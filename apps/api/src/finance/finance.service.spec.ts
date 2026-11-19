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

describe('FinanceService — langue des PDF', () => {
  const setup = (preferredLanguage?: 'fr' | 'ar') => {
    const ctx = build();
    ctx.prisma.candidate.findUniqueOrThrow.mockResolvedValue({ firstName: 'Ali', lastName: 'Ben', phone: '1', email: null, preferredLanguage });
    ctx.prisma.agencySettings.findUnique.mockResolvedValue({ name: 'Study in World', nameAr: 'ستادي', address: 'Gabès', addressAr: 'قابس' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfSvc = (ctx.service as any).pdf as { document: jest.Mock };
    pdfSvc.document.mockResolvedValue(Buffer.from('pdf'));
    return { ...ctx, header: () => pdfSvc.document.mock.calls[0][0] };
  };

  it('facture : langue par défaut = préférence du candidat', async () => {
    const { service, header } = setup('ar');
    const res = await service.invoicePdf(actor(), 'inv1');
    expect(header()).toMatchObject({ lang: 'ar', agency: { nameAr: 'ستادي', addressAr: 'قابس' } });
    expect(res.filename).toBe('فاتورة-FAC-2026-0001.pdf');
    expect(res.disposition).toBe(`inline; filename="Facture-FAC-2026-0001.pdf"; filename*=UTF-8''${encodeURIComponent('فاتورة-FAC-2026-0001.pdf')}`);
  });

  it('?lang=fr remplace ar', async () => {
    const { service, header } = setup('ar');
    await service.invoicePdf(actor(), 'inv1', 'fr');
    expect(header().lang).toBe('fr');
  });

  it('candidat sans préférence → fr', async () => {
    const { service, header } = setup(undefined);
    const res = await service.invoicePdf(actor(), 'inv1');
    expect(header().lang).toBe('fr');
    expect(res.disposition).toContain('filename="Facture-FAC-2026-0001.pdf"');
  });
});

describe('FinanceService — TVA, débours et timbre', () => {
  const TAXES = { taxesEnabled: true, vatRate: 19, stampDuty: 1 };
  const lines = [
    { label: 'Accompagnement', quantity: 1, unitPrice: 2000, kind: 'SERVICE' as const },
    { label: 'Inscription université', quantity: 1, unitPrice: 1500, kind: 'DISBURSEMENT' as const },
  ];
  const setup = (settings: object | null = TAXES) => {
    const ctx = build();
    ctx.prisma.agencySettings.findUnique.mockResolvedValue(settings);
    ctx.prisma.invoice.create = jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'inv9', payments: [], ...data, items: [] }));
    ctx.prisma.quote.create = jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'q9', ...data, items: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (m: jest.Mock): any => m.mock.calls[0][0].data;
    return { ...ctx, data };
  };

  it('facture créée avec taxes : lignes et totaux enregistrés', async () => {
    const { service, prisma, data } = setup();
    await service.createInvoice(actor(), 'cand1', { items: lines }, {});
    const d = data(prisma.invoice.create);
    expect(d).toMatchObject({ subtotal: 2000, vatAmount: 380, disbursements: 1500, stampDuty: 1, total: 3881 });
    expect(d.items.create).toEqual([
      expect.objectContaining({ kind: 'SERVICE', vatRate: 19 }),
      expect.objectContaining({ kind: 'DISBURSEMENT', vatRate: 0 }),
    ]);
  });

  it('devis créé avec taxes : mêmes totaux', async () => {
    const { service, prisma, data } = setup();
    await service.createQuote(actor(), 'cand1', { items: lines }, {});
    expect(data(prisma.quote.create)).toMatchObject({ total: 3881 });
  });

  it('agence sans taxes : débours forcé en service, total brut', async () => {
    const { service, prisma, data } = setup(null);
    await service.createInvoice(actor(), 'cand1', { items: lines }, {});
    const d = data(prisma.invoice.create);
    expect(d).toMatchObject({ vatAmount: 0, stampDuty: 0, total: 3500 });
    expect(d.items.create.every((l: { kind: string; vatRate: number }) => l.kind === 'SERVICE' && l.vatRate === 0)).toBe(true);
  });

  it('devis ancien → facture garde la somme brute, sans TVA ni timbre', async () => {
    const { service, prisma, data } = setup();
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1', status: 'ACCEPTED', candidateId: 'cand1', number: 'DEV-1', currency: 'TND', total: null,
      items: [{ label: 'A', quantity: 1, unitPrice: 2000, kind: 'SERVICE' }, { label: 'B', quantity: 1, unitPrice: 1500, kind: 'SERVICE' }] });
    await service.createInvoiceFromQuote(actor(), 'q1', {});
    const d = data(prisma.invoice.create);
    expect(d).toMatchObject({ vatAmount: 0, stampDuty: 0, total: 3500 });
  });

  it('devis récent → facture garde les types et recalcule avec les Paramètres du jour', async () => {
    const { service, prisma, data } = setup({ taxesEnabled: true, vatRate: 19, stampDuty: 1.5 });
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1', status: 'ACCEPTED', candidateId: 'cand1', number: 'DEV-1', currency: 'TND', total: 3881,
      items: lines.map((l) => ({ ...l, vatRate: l.kind === 'SERVICE' ? 19 : 0 })) });
    await service.createInvoiceFromQuote(actor(), 'q1', {});
    const d = data(prisma.invoice.create);
    expect(d).toMatchObject({ disbursements: 1500, stampDuty: 1.5, total: 3881.5 });
    expect(d.items.create[1]).toMatchObject({ kind: 'DISBURSEMENT', vatRate: 0 });
  });

  it('devis créé sans taxes puis taxes activées → facture au prix accepté, sans TVA ni timbre', async () => {
    const { service, prisma, data } = setup();
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1', status: 'ACCEPTED', candidateId: 'cand1', number: 'DEV-1', currency: 'TND',
      subtotal: 3500, vatAmount: 0, disbursements: 0, stampDuty: 0, total: 3500,
      items: [{ label: 'A', quantity: 1, unitPrice: 2000, kind: 'SERVICE', vatRate: 0 }, { label: 'B', quantity: 1, unitPrice: 1500, kind: 'SERVICE', vatRate: 0 }] });
    await service.createInvoiceFromQuote(actor(), 'q1', {});
    expect(data(prisma.invoice.create)).toMatchObject({ vatAmount: 0, stampDuty: 0, total: 3500 });
  });

  const taxed = { id: 'inv1', organizationId: 'orgA', candidateId: 'cand1', number: 'FAC-1', currency: 'TND', status: 'ISSUED', payments: [],
    items: [{ label: 'Traduction', quantity: 3, unitPrice: 45.5, kind: 'SERVICE', vatRate: 19 }],
    subtotal: 136.5, vatAmount: 25.935, disbursements: 0, stampDuty: 1, total: 163.435 };

  it('paiement du TTC exact (163.435) accepté et facture payée', async () => {
    const { service, prisma } = setup();
    prisma.invoice.findFirst.mockResolvedValue(taxed);
    await service.recordPayment(actor(), 'inv1', { amount: 163.435, method: 'BANK_TRANSFER' }, {});
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { status: 'PAID' } });
  });

  it('paiement au-delà du TTC refusé', async () => {
    const { service, prisma } = setup();
    prisma.invoice.findFirst.mockResolvedValue(taxed);
    await expect(service.recordPayment(actor(), 'inv1', { amount: 163.5, method: 'BANK_TRANSFER' }, {})).rejects.toMatchObject({ status: 400 });
  });

  it('facture existante : un nouveau taux dans les Paramètres ne change pas ses totaux', async () => {
    const { service, prisma } = setup({ taxesEnabled: true, vatRate: 7, stampDuty: 5 });
    prisma.invoice.findMany = jest.fn().mockResolvedValue([taxed]);
    const [inv] = await service.invoicesFor(actor(), 'cand1');
    expect(inv).toMatchObject({ vatAmount: 25.935, stampDuty: 1, total: 163.435, taxed: true });
  });

  it('réglages de taxes : défauts sans Paramètres', async () => {
    const { service } = setup(null);
    await expect(service.taxSettings('orgA')).resolves.toEqual({ taxesEnabled: false, vatRate: 19, stampDuty: 1 });
  });
});
