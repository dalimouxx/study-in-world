import { ProspectsService } from './prospects.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['prospect.view', 'prospect.manage'],
  isPlatformAdmin: false,
});

function build() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    prospect: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    candidate: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn(async (arg: unknown) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[])));
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
  return { service: new ProspectsService(prisma as never, audit as never, timeline as never), prisma, audit, timeline };
}

describe('ProspectsService — dédoublonnage', () => {
  it('refuse la création si un prospect a déjà ce numéro', async () => {
    const { service, prisma } = build();
    prisma.prospect.findMany.mockResolvedValue([{ id: 'p-existing', firstName: 'X', lastName: 'Y', status: 'NEW' }]);
    await expect(
      service.create(actor(), { firstName: 'A', lastName: 'B', phone: '20123456' }, {}),
    ).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'DUPLICATE_CONTACT' }) });
    expect(prisma.prospect.create).not.toHaveBeenCalled();
  });

  it('refuse aussi si le doublon est déjà un candidat', async () => {
    const { service, prisma } = build();
    prisma.candidate.findMany.mockResolvedValue([{ id: 'c-existing', firstName: 'X', lastName: 'Y', status: 'ACTIVE' }]);
    await expect(service.create(actor(), { firstName: 'A', lastName: 'B', phone: '20123456' }, {})).rejects.toMatchObject({ status: 409 });
  });

  it('force:true contourne la vérification de doublon', async () => {
    const { service, prisma } = build();
    prisma.prospect.findMany.mockResolvedValue([{ id: 'p-existing' }]);
    prisma.prospect.create.mockResolvedValue({ id: 'new', status: 'NEW' });
    await service.create(actor(), { firstName: 'A', lastName: 'B', phone: '20123456', force: true }, {});
    expect(prisma.prospect.create).toHaveBeenCalled();
  });

  it('crée normalement sans doublon', async () => {
    const { service, prisma } = build();
    prisma.prospect.create.mockResolvedValue({ id: 'new', status: 'NEW' });
    await service.create(actor(), { firstName: 'A', lastName: 'B', phone: '20999999' }, {});
    expect(prisma.prospect.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: 'orgA', phone: '20999999' }) }),
    );
  });
});

describe('ProspectsService — conversion', () => {
  it('crée un candidat, marque le prospect CONVERTED et les relie', async () => {
    const { service, prisma } = build();
    prisma.prospect.findFirst.mockResolvedValue({
      id: 'p1', status: 'QUALIFIED', firstName: 'A', lastName: 'B', phone: '20123456', email: null, branchId: 'b1', assignedToId: 'u1',
    });
    prisma.candidate.create.mockResolvedValue({ id: 'cand1' });
    const result = await service.convert(actor(), 'p1', {});
    expect(result.id).toBe('cand1');
    expect(prisma.prospect.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'CONVERTED', convertedCandidateId: 'cand1' } });
  });

  it('refuse de convertir un prospect déjà converti', async () => {
    const { service, prisma } = build();
    prisma.prospect.findFirst.mockResolvedValue({ id: 'p1', status: 'CONVERTED' });
    await expect(service.convert(actor(), 'p1', {})).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'ALREADY_CONVERTED' }) });
  });
});
