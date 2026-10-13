import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { apiError } from '../common/errors/api-error';
import type { CandidateAuthUser, RequestMeta } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import type { Env } from '../config/env';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // durée de validité d'un lien d'activation / de réinitialisation
const REUSE_GRACE_MS = 10_000;

export interface PortalAuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  candidate: CandidateAuthUser;
}

const toCandidateAuthUser = (c: { id: string; organizationId: string; email: string | null; firstName: string; lastName: string }): CandidateAuthUser => ({
  id: c.id,
  organizationId: c.organizationId,
  email: c.email ?? '',
  firstName: c.firstName,
  lastName: c.lastName,
});

/**
 * Authentification du portail candidat — même niveau de rigueur que l'authentification employé (rotation de
 * refresh token avec détection de réutilisation, verrouillage après échecs répétés, lien à usage unique par
 * e-mail) mais dans des tables séparées (CandidateRefreshToken, CandidateAccessToken, CandidateLoginLog) pour
 * qu'un incident sur l'un des deux systèmes ne puisse jamais affecter l'autre.
 */
@Injectable()
export class CandidateAuthService {
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

  async login(emailRaw: string, password: string, meta: RequestMeta): Promise<PortalAuthResult> {
    const email = emailRaw.trim().toLowerCase();
    const candidate = await this.prisma.candidate.findFirst({ where: { email, deletedAt: null } });

    const fail = async (reason: string, organizationId?: string, candidateId?: string): Promise<never> => {
      await this.prisma.candidateLoginLog.create({ data: { organizationId, candidateId, email, success: false, reason, ip: meta.ip, userAgent: meta.userAgent } });
      throw apiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Identifiants invalides');
    };

    if (!candidate || !candidate.passwordHash) {
      await argon2.verify(await this.getDummyHash(), password).catch(() => false);
      return fail(candidate ? 'not_activated' : 'unknown_candidate', candidate?.organizationId, candidate?.id);
    }
    if (candidate.status === 'ARCHIVED') return fail('archived', candidate.organizationId, candidate.id);

    if (candidate.lockedUntil && candidate.lockedUntil > new Date()) {
      await this.prisma.candidateLoginLog.create({ data: { organizationId: candidate.organizationId, candidateId: candidate.id, email, success: false, reason: 'locked', ip: meta.ip, userAgent: meta.userAgent } });
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED', 'Compte temporairement verrouillé');
    }

    const ok = await argon2.verify(candidate.passwordHash, password).catch(() => false);
    if (!ok) {
      const max = this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
      const attempts = candidate.failedLoginCount + 1;
      const lock = attempts >= max;
      await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: { failedLoginCount: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + this.config.get('LOGIN_LOCK_MINUTES', { infer: true }) * 60_000) : null },
      });
      return fail('bad_password', candidate.organizationId, candidate.id);
    }

    await this.prisma.candidate.update({ where: { id: candidate.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.prisma.candidateLoginLog.create({ data: { organizationId: candidate.organizationId, candidateId: candidate.id, email, success: true, ip: meta.ip, userAgent: meta.userAgent } });
    await this.audit.log({ organizationId: candidate.organizationId, action: 'portal.login', entity: 'Candidate', entityId: candidate.id, meta });
    return this.issueTokens(toCandidateAuthUser(candidate), meta);
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<PortalAuthResult> {
    const invalid = () => apiError(HttpStatus.UNAUTHORIZED, 'INVALID_REFRESH', 'Session expirée');
    if (!rawToken) throw invalid();

    const stored = await this.prisma.candidateRefreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!stored) throw invalid();

    if (stored.revokedAt) {
      if (Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.prisma.candidateRefreshToken.updateMany({ where: { candidateId: stored.candidateId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      throw invalid();
    }
    if (stored.expiresAt < new Date()) throw invalid();

    const candidate = await this.prisma.candidate.findFirst({ where: { id: stored.candidateId, deletedAt: null, status: { not: 'ARCHIVED' } } });
    if (!candidate) throw invalid();

    const result = await this.issueTokens(toCandidateAuthUser(candidate), meta);
    await this.prisma.candidateRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return result;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.candidateRefreshToken.updateMany({ where: { tokenHash: sha256(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(candidateId: string): Promise<CandidateAuthUser> {
    const candidate = await this.prisma.candidate.findFirstOrThrow({ where: { id: candidateId, deletedAt: null } });
    return toCandidateAuthUser(candidate);
  }

  /** Déclenché par un employé (candidate.manage) depuis le dossier candidat : envoie le lien d'activation. */
  async invite(actor: AuthUser, candidateId: string): Promise<void> {
    const candidate = await this.prisma.candidate.findFirst({ where: { id: candidateId, organizationId: actor.organizationId, deletedAt: null } });
    if (!candidate) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');
    if (!candidate.email) throw apiError(HttpStatus.BAD_REQUEST, 'EMAIL_REQUIRED', 'Le candidat doit avoir une adresse e-mail pour être invité au portail');

    const token = randomBytes(32).toString('base64url');
    await this.prisma.candidateAccessToken.create({
      data: { candidateId: candidate.id, kind: 'ACTIVATE', tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    const link = `${this.config.get('FRONTEND_URL', { infer: true })}/fr/portal/activate?token=${token}`;
    await this.mail.send(
      candidate.email,
      'Accédez à votre espace personnel Study in World',
      `Bonjour ${candidate.firstName},\n\nVotre conseiller vous invite à créer votre accès personnel pour suivre votre dossier en ligne.\nOuvrez ce lien (valable 7 jours) pour choisir votre mot de passe :\n${link}\n\nSi vous ne vous attendiez pas à ce message, ignorez-le.`,
    );
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'portal.invite', entity: 'Candidate', entityId: candidate.id, meta: {} });
  }

  async activate(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
    await this.consumeAccessToken(token, 'ACTIVATE', newPassword, meta, 'portal.activated');
  }

  /** Répond toujours pareil, que l'e-mail existe ou non. */
  async forgotPassword(emailRaw: string): Promise<void> {
    const candidate = await this.prisma.candidate.findFirst({ where: { email: emailRaw.trim().toLowerCase(), deletedAt: null, passwordHash: { not: null } } });
    if (!candidate || !candidate.email) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.candidateAccessToken.create({
      data: { candidateId: candidate.id, kind: 'RESET', tokenHash: sha256(token), expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS) },
    });
    const link = `${this.config.get('FRONTEND_URL', { infer: true })}/fr/portal/reset-password?token=${token}`;
    await this.mail.send(
      candidate.email,
      'Réinitialisation de votre mot de passe',
      `Bonjour ${candidate.firstName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    );
  }

  async resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
    await this.consumeAccessToken(token, 'RESET', newPassword, meta, 'portal.password_reset');
  }

  private async consumeAccessToken(token: string, kind: 'ACTIVATE' | 'RESET', newPassword: string, meta: RequestMeta, auditAction: string): Promise<void> {
    const rec = await this.prisma.candidateAccessToken.findUnique({ where: { tokenHash: sha256(token) }, include: { candidate: true } });
    if (!rec || rec.kind !== kind || rec.usedAt || rec.expiresAt < new Date() || rec.candidate.deletedAt) {
      throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_TOKEN', 'Lien invalide ou expiré');
    }
    await this.prisma.$transaction([
      this.prisma.candidate.update({
        where: { id: rec.candidateId },
        data: { passwordHash: await argon2.hash(newPassword), portalActivatedAt: rec.candidate.portalActivatedAt ?? new Date(), failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.candidateAccessToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      this.prisma.candidateRefreshToken.updateMany({ where: { candidateId: rec.candidateId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ organizationId: rec.candidate.organizationId, action: auditAction, entity: 'Candidate', entityId: rec.candidateId, meta });
  }

  private async issueTokens(candidate: CandidateAuthUser, meta: RequestMeta): Promise<PortalAuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: candidate.id, org: candidate.organizationId, aud: 'candidate-portal' },
      {
        secret: this.config.get('CANDIDATE_JWT_SECRET', { infer: true }) ?? this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: this.config.get('CANDIDATE_JWT_ACCESS_TTL', { infer: true }) as never,
      },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.config.get('CANDIDATE_REFRESH_TTL_DAYS', { infer: true }) * 86_400_000);
    await this.prisma.candidateRefreshToken.create({
      data: { candidateId: candidate.id, tokenHash: sha256(refreshToken), expiresAt: refreshExpiresAt, ip: meta.ip, userAgent: meta.userAgent },
    });
    return { accessToken, refreshToken, refreshExpiresAt, candidate };
  }
}
