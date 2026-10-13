import { CashboxService } from './cashbox.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ACCOUNTANT', roleName: 'Comptable',
  permissions: ['cashbox.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    cashboxSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    cashboxMovement: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new CashboxService(prisma as never, audit as never), prisma, audit };
}

describe('CashboxService', () => {
  it('refuse d’ouvrir une deuxième session pour une branche déjà ouverte', async () => {
    const { service, prisma } = build();
    prisma.cashboxSession.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.open(actor(), { openingAmount: 100 }, {})).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'CASHBOX_ALREADY_OPEN' }) });
  });

  it('refuse un mouvement si aucune session n’est ouverte', async () => {
    const { service, prisma } = build();
    prisma.cashboxSession.findFirst.mockResolvedValue(null);
    await expect(service.addMovement('orgA', 'b1', 'IN', 50, 'test', {}, 'u1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CASHBOX_CLOSED' }) });
  });

  it('calcule le solde attendu (ouverture + entrées − sorties) à la clôture', async () => {
    const { service, prisma } = build();
    prisma.cashboxSession.findFirst.mockResolvedValue({ id: 's1', organizationId: 'orgA', openingAmount: 100, closedAt: null });
    prisma.cashboxMovement.findMany.mockResolvedValue([{ type: 'IN', amount: 500 }, { type: 'OUT', amount: 80 }]);
    await service.close(actor(), 's1', { closingAmount: 520 }, {});
    expect(prisma.cashboxSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ expectedAmount: 520, closingAmount: 520 }) }),
    );
    // écart tracé dans l'audit : 520 compté − 520 attendu = 0 (mais le calcul doit être visible pour un écart non nul)
    expect(prisma.cashboxSession.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1' } }));
  });

  it('refuse de clôturer une session déjà clôturée', async () => {
    const { service, prisma } = build();
    prisma.cashboxSession.findFirst.mockResolvedValue({ id: 's1', organizationId: 'orgA', closedAt: new Date(), openingAmount: 100 });
    await expect(service.close(actor(), 's1', { closingAmount: 100 }, {})).rejects.toMatchObject({ status: 409 });
  });
});
