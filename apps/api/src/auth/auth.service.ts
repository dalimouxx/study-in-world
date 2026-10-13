import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import type { Env } from '../config/env';
import { toAuthUser } from './strategies/jwt.strategy';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const RESET_TTL_MS = 60 * 60 * 1000;
const REUSE_GRACE_MS = 10_000;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthUser;
}

@Injectable()
export class AuthService {
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

  private userInclude = { role: { include: { permissions: { include: { permission: true } } } } } as const;

  async login(emailRaw: string, password: string, meta: RequestMeta): Promise<AuthResult> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: this.userInclude,
    });

    const fail = async (reason: string, orgId?: string, userId?: string): Promise<never> => {
      await this.prisma.loginLog.create({
        data: { organizationId: orgId, userId, email, success: false, reason, ip: meta.ip, userAgent: meta.userAgent },
      });
      throw apiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Identifiants invalides');
    };

    if (!user || user.status !== 'ACTIVE') {
      // Vérification factice pour lisser le temps de réponse (évite l'énumération de comptes).
      await argon2.verify(await this.getDummyHash(), password).catch(() => false);
      return fail(user ? 'inactive' : 'unknown_user', user?.organizationId, user?.id);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.prisma.loginLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          email,
          success: false,
          reason: 'locked',
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED', 'Compte temporairement verrouillé');
    }

    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      const max = this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
      const attempts = user.failedLoginCount + 1;
      const lock = attempts >= max;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : attempts,
          lockedUntil: lock ? new Date(Date.now() + this.config.get('LOGIN_LOCK_MINUTES', { infer: true }) * 60_000) : null,
        },
      });
      if (lock) {
        await this.audit.log({
          organizationId: user.organizationId,
          userId: user.id,
          action: 'auth.locked',
          entity: 'User',
          entityId: user.id,
          meta,
        });
      }
      return fail('bad_password', user.organizationId, user.id);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.prisma.loginLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        email,
        success: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    await this.audit.log({ organizationId: user.organizationId, userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, meta });
    return this.issueTokens(toAuthUser(user), meta);
  }

  /** Rotation du refresh token. Un token déjà utilisé qui revient = vol probable : toute la famille est révoquée. */
  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<AuthResult> {
    const invalid = () => apiError(HttpStatus.UNAUTHORIZED, 'INVALID_REFRESH', 'Session expirée');
    if (!rawToken) throw invalid();

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!stored) throw invalid();

    if (stored.revokedAt) {
      // Marge de 10 s : deux onglets peuvent rafraîchir en même temps avec le même cookie (cas légitime).
      if (Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw invalid();
    }
    if (stored.expiresAt < new Date()) throw invalid();

    const user = await this.prisma.user.findFirst({
      where: { id: stored.userId, deletedAt: null, status: 'ACTIVE' },
      include: this.userInclude,
    });
    if (!user) throw invalid();

    const result = await this.issueTokens(toAuthUser(user), meta);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return result;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
      include: this.userInclude,
    });
    return toAuthUser(user);
  }

  async changePassword(actor: AuthUser, current: string, next: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await argon2.verify(user.passwordHash, current).catch(() => false))) {
      throw apiError(HttpStatus.BAD_REQUEST, 'WRONG_PASSWORD', 'Mot de passe actuel incorrect');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(next), mustChangePassword: false },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ organizationId: user.organizationId, userId: user.id, action: 'auth.password_changed', entity: 'User', entityId: user.id, meta });
    return this.issueTokens({ ...actor, mustChangePassword: false }, meta);
  }

  /** Répond toujours pareil, que l'e-mail existe ou non. */
  async forgotPassword(emailRaw: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: emailRaw.trim().toLowerCase(), deletedAt: null, status: 'ACTIVE' },
    });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    const link = `${this.config.get('FRONTEND_URL', { infer: true })}/${user.locale}/reset-password?token=${token}`;
    const fr = user.locale !== 'ar';
    await this.mail.send(
      user.email,
      fr ? 'Réinitialisation de votre mot de passe' : 'إعادة تعيين كلمة المرور',
      fr
        ? `Bonjour ${user.firstName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`
        : `مرحبًا ${user.firstName}،\n\nلاختيار كلمة مرور جديدة افتح الرابط التالي (صالح لمدة ساعة):\n${link}\n\nإذا لم تطلب ذلك فتجاهل هذه الرسالة.`,
    );
  }

  async resetPassword(token: string, next: string, meta: RequestMeta): Promise<void> {
    const rec = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!rec || rec.usedAt || rec.expiresAt < new Date() || rec.user.deletedAt) {
      throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_RESET_TOKEN', 'Lien invalide ou expiré');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: rec.userId },
        data: { passwordHash: await argon2.hash(next), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: rec.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ organizationId: rec.user.organizationId, userId: rec.userId, action: 'auth.password_reset', entity: 'User', entityId: rec.userId, meta });
  }

  private async issueTokens(user: AuthUser, meta: RequestMeta): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, org: user.organizationId });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.config.get('REFRESH_TTL_DAYS', { infer: true }) * 86_400_000);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt, ip: meta.ip, userAgent: meta.userAgent },
    });
    return { accessToken, refreshToken, refreshExpiresAt, user };
  }
}

