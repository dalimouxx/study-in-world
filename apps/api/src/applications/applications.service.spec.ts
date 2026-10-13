import { ApplicationsService } from './applications.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['application.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = { application: { create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'app1', ...(data as object) })) } };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const programs = {
    get: jest.fn().mockResolvedValue({ id: 'prog1', name: 'Master Informatique', university: { name: 'Université de Rome', country: { name: 'Italie' } } }),
  };
  const automation = { fire: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new ApplicationsService(prisma as never, candidates as never, programs as never, automation as never, audit as never, timeline as never), prisma, programs };
}

describe('ApplicationsService.create', () => {
  it('dérive pays/université/programme depuis le catalogue quand programId est fourni', async () => {
    const { service, prisma } = build();
    await service.create(actor(), 'cand1', { programId: 'prog1', intake: 'Automne 2026' }, {});
    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ country: 'Italie', university: 'Université de Rome', program: 'Master Informatique' }) }),
    );
  });

  it('refuse si ni programId ni les champs libres ne sont fournis', async () => {
    const { service } = build();
    await expect(service.create(actor(), 'cand1', { intake: 'Automne 2026' }, {})).rejects.toMatchObject({ status: 400 });
  });

  it('accepte les champs libres sans programId (établissement non catalogué)', async () => {
    const { service, prisma } = build();
    await service.create(actor(), 'cand1', { country: 'France', university: 'Sorbonne', program: 'Licence Droit', intake: 'Automne 2026' }, {});
    expect(prisma.application.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ country: 'France', university: 'Sorbonne', program: 'Licence Droit' }) }),
    );
  });
});
