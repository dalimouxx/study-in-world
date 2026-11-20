import { HttpStatus, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger('DoubleAuthentification');
  private readonly usedChallenges = new Map<string, number>();
  // Jetons d'étape en cours de vérification : une seule vérification à la fois par jeton (requêtes parallèles).
  private readonly claimedChallenges = new Set<string>();
  // Mauvais codes par jeton : au-delà de 5, le jeton est brûlé (il faut ressaisir le mot de passe).
  private readonly failuresByChallenge = new Map<string, number>();

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

  /**
   * Réserve le jeton pour une vérification (synchrone, donc sans course entre requêtes parallèles du même processus).
   * Refus si une autre vérification du même jeton est en cours ou s'il a déjà servi.
   */
  claimChallenge(jti: string): boolean {
    if (this.claimedChallenges.has(jti) || this.usedChallenges.has(jti)) return false;
    this.claimedChallenges.add(jti);
    return true;
  }

  /** Vérification terminée sans succès : le jeton redevient utilisable, sauf après 5 mauvais codes (brûlé). */
  releaseChallenge(jti: string, failed: boolean): void {
    this.claimedChallenges.delete(jti);
    if (!failed) return;
    const n = (this.failuresByChallenge.get(jti) ?? 0) + 1;
    this.failuresByChallenge.set(jti, n);
    if (n >= 5) this.markChallengeUsed(jti);
  }

  /** Jeton consommé par une connexion réussie : il ne pourra plus servir (gardé jusqu'à son expiration). */
  markChallengeUsed(jti: string): void {
    const now = Date.now();
    for (const [k, exp] of this.usedChallenges) if (exp < now) { this.usedChallenges.delete(k); this.failuresByChallenge.delete(k); }
    this.claimedChallenges.delete(jti);
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
      let secret: string;
      try {
        secret = decryptSecret(user.totpSecret, this.key());
      } catch {
        // Clé de chiffrement changée depuis l'activation (JWT_SECRET ou TOTP_ENCRYPTION_KEY) : code refusé, pas d'erreur 500.
        this.logger.error(`Secret de double authentification illisible pour l'utilisateur ${user.id} : clé de chiffrement modifiée ?`);
        return { ok: false };
      }
      const delta = authenticator.checkDelta(value, secret);
      if (delta === null) return { ok: false };
      const step = Math.floor(now / STEP_MS) + delta;
      if (user.totpLastUsedStep !== null && step <= user.totpLastUsedStep) return { ok: false };
      return { ok: true, step };
    }
    const normalized = normalizeRecoveryCode(value);
    // Seule une saisie au format d'un code de secours déclenche les vérifications argon2 (coûteuses).
    if (!/^[a-z2-9]{4}-[a-z2-9]{4}$/.test(normalized)) return { ok: false };
    for (let i = 0; i < user.totpRecoveryCodes.length; i++) {
      if (await argon2.verify(user.totpRecoveryCodes[i], normalized).catch(() => false)) {
        return { ok: true, recoveryCodes: user.totpRecoveryCodes.filter((_, j) => j !== i) };
      }
    }
    return { ok: false };
  }

  /**
   * Enregistre l'usage du code de façon atomique : la mise à jour n'a lieu que si l'état n'a pas changé depuis la
   * vérification (période pas encore utilisée, ou liste de codes de secours inchangée). Deux requêtes simultanées
   * avec le même code : une seule réussit. Renvoie false si le code a été utilisé entre-temps.
   */
  async consumeCode(user: TotpUser, check: Extract<CodeCheck, { ok: true }>, extra: Record<string, unknown>): Promise<boolean> {
    const where =
      'step' in check
        ? { id: user.id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: check.step } }] }
        : { id: user.id, totpRecoveryCodes: { equals: user.totpRecoveryCodes } };
    const data = 'step' in check ? { totpLastUsedStep: check.step } : { totpRecoveryCodes: check.recoveryCodes };
    const { count } = await this.prisma.user.updateMany({ where, data: { ...data, ...extra } });
    return count === 1;
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
