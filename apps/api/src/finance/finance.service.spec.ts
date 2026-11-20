import { FinanceService } from './finance.service';
import type { AuthUser } from '../common/auth-user';

const actor = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ACCOUNTANT', roleName: 'Comptable',
  permissions: ['finance.view', 'finance.manage'],
  isPlatformAdmin: false,
  ...over,
});

function build() {
  const invoice = {
    id: 'inv1', organizationId: 'orgA', candidateId: 'cand1', number: 'FAC-2026-0001',
    currency: 'TND', status: 'ISSUED',
    items: [{ label: 'Frais de dossier', quantity: 1, unitPrice: 500 }],
    payments: [] as { amount: number }[],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    invoice: { findFirst: jest.fn().mockResolvedValue(invoice), update: jest.fn().mockResolvedValue({}) },
    payment: { create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'pay1', ...(data as object) })) },
    quote: { findFirst: jest.fn() },
    candidate: { findUniqueOrThrow: jest.fn() },
    agencySettings: { findUnique: jest.fn() },
  };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const counter = { next: jest.fn().mockResolvedValue('REC-2026-0001') };
  const cashbox = { addMovement: jest.fn().mockResolvedValue({}) };
  const pdfSvc = { document: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new FinanceService(prisma, candidates as never, counter as never, cashbox as never, pdfSvc as never, audit as never, timeline as never);
  return { service, prisma, cashbox, invoice };
}

describe('FinanceService.recordPayment', () => {
  it('un paiement en espèces exige une caisse ouverte (répercuté par CashboxService)', async () => {
    const { service, cashbox } = build();
    cashbox.addMovement = jest.fn().mockRejectedValue(Object.assign(new Error('closed'), { status: 409, response: { code: 'CASHBOX_CLOSED' } }));
    await expect(service.recordPayment(actor(), 'inv1', { amount: 200, method: 'CASH' }, {})).rejects.toMatchObject({ response: { code: 'CASHBOX_CLOSED' } });
  });

  it('un paiement par virement ne touche pas la caisse', async () => {
    const { service, cashbox } = build();
    await service.recordPayment(actor(), 'inv1', { amount: 500, method: 'BANK_TRANSFER' }, {});
    expect(cashbox.addMovement).not.toHaveBeenCalled();
  });

  it('refuse un paiement supérieur au solde restant', async () => {
    const { service } = build();
    await expect(service.recordPayment(actor(), 'inv1', { amount: 600, method: 'BANK_TRANSFER' }, {})).rejects.toMatchObject({ status: 400 });
  });

  it('passe la facture à PAYÉE quand le solde est atteint', async () => {
    const { service, prisma } = build();
    await service.recordPayment(actor(), 'inv1', { amount: 500, method: 'BANK_TRANSFER' }, {});
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { status: 'PAID' } });
  });

  it('passe la facture à PARTIELLEMENT PAYÉE pour un paiement partiel', async () => {
    const { service, prisma } = build();
    await service.recordPayment(actor(), 'inv1', { amount: 200, method: 'BANK_TRANSFER' }, {});
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { status: 'PARTIALLY_PAID' } });
  });

  it('un paiement en espèces crée un mouvement de caisse IN lié à la branche de l’employé', async () => {
    const { service, cashbox } = build();
    await service.recordPayment(actor({ branchId: 'branch-gab' }), 'inv1', { amount: 500, method: 'CASH' }, {});
    expect(cashbox.addMovement).toHaveBeenCalledWith('orgA', 'branch-gab', 'IN', 500, expect.stringContaining('FAC-2026-0001'), expect.objectContaining({ paymentId: 'pay1' }), 'u1');
  });
});
