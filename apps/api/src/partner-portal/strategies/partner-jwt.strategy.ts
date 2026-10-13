import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { apiError } from '../../common/errors/api-error';
import type { PartnerAuthUser } from '../../common/auth-user';
import type { Env } from '../../config/env';

export interface PartnerJwtPayload {
  sub: string;
  org: string;
  partner: string;
  aud: 'partner-portal';
}

/** Stratégie nommée `partner-jwt`, distincte de `jwt` (employés) et `candidate-jwt` (candidats). */
@Injectable()
export class PartnerJwtStrategy extends PassportStrategy(Strategy, 'partner-jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('PARTNER_JWT_SECRET', { infer: true }) ?? config.get('JWT_SECRET', { infer: true }),
      ignoreExpiration: false,
    });
  }

  async validate(payload: PartnerJwtPayload): Promise<PartnerAuthUser> {
    if (payload.aud !== 'partner-portal') throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session invalide');
    const user = await this.prisma.partnerUser.findFirst({ where: { id: payload.sub, organizationId: payload.org, partnerId: payload.partner, deletedAt: null } });
    if (!user) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session invalide');
    return { id: user.id, organizationId: user.organizationId, partnerId: user.partnerId, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }
}
