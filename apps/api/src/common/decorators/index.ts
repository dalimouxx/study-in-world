import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser, RequestMeta } from '../auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'permissions';

/** Route accessible sans authentification. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Toutes les permissions listées sont requises. */
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});

export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 300) };
});
