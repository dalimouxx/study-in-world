import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { apiError } from '../common/errors/api-error';
import type { AuthUser } from '../common/auth-user';

/**
 * Garde dédié à /platform-admin (gestion des agences elles-mêmes, SaaS multi-agences — section 12).
 * Volontairement séparé de PermissionsGuard : un SUPER_ADMIN d'une agence normale passe automatiquement
 * PermissionsGuard (bypass par rôle), mais ça ne doit jamais suffire pour gérer TOUTES les agences. Seul
 * `isPlatformAdmin` (jamais réglable depuis l'écran de gestion des employés) donne accès ici.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentification requise');
    if (!user.isPlatformAdmin) throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Réservé à l’administration de la plateforme');
    return true;
  }
}
