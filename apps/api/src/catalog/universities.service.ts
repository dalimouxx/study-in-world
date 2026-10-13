import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { CountriesService } from './countries.service';
import { CreateUniversityDto, ListUniversitiesQuery, UpdateUniversityDto } from './dto/university.dto';
import { generateUniqueSlug } from './slug.util';

const include = { country: { select: { id: true, name: true, slug: true, flagEmoji: true } } } satisfies Prisma.UniversityInclude;

@Injectable()
export class UniversitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly countries: CountriesService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListUniversitiesQuery): Promise<Paginated<Prisma.UniversityGetPayload<{ include: typeof include }>>> {
    const where: Prisma.UniversityWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      ...(q.countryId ? { countryId: q.countryId } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { city: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.university.count({ where }),
      this.prisma.university.findMany({ where, include, orderBy: { name: 'asc' }, ...skipTake(q) }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(actor: AuthUser, id: string) {
    const found = await this.prisma.university.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null }, include });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Université introuvable');
    return found;
  }

  async assertBelongs(organizationId: string, id: string): Promise<void> {
    const found = await this.prisma.university.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Université introuvable');
  }

  async create(actor: AuthUser, dto: CreateUniversityDto, meta: RequestMeta) {
    await this.countries.assertBelongs(actor.organizationId, dto.countryId);
    const slug = await generateUniqueSlug(dto.slug ?? dto.name, (s) =>
      this.prisma.university.count({ where: { organizationId: actor.organizationId, slug: s } }).then((n) => n > 0),
    );
    const created = await this.prisma.university.create({ data: { organizationId: actor.organizationId, ...dto, slug }, include });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.university.create', entity: 'University', entityId: created.id, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateUniversityDto, meta: RequestMeta) {
    await this.get(actor, id);
    if (dto.countryId) await this.countries.assertBelongs(actor.organizationId, dto.countryId);
    const updated = await this.prisma.university.update({ where: { id }, data: dto, include });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.university.update', entity: 'University', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    await this.get(actor, id);
    await this.prisma.university.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.university.delete', entity: 'University', entityId: id, meta });
  }
}
