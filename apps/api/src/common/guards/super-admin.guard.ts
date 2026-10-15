import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { apiError } from '../errors/api-error';
import { SUPER_ADMIN_ROLE } from '../../rbac/permissions';
import type { AuthUser } from '../auth-user';

/**
 * Réservé au rôle Super Admin lui-même — volontairement distinct de PermissionsGuard. Le rôle
 * Administrateur a aussi `permissions: 'ALL'` dans SYSTEM_ROLES et passerait n'importe quel
 * `@RequirePermissions(...)`, alors que la gestion du contenu public du site (landing page) doit
 * rester exclue même des administrateurs d'agence, à la demande explicite de l'agence propriétaire.
 * Même logique que PlatformAdminGuard, mais sur le rôle (roleCode) plutôt que sur isPlatformAdmin.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentification requise');
    if (user.roleCode !== SUPER_ADMIN_ROLE) {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Réservé au Super Admin');
    }
    return true;
  }
}
