import { PlatformAdminService } from './platform-admin.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'platform-admin-1', organizationId: 'orgA', branchId: null, email: 'mohamed@studyinworld.net',
  firstName: 'Mohamed', lastName: 'B', locale: 'fr', mustChangePassword: false, roleId: 'r1',
  roleCode: 'SUPER_ADMIN', roleName: 'Super Admin', permissions: [], isPlatformAdmin: true,
});

function build() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'newAdminUser', ...(data as object) })) },
    permission: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]) },
    organization: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'newOrg', ...(data as object) })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    agencySettings: { create: jest.fn().mockResolvedValue({}) },
    branch: { create: jest.fn().mockResolvedValue({ id: 'branch1' }) },
    role: { create: jest.fn().mockResolvedValue({ id: 'role1' }) },
    rolePermission: { createMany: jest.fn().mockResolvedValue({}) },
    platformInvoice: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'inv1', ...(data as object) })),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'inv1', ...(data as object) })),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new PlatformAdminService(prisma as never, audit as never), prisma };
}

describe('PlatformAdminService.create — scaffoldage d’une nouvelle agence', () => {
  it('crée organisation, paramètres, branche, rôle Super Admin (toutes les permissions) et le premier compte', async () => {
    const { service, prisma } = build();
    const result = await service.create(actor(), {
      name: 'Nouvelle Agence', adminEmail: 'admin@nouvelle-agence.tn', adminFirstName: 'Sami', adminLastName: 'Ben Ali', adminPassword: 'MotDePasse123',
    }, {});

    expect(prisma.organization.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Nouvelle Agence', slug: 'nouvelle-agence', plan: 'TRIAL' }) }));
    expect(prisma.agencySettings.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'newOrg' }) }));
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [{ roleId: 'role1', permissionId: 'p1' }, { roleId: 'role1', permissionId: 'p2' }],
    }));
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'newOrg', roleId: 'role1', email: 'admin@nouvelle-agence.tn', mustChangePassword: true }),
    }));
    expect(result.organization.id).toBe('newOrg');
  });

  it('refuse si l’e-mail de l’administrateur est déjà utilisé par un employé, de n’importe quelle agence', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-elsewhere' });
    await expect(service.create(actor(), {
      name: 'Autre Agence', adminEmail: 'deja-pris@x.tn', adminFirstName: 'A', adminLastName: 'B', adminPassword: 'MotDePasse123',
    }, {})).rejects.toMatchObject({ status: 409 });
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('ajoute un suffixe numérique si le slug dérivé du nom existe déjà', async () => {
    const { service, prisma } = build();
    prisma.organization.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);
    await service.create(actor(), {
      name: 'Study in World', adminEmail: 'admin2@x.tn', adminFirstName: 'A', adminLastName: 'B', adminPassword: 'MotDePasse123',
    }, {});
    expect(prisma.organization.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ slug: 'study-in-world-2' }) }));
  });

  it('refuse la création si le catalogue de permissions n’a pas encore été initialisé sur ce serveur', async () => {
    const { service, prisma } = build();
    prisma.permission.findMany.mockResolvedValue([]);
    await expect(service.create(actor(), {
      name: 'Agence', adminEmail: 'x@x.tn', adminFirstName: 'A', adminLastName: 'B', adminPassword: 'MotDePasse123',
    }, {})).rejects.toMatchObject({ status: 500 });
  });
});

describe('PlatformAdminService — facturation manuelle (aucun prestataire de paiement)', () => {
  it('createInvoice() enregistre une facture pour l’agence donnée', async () => {
    const { service, prisma } = build();
    prisma.organization.findUnique.mockResolvedValue({ id: 'orgA', _count: {} });
    await service.createInvoice(actor(), 'orgA', {
      amount: 150, periodStart: '2026-01-01', periodEnd: '2026-01-31', dueDate: '2026-02-05',
    }, {});
    expect(prisma.platformInvoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'orgA', amount: 150, currency: 'TND' }),
    }));
  });

  it('listInvoices() calcule isOverdue à la lecture pour une facture PENDING dont l’échéance est passée, sans jamais réécrire son statut', async () => {
    const { service, prisma } = build();
    prisma.organization.findUnique.mockResolvedValue({ id: 'orgA', _count: {} });
    prisma.platformInvoice.findMany.mockResolvedValue([
      { id: 'inv1', status: 'PENDING', dueDate: new Date('2020-01-01') },
      { id: 'inv2', status: 'PAID', dueDate: new Date('2020-01-01') },
    ]);
    const result = await service.listInvoices('orgA');
    expect(result[0]).toMatchObject({ id: 'inv1', status: 'PENDING', isOverdue: true });
    expect(result[1]).toMatchObject({ id: 'inv2', status: 'PAID', isOverdue: false });
    expect(prisma.platformInvoice.update).not.toHaveBeenCalled();
  });

  it('updateInvoice() fixe paidAt uniquement quand le statut passe à PAID', async () => {
    const { service, prisma } = build();
    prisma.platformInvoice.findFirst.mockResolvedValue({ id: 'inv1', organizationId: 'orgA' });
    await service.updateInvoice(actor(), 'orgA', 'inv1', { status: 'PAID' }, {});
    expect(prisma.platformInvoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PAID', paidAt: expect.any(Date) }),
    }));
  });

  it('updateInvoice() refuse une facture d’une autre agence (isolation)', async () => {
    const { service, prisma } = build();
    prisma.platformInvoice.findFirst.mockResolvedValue(null); // le filtre organizationId de la requête l'exclut déjà
    await expect(service.updateInvoice(actor(), 'orgA', 'inv-from-another-org', { status: 'PAID' }, {})).rejects.toMatchObject({ status: 404 });
  });
});
