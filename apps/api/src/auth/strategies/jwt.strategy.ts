import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { apiError } from '../../common/errors/api-error';
import type { AuthUser } from '../../common/auth-user';
import type { Env } from '../../config/env';

export interface JwtPayload {
  sub: string;
  org: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      ignoreExpiration: false,
    });
  }

  /** Recharge l'utilisateur à chaque requête : désactivation et changement de droits immédiats. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, organizationId: payload.org, deletedAt: null, status: 'ACTIVE' },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session invalide');
    return toAuthUser(user);
  }
}

export function toAuthUser(user: {
  id: string;
  organizationId: string;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  mustChangePassword: boolean;
  roleId: string;
  isPlatformAdmin: boolean;
  role: { code: string; name: string; permissions: { permission: { code: string } }[] };
}): AuthUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    branchId: user.branchId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    locale: user.locale,
    mustChangePassword: user.mustChangePassword,
    roleId: user.roleId,
    roleCode: user.role.code,
    roleName: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.code),
    isPlatformAdmin: user.isPlatformAdmin,
  };
}
