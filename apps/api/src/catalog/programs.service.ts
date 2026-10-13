import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { UniversitiesService } from './universities.service';
import { CreateProgramDto, SearchProgramsQuery, UpdateProgramDto } from './dto/program.dto';
import { generateUniqueSlug } from './slug.util';

const include = {
  university: { select: { id: true, name: true, slug: true, city: true, isPublic: true, country: { select: { id: true, name: true, slug: true, flagEmoji: true } } } },
} satisfies Prisma.ProgramInclude;

type ProgramWithUniversity = Prisma.ProgramGetPayload<{ include: typeof include }>;

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly universities: UniversitiesService,
    private readonly audit: AuditService,
  ) {}

  /** Recherche filtrée (Phase 4, section 10) — utilisée par l'admin ET le site public. */
  async search(organizationId: string, q: SearchProgramsQuery): Promise<Paginated<ProgramWithUniversity>> {
    const where: Prisma.ProgramWhereInput = {
      organizationId,
      deletedAt: null,
      ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      ...(q.universityId ? { universityId: q.universityId } : {}),
      ...(q.level ? { level: q.level } : {}),
      ...(q.domain ? { domain: { contains: q.domain, mode: 'insensitive' } } : {}),
      ...(q.language ? { language: { contains: q.language, mode: 'insensitive' } } : {}),
      ...(q.intake ? { intake: { contains: q.intake, mode: 'insensitive' } } : {}),
      ...(q.maxBudget !== undefined ? { tuitionFees: { lte: q.maxBudget } } : {}),
      // Un candidat avec ce score IELTS est éligible si le programme n'exige rien, ou exige au plus ce score.
      ...(q.ielts !== undefined ? { OR: [{ minIelts: null }, { minIelts: { lte: q.ielts } }] } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
      university: {
        deletedAt: null,
        ...(q.countryId ? { countryId: q.countryId } : {}),
        ...(q.city ? { city: { contains: q.city, mode: 'insensitive' } } : {}),
        ...(q.isPublic === 'true' ? { isPublic: true } : q.isPublic === 'false' ? { isPublic: false } : {}),
      },
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.program.count({ where }),
      this.prisma.program.findMany({ where, include, orderBy: { name: 'asc' }, ...skipTake(q) }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(actor: AuthUser, id: string) {
    const found = await this.prisma.program.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null }, include });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Programme introuvable');
    return found;
  }

  async assertBelongs(organizationId: string, id: string): Promise<void> {
    const found = await this.prisma.program.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Programme introuvable');
  }

  /** Jusqu'à 4 programmes, pour le comparateur (section 30). */
  async compare(organizationId: string, ids: string[]) {
    return this.prisma.program.findMany({ where: { id: { in: ids.slice(0, 4) }, organizationId, deletedAt: null }, include });
  }

  async create(actor: AuthUser, dto: CreateProgramDto, meta: RequestMeta) {
    await this.universities.assertBelongs(actor.organizationId, dto.universityId);
    const slug = await generateUniqueSlug(dto.slug ?? dto.name, (s) =>
      this.prisma.program.count({ where: { organizationId: actor.organizationId, slug: s } }).then((n) => n > 0),
    );
    const created = await this.prisma.program.create({
      data: {
        organizationId: actor.organizationId,
        ...dto,
        slug,
        openDate: dto.openDate ? new Date(dto.openDate) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
      include,
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.program.create', entity: 'Program', entityId: created.id, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateProgramDto, meta: RequestMeta) {
    await this.get(actor, id);
    if (dto.universityId) await this.universities.assertBelongs(actor.organizationId, dto.universityId);
    const updated = await this.prisma.program.update({
      where: { id },
      data: { ...dto, openDate: dto.openDate ? new Date(dto.openDate) : undefined, deadline: dto.deadline ? new Date(dto.deadline) : undefined },
      include,
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.program.update', entity: 'Program', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    await this.get(actor, id);
    await this.prisma.program.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.program.delete', entity: 'Program', entityId: id, meta });
  }
}
