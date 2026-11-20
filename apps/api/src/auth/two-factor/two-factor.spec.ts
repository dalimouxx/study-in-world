import 'reflect-metadata';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { authenticator } from 'otplib';
import { AuthService, type AuthResult, type TwoFactorChallenge } from '../auth.service';
import { toAuthUser } from '../strategies/jwt.strategy';
import { decryptSecret, encryptSecret, generateRecoveryCodes, normalizeRecoveryCode, requiresTwoFactor, totpKey } from './two-factor.crypto';
import { TwoFactorSetupGuard } from './two-factor.guard';
import { TwoFactorService } from './two-factor.service';

const JWT_SECRET = 'x'.repeat(40);
const KEY = totpKey(undefined, JWT_SECRET);
const PASSWORD = 'Correct-Password1';
const SECRET = authenticator.generateSecret();
let passwordHash: string;
let recoveryHashes: string[];
const RECOVERY = ['abcd-efgh', 'jkmn-pqrs'];

beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD);
  recoveryHashes = await Promise.all(RECOVERY.map((c) => argon2.hash(c)));
});

const role = (code: string) => ({ code, name: code, permissions: [] });
const user = (o: Record<string, unknown> = {}) => ({
  id: 'u1', organizationId: 'org1', branchId: null, email: 'a@b.tn', firstName: 'A', lastName: 'B', locale: 'fr',
  mustChangePassword: false, roleId: 'r1', isPlatformAdmin: false, status: 'ACTIVE', passwordHash, failedLoginCount: 0,
  lockedUntil: null as Date | null, deletedAt: null, role: role('ADVISOR'),
  totpSecret: encryptSecret(SECRET, KEY), totpPendingSecret: null as string | null, totpEnabledAt: new Date(), totpLastUsedStep: null as number | null,
  totpRecoveryCodes: recoveryHashes, ...o,
});

/** Base simulée avec état : les mises à jour s'appliquent vraiment (incréments, conditions), comme en base. */
function build(u: ReturnType<typeof user> | null) {
  const state = u ? { ...u } : null;
  const tick = () => new Promise((r) => setImmediate(r)); // laisse les requêtes parallèles s'entrelacer
  const apply = (data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      (state as unknown as Record<string, unknown>)[k] = v && typeof v === 'object' && 'increment' in (v as object) ? ((state as unknown as Record<string, number>)[k] ?? 0) + (v as { increment: number }).increment : v;
    }
  };
  const matches = (where: Record<string, unknown>) => {
    if (!state) return false;
    if (Array.isArray(where.OR)) {
      return (where.OR as Record<string, unknown>[]).some((c) => (c.totpLastUsedStep === null ? state.totpLastUsedStep === null : state.totpLastUsedStep !== null && state.totpLastUsedStep < (c.totpLastUsedStep as { lt: number }).lt));
    }
    if (where.totpRecoveryCodes) return JSON.stringify(state.totpRecoveryCodes) === JSON.stringify((where.totpRecoveryCodes as { equals: string[] }).equals);
    return true;
  };
  const prisma = {
    user: {
      findFirst: jest.fn().mockImplementation(async () => { await tick(); return state && { ...state }; }),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => state && { ...state }),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { await tick(); apply(data); return { ...state }; }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        await tick();
        if (!matches(where)) return { count: 0 };
        apply(data);
        return { count: 1 };
      }),
    },
    loginLog: { create: jest.fn().mockResolvedValue({}) },
    refreshToken: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const config = { get: (k: string) => ({ LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15, REFRESH_TTL_DAYS: 30, JWT_SECRET, TOTP_ENCRYPTION_KEY: undefined })[k] };
  const jwt = new JwtService({ secret: JWT_SECRET, signOptions: { expiresIn: '15m' } });
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const twoFactor = new TwoFactorService(prisma as never, jwt, config as never, audit as never);
  const auth = new AuthService(prisma as never, jwt, config as never, audit as never, { send: jest.fn() } as never, twoFactor);
  return { auth, twoFactor, prisma, jwt, audit, state: state! };
}

describe('outils', () => {
  it('chiffre et déchiffre le secret ; un secret modifié est refusé', () => {
    const enc = encryptSecret(SECRET, KEY);
    expect(enc).not.toContain(SECRET);
    expect(decryptSecret(enc, KEY)).toBe(SECRET);
    const parts = enc.split('.');
    parts[3] = Buffer.from('falsifié').toString('base64url');
    expect(() => decryptSecret(parts.join('.'), KEY)).toThrow();
  });

  it('10 codes de secours distincts au format xxxx-xxxx ; saisie tolérante', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(normalizeRecoveryCode(' ABCD EFGH ')).toBe('abcd-efgh');
  });

  it('obligatoire pour SUPER_ADMIN, ADMIN et les administrateurs de la plateforme seulement', () => {
    expect(requiresTwoFactor('SUPER_ADMIN', false)).toBe(true);
    expect(requiresTwoFactor('ADMIN', false)).toBe(true);
    expect(requiresTwoFactor('ADVISOR', true)).toBe(true);
    expect(requiresTwoFactor('ADVISOR', false)).toBe(false);
  });

  it('mustSetupTwoFactor : administrateur sans double authentification', () => {
    expect(toAuthUser(user({ role: role('ADMIN'), totpEnabledAt: null }))).toMatchObject({ mustSetupTwoFactor: true, twoFactorEnabled: false });
    expect(toAuthUser(user({ role: role('ADMIN') }))).toMatchObject({ mustSetupTwoFactor: false, twoFactorEnabled: true });
    expect(toAuthUser(user({ totpEnabledAt: null }))).toMatchObject({ mustSetupTwoFactor: false });
  });
});

describe('connexion en deux temps', () => {
  const step = async (b: ReturnType<typeof build>) => (await b.auth.login('a@b.tn', PASSWORD, {})) as TwoFactorChallenge;

  it('mot de passe correct : un jeton d’étape, pas de session', async () => {
    const b = build(user());
    const res = await step(b);
    expect(res.twoFactorRequired).toBe(true);
    expect(b.prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('le jeton d’étape ne vaut jamais comme session (signé avec une autre clé)', async () => {
    const b = build(user());
    const res = await step(b);
    await expect(b.jwt.verifyAsync(res.twoFactorToken)).rejects.toThrow();
  });

  it('bon code : session ; le même code ne peut pas être rejoué', async () => {
    const u = user();
    const b = build(u);
    const { twoFactorToken } = await step(b);
    const code = authenticator.generate(SECRET);
    const ok = (await b.auth.verifyTwoFactor(twoFactorToken, code, {})) as AuthResult;
    expect(ok.accessToken).toBeTruthy();
    expect(b.state.totpLastUsedStep).toBeGreaterThan(0);
    // Nouvelle connexion, même code, même période : refusé.
    const b2 = build({ ...u, totpLastUsedStep: b.state.totpLastUsedStep });
    const second = await step(b2);
    await expect(b2.auth.verifyTwoFactor(second.twoFactorToken, code, {})).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_2FA_CODE' }) });
  });

  it('jeton d’étape déjà utilisé pour une connexion réussie : refusé', async () => {
    const b = build(user());
    const { twoFactorToken } = await step(b);
    await b.auth.verifyTwoFactor(twoFactorToken, authenticator.generate(SECRET), {});
    await expect(b.auth.verifyTwoFactor(twoFactorToken, 'abcd-efgh', {})).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TWO_FACTOR_EXPIRED' }) });
  });

  it('jeton d’étape expiré ou falsifié : refusé', async () => {
    const b = build(user());
    const expired = await b.jwt.signAsync({ sub: 'u1', typ: '2fa', jti: 'j' }, { secret: 'autre-secret', expiresIn: '5m' });
    await expect(b.auth.verifyTwoFactor(expired, authenticator.generate(SECRET), {})).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TWO_FACTOR_EXPIRED' }) });
  });

  it('mauvais code : compte dans le verrouillage (5e erreur → verrouillé)', async () => {
    const b = build(user({ failedLoginCount: 4 }));
    const { twoFactorToken } = await step(b);
    await expect(b.auth.verifyTwoFactor(twoFactorToken, '000000', {})).rejects.toMatchObject({ status: 401 });
    expect(b.state.lockedUntil).toBeInstanceOf(Date);
  });

  it('code de secours : accepté une fois, puis retiré', async () => {
    const b = build(user());
    const { twoFactorToken } = await step(b);
    await b.auth.verifyTwoFactor(twoFactorToken, 'ABCD EFGH', {});
    expect(b.state.totpRecoveryCodes).toHaveLength(1);
    const b2 = build(user({ totpRecoveryCodes: b.state.totpRecoveryCodes }));
    const again = await step(b2);
    await expect(b2.auth.verifyTwoFactor(again.twoFactorToken, 'abcd-efgh', {})).rejects.toMatchObject({ status: 401 });
  });

  it('attaque : 50 mauvais codes envoyés en parallèle → le compte est verrouillé', async () => {
    const b = build(user());
    const tokens = await Promise.all(Array.from({ length: 10 }, () => step(b)));
    await Promise.allSettled(Array.from({ length: 50 }, (_, i) => b.auth.verifyTwoFactor(tokens[i % 10].twoFactorToken, String(100000 + i), {})));
    expect(b.state.lockedUntil).toBeInstanceOf(Date);
  });

  it('attaque : le même bon code envoyé 3 fois en parallèle → une seule session', async () => {
    const b = build(user());
    const t1 = await step(b);
    const t2 = await step(b);
    const code = authenticator.generate(SECRET);
    const results = await Promise.allSettled([
      b.auth.verifyTwoFactor(t1.twoFactorToken, code, {}),
      b.auth.verifyTwoFactor(t1.twoFactorToken, code, {}),
      b.auth.verifyTwoFactor(t2.twoFactorToken, code, {}),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('un jeton d’étape est brûlé après 5 mauvais codes', async () => {
    const b = build(user({ failedLoginCount: -100 })); // le verrouillage du compte n'intervient pas ici
    const { twoFactorToken } = await step(b);
    for (let i = 0; i < 5; i++) await b.auth.verifyTwoFactor(twoFactorToken, '000000', {}).catch(() => undefined);
    await expect(b.auth.verifyTwoFactor(twoFactorToken, authenticator.generate(SECRET), {})).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TWO_FACTOR_EXPIRED' }) });
  });

  it('clé de chiffrement changée : code refusé proprement (pas d’erreur 500)', async () => {
    const b = build(user({ totpSecret: encryptSecret(SECRET, totpKey('une-autre-cle-de-chiffrement-de-32-car', JWT_SECRET)) }));
    const { twoFactorToken } = await step(b);
    await expect(b.auth.verifyTwoFactor(twoFactorToken, authenticator.generate(SECRET), {})).rejects.toMatchObject({ status: 401 });
  });

  it('sans double authentification : connexion directe comme avant', async () => {
    const b = build(user({ totpEnabledAt: null, totpSecret: null }));
    const res = (await b.auth.login('a@b.tn', PASSWORD, {})) as AuthResult;
    expect(res.accessToken).toBeTruthy();
  });
});

describe('mise en place, désactivation, réinitialisation', () => {
  const actor = (o: Record<string, unknown> = {}) => ({ ...toAuthUser(user(o)), ...o }) as never;

  it('mise en place : QR code puis activation avec un code ; 10 codes de secours ; secret chiffré en base', async () => {
    const b = build(user({ totpEnabledAt: null, totpSecret: null }));
    const setup = await b.twoFactor.setup(actor({ totpEnabledAt: null }));
    expect(setup.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(setup.otpauthUrl).toContain('otpauth://totp/');
    const pending = b.prisma.user.update.mock.calls[0][0].data.totpPendingSecret as string;
    expect(pending).not.toContain(setup.secret);
    b.prisma.user.findUniqueOrThrow.mockResolvedValue(user({ totpEnabledAt: null, totpSecret: null, totpPendingSecret: pending }));
    await expect(b.twoFactor.enable(actor(), '000000', {})).rejects.toMatchObject({ status: 400 });
    const res = await b.twoFactor.enable(actor(), authenticator.generate(setup.secret), {});
    expect(res.recoveryCodes).toHaveLength(10);
    const saved = b.prisma.user.update.mock.calls.at(-1)[0].data;
    expect(saved.totpSecret).toBe(pending);
    expect(saved.totpRecoveryCodes.every((h: string) => h.startsWith('$argon2'))).toBe(true);
  });

  it('un administrateur ne peut pas désactiver sa double authentification', async () => {
    const b = build(user({ role: role('ADMIN') }));
    await expect(b.twoFactor.disable(actor({ roleCode: 'ADMIN' }), PASSWORD, authenticator.generate(SECRET), {})).rejects.toMatchObject({ status: 403 });
  });

  it('un conseiller peut la désactiver avec son mot de passe et un code', async () => {
    const b = build(user());
    await expect(b.twoFactor.disable(actor(), 'mauvais', authenticator.generate(SECRET), {})).rejects.toMatchObject({ status: 400 });
    await b.twoFactor.disable(actor(), PASSWORD, authenticator.generate(SECRET), {});
    expect(b.prisma.user.update.mock.calls.at(-1)[0].data).toMatchObject({ totpSecret: null, totpEnabledAt: null });
  });

  it('réinitialisation par le Super Admin : limitée à son agence, sessions fermées, journalisée', async () => {
    const b = build(user());
    await b.twoFactor.reset(actor({ roleCode: 'SUPER_ADMIN' }), 'u1', {});
    expect(b.prisma.user.findFirst.mock.calls.at(-1)[0].where).toMatchObject({ id: 'u1', organizationId: 'org1' });
    expect(b.prisma.$transaction).toHaveBeenCalled();
    expect(b.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.2fa_reset' }));
  });
});

describe('TwoFactorSetupGuard', () => {
  const ctx = (u: object | undefined, allowed: boolean) => {
    const reflector = { getAllAndOverride: () => allowed } as unknown as Reflector;
    const context = { getType: () => 'http', getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user: u }) }) };
    return { guard: new TwoFactorSetupGuard(reflector), context: context as never };
  };

  it('bloque un administrateur sans double authentification (403), sauf les routes de mise en place', () => {
    const blocked = ctx({ mustSetupTwoFactor: true }, false);
    expect(() => blocked.guard.canActivate(blocked.context)).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: 'TWO_FACTOR_SETUP_REQUIRED' }) }));
    const allowed = ctx({ mustSetupTwoFactor: true }, true);
    expect(allowed.guard.canActivate(allowed.context)).toBe(true);
  });

  it('laisse passer les autres comptes et les routes publiques', () => {
    const other = ctx({ mustSetupTwoFactor: false }, false);
    expect(other.guard.canActivate(other.context)).toBe(true);
    const anon = ctx(undefined, false);
    expect(anon.guard.canActivate(anon.context)).toBe(true);
  });
});
