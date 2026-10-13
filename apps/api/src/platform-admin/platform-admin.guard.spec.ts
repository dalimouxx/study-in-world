import { ExecutionContext } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';
import type { AuthUser } from '../common/auth-user';

const ctxWith = (user?: Partial<AuthUser>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;

describe('PlatformAdminGuard — isolation de /platform-admin', () => {
  const guard = new PlatformAdminGuard();

  it('refuse un employé authentifié qui n’est pas administrateur de la plateforme', () => {
    expect(() => guard.canActivate(ctxWith({ isPlatformAdmin: false }))).toThrow(expect.objectContaining({ status: 403 }));
  });

  it('refuse même un SUPER_ADMIN de sa propre agence s’il n’a pas isPlatformAdmin — ce garde est volontairement indépendant du RBAC normal', () => {
    expect(() => guard.canActivate(ctxWith({ roleCode: 'SUPER_ADMIN', isPlatformAdmin: false }))).toThrow(expect.objectContaining({ status: 403 }));
  });

  it('refuse une requête non authentifiée', () => {
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(expect.objectContaining({ status: 401 }));
  });

  it('autorise un utilisateur avec isPlatformAdmin: true', () => {
    expect(guard.canActivate(ctxWith({ isPlatformAdmin: true }))).toBe(true);
  });
});
