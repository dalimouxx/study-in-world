import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../decorators';
import { apiError } from '../errors/api-error';
import { SUPER_ADMIN_ROLE } from '../../rbac/permissions';
import type { AuthUser } from '../auth-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, targets);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentification requise');
    if (user.roleCode === SUPER_ADMIN_ROLE) return true;

    const granted = new Set(user.permissions);
    if (required.every((code) => granted.has(code))) return true;
    throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Permission insuffisante');
  }
}
