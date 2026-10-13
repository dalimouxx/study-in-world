import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { FinanceService } from '../finance/finance.service';
import { MessagesService } from '../messages/messages.service';
import { StorageService } from '../storage/storage.service';
import { TimelineService } from '../timeline/timeline.service';
import { apiError } from '../common/errors/api-error';
import type { CandidateAuthUser } from '../common/auth-user';
import { PortalUploadDocumentDto, UpdatePortalProfileDto } from './dto/portal.dto';
import type { SignContractDto } from '../contracts/dto/contract.dto';

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/**
 * Toutes les méthodes sont bornées à `candidate.id` (jamais un paramètre d'URL) : un candidat authentifié ne
 * peut techniquement pas demander les données d'un autre, il n'y a même pas de champ id à falsifier.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly timelineService: TimelineService,
    private readonly finance: FinanceService,
    private readonly messages: MessagesService,
    private readonly contractsService: ContractsService,
  ) {}

  profile(candidate: CandidateAuthUser) {
    return this.prisma.candidate.findFirstOrThrow({
      where: { id: candidate.id, organizationId: candidate.organizationId },
      select: {
        id: true, firstName: true, lastName: true, phone: true, email: true, birthDate: true,
        nationality: true, passportNumber: true, status: true, createdAt: true,
      },
    });
  }

  async updateProfile(candidate: CandidateAuthUser, dto: UpdatePortalProfileDto) {
    return this.prisma.candidate.update({
      where: { id: candidate.id },
      data: dto,
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, nationality: true },
    });
  }

  documents(candidate: CandidateAuthUser) {
    return this.prisma.candidateDocument.findMany({
      where: { candidateId: candidate.id, deletedAt: null },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
    });
  }

  async uploadDocument(candidate: CandidateAuthUser, dto: PortalUploadDocumentDto, file: { buffer: Buffer; mimetype: string; size: number }) {
    if (!ALLOWED_MIME.has(file.mimetype)) throw apiError(HttpStatus.BAD_REQUEST, 'UNSUPPORTED_FILE_TYPE', 'Type de fichier non pris en charge (PDF, JPEG, PNG, WEBP uniquement)');
    if (file.size > MAX_SIZE) throw apiError(HttpStatus.BAD_REQUEST, 'FILE_TOO_LARGE', 'Fichier trop volumineux (15 Mo maximum)');

    const lastVersion = await this.prisma.candidateDocument.findFirst({
      where: { candidateId: candidate.id, type: dto.type, deletedAt: null },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const filePath = await this.storage.save(candidate.organizationId, file.buffer);
    const doc = await this.prisma.candidateDocument.create({
      data: {
        organizationId: candidate.organizationId,
        candidateId: candidate.id,
        type: dto.type,
        label: dto.label,
        version: (lastVersion?.version ?? 0) + 1,
        filePath,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
    await this.timelineService.add(candidate.organizationId, 'CANDIDATE', candidate.id, 'DOCUMENT', `Document déposé par le candidat : ${dto.label} (v${doc.version})`);
    return doc;
  }

  async downloadDocument(candidate: CandidateAuthUser, id: string) {
    const doc = await this.prisma.candidateDocument.findFirst({ where: { id, candidateId: candidate.id, deletedAt: null } });
    if (!doc) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Document introuvable');
    const buffer = await this.storage.read(candidate.organizationId, doc.filePath);
    return { buffer, mimeType: doc.mimeType, filename: doc.label };
  }

  checklist(candidate: CandidateAuthUser) {
    return this.prisma.checklistItem.findMany({ where: { candidateId: candidate.id }, orderBy: { position: 'asc' } });
  }

  applications(candidate: CandidateAuthUser) {
    return this.prisma.application.findMany({ where: { candidateId: candidate.id }, orderBy: { createdAt: 'desc' } });
  }

  visaFiles(candidate: CandidateAuthUser) {
    return this.prisma.visaFile.findMany({ where: { candidateId: candidate.id }, orderBy: { createdAt: 'desc' } });
  }

  /** Lecture seule : le candidat voit sa progression mais ne modifie pas la checklist visa lui-même. */
  async visaChecklist(candidate: CandidateAuthUser, visaFileId: string) {
    const visaFile = await this.prisma.visaFile.findFirst({ where: { id: visaFileId, candidateId: candidate.id } });
    if (!visaFile) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Dossier visa introuvable');
    return this.prisma.checklistItem.findMany({ where: { visaFileId }, orderBy: { position: 'asc' } });
  }

  quotes(candidate: CandidateAuthUser) {
    return this.prisma.quote.findMany({ where: { candidateId: candidate.id }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  }

  invoices(candidate: CandidateAuthUser) {
    return this.prisma.invoice.findMany({ where: { candidateId: candidate.id }, include: { items: true, payments: true }, orderBy: { createdAt: 'desc' } });
  }

  invoicePdf(candidate: CandidateAuthUser, invoiceId: string) {
    return this.finance.invoicePdfForCandidate(candidate.organizationId, candidate.id, invoiceId);
  }

  appointments(candidate: CandidateAuthUser) {
    return this.prisma.appointment.findMany({
      where: { organizationId: candidate.organizationId, relatedType: 'CANDIDATE', relatedId: candidate.id, startAt: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Chronologie filtrée : jamais les notes internes (type NOTE), qui peuvent contenir des remarques destinées
   * uniquement à l'équipe. Seuls les événements auto-générés (statut, document, système) sont montrés.
   */
  async timeline(candidate: CandidateAuthUser) {
    const entries = await this.prisma.timelineEntry.findMany({
      where: { organizationId: candidate.organizationId, entityType: 'CANDIDATE', entityId: candidate.id, type: { in: ['STATUS_CHANGE', 'DOCUMENT', 'SYSTEM'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return entries;
  }

  async messagesList(candidate: CandidateAuthUser) {
    const list = await this.messages.list(candidate.organizationId, candidate.id);
    await this.messages.markReadByCandidate(candidate.organizationId, candidate.id);
    return list;
  }

  sendMessage(candidate: CandidateAuthUser, content: string) {
    return this.messages.sendFromCandidate(candidate.organizationId, candidate.id, content);
  }

  contracts(candidate: CandidateAuthUser) {
    return this.contractsService.list(candidate.organizationId, candidate.id);
  }

  contractPdf(candidate: CandidateAuthUser, id: string) {
    return this.contractsService.pdf(candidate.organizationId, id);
  }

  /** Signature à distance, depuis le portail : mêmes règles que la signature en présentiel côté employé. */
  signContract(candidate: CandidateAuthUser, id: string, dto: SignContractDto) {
    return this.contractsService.sign(candidate.organizationId, candidate.id, id, dto, {});
  }
}
