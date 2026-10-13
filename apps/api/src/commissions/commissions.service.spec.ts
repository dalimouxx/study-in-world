import { CommissionsService } from './commissions.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ACCOUNTANT', roleName: 'Comptable',
  permissions: ['finance.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    candidate: { findUniqueOrThrow: jest.fn() },
    commission: { create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'com1', status: 'TO_CONFIRM', ...(data as object) })), findFirst: jest.fn(), update: jest.fn() },
  };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new CommissionsService(prisma as never, candidates as never, audit as never, timeline as never), prisma };
}

describe('CommissionsService.create', () => {
  it('refuse de créer une commission pour un candidat sans partenaire', async () => {
    const { service, prisma } = build();
    prisma.candidate.findUniqueOrThrow.mockResolvedValue({ id: 'cand1', partnerId: null });
    await expect(service.create(actor(), 'cand1', { amount: 100 }, {})).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CANDIDATE_HAS_NO_PARTNER' }) });
  });

  it('dérive toujours le partnerId du candidat, jamais d’un paramètre libre', async () => {
    const { service, prisma } = build();
    prisma.candidate.findUniqueOrThrow.mockResolvedValue({ id: 'cand1', partnerId: 'partnerA' });
    const created = await service.create(actor(), 'cand1', { amount: 250 }, {});
    expect((created as { partnerId: string }).partnerId).toBe('partnerA');
    expect(prisma.commission.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ partnerId: 'partnerA', amount: 250 }) }));
  });
});
