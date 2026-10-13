import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../decorators';

function ctx(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardWith(meta: Record<string, unknown>) {
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe('PermissionsGuard', () => {
  it('laisse passer une route sans permission requise', () => {
    expect(guardWith({}).canActivate(ctx({ roleCode: 'ADVISOR', permissions: [] }))).toBe(true);
  });

  it('laisse passer une route publique', () => {
    expect(guardWith({ [IS_PUBLIC_KEY]: true, [PERMISSIONS_KEY]: ['x.y'] }).canActivate(ctx(undefined))).toBe(true);
  });

  it('refuse (403) quand une permission manque', () => {
    const g = guardWith({ [PERMISSIONS_KEY]: ['employee.view', 'employee.edit'] });
    expect(() => g.canActivate(ctx({ roleCode: 'DIRECTOR', permissions: ['employee.view'] }))).toThrow();
  });

  it('accepte quand toutes les permissions sont présentes', () => {
    const g = guardWith({ [PERMISSIONS_KEY]: ['employee.view'] });
    expect(g.canActivate(ctx({ roleCode: 'DIRECTOR', permissions: ['employee.view'] }))).toBe(true);
  });

  it('le Super Admin passe toujours', () => {
    const g = guardWith({ [PERMISSIONS_KEY]: ['payment.create'] });
    expect(g.canActivate(ctx({ roleCode: 'SUPER_ADMIN', permissions: [] }))).toBe(true);
  });

  it('refuse (401) sans utilisateur authentifié', () => {
    expect(() => guardWith({ [PERMISSIONS_KEY]: ['a.b'] }).canActivate(ctx(undefined))).toThrow();
  });
});
