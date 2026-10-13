import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { assertCanAssignRole } from '../rbac/role-guards';
import { SUPER_ADMIN_ROLE } from '../rbac/permissions';
import { CreateEmployeeDto, ListEmployeesQuery, UpdateEmployeeDto } from './dto/employee.dto';

/** Jamais de passwordHash dans les réponses. */
const employeeSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  locale: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  roleId: true,
  branchId: true,
  role: { select: { id: true, code: true, name: true } },
  branch: { select: { id: true, name: true, code: true } },
} satisfies Prisma.UserSelect;

type Employee = Prisma.UserGetPayload<{ select: typeof employeeSelect }>;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListEmployeesQuery): Promise<Paginated<Employee>> {
    const where: Prisma.UserWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(q.roleId ? { roleId: q.roleId } : {}),
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: employeeSelect, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], ...skipTake(q) }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(actor: AuthUser, id: string): Promise<Employee> {
    const found = await this.prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
      select: employeeSelect,
    });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Employé introuvable');
    return found;
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto, meta: RequestMeta): Promise<Employee> {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw apiError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Cette adresse e-mail est déjà utilisée');
    }
    await this.loadAssignableRole(actor, dto.roleId);
    if (dto.branchId) await this.assertBranch(actor, dto.branchId);

    const created = await this.prisma.user.create({
      data: {
        organizationId: actor.organizationId,
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: dto.roleId,
        branchId: dto.branchId,
        locale: dto.locale ?? 'fr',
        passwordHash: await argon2.hash(dto.password),
        mustChangePassword: true,
      },
      select: employeeSelect,
    });
    await this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'employee.create',
      entity: 'User',
      entityId: created.id,
      metadata: { email, role: created.role.code },
      meta,
    });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateEmployeeDto, meta: RequestMeta): Promise<Employee> {
    const target = await this.get(actor, id);
    this.assertCanTouch(actor, target);

    const isSelf = actor.id === id;
    if (isSelf && ((dto.roleId && dto.roleId !== target.roleId) || (dto.status && dto.status !== target.status))) {
      throw apiError(HttpStatus.FORBIDDEN, 'SELF_LOCKOUT', 'Vous ne pouvez pas modifier votre propre rôle ou statut');
    }
    if (dto.roleId && dto.roleId !== target.roleId) await this.loadAssignableRole(actor, dto.roleId);
    if (dto.branchId) await this.assertBranch(actor, dto.branchId);

    const losesSuperAdmin =
      target.role.code === SUPER_ADMIN_ROLE &&
      ((dto.roleId && dto.roleId !== target.roleId) || dto.status === 'INACTIVE');
    if (losesSuperAdmin) await this.assertNotLastSuperAdmin(actor.organizationId, id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: dto.roleId,
        branchId: dto.branchId,
        locale: dto.locale,
        status: dto.status,
        ...(dto.password ? { passwordHash: await argon2.hash(dto.password), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } : {}),
      },
      select: employeeSelect,
    });

    if (dto.status === 'INACTIVE' || dto.password || (dto.roleId && dto.roleId !== target.roleId)) {
      await this.revokeSessions(id);
    }
    await this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'employee.update',
      entity: 'User',
      entityId: id,
      metadata: {
        fields: Object.keys(dto).filter((k) => k !== 'password'),
        passwordReset: !!dto.password,
        ...(dto.roleId && dto.roleId !== target.roleId ? { roleFrom: target.role.code, roleTo: updated.role.code } : {}),
      },
      meta,
    });
    return updated;
  }

  /** Suppression logique : l'historique (audit, futurs dossiers) reste rattaché à l'employé. */
  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    if (actor.id === id) throw apiError(HttpStatus.FORBIDDEN, 'SELF_LOCKOUT', 'Vous ne pouvez pas supprimer votre propre compte');
    const target = await this.get(actor, id);
    this.assertCanTouch(actor, target);
    if (target.role.code === SUPER_ADMIN_ROLE) await this.assertNotLastSuperAdmin(actor.organizationId, id);

    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
    await this.revokeSessions(id);
    await this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'employee.delete',
      entity: 'User',
      entityId: id,
      metadata: { email: target.email },
      meta,
    });
  }

  // ---- règles ----

  private assertCanTouch(actor: AuthUser, target: Employee) {
    if (target.role.code === SUPER_ADMIN_ROLE && actor.roleCode !== SUPER_ADMIN_ROLE) {
      throw apiError(HttpStatus.FORBIDDEN, 'ROLE_ESCALATION', 'Seul un Super Admin peut modifier ce compte');
    }
  }

  private async loadAssignableRole(actor: AuthUser, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: actor.organizationId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_ROLE', 'Rôle invalide');
    assertCanAssignRole(actor, { code: role.code, permissionCodes: role.permissions.map((p) => p.permission.code) });
    return role;
  }

  private async assertBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: actor.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_BRANCH', 'Branche invalide');
  }

  private async assertNotLastSuperAdmin(organizationId: string, excludeId: string) {
    const others = await this.prisma.user.count({
      where: { organizationId, id: { not: excludeId }, deletedAt: null, status: 'ACTIVE', role: { code: SUPER_ADMIN_ROLE } },
    });
    if (others === 0) throw apiError(HttpStatus.CONFLICT, 'LAST_SUPER_ADMIN', 'Il doit rester au moins un Super Admin actif');
  }

  private revokeSessions(userId: string) {
    return this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
