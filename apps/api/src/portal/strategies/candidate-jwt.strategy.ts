import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { apiError } from '../../common/errors/api-error';
import type { CandidateAuthUser } from '../../common/auth-user';
import type { Env } from '../../config/env';

export interface CandidateJwtPayload {
  sub: string;
  org: string;
  aud: 'candidate-portal';
}

/**
 * Stratégie nommée `candidate-jwt` (distincte de la stratégie `jwt` des employés) : un jeton employé ne peut
 * jamais être accepté ici, et réciproquement, même si les deux venaient à partager le même secret.
 */
@Injectable()
export class CandidateJwtStrategy extends PassportStrategy(Strategy, 'candidate-jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('CANDIDATE_JWT_SECRET', { infer: true }) ?? config.get('JWT_SECRET', { infer: true }),
      ignoreExpiration: false,
    });
  }

  async validate(payload: CandidateJwtPayload): Promise<CandidateAuthUser> {
    if (payload.aud !== 'candidate-portal') throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session invalide');
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: payload.sub, organizationId: payload.org, deletedAt: null, status: { not: 'ARCHIVED' } },
    });
    if (!candidate) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session invalide');
    return { id: candidate.id, organizationId: candidate.organizationId, email: candidate.email ?? '', firstName: candidate.firstName, lastName: candidate.lastName };
  }
}
