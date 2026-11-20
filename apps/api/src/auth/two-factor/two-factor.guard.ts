import { CanActivate, ExecutionContext, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiError } from '../../common/errors/api-error';
import type { AuthUser } from '../../common/auth-user';

const ALLOW_KEY = 'allowDuringTwoFactorSetup';
/** Route accessible à un administrateur qui doit encore mettre en place la double authentification. */
export const AllowDuringTwoFactorSetup = () => SetMetadata(ALLOW_KEY, true);

/**
 * Blocage côté serveur : un compte qui doit mettre en place la double authentification (administrateur sans
 * double authentification) ne peut rien faire d'autre — pas seulement à l'écran. L'état est relu à chaque requête
 * (JwtStrategy recharge l'utilisateur), donc une session déjà ouverte est concernée immédiatement.
 */
@Injectable()
export class TwoFactorSetupGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user?.mustSetupTwoFactor) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_KEY, [context.getHandler(), context.getClass()])) return true;
    throw apiError(HttpStatus.FORBIDDEN, 'TWO_FACTOR_SETUP_REQUIRED', 'Activez la double authentification pour continuer');
  }
}
