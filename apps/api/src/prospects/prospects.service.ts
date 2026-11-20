import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, ProspectStatus, TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { AddNoteDto, CreateProspectDto, ListProspectsQuery, UpdateProspectDto } from './dto/prospect.dto';

const include = {
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  branch: { select: { id: true, name: true } },
  desiredCountry: { select: { id: true, name: true, flagEmoji: true } },
} satisfies Prisma.ProspectInclude;

type ProspectWithRelations = Prisma.ProspectGetPayload<{ include: typeof include }>;
export type LeadCategory = 'hot' | 'warm' | 'cold';

/**
 * Score /100 (section 14) : aide le conseiller à prioriser, ne convertit jamais rien automatiquement.
 * Basé uniquement sur des champs directement disponibles sur le prospect (pas de jointure coûteuse sur la
 * chronologie) — un raffinement futur pourrait pondérer aussi le nombre d'appels/messages échangés.
 */
export function computeLeadScore(p: { budget: number | null; desiredCountryId: string | null; desiredProgram: string | null; email: string | null; assignedToId: string | null; status: ProspectStatus; nextFollowUpAt: Date | null }): { score: number; category: LeadCategory } {
  let score = 0;
  if (p.budget && p.budget > 0) score += 20;
  if (p.desiredCountryId || p.desiredProgram) score += 20;
  if (p.email) score += 15;
  if (p.assignedToId) score += 15;
  if (p.status === 'QUALIFIED') score += 15;
  else if (p.status === 'CONTACTED') score += 8;
  if (p.nextFollowUpAt) {
    score += p.nextFollowUpAt.getTime() >= Date.now() ? 15 : -10;
  }
  score = Math.max(0, Math.min(100, score));
  const category: LeadCategory = score >= 65 ? 'hot' : score >= 35 ? 'warm' : 'cold';
  return { score, category };
}

const withScore = <T extends { budget: number | null; desiredCountryId: string | null; desiredProgram: string | null; email: string | null; assignedToId: string | null; status: ProspectStatus; nextFollowUpAt: Date | null }>(p: T) => ({ ...p, ...computeLeadScore(p) });

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  async list(actor: AuthUser, q: ListProspectsQuery): Promise<Paginated<ReturnType<typeof withScore>>> {
    const where = this.buildWhere(actor, q);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.prospect.count({ where }),
      this.prisma.prospect.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
    ]);
    return { items: items.map(withScore), total, page: q.page, pageSize: q.pageSize };
  }

  /** Même filtre que list(), sans pagination — pour l'export. */
  async listForExport(actor: AuthUser, q: ListProspectsQuery) {
    const items = await this.prisma.prospect.findMany({ where: this.buildWhere(actor, q), include, orderBy: { createdAt: 'desc' }, take: 5000 });
    return items.map(withScore);
  }

  private buildWhere(actor: AuthUser, q: ListProspectsQuery): Prisma.ProspectWhereInput {
    return {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.assignedToId ? { assignedToId: q.assignedToId } : {}),
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /** Vue Kanban (section 12) : tous les prospects actifs (jamais perdus/convertis), sans pagination. */
  async board(actor: AuthUser) {
    const items = await this.prisma.prospect.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null, status: { notIn: ['CONVERTED', 'LOST'] } },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return items.map(withScore);
  }

  async get(actor: AuthUser, id: string) {
    const found = await this.prisma.prospect.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null }, include });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Prospect introuvable');
    return withScore(found);
  }

  /** Détecte les doublons potentiels (même numéro de téléphone) avant création. */
  async findDuplicates(actor: AuthUser, phone: string) {
    const [prospects, candidates] = await Promise.all([
      this.prisma.prospect.findMany({
        where: { organizationId: actor.organizationId, phone, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, status: true },
      }),
      this.prisma.candidate.findMany({
        where: { organizationId: actor.organizationId, phone, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, status: true },
      }),
    ]);
    return { prospects, candidates };
  }

  async create(actor: AuthUser, dto: CreateProspectDto, meta: RequestMeta) {
    if (!dto.force) {
      const dup = await this.findDuplicates(actor, dto.phone);
      if (dup.prospects.length > 0 || dup.candidates.length > 0) {
        throw apiError(HttpStatus.CONFLICT, 'DUPLICATE_CONTACT', 'Un contact avec ce numéro existe déjà');
      }
    }
    const created = await this.prisma.prospect.create({
      data: {
        organizationId: actor.organizationId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        city: dto.city,
        desiredCountryId: dto.desiredCountryId,
        desiredProgram: dto.desiredProgram,
        budget: dto.budget,
        campaign: dto.campaign,
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined,
        source: dto.source,
        notes: dto.notes,
        branchId: dto.branchId ?? actor.branchId,
        assignedToId: dto.assignedToId ?? actor.id,
      },
      include,
    });
    await this.timeline.add(actor.organizationId, 'PROSPECT', created.id, TimelineType.SYSTEM, 'Prospect créé', actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'prospect.create', entity: 'Prospect', entityId: created.id, meta });
    return withScore(created);
  }

  async update(actor: AuthUser, id: string, dto: UpdateProspectDto, meta: RequestMeta) {
    const before = await this.get(actor, id);
    const updated = await this.prisma.prospect.update({
      where: { id },
      data: { ...dto, nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined },
      include,
    });
    if (dto.status && dto.status !== before.status) {
      await this.timeline.add(
        actor.organizationId,
        'PROSPECT',
        id,
        TimelineType.STATUS_CHANGE,
        `Statut : ${before.status} → ${dto.status}`,
        actor.id,
      );
    }
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'prospect.update', entity: 'Prospect', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return withScore(updated);
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    await this.get(actor, id);
    await this.prisma.prospect.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'prospect.delete', entity: 'Prospect', entityId: id, meta });
  }

  async addNote(actor: AuthUser, id: string, dto: AddNoteDto) {
    await this.get(actor, id);
    return this.timeline.add(actor.organizationId, 'PROSPECT', id, TimelineType.NOTE, dto.content, actor.id);
  }

  timelineFor(actor: AuthUser, id: string, page: number, pageSize: number) {
    return this.timeline.list(actor.organizationId, 'PROSPECT', id, page, pageSize);
  }

  /** Conversion : crée le candidat, marque le prospect CONVERTED et lie les deux enregistrements. */
  async convert(actor: AuthUser, id: string, meta: RequestMeta) {
    const prospect = await this.get(actor, id);
    if (prospect.status === 'CONVERTED') {
      throw apiError(HttpStatus.CONFLICT, 'ALREADY_CONVERTED', 'Ce prospect a déjà été converti');
    }
    const candidate = await this.prisma.$transaction(async (tx) => {
      const created = await tx.candidate.create({
        data: {
          organizationId: actor.organizationId,
          branchId: prospect.branchId,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          phone: prospect.phone,
          email: prospect.email,
          assignedToId: prospect.assignedToId ?? actor.id,
        },
      });
      await tx.prospect.update({ where: { id }, data: { status: 'CONVERTED', convertedCandidateId: created.id } });
      return created;
    });
    await this.timeline.add(actor.organizationId, 'PROSPECT', id, TimelineType.SYSTEM, 'Converti en candidat', actor.id);
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidate.id, TimelineType.SYSTEM, 'Créé à partir d’un prospect', actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'prospect.convert', entity: 'Prospect', entityId: id, metadata: { candidateId: candidate.id }, meta });
    return candidate;
  }
}
