import { PartnersService } from './partners.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['partner.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    partner: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'p1', ...(data as object) })), update: jest.fn() },
    candidate: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (arr: Promise<unknown>[]) => Promise.all(arr)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new PartnersService(prisma as never, audit as never), prisma };
}

describe('PartnersService', () => {
  it('crée un partenaire avec les données fournies', async () => {
    const { service, prisma } = build();
    const created = await service.create(actor(), { type: 'AGENT', companyName: 'ABC Agency' }, {});
    expect(prisma.partner.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'orgA', companyName: 'ABC Agency' }) }));
    expect((created as { id: string }).id).toBe('p1');
  });

  it('refuse de récupérer un partenaire introuvable ou d’une autre organisation', async () => {
    const { service, prisma } = build();
    prisma.partner.findFirst.mockResolvedValue(null);
    await expect(service.get(actor(), 'p-other-org')).rejects.toMatchObject({ status: 404 });
  });

  it('candidates() liste uniquement les candidats liés à ce partenaire', async () => {
    const { service, prisma } = build();
    prisma.partner.findFirst.mockResolvedValue({ id: 'p1' });
    await service.candidates(actor(), 'p1');
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ partnerId: 'p1' }) }));
  });
});
