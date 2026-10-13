import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { CreatePartnerDto, ListPartnersQuery, UpdatePartnerDto } from './dto/partner.dto';

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListPartnersQuery): Promise<Paginated<Prisma.PartnerGetPayload<object>>> {
    const where: Prisma.PartnerWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      ...(q.type ? { type: q.type } : {}),
      ...(q.search ? { companyName: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.partner.count({ where }),
      this.prisma.partner.findMany({ where, orderBy: { companyName: 'asc' }, ...skipTake(q) }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(actor: AuthUser, id: string) {
    const found = await this.prisma.partner.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Partenaire introuvable');
    return found;
  }

  async assertBelongs(organizationId: string, id: string): Promise<void> {
    const found = await this.prisma.partner.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Partenaire introuvable');
  }

  async create(actor: AuthUser, dto: CreatePartnerDto, meta: RequestMeta) {
    const created = await this.prisma.partner.create({ data: { organizationId: actor.organizationId, ...dto } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'partner.create', entity: 'Partner', entityId: created.id, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdatePartnerDto, meta: RequestMeta) {
    await this.get(actor, id);
    const updated = await this.prisma.partner.update({ where: { id }, data: dto });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'partner.update', entity: 'Partner', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    await this.get(actor, id);
    await this.prisma.partner.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'partner.delete', entity: 'Partner', entityId: id, meta });
  }

  async candidates(actor: AuthUser, id: string) {
    await this.get(actor, id);
    return this.prisma.candidate.findMany({ where: { organizationId: actor.organizationId, partnerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }
}
