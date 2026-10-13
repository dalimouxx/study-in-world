import { CandidateAuthService } from './candidate-auth.service';

function build() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    candidate: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}), findFirstOrThrow: jest.fn() },
    candidateLoginLog: { create: jest.fn().mockResolvedValue({}) },
    candidateRefreshToken: { create: jest.fn().mockResolvedValue({}), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    candidateAccessToken: { create: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
  };
  prisma.$transaction = jest.fn(async (arr: Promise<unknown>[]) => Promise.all(arr));
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCK_MINUTES: 15, CANDIDATE_JWT_SECRET: undefined, JWT_SECRET: 'x'.repeat(32),
        CANDIDATE_JWT_ACCESS_TTL: '30m', CANDIDATE_REFRESH_TTL_DAYS: 90, FRONTEND_URL: 'http://localhost:3000',
      };
      return values[key];
    }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  return { service: new CandidateAuthService(prisma, jwt as never, config as never, audit as never, mail as never), prisma, mail };
}

describe('CandidateAuthService.login', () => {
  it('refuse un candidat sans mot de passe (jamais activé)', async () => {
    const { service, prisma } = build();
    prisma.candidate.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'orgA', passwordHash: null, status: 'ACTIVE' });
    await expect(service.login('a@a.tn', 'x', {})).rejects.toMatchObject({ status: 401, response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }) });
  });

  it('refuse un candidat archivé même avec le bon mot de passe', async () => {
    const { service, prisma } = build();
    prisma.candidate.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'orgA', passwordHash: 'hash', status: 'ARCHIVED', failedLoginCount: 0 });
    await expect(service.login('a@a.tn', 'x', {})).rejects.toMatchObject({ status: 401 });
  });

  it('verrouille après le nombre maximum de tentatives échouées', async () => {
    const { service, prisma } = build();
    prisma.candidate.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'orgA', passwordHash: '$argon2id$fake', status: 'ACTIVE', failedLoginCount: 4, lockedUntil: null });
    await expect(service.login('a@a.tn', 'wrong', {})).rejects.toMatchObject({ status: 401 });
    expect(prisma.candidate.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: expect.any(Date) }) }));
  });
});

describe('CandidateAuthService.invite', () => {
  it('refuse d’inviter un candidat sans e-mail', async () => {
    const { service, prisma } = build();
    prisma.candidate.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'orgA', email: null, firstName: 'A' });
    await expect(service.invite({ organizationId: 'orgA' } as never, 'c1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'EMAIL_REQUIRED' }) });
  });

  it('envoie un e-mail avec un lien d’activation quand l’e-mail est présent', async () => {
    const { service, prisma, mail } = build();
    prisma.candidate.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'orgA', email: 'candidat@example.com', firstName: 'Amine' });
    await service.invite({ organizationId: 'orgA', id: 'u1' } as never, 'c1');
    expect(prisma.candidateAccessToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ candidateId: 'c1', kind: 'ACTIVATE' }) }));
    expect(mail.send).toHaveBeenCalledWith('candidat@example.com', expect.any(String), expect.stringContaining('/portal/activate?token='));
  });
});

describe('CandidateAuthService — jetons de session distincts des employés', () => {
  it('issueTokens signe avec aud: candidate-portal et un secret dédié, distinct des employés', async () => {
    const { service } = build();
    const candidate = { id: 'c1', organizationId: 'orgA', email: 'a@a.tn', firstName: 'A', lastName: 'B' };
    const signAsync = (service as unknown as { jwt: { signAsync: jest.Mock } }).jwt.signAsync;
    await service['issueTokens'](candidate, {});
    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'c1', org: 'orgA', aud: 'candidate-portal' }),
      expect.objectContaining({ secret: 'x'.repeat(32) }),
    );
  });
});
