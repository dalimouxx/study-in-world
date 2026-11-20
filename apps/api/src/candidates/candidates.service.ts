import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { AddNoteDto, CreateCandidateDto, ListCandidatesQuery, UpdateCandidateDto } from './dto/candidate.dto';

const include = {
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  branch: { select: { id: true, name: true } },
  partner: { select: { id: true, companyName: true, type: true } },
  _count: { select: { applications: true, visaFiles: true, documents: { where: { deletedAt: null } } } },
} satisfies Prisma.CandidateInclude;

type CandidateWithRelations = Prisma.CandidateGetPayload<{ include: typeof include }>;

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  async list(actor: AuthUser, q: ListCandidatesQuery): Promise<Paginated<CandidateWithRelations>> {
    const where = this.buildWhere(actor, q);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.candidate.count({ where }),
      this.prisma.candidate.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  /** Même filtre que list(), sans pagination — pour l'export (section « jamais construit »). Plafonné pour rester sûr même sur une très grosse agence. */
  async listForExport(actor: AuthUser, q: ListCandidatesQuery): Promise<CandidateWithRelations[]> {
    return this.prisma.candidate.findMany({ where: this.buildWhere(actor, q), include, orderBy: { createdAt: 'desc' }, take: 5000 });
  }

  private buildWhere(actor: AuthUser, q: ListCandidatesQuery): Prisma.CandidateWhereInput {
    return {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.assignedToId ? { assignedToId: q.assignedToId } : {}),
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
              { passportNumber: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  async get(actor: AuthUser, id: string): Promise<CandidateWithRelations> {
    const found = await this.prisma.candidate.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null }, include });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');
    return found;
  }

  /** Vérifie qu'un candidat appartient à l'organisation de l'appelant ; utilisé par les modules dépendants (documents, finance…). */
  async assertBelongs(organizationId: string, candidateId: string): Promise<void> {
    const found = await this.prisma.candidate.findFirst({ where: { id: candidateId, organizationId, deletedAt: null }, select: { id: true } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');
  }

  async create(actor: AuthUser, dto: CreateCandidateDto, meta: RequestMeta): Promise<CandidateWithRelations> {
    const created = await this.prisma.candidate.create({
      data: {
        organizationId: actor.organizationId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        nationality: dto.nationality,
        passportNumber: dto.passportNumber,
        branchId: dto.branchId ?? actor.branchId,
        assignedToId: dto.assignedToId ?? actor.id,
      },
      include,
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', created.id, TimelineType.SYSTEM, 'Candidat créé', actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'candidate.create', entity: 'Candidate', entityId: created.id, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateCandidateDto, meta: RequestMeta): Promise<CandidateWithRelations> {
    const before = await this.get(actor, id);
    if (dto.partnerId) {
      const partner = await this.prisma.partner.findFirst({ where: { id: dto.partnerId, organizationId: actor.organizationId, deletedAt: null }, select: { id: true } });
      if (!partner) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Partenaire introuvable');
    }
    const updated = await this.prisma.candidate.update({
      where: { id },
      data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined },
      include,
    });
    if (dto.status && dto.status !== before.status) {
      await this.timeline.add(actor.organizationId, 'CANDIDATE', id, TimelineType.STATUS_CHANGE, `Statut : ${before.status} → ${dto.status}`, actor.id);
    }
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'candidate.update', entity: 'Candidate', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    await this.get(actor, id);
    await this.prisma.candidate.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'candidate.delete', entity: 'Candidate', entityId: id, meta });
  }

  async addNote(actor: AuthUser, id: string, dto: AddNoteDto) {
    await this.get(actor, id);
    return this.timeline.add(actor.organizationId, 'CANDIDATE', id, TimelineType.NOTE, dto.content, actor.id);
  }

  timelineFor(actor: AuthUser, id: string, page: number, pageSize: number) {
    return this.timeline.list(actor.organizationId, 'CANDIDATE', id, page, pageSize);
  }
}
