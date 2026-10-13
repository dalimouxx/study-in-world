import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

/** Chaîne vide envoyée par un formulaire => champ effacé (null). */
const blankToNull = <T extends object>(dto: T): T =>
  Object.fromEntries(Object.entries(dto).map(([k, v]) => [k, v === '' ? null : v])) as T;

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    const rows = await this.prisma.branch.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });
    return rows.map(({ _count, ...b }) => ({ ...b, employeeCount: _count.users }));
  }

  async create(actor: AuthUser, dto: CreateBranchDto, meta: RequestMeta) {
    const exists = await this.prisma.branch.findFirst({ where: { organizationId: actor.organizationId, code: dto.code } });
    if (exists) throw apiError(HttpStatus.CONFLICT, 'BRANCH_CODE_TAKEN', 'Ce code de branche existe déjà');
    const branch = await this.prisma.branch.create({ data: { ...blankToNull(dto), organizationId: actor.organizationId } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'branch.create', entity: 'Branch', entityId: branch.id, metadata: { name: branch.name }, meta });
    return branch;
  }

  async update(actor: AuthUser, id: string, dto: UpdateBranchDto, meta: RequestMeta) {
    await this.find(actor, id);
    if (dto.code) {
      const clash = await this.prisma.branch.findFirst({ where: { organizationId: actor.organizationId, code: dto.code, id: { not: id } } });
      if (clash) throw apiError(HttpStatus.CONFLICT, 'BRANCH_CODE_TAKEN', 'Ce code de branche existe déjà');
    }
    const branch = await this.prisma.branch.update({ where: { id }, data: blankToNull(dto) });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'branch.update', entity: 'Branch', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return branch;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta) {
    const branch = await this.find(actor, id);
    const users = await this.prisma.user.count({ where: { branchId: id, deletedAt: null } });
    if (users > 0) throw apiError(HttpStatus.CONFLICT, 'BRANCH_IN_USE', 'Des employés sont encore rattachés à cette branche');
    await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'branch.delete', entity: 'Branch', entityId: id, metadata: { name: branch.name }, meta });
  }

  private async find(actor: AuthUser, id: string) {
    const b = await this.prisma.branch.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null } });
    if (!b) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Branche introuvable');
    return b;
  }
}
