import { HttpStatus, Injectable } from '@nestjs/common';
import { TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { AutomationEngineService } from '../automation/automation-engine.service';
import { ChecklistService } from '../checklist/checklist.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CandidatesService } from '../candidates/candidates.service';
import { CreateVisaFileDto, UpdateVisaFileDto } from './dto/visa.dto';

@Injectable()
export class VisaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly automation: AutomationEngineService,
    private readonly checklist: ChecklistService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  async list(actor: AuthUser, candidateId: string) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    return this.prisma.visaFile.findMany({ where: { organizationId: actor.organizationId, candidateId }, orderBy: { createdAt: 'desc' } });
  }

  /** Ouvre le dossier et pré-remplit sa checklist avec les pièces standard (section 22). */
  async create(actor: AuthUser, candidateId: string, dto: CreateVisaFileDto, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const created = await this.prisma.visaFile.create({ data: { organizationId: actor.organizationId, candidateId, ...dto } });
    await this.checklist.seedDefaultVisaChecklist(actor.organizationId, candidateId, created.id);
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, TimelineType.SYSTEM, `Dossier visa ouvert : ${dto.country}`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'visa.create', entity: 'VisaFile', entityId: created.id, metadata: { candidateId }, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateVisaFileDto, meta: RequestMeta) {
    const before = await this.find(actor, id);
    const updated = await this.prisma.visaFile.update({
      where: { id },
      data: {
        ...dto,
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : undefined,
        submissionDate: dto.submissionDate ? new Date(dto.submissionDate) : undefined,
      },
    });
    if (dto.status && dto.status !== before.status) {
      await this.timeline.add(actor.organizationId, 'CANDIDATE', before.candidateId, TimelineType.STATUS_CHANGE, `Visa ${before.country} : ${before.status} → ${dto.status}`, actor.id);
      await this.automation.fire(actor.organizationId, 'VISA_STATUS_CHANGED', dto.status, before.candidateId, actor.id);
    }
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'visa.update', entity: 'VisaFile', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  private async find(actor: AuthUser, id: string) {
    const file = await this.prisma.visaFile.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!file) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Dossier visa introuvable');
    return file;
  }
}
