import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { authenticator as baseAuthenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { apiError } from '../../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../../common/auth-user';
import type { Env } from '../../config/env';
import {
  decryptSecret,
  deriveKey,
  encryptSecret,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  requiresTwoFactor,
  totpKey,
} from './two-factor.crypto';

const STEP_MS = 30_000;
const CHALLENGE_TTL = '5m';
const ISSUER = 'Study in World';
// Codes à 6 chiffres, périodes de 30 s, tolérance d'une période avant/après (décalage d'horloge du téléphone).
const authenticator = baseAuthenticator.clone({ step: 30, digits: 6, window: 1 });

type TotpUser = { id: string; totpSecret: string | null; totpLastUsedStep: number | null; totpRecoveryCodes: string[] };
export type CodeCheck = { ok: false } | { ok: true; step: number } | { ok: true; recoveryCodes: string[] };

/** Jeton d'étape entre le mot de passe et le code : signé avec une clé à part, il ne vaut jamais comme session. */
@Injectable()
export class TwoFactorService {
  private readonly usedChallenges = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  private key(): Buffer {
    return totpKey(this.config.get('TOTP_ENCRYPTION_KEY', { infer: true }), this.config.get('JWT_SECRET', { infer: true }));
  }

  private challengeSecret(): string {
    return deriveKey(this.config.get('JWT_SECRET', { infer: true }), 'two-factor-challenge').toString('hex');
  }

  // ---------- Connexion ----------

  createChallenge(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId, typ: '2fa', jti: randomUUID() }, { secret: this.challengeSecret(), expiresIn: CHALLENGE_TTL });
  }

  /** Utilisateur du jeton d'étape ; refuse un jeton expiré, falsifié ou déjà utilisé pour une connexion réussie. */
  async readChallenge(token: string): Promise<{ userId: string; jti: string }> {
    const invalid = () => apiError(HttpStatus.UNAUTHORIZED, 'TWO_FACTOR_EXPIRED', 'Étape expirée : reconnectez-vous');
    let payload: { sub?: string; typ?: string; jti?: string; exp?: number };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.challengeSecret() });
    } catch {
      throw invalid();
    }
    if (payload.typ !== '2fa' || !payload.sub || !payload.jti || this.usedChallenges.has(payload.jti)) throw invalid();
    return { userId: payload.sub, jti: payload.jti };
  }

  /** Jeton consommé par une connexion réussie : il ne pourra plus servir (gardé jusqu'à son expiration). */
  markChallengeUsed(jti: string): void {
    const now = Date.now();
    for (const [k, exp] of this.usedChallenges) if (exp < now) this.usedChallenges.delete(k);
    this.usedChallenges.set(jti, now + 5 * 60_000);
  }

  /**
   * Vérifie un code de l'application (6 chiffres) ou un code de secours. Un code de l'application déjà utilisé
   * (même période de 30 s ou antérieure) est refusé : il ne peut pas être rejoué.
   */
  async checkCode(user: TotpUser, code: string, now = Date.now()): Promise<CodeCheck> {
    const value = code.trim();
    if (/^\d{6}$/.test(value)) {
      if (!user.totpSecret) return { ok: false };
      const secret = decryptSecret(user.totpSecret, this.key());
      const delta = authenticator.checkDelta(value, secret);
      if (delta === null) return { ok: false };
      const step = Math.floor(now / STEP_MS) + delta;
      if (user.totpLastUsedStep !== null && step <= user.totpLastUsedStep) return { ok: false };
      return { ok: true, step };
    }
    const normalized = normalizeRecoveryCode(value);
    for (let i = 0; i < user.totpRecoveryCodes.length; i++) {
      if (await argon2.verify(user.totpRecoveryCodes[i], normalized).catch(() => false)) {
        return { ok: true, recoveryCodes: user.totpRecoveryCodes.filter((_, j) => j !== i) };
      }
    }
    return { ok: false };
  }

  /** Données à enregistrer après un code accepté (période utilisée, ou code de secours retiré). */
  afterSuccess(check: Extract<CodeCheck, { ok: true }>) {
    return 'step' in check ? { totpLastUsedStep: check.step } : { totpRecoveryCodes: check.recoveryCodes };
  }

  // ---------- Mise en place, désactivation, réinitialisation ----------

  async setup(actor: AuthUser): Promise<{ otpauthUrl: string; qrDataUrl: string; secret: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (user.totpEnabledAt) throw apiError(HttpStatus.CONFLICT, 'TWO_FACTOR_ALREADY_ENABLED', 'La double authentification est déjà activée');
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: actor.id }, data: { totpPendingSecret: encryptSecret(secret, this.key()) } });
    const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
    return { otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 }), secret };
  }

  async enable(actor: AuthUser, code: string, meta: RequestMeta): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (user.totpEnabledAt) throw apiError(HttpStatus.CONFLICT, 'TWO_FACTOR_ALREADY_ENABLED', 'La double authentification est déjà activée');
    if (!user.totpPendingSecret) throw apiError(HttpStatus.BAD_REQUEST, 'TWO_FACTOR_NOT_STARTED', 'Commencez par scanner le QR code');
    const secret = decryptSecret(user.totpPendingSecret, this.key());
    const delta = /^\d{6}$/.test(code.trim()) ? authenticator.checkDelta(code.trim(), secret) : null;
    if (delta === null) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_2FA_CODE', 'Code incorrect');

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.user.update({
      where: { id: actor.id },
      data: {
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        totpEnabledAt: new Date(),
        totpLastUsedStep: Math.floor(Date.now() / STEP_MS) + delta,
        totpRecoveryCodes: await Promise.all(recoveryCodes.map((c) => argon2.hash(c))),
      },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'auth.2fa_enabled', entity: 'User', entityId: actor.id, meta });
    return { recoveryCodes };
  }

  async disable(actor: AuthUser, password: string, code: string, meta: RequestMeta): Promise<void> {
    if (requiresTwoFactor(actor.roleCode, actor.isPlatformAdmin)) {
      throw apiError(HttpStatus.FORBIDDEN, 'TWO_FACTOR_REQUIRED', 'La double authentification est obligatoire pour votre rôle');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!user.totpEnabledAt) return;
    const passwordOk = await argon2.verify(user.passwordHash, password).catch(() => false);
    const check = passwordOk ? await this.checkCode(user, code) : { ok: false as const };
    if (!passwordOk || !check.ok) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_2FA_CODE', 'Mot de passe ou code incorrect');
    await this.prisma.user.update({ where: { id: actor.id }, data: this.cleared() });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'auth.2fa_disabled', entity: 'User', entityId: actor.id, meta });
  }

  /** Téléphone perdu : un Super Admin efface la double authentification d'un employé de son agence (et ferme ses sessions). */
  async reset(actor: AuthUser, userId: string, meta: RequestMeta): Promise<void> {
    const target = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null, ...(actor.isPlatformAdmin ? {} : { organizationId: actor.organizationId }) } });
    if (!target) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Employé introuvable');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: this.cleared() }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ organizationId: target.organizationId, userId: actor.id, action: 'auth.2fa_reset', entity: 'User', entityId: userId, meta });
  }

  private cleared() {
    return { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastUsedStep: null, totpRecoveryCodes: [] };
  }
}
