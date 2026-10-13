import { HttpStatus, Injectable } from '@nestjs/common';
import { TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { AutomationEngineService } from '../automation/automation-engine.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CandidatesService } from '../candidates/candidates.service';
import { ProgramsService } from '../catalog/programs.service';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';

const include = { catalogProgram: { include: { university: { include: { country: true } } } } };

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly programs: ProgramsService,
    private readonly automation: AutomationEngineService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  async list(actor: AuthUser, candidateId: string) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    return this.prisma.application.findMany({ where: { organizationId: actor.organizationId, candidateId }, include, orderBy: { createdAt: 'desc' } });
  }

  async create(actor: AuthUser, candidateId: string, dto: CreateApplicationDto, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);

    let country = dto.country;
    let university = dto.university;
    let program = dto.program;
    let deadline = dto.deadline ? new Date(dto.deadline) : undefined;

    if (dto.programId) {
      const catalog = await this.programs.get(actor, dto.programId);
      country ??= catalog.university.country.name;
      university ??= catalog.university.name;
      program ??= catalog.name;
      deadline ??= catalog.deadline ?? undefined;
    }
    if (!country || !university || !program) {
      throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Choisissez un programme du catalogue ou renseignez pays/université/programme manuellement');
    }

    const created = await this.prisma.application.create({
      data: {
        organizationId: actor.organizationId,
        candidateId,
        programId: dto.programId,
        intake: dto.intake,
        notes: dto.notes,
        country,
        university,
        program,
        deadline,
        createdById: actor.id,
      },
      include,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, TimelineType.SYSTEM, `Candidature créée : ${university} (${program})`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'application.create', entity: 'Application', entityId: created.id, metadata: { candidateId }, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateApplicationDto, meta: RequestMeta) {
    const before = await this.find(actor, id);
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        ...dto,
        submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
        decisionAt: dto.decisionAt ? new Date(dto.decisionAt) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
    if (dto.status && dto.status !== before.status) {
      await this.timeline.add(actor.organizationId, 'CANDIDATE', before.candidateId, TimelineType.STATUS_CHANGE, `Candidature ${before.university} : ${before.status} → ${dto.status}`, actor.id);
      await this.automation.fire(actor.organizationId, 'APPLICATION_STATUS_CHANGED', dto.status, before.candidateId, actor.id);
    }
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'application.update', entity: 'Application', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    const app = await this.find(actor, id);
    await this.prisma.application.delete({ where: { id } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'application.delete', entity: 'Application', entityId: id, metadata: { candidateId: app.candidateId }, meta });
  }

  private async find(actor: AuthUser, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!app) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidature introuvable');
    return app;
  }
}
