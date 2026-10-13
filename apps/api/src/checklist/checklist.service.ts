import { HttpStatus, Injectable } from '@nestjs/common';
import { TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CandidatesService } from '../candidates/candidates.service';
import { CreateChecklistItemDto, ReorderChecklistDto, UpdateChecklistItemDto } from './dto/checklist.dto';

/** Pièces standard d'un dossier visa (section 22) — pré-remplies à l'ouverture, modifiables ensuite comme les autres. */
export const DEFAULT_VISA_CHECKLIST = [
  'Formulaire de demande de visa rempli',
  'Passeport valide (6 mois minimum)',
  'Photo d’identité aux normes',
  'Lettre d’admission de l’université',
  'Preuve de logement',
  'Assurance santé / voyage',
  'Preuve de ressources financières',
  'Rendez-vous au centre visa pris',
];

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  /** Checklist générale du candidat : exclut explicitement les éléments propres à un dossier visa précis. */
  async list(actor: AuthUser, candidateId: string) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    return this.prisma.checklistItem.findMany({ where: { organizationId: actor.organizationId, candidateId, visaFileId: null }, orderBy: { position: 'asc' } });
  }

  async create(actor: AuthUser, candidateId: string, dto: CreateChecklistItemDto) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const last = await this.prisma.checklistItem.findFirst({ where: { organizationId: actor.organizationId, candidateId, visaFileId: null }, orderBy: { position: 'desc' } });
    return this.prisma.checklistItem.create({
      data: { organizationId: actor.organizationId, candidateId, label: dto.label, position: (last?.position ?? -1) + 1 },
    });
  }

  listForVisa(organizationId: string, visaFileId: string) {
    return this.prisma.checklistItem.findMany({ where: { organizationId, visaFileId }, orderBy: { position: 'asc' } });
  }

  async createForVisa(actor: AuthUser, visaFileId: string, label: string) {
    const visaFile = await this.prisma.visaFile.findFirst({ where: { id: visaFileId, organizationId: actor.organizationId } });
    if (!visaFile) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Dossier visa introuvable');
    const last = await this.prisma.checklistItem.findFirst({ where: { organizationId: actor.organizationId, visaFileId }, orderBy: { position: 'desc' } });
    return this.prisma.checklistItem.create({
      data: { organizationId: actor.organizationId, candidateId: visaFile.candidateId, visaFileId, label, position: (last?.position ?? -1) + 1 },
    });
  }

  /** Appelé une fois à l'ouverture du dossier visa (voir VisaService.create). */
  seedDefaultVisaChecklist(organizationId: string, candidateId: string, visaFileId: string) {
    return this.prisma.checklistItem.createMany({
      data: DEFAULT_VISA_CHECKLIST.map((label, position) => ({ organizationId, candidateId, visaFileId, label, position })),
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateChecklistItemDto, meta: RequestMeta) {
    const item = await this.find(actor, id);
    const updated = await this.prisma.checklistItem.update({ where: { id }, data: dto });
    if (dto.status && dto.status !== item.status) {
      const context = item.visaFileId ? 'Checklist visa' : 'Checklist';
      await this.timeline.add(actor.organizationId, 'CANDIDATE', item.candidateId, TimelineType.SYSTEM, `${context} « ${item.label} » : ${dto.status}`, actor.id);
      await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'checklist.update', entity: 'ChecklistItem', entityId: id, metadata: { status: dto.status }, meta });
    }
    return updated;
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    await this.find(actor, id);
    await this.prisma.checklistItem.delete({ where: { id } });
  }

  async reorder(actor: AuthUser, candidateId: string, dto: ReorderChecklistDto): Promise<void> {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.checklistItem.update({ where: { id: i.id }, data: { position: i.position } }),
      ),
    );
  }

  private async find(actor: AuthUser, id: string) {
    const item = await this.prisma.checklistItem.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!item) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Élément de checklist introuvable');
    return item;
  }
}
