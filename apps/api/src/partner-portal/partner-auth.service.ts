import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, PartnerAuthUser, RequestMeta } from '../common/auth-user';
import type { Env } from '../config/env';
import { CreatePartnerUserDto } from './dto/partner-auth.dto';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface PartnerAuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  partnerUser: PartnerAuthUser;
}

const toPartnerAuthUser = (u: { id: string; organizationId: string; partnerId: string; email: string; firstName: string; lastName: string }): PartnerAuthUser => ({
  id: u.id,
  organizationId: u.organizationId,
  partnerId: u.partnerId,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
});

/**
 * Authentification du portail partenaire (Phase 8, section 64) — même rigueur et même isolation totale que
 * le portail candidat : tables séparées (PartnerRefreshToken, PartnerAccessToken, PartnerLoginLog), un jeton
 * de ce portail ne peut structurellement pas être accepté ailleurs.
 */
@Injectable()
export class PartnerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  private dummyHash?: Promise<string>;
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }

  async login(emailRaw: string, password: string, meta: RequestMeta): Promise<PartnerAuthResult> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.partnerUser.findFirst({ where: { email, deletedAt: null } });

    const fail = async (reason: string, organizationId?: string, partnerUserId?: string): Promise<never> => {
      await this.prisma.partnerLoginLog.create({ data: { organizationId, partnerUserId, email, success: false, reason, ip: meta.ip, userAgent: meta.userAgent } });
      throw apiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Identifiants invalides');
    };

    if (!user || !user.passwordHash) {
      await argon2.verify(await this.getDummyHash(), password).catch(() => false);
      return fail(user ? 'not_activated' : 'unknown_user', user?.organizationId, user?.id);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.prisma.partnerLoginLog.create({ data: { organizationId: user.organizationId, partnerUserId: user.id, email, success: false, reason: 'locked', ip: meta.ip, userAgent: meta.userAgent } });
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED', 'Compte temporairement verrouillé');
    }

    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      const max = this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
      const attempts = user.failedLoginCount + 1;
      const lock = attempts >= max;
      await this.prisma.partnerUser.update({
        where: { id: user.id },
        data: { failedLoginCount: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + this.config.get('LOGIN_LOCK_MINUTES', { infer: true }) * 60_000) : null },
      });
      return fail('bad_password', user.organizationId, user.id);
    }

    await this.prisma.partnerUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.prisma.partnerLoginLog.create({ data: { organizationId: user.organizationId, partnerUserId: user.id, email, success: true, ip: meta.ip, userAgent: meta.userAgent } });
    await this.audit.log({ organizationId: user.organizationId, action: 'partner_portal.login', entity: 'PartnerUser', entityId: user.id, meta });
    return this.issueTokens(toPartnerAuthUser(user), meta);
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<PartnerAuthResult> {
    const invalid = () => apiError(HttpStatus.UNAUTHORIZED, 'INVALID_REFRESH', 'Session expirée');
    if (!rawToken) throw invalid();
    const stored = await this.prisma.partnerRefreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!stored) throw invalid();
    if (stored.revokedAt || stored.expiresAt < new Date()) throw invalid();

    const user = await this.prisma.partnerUser.findFirst({ where: { id: stored.partnerUserId, deletedAt: null } });
    if (!user) throw invalid();

    const result = await this.issueTokens(toPartnerAuthUser(user), meta);
    await this.prisma.partnerRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return result;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.partnerRefreshToken.updateMany({ where: { tokenHash: sha256(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(partnerUserId: string): Promise<PartnerAuthUser> {
    const user = await this.prisma.partnerUser.findFirstOrThrow({ where: { id: partnerUserId, deletedAt: null } });
    return toPartnerAuthUser(user);
  }

  /** Employé : crée le compte et envoie le lien d'activation en une seule étape (contrairement au candidat, qui existe déjà). */
  async createAndInvite(actor: AuthUser, partnerId: string, dto: CreatePartnerUserDto): Promise<void> {
    const partner = await this.prisma.partner.findFirst({ where: { id: partnerId, organizationId: actor.organizationId, deletedAt: null } });
    if (!partner) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Partenaire introuvable');

    const user = await this.prisma.partnerUser.create({
      data: { organizationId: actor.organizationId, partnerId, email: dto.email.toLowerCase(), firstName: dto.firstName, lastName: dto.lastName },
    });
    const token = randomBytes(32).toString('base64url');
    await this.prisma.partnerAccessToken.create({
      data: { partnerUserId: user.id, kind: 'ACTIVATE', tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    const link = `${this.config.get('FRONTEND_URL', { infer: true })}/fr/partner-portal/activate?token=${token}`;
    await this.mail.send(
      dto.email,
      'Accédez à votre espace partenaire Study in World',
      `Bonjour ${dto.firstName},\n\nVous avez été invité(e) à accéder à l'espace partenaire de Study in World.\nOuvrez ce lien (valable 7 jours) pour choisir votre mot de passe :\n${link}\n\nSi vous ne vous attendiez pas à ce message, ignorez-le.`,
    );
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'partner_portal.invite', entity: 'PartnerUser', entityId: user.id, meta: {} });
  }

  async forgotPassword(emailRaw: string): Promise<void> {
    const user = await this.prisma.partnerUser.findFirst({ where: { email: emailRaw.trim().toLowerCase(), deletedAt: null, passwordHash: { not: null } } });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.partnerAccessToken.create({ data: { partnerUserId: user.id, kind: 'RESET', tokenHash: sha256(token), expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS) } });
    const link = `${this.config.get('FRONTEND_URL', { infer: true })}/fr/partner-portal/reset-password?token=${token}`;
    await this.mail.send(
      user.email,
      'Réinitialisation de votre mot de passe',
      `Bonjour ${user.firstName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    );
  }

  async activate(token: string, newPassword: string): Promise<void> {
    await this.consumeAccessToken(token, 'ACTIVATE', newPassword);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.consumeAccessToken(token, 'RESET', newPassword);
  }

  private async consumeAccessToken(token: string, kind: 'ACTIVATE' | 'RESET', newPassword: string): Promise<void> {
    const rec = await this.prisma.partnerAccessToken.findUnique({ where: { tokenHash: sha256(token) }, include: { partnerUser: true } });
    if (!rec || rec.kind !== kind || rec.usedAt || rec.expiresAt < new Date() || rec.partnerUser.deletedAt) {
      throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_TOKEN', 'Lien invalide ou expiré');
    }
    await this.prisma.$transaction([
      this.prisma.partnerUser.update({
        where: { id: rec.partnerUserId },
        data: { passwordHash: await argon2.hash(newPassword), portalActivatedAt: rec.partnerUser.portalActivatedAt ?? new Date(), failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.partnerAccessToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      this.prisma.partnerRefreshToken.updateMany({ where: { partnerUserId: rec.partnerUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  private async issueTokens(partnerUser: PartnerAuthUser, meta: RequestMeta): Promise<PartnerAuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: partnerUser.id, org: partnerUser.organizationId, partner: partnerUser.partnerId, aud: 'partner-portal' },
      {
        secret: this.config.get('PARTNER_JWT_SECRET', { infer: true }) ?? this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: this.config.get('PARTNER_JWT_ACCESS_TTL', { infer: true }) as never,
      },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.config.get('PARTNER_REFRESH_TTL_DAYS', { infer: true }) * 86_400_000);
    await this.prisma.partnerRefreshToken.create({ data: { partnerUserId: partnerUser.id, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt, ip: meta.ip, userAgent: meta.userAgent } });
    return { accessToken, refreshToken, refreshExpiresAt, partnerUser };
  }
}
