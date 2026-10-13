import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PartnerAuthUser } from '../common/auth-user';

export const CurrentPartner = createParamDecorator((_: unknown, ctx: ExecutionContext): PartnerAuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: PartnerAuthUser }>().user;
});
