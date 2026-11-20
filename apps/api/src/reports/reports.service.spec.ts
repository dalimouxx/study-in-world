import { ReportsService } from './reports.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ACCOUNTANT', roleName: 'Comptable',
  permissions: ['finance.view'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    payment: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    expense: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  return { service: new ReportsService(prisma as never, candidates as never), prisma };
}

describe('ReportsService.candidateProfitability', () => {
  it('calcule la marge = revenus (paiements) − dépenses attribuées', async () => {
    const { service, prisma } = build();
    prisma.payment.findMany.mockResolvedValue([{ amount: 1000 }, { amount: 500 }]);
    prisma.expense.findMany.mockResolvedValue([{ amount: 200, category: 'Traduction', description: 'x', date: new Date() }]);
    const result = await service.candidateProfitability(actor(), 'cand1');
    expect(result.revenue).toBe(1500);
    expect(result.expenses).toBe(200);
    expect(result.margin).toBe(1300);
    expect(result.marginPercent).toBeCloseTo((1300 / 1500) * 100);
  });

  it('marginPercent est 0 sans revenu, pas une division par zéro', async () => {
    const { service } = build();
    const result = await service.candidateProfitability(actor(), 'cand1');
    expect(result.marginPercent).toBe(0);
  });
});

describe('ReportsService.forecast', () => {
  it('sépare le montant à encaisser du montant en retard selon la date d’échéance', async () => {
    const { service, prisma } = build();
    const past = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 86_400_000);
    prisma.invoice.findMany.mockResolvedValue([
      { dueDate: past, items: [{ quantity: 1, unitPrice: 500 }], payments: [] }, // en retard
      { dueDate: future, items: [{ quantity: 1, unitPrice: 300 }], payments: [{ amount: 100 }] }, // pas encore dû
    ]);
    const result = await service.forecast(actor(), '30d');
    expect(result.toCollect).toBe(500 + 200);
    expect(result.overdue).toBe(500);
  });

  it('le flux de trésorerie net est encaissé moins dépenses', async () => {
    const { service, prisma } = build();
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 2000 } });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 300 } });
    const result = await service.forecast(actor(), '7d');
    expect(result.netCashFlow).toBe(1700);
  });
});
