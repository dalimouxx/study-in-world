import { PartnerAuthService } from './partner-auth.service';

function build() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    partnerUser: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}), findFirstOrThrow: jest.fn(), create: jest.fn() },
    partnerLoginLog: { create: jest.fn().mockResolvedValue({}) },
    partnerRefreshToken: { create: jest.fn().mockResolvedValue({}), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    partnerAccessToken: { create: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
    partner: { findFirst: jest.fn() },
  };
  prisma.$transaction = jest.fn(async (arr: Promise<unknown>[]) => Promise.all(arr));
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15, PARTNER_JWT_SECRET: undefined, JWT_SECRET: 'x'.repeat(32),
        PARTNER_JWT_ACCESS_TTL: '30m', PARTNER_REFRESH_TTL_DAYS: 90, FRONTEND_URL: 'http://localhost:3000',
      };
      return values[key];
    }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  return { service: new PartnerAuthService(prisma, jwt as never, config as never, audit as never, mail as never), prisma, mail };
}

describe('PartnerAuthService.login', () => {
  it('refuse un utilisateur sans mot de passe (jamais activé)', async () => {
    const { service, prisma } = build();
    prisma.partnerUser.findFirst.mockResolvedValue({ id: 'pu1', organizationId: 'orgA', passwordHash: null });
    await expect(service.login('a@a.tn', 'x', {})).rejects.toMatchObject({ status: 401, response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }) });
  });

  it('verrouille après le nombre maximum de tentatives échouées', async () => {
    const { service, prisma } = build();
    prisma.partnerUser.findFirst.mockResolvedValue({ id: 'pu1', organizationId: 'orgA', passwordHash: '$argon2id$fake', failedLoginCount: 4, lockedUntil: null });
    await expect(service.login('a@a.tn', 'wrong', {})).rejects.toMatchObject({ status: 401 });
    expect(prisma.partnerUser.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: expect.any(Date) }) }));
  });
});

describe('PartnerAuthService.createAndInvite', () => {
  it('refuse d’inviter pour un partenaire introuvable', async () => {
    const { service, prisma } = build();
    prisma.partner.findFirst.mockResolvedValue(null);
    await expect(service.createAndInvite({ organizationId: 'orgA' } as never, 'p1', { email: 'a@a.tn', firstName: 'A', lastName: 'B' })).rejects.toMatchObject({ status: 404 });
  });

  it('crée le compte et envoie le lien d’activation', async () => {
    const { service, prisma, mail } = build();
    prisma.partner.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'orgA' });
    prisma.partnerUser.create.mockResolvedValue({ id: 'pu1' });
    await service.createAndInvite({ organizationId: 'orgA', id: 'u1' } as never, 'p1', { email: 'contact@partner.tn', firstName: 'Sami', lastName: 'X' });
    expect(prisma.partnerUser.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ partnerId: 'p1', email: 'contact@partner.tn' }) }));
    expect(mail.send).toHaveBeenCalledWith('contact@partner.tn', expect.any(String), expect.stringContaining('/partner-portal/activate?token='));
  });
});

describe('PartnerAuthService — jetons distincts des employés et des candidats', () => {
  it('signe avec aud: partner-portal et le claim partner', async () => {
    const { service } = build();
    const partnerUser = { id: 'pu1', organizationId: 'orgA', partnerId: 'p1', email: 'a@a.tn', firstName: 'A', lastName: 'B' };
    const signAsync = (service as unknown as { jwt: { signAsync: jest.Mock } }).jwt.signAsync;
    await service['issueTokens'](partnerUser, {});
    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'pu1', org: 'orgA', partner: 'p1', aud: 'partner-portal' }),
      expect.objectContaining({ secret: 'x'.repeat(32) }),
    );
  });
});
