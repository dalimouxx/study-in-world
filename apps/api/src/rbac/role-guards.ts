import { HttpStatus } from '@nestjs/common';
import { apiError } from '../common/errors/api-error';
import type { AuthUser } from '../common/auth-user';
import { SUPER_ADMIN_ROLE } from './permissions';

/**
 * Anti-escalade de privilèges : on ne peut attribuer qu'un rôle dont les droits
 * sont inclus dans les siens, et seul un Super Admin peut manipuler le rôle Super Admin.
 */
export function assertCanAssignRole(actor: AuthUser, role: { code: string; permissionCodes: string[] }): void {
  if (actor.roleCode === SUPER_ADMIN_ROLE) return;
  if (role.code === SUPER_ADMIN_ROLE) {
    throw apiError(HttpStatus.FORBIDDEN, 'ROLE_ESCALATION', 'Seul un Super Admin peut attribuer ce rôle');
  }
  const mine = new Set(actor.permissions);
  if (!role.permissionCodes.every((c) => mine.has(c))) {
    throw apiError(HttpStatus.FORBIDDEN, 'ROLE_ESCALATION', 'Ce rôle dépasse vos propres droits');
  }
}
