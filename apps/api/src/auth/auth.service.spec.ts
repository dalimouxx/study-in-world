import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

const PASSWORD = 'Correct-Password1';
let hash: string;

const baseUser = () => ({
  id: 'u1',
  organizationId: 'org1',
  branchId: null,
  email: 'a@b.tn',
  firstName: 'A',
  lastName: 'B',
  locale: 'fr',
  mustChangePassword: false,
  roleId: 'r1',
  status: 'ACTIVE',
  passwordHash: hash,
  failedLoginCount: 0,
  lockedUntil: null as Date | null,
  deletedAt: null,
  role: { code: 'ADVISOR', name: 'Conseiller', permissions: [] },
});

function build(user: ReturnType<typeof baseUser> | null) {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue({}) },
    loginLog: { create: jest.fn().mockResolvedValue({}) },
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const config = { get: (k: string) => ({ LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15, REFRESH_TTL_DAYS: 30 })[k] };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const mail = { send: jest.fn() };
  const service = new AuthService(prisma as never, jwt as never, config as never, audit as never, mail as never);
  return { service, prisma, audit };
}

beforeAll(async () => {
  hash = await argon2.hash(PASSWORD);
});

describe('AuthService.login', () => {
  it('connecte avec les bons identifiants et remet le compteur à zéro', async () => {
    const { service, prisma } = build({ ...baseUser(), failedLoginCount: 3 });
    const res = await service.login('A@B.tn ', PASSWORD, {});
    expect(res.accessToken).toBe('access.jwt');
    expect(res.refreshToken.length).toBeGreaterThan(40);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }) }),
    );
    // le token est stocké haché, jamais en clair
    const stored = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash as string;
    expect(stored).not.toBe(res.refreshToken);
  });

  it('verrouille le compte à la 5e erreur', async () => {
    const { service, prisma } = build({ ...baseUser(), failedLoginCount: 4 });
    await expect(service.login('a@b.tn', 'mauvais', {})).rejects.toMatchObject({ status: 401 });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.lockedUntil).toBeInstanceOf(Date);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('refuse (429) un compte verrouillé, même avec le bon mot de passe', async () => {
    const { service } = build({ ...baseUser(), lockedUntil: new Date(Date.now() + 60_000) });
    await expect(service.login('a@b.tn', PASSWORD, {})).rejects.toMatchObject({ status: 429 });
  });

  it('même erreur pour un e-mail inconnu (pas d’énumération de comptes)', async () => {
    const { service } = build(null);
    await expect(service.login('nobody@x.tn', 'x', {})).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
    });
  });

  it('refuse un compte désactivé', async () => {
    const { service } = build({ ...baseUser(), status: 'INACTIVE' });
    await expect(service.login('a@b.tn', PASSWORD, {})).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthService.refresh', () => {
  it('révoque toutes les sessions si un refresh token déjà utilisé est rejoué', async () => {
    const { service, prisma } = build(baseUser());
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 1e6) });
    await expect(service.refresh('rejoue', {})).rejects.toMatchObject({ status: 401 });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
  });

  it('tolère un rejeu dans les 10 s (deux onglets) sans couper toutes les sessions', async () => {
    const { service, prisma } = build(baseUser());
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1e6) });
    await expect(service.refresh('rejoue', {})).rejects.toMatchObject({ status: 401 });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('refuse un token expiré ou absent', async () => {
    const { service, prisma } = build(baseUser());
    await expect(service.refresh(undefined, {})).rejects.toMatchObject({ status: 401 });
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() - 1) });
    await expect(service.refresh('x', {})).rejects.toMatchObject({ status: 401 });
  });

  it('fait tourner le token : ancien révoqué, nouveau émis', async () => {
    const { service, prisma } = build(baseUser());
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 1e6) });
    const res = await service.refresh('valide', {});
    expect(res.refreshToken).not.toBe('valide');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1' } }));
  });
});
