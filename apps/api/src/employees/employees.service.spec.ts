import { EmployeesService } from './employees.service';
import type { AuthUser } from '../common/auth-user';

const actor = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: 'actor',
  organizationId: 'orgA',
  branchId: null,
  email: 'admin@a.tn',
  firstName: 'Ad',
  lastName: 'Min',
  locale: 'fr',
  mustChangePassword: false,
  roleId: 'rAdmin',
  roleCode: 'ADMIN',
  roleName: 'Administrateur',
  permissions: ['employee.view', 'employee.create', 'employee.edit', 'employee.delete'],
  isPlatformAdmin: false,
  ...over,
});

function build() {
  const prisma = {
    user: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    role: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new EmployeesService(prisma as never, audit as never), prisma, audit };
}

const target = (roleCode: string, id = 't1') => ({
  id,
  email: 't@a.tn',
  roleId: 'rT',
  status: 'ACTIVE',
  role: { id: 'rT', code: roleCode, name: roleCode },
});

describe('EmployeesService — isolation entre agences', () => {
  it('list() filtre toujours sur l’organisation de l’appelant et exclut les supprimés', async () => {
    const { service, prisma } = build();
    await service.list(actor(), { page: 1, pageSize: 20 });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: expect.objectContaining({ organizationId: 'orgA', deletedAt: null }) });
  });

  it('get() d’un employé d’une autre agence => 404', async () => {
    const { service, prisma } = build();
    prisma.user.findFirst.mockResolvedValue(null); // la requête est scopée : l'autre org ne remonte pas
    await expect(service.get(actor(), 'user-of-orgB')).rejects.toMatchObject({ status: 404 });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'user-of-orgB', organizationId: 'orgA' }) }),
    );
  });

  it('create() refuse un rôle qui n’appartient pas à l’agence', async () => {
    const { service, prisma } = build();
    prisma.role.findFirst.mockResolvedValue(null);
    await expect(
      service.create(actor(), { email: 'x@y.tn', firstName: 'X', lastName: 'Y', roleId: 'role-orgB', password: 'Abcdefghi1' }, {}),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.role.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'role-orgB', organizationId: 'orgA' } }));
  });
});

describe('EmployeesService — anti-escalade et garde-fous', () => {
  it('un Administrateur ne peut pas créer un Super Admin', async () => {
    const { service, prisma } = build();
    prisma.role.findFirst.mockResolvedValue({ id: 'rSA', code: 'SUPER_ADMIN', permissions: [] });
    await expect(
      service.create(actor(), { email: 'x@y.tn', firstName: 'X', lastName: 'Y', roleId: 'rSA', password: 'Abcdefghi1' }, {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('on ne peut pas attribuer un rôle plus puissant que le sien', async () => {
    const { service, prisma } = build();
    prisma.role.findFirst.mockResolvedValue({ id: 'rX', code: 'CUSTOM_X', permissions: [{ permission: { code: 'settings.manage' } }] });
    await expect(
      service.create(actor(), { email: 'x@y.tn', firstName: 'X', lastName: 'Y', roleId: 'rX', password: 'Abcdefghi1' }, {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('impossible de supprimer son propre compte', async () => {
    const { service } = build();
    await expect(service.remove(actor({ id: 'me' }), 'me', {})).rejects.toMatchObject({ status: 403 });
  });

  it('impossible de supprimer le dernier Super Admin actif', async () => {
    const { service, prisma } = build();
    prisma.user.findFirst.mockResolvedValue(target('SUPER_ADMIN'));
    prisma.user.count.mockResolvedValue(0); // aucun autre Super Admin
    await expect(service.remove(actor({ roleCode: 'SUPER_ADMIN' }), 't1', {})).rejects.toMatchObject({ status: 409 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('suppression logique + révocation des sessions', async () => {
    const { service, prisma, audit } = build();
    prisma.user.findFirst.mockResolvedValue(target('ADVISOR'));
    await service.remove(actor(), 't1', {});
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), status: 'INACTIVE' }) }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'employee.delete' }));
  });

  it('l’audit d’une réinitialisation de mot de passe ne contient jamais le mot de passe', async () => {
    const { service, prisma, audit } = build();
    prisma.user.findFirst.mockResolvedValue(target('ADVISOR'));
    prisma.user.update.mockResolvedValue({ role: { code: 'ADVISOR' } });
    await service.update(actor(), 't1', { password: 'Nouveau-Mdp1234' }, {});
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('Nouveau-Mdp1234');
  });
});
