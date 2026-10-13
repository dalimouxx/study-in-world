import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { CreateCountryDto, ListCountriesQuery, UpdateCountryDto } from './dto/country.dto';
import { generateUniqueSlug } from './slug.util';

@Injectable()
export class CountriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListCountriesQuery): Promise<Paginated<Prisma.CountryGetPayload<object>>> {
    const where: Prisma.CountryWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.country.count({ where }),
      this.prisma.country.findMany({ where, orderBy: { name: 'asc' }, ...skipTake(q) }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(actor: AuthUser, id: string) {
    const found = await this.prisma.country.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Pays introuvable');
    return found;
  }

  async assertBelongs(organizationId: string, id: string): Promise<void> {
    const found = await this.prisma.country.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Pays introuvable');
  }

  async create(actor: AuthUser, dto: CreateCountryDto, meta: RequestMeta) {
    const slug = await generateUniqueSlug(dto.slug ?? dto.name, (s) =>
      this.prisma.country.count({ where: { organizationId: actor.organizationId, slug: s } }).then((n) => n > 0),
    );
    const created = await this.prisma.country.create({ data: { organizationId: actor.organizationId, ...dto, slug } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.country.create', entity: 'Country', entityId: created.id, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateCountryDto, meta: RequestMeta) {
    await this.get(actor, id);
    const updated = await this.prisma.country.update({ where: { id }, data: dto });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.country.update', entity: 'Country', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    await this.get(actor, id);
    await this.prisma.country.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'catalog.country.delete', entity: 'Country', entityId: id, meta });
  }
}
