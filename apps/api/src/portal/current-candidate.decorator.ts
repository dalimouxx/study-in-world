import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CandidateAuthUser } from '../common/auth-user';

export const CurrentCandidate = createParamDecorator((_: unknown, ctx: ExecutionContext): CandidateAuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: CandidateAuthUser }>().user;
});
