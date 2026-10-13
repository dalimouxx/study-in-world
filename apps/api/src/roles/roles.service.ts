import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { SUPER_ADMIN_ROLE } from '../rbac/permissions';
import { CreateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    const roles = await this.prisma.role.findMany({
      where: { organizationId: actor.organizationId },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: { where: { deletedAt: null } } } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.code).sort(),
    }));
  }

  catalog() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }], select: { code: true, module: true, action: true } });
  }

  async create(actor: AuthUser, dto: CreateRoleDto, meta: RequestMeta) {
    const codes = dto.permissions ?? [];
    await this.assertGrantable(actor, codes);
    const code = 'CUSTOM_' + dto.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    if (await this.prisma.role.findUnique({ where: { organizationId_code: { organizationId: actor.organizationId, code } } })) {
      throw apiError(HttpStatus.CONFLICT, 'ROLE_EXISTS', 'Un rôle portant ce nom existe déjà');
    }
    const perms = await this.prisma.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
    const role = await this.prisma.role.create({
      data: {
        organizationId: actor.organizationId,
        code,
        name: dto.name.trim(),
        description: dto.description,
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'role.create', entity: 'Role', entityId: role.id, metadata: { name: role.name, permissions: codes }, meta });
    return { id: role.id };
  }

  async setPermissions(actor: AuthUser, roleId: string, codes: string[], meta: RequestMeta) {
    const role = await this.findEditable(actor, roleId);
    await this.assertGrantable(actor, codes);
    const perms = await this.prisma.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) }),
    ]);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'role.permissions', entity: 'Role', entityId: roleId, metadata: { role: role.code, permissions: codes }, meta });
  }

  async remove(actor: AuthUser, roleId: string, meta: RequestMeta) {
    const role = await this.findEditable(actor, roleId);
    if (role.isSystem) throw apiError(HttpStatus.FORBIDDEN, 'SYSTEM_ROLE', 'Un rôle système ne peut pas être supprimé');
    const users = await this.prisma.user.count({ where: { roleId, deletedAt: null } });
    if (users > 0) throw apiError(HttpStatus.CONFLICT, 'ROLE_IN_USE', 'Ce rôle est encore attribué à des employés');
    await this.prisma.role.delete({ where: { id: roleId } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'role.delete', entity: 'Role', entityId: roleId, metadata: { name: role.name }, meta });
  }

  private async findEditable(actor: AuthUser, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, organizationId: actor.organizationId } });
    if (!role) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Rôle introuvable');
    if (role.code === SUPER_ADMIN_ROLE) throw apiError(HttpStatus.FORBIDDEN, 'SYSTEM_ROLE', 'Le rôle Super Admin n’est pas modifiable');
    return role;
  }

  /** Codes existants uniquement, et un non-Super Admin ne peut accorder que des droits qu'il possède. */
  private async assertGrantable(actor: AuthUser, codes: string[]) {
    const unique = [...new Set(codes)];
    const known = await this.prisma.permission.count({ where: { code: { in: unique } } });
    if (known !== unique.length) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_PERMISSION', 'Permission inconnue');
    if (actor.roleCode !== SUPER_ADMIN_ROLE) {
      const mine = new Set(actor.permissions);
      if (!unique.every((c) => mine.has(c))) {
        throw apiError(HttpStatus.FORBIDDEN, 'ROLE_ESCALATION', 'Vous ne pouvez accorder que des droits que vous possédez');
      }
    }
  }
}
