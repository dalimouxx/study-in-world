import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { CounterService } from '../common/services/counter.service';
import { StorageService } from '../storage/storage.service';
import { PdfService } from '../finance/pdf/pdf.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CandidatesService } from '../candidates/candidates.service';
import { ContractItemDto, CreateContractDto, SignContractDto } from './dto/contract.dto';

const DEFAULT_TEMPLATE = `Entre l'agence {{agency_name}}, d'une part,
et {{candidate_name}}, titulaire du passeport {{candidate_passport}}, ci-après « le candidat », d'autre part,

il a été convenu ce qui suit :

L'agence s'engage à fournir au candidat les services suivants :
{{services}}

Montant total : {{total}} {{currency}}

Fait le {{date}}, référence {{number}}.`;

const total = (items: { quantity: number; unitPrice: number }[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly counter: CounterService,
    private readonly storage: StorageService,
    private readonly pdfService: PdfService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  list(organizationId: string, candidateId: string) {
    return this.prisma.contract.findMany({ where: { organizationId, candidateId }, orderBy: { createdAt: 'desc' } });
  }

  async get(organizationId: string, id: string) {
    const found = await this.prisma.contract.findFirst({ where: { id, organizationId } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Contrat introuvable');
    return found;
  }

  async create(actor: AuthUser, candidateId: string, dto: CreateContractDto, meta: RequestMeta) {
    const candidate = await this.prisma.candidate.findFirst({ where: { id: candidateId, organizationId: actor.organizationId, deletedAt: null } });
    if (!candidate) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');

    let items: ContractItemDto[];
    if (dto.quoteId) {
      const quote = await this.prisma.quote.findFirst({ where: { id: dto.quoteId, organizationId: actor.organizationId, candidateId }, include: { items: true } });
      if (!quote) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Devis introuvable');
      items = quote.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice }));
    } else if (dto.items?.length) {
      items = dto.items;
    } else {
      throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Fournissez un devis existant ou des lignes de prestation');
    }

    const settings = await this.prisma.agencySettings.findUnique({ where: { organizationId: actor.organizationId } });
    const number = await this.counter.next(actor.organizationId, 'contract', 'CTR');
    const amount = total(items);
    const currency = settings?.currency ?? 'TND';
    const content = this.render(settings?.contractTemplate ?? DEFAULT_TEMPLATE, {
      agency_name: settings?.name ?? 'Study in World',
      candidate_name: `${candidate.firstName} ${candidate.lastName}`,
      candidate_passport: candidate.passportNumber ?? '—',
      services: items.map((i) => `- ${i.label} × ${i.quantity} : ${(i.quantity * i.unitPrice).toFixed(3)} ${currency}`).join('\n'),
      total: amount.toFixed(3),
      currency,
      date: new Date().toLocaleDateString('fr-TN'),
      number,
    });

    const created = await this.prisma.contract.create({
      data: { organizationId: actor.organizationId, candidateId, quoteId: dto.quoteId, number, content, totalAmount: amount, currency, createdById: actor.id },
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, 'SYSTEM', `Contrat ${number} créé (${amount.toFixed(3)} ${currency})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'contract.create', entity: 'Contract', entityId: created.id, metadata: { candidateId, number }, meta });
    return created;
  }

  async setStatus(actor: AuthUser, id: string, status: 'SENT' | 'CANCELLED', meta: RequestMeta) {
    const contract = await this.get(actor.organizationId, id);
    if (contract.status === 'SIGNED') throw apiError(HttpStatus.CONFLICT, 'CONTRACT_SIGNED', 'Un contrat déjà signé ne peut plus être modifié');
    const updated = await this.prisma.contract.update({ where: { id }, data: { status } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'contract.status', entity: 'Contract', entityId: id, metadata: { status }, meta });
    return updated;
  }

  /** Utilisé aussi bien par un employé (signature en présentiel) que par le candidat lui-même (portail). */
  async sign(organizationId: string, candidateId: string, id: string, dto: SignContractDto, meta: RequestMeta, actorUserId?: string): Promise<void> {
    const contract = await this.prisma.contract.findFirst({ where: { id, organizationId, candidateId } });
    if (!contract) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Contrat introuvable');
    if (contract.status === 'SIGNED') throw apiError(HttpStatus.CONFLICT, 'CONTRACT_SIGNED', 'Ce contrat est déjà signé');
    if (contract.status === 'CANCELLED') throw apiError(HttpStatus.CONFLICT, 'CONTRACT_CANCELLED', 'Ce contrat est annulé');

    const base64 = dto.signatureImage.replace(/^data:image\/\w+;base64,/, '');
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
      if (buffer.length === 0) throw new Error('empty');
    } catch {
      throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_SIGNATURE', 'Signature invalide');
    }
    const signaturePath = await this.storage.save(organizationId, buffer);

    await this.prisma.contract.update({
      where: { id },
      data: { status: 'SIGNED', signedAt: new Date(), signerName: dto.signerName, signatureMethod: dto.method, signatureImage: signaturePath },
    });
    await this.timeline.add(organizationId, 'CANDIDATE', candidateId, 'SYSTEM', `Contrat ${contract.number} signé par ${dto.signerName}`, actorUserId);
    await this.audit.log({ organizationId, userId: actorUserId, action: 'contract.sign', entity: 'Contract', entityId: id, metadata: { signerName: dto.signerName, method: dto.method }, meta });
  }

  async pdf(organizationId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({ where: { id, organizationId } });
    if (!contract) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Contrat introuvable');
    const settings = await this.prisma.agencySettings.findUnique({ where: { organizationId } });
    const signature = contract.signatureImage
      ? { image: await this.storage.read(organizationId, contract.signatureImage), signerName: contract.signerName ?? '', signedAt: contract.signedAt ?? new Date() }
      : null;
    const buffer = await this.pdfService.contract(
      { number: contract.number, date: contract.createdAt, agency: { name: settings?.name ?? 'Study in World', address: settings?.address } },
      contract.content,
      signature,
    );
    return { buffer, filename: `${contract.number}.pdf` };
  }

  private render(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), template);
  }
}
