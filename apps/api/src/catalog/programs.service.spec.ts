import { ProgramsService } from './programs.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['catalog.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    program: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (arr: Promise<unknown>[]) => Promise.all(arr)),
  };
  const universities = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new ProgramsService(prisma as never, universities as never, audit as never), prisma };
}

describe('ProgramsService.search — filtres', () => {
  it('filtre par budget maximum (tuitionFees <= maxBudget)', async () => {
    const { service, prisma } = build();
    await service.search('orgA', { page: 1, pageSize: 20, maxBudget: 5000 });
    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tuitionFees: { lte: 5000 } }) }),
    );
  });

  it('filtre par IELTS : accepte les programmes sans exigence ou avec exigence <= score du candidat', async () => {
    const { service, prisma } = build();
    await service.search('orgA', { page: 1, pageSize: 20, ielts: 6.5 });
    expect(prisma.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: [{ minIelts: null }, { minIelts: { lte: 6.5 } }] }) }),
    );
  });

  it('exclut les programmes inactifs par défaut', async () => {
    const { service, prisma } = build();
    await service.search('orgA', { page: 1, pageSize: 20 });
    expect(prisma.program.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }));
  });
});

describe('ProgramsService.create — génération de slug unique', () => {
  it('ajoute un suffixe -2 si le slug existe déjà', async () => {
    const { service, prisma } = build();
    prisma.program.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0); // 'master-info' pris, 'master-info-2' libre
    prisma.program.create.mockImplementation(({ data }: { data: { slug: string } }) => Promise.resolve({ id: 'p1', ...data }));
    const created = await service.create(
      actor(),
      { universityId: 'uni1', name: 'Master Info', level: 'MASTER' as never },
      {},
    );
    expect((created as { slug: string }).slug).toBe('master-info-2');
  });
});
