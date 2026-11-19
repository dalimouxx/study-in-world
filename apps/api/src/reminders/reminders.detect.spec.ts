import { detectReminders } from './reminders.detect';

const TZ = 'Africa/Tunis';
const NOW = new Date('2026-11-16T07:30:00Z'); // 08:30 à Tunis, lundi 16 novembre
const cand = (o: object = {}) => ({
  id: 'c1', firstName: 'Yasmine', lastName: 'Ben Ali', phone: '+21620000000', email: 'y@demo.tn', preferredLanguage: 'fr', assignedToId: 'u1', status: 'ACTIVE', deletedAt: null, ...o,
});

function build() {
  const prisma = {
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
    candidate: { findMany: jest.fn().mockResolvedValue([]) },
    visaFile: { findMany: jest.fn().mockResolvedValue([]) },
    prospect: { findMany: jest.fn().mockResolvedValue([]) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
    candidateDocument: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return prisma;
}
const run = (prisma: ReturnType<typeof build>) => detectReminders(prisma as never, 'orgA', NOW, TZ);

describe('detectReminders — rendez-vous', () => {
  it('détecte un rendez-vous à 00:30 locale demain', async () => {
    const prisma = build();
    prisma.appointment.findMany.mockResolvedValue([{ id: 'a1', relatedId: 'c1', startAt: new Date('2026-11-16T23:30:00Z'), location: 'Agence', title: 'RDV' }]);
    prisma.candidate.findMany.mockResolvedValue([cand()]);
    const out = await run(prisma);
    expect(out).toEqual([expect.objectContaining({ kind: 'APPOINTMENT_TOMORROW', entityType: 'APPOINTMENT', entityId: 'a1', cycle: '' })]);
    const where = prisma.appointment.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: 'orgA', status: 'SCHEDULED', relatedType: 'CANDIDATE' });
    expect(where.startAt).toEqual({ gte: new Date('2026-11-16T23:00:00Z'), lt: new Date('2026-11-17T23:00:00Z') });
  });

  it('ignore un rendez-vous d’un candidat archivé (le candidat n’est pas trouvé)', async () => {
    const prisma = build();
    prisma.appointment.findMany.mockResolvedValue([{ id: 'a1', relatedId: 'c1', startAt: new Date('2026-11-17T09:00:00Z'), location: null, title: 'RDV' }]);
    prisma.candidate.findMany.mockResolvedValue([]);
    expect(await run(prisma)).toEqual([]);
    expect(prisma.candidate.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA', deletedAt: null, status: { not: 'ARCHIVED' } });
  });
});

describe('detectReminders — visa', () => {
  it('détecte un rendez-vous visa demain, statut ouvert', async () => {
    const prisma = build();
    prisma.visaFile.findMany.mockResolvedValue([{ id: 'v1', country: 'Malte', appointmentDate: new Date('2026-11-17T08:00:00Z'), candidate: cand() }]);
    const out = await run(prisma);
    expect(out).toEqual([expect.objectContaining({ kind: 'VISA_APPOINTMENT_TOMORROW', entityId: 'v1', vars: expect.objectContaining({ pays: 'Malte' }) })]);
    expect(prisma.visaFile.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA', status: { notIn: ['APPROVED', 'REFUSED'] } });
  });

  it('ignore un visa dont le candidat est archivé', async () => {
    const prisma = build();
    prisma.visaFile.findMany.mockResolvedValue([{ id: 'v1', country: 'Malte', appointmentDate: new Date('2026-11-17T08:00:00Z'), candidate: cand({ status: 'ARCHIVED' }) }]);
    expect(await run(prisma)).toEqual([]);
  });
});

describe('detectReminders — prospects', () => {
  it('détecte un prospect à relancer aujourd’hui, avec une clé par jour local', async () => {
    const prisma = build();
    prisma.prospect.findMany.mockResolvedValue([{ id: 'p1', firstName: 'Amine', lastName: 'K', phone: '+216500', email: null, preferredLanguage: 'ar', assignedToId: null, nextFollowUpAt: new Date('2026-11-16T09:00:00Z') }]);
    const out = await run(prisma);
    expect(out).toEqual([expect.objectContaining({ kind: 'PROSPECT_FOLLOW_UP', entityId: 'p1', cycle: '2026-11-16', target: expect.objectContaining({ type: 'PROSPECT', preferredLanguage: 'ar', assignedToId: null }) })]);
    const where = prisma.prospect.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: 'orgA', deletedAt: null, status: { notIn: ['CONVERTED', 'LOST'] } });
    expect(where.nextFollowUpAt).toEqual({ lt: new Date('2026-11-16T23:00:00Z') });
  });
});

describe('detectReminders — factures', () => {
  const invoice = (o: object = {}) => ({
    id: 'i1', number: 'FAC-1', currency: 'TND', dueDate: new Date('2026-11-06T10:00:00Z'), status: 'ISSUED',
    items: [{ quantity: 1, unitPrice: 2400 }], payments: [{ amount: 1200 }], candidate: cand(), ...o,
  });

  it('détecte une facture en retard avec le reste à payer et le cycle de 7 jours', async () => {
    const prisma = build();
    prisma.invoice.findMany.mockResolvedValue([invoice()]);
    const out = await run(prisma);
    expect(out).toEqual([expect.objectContaining({ kind: 'INVOICE_OVERDUE', entityId: 'i1', cycle: 'c1', vars: expect.objectContaining({ montant: '1200', devise: 'TND', facture: 'FAC-1' }) })]);
    expect(prisma.invoice.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA', status: { in: ['ISSUED', 'PARTIALLY_PAID'] } });
  });

  it('facture taxée : le reste à payer part du total TTC', async () => {
    const prisma = build();
    prisma.invoice.findMany.mockResolvedValue([invoice({ items: [{ quantity: 1, unitPrice: 2000, kind: 'SERVICE' }], subtotal: 2000, vatAmount: 380, disbursements: 0, stampDuty: 1, total: 2381, payments: [{ amount: 1000 }] })]);
    const out = await run(prisma);
    expect(out[0].vars).toMatchObject({ montant: '1381' });
  });

  it('ignore une facture soldée', async () => {
    const prisma = build();
    prisma.invoice.findMany.mockResolvedValue([invoice({ payments: [{ amount: 2400 }] })]);
    expect(await run(prisma)).toEqual([]);
  });
});

describe('detectReminders — documents rejetés', () => {
  const doc = (o: object = {}) => ({
    id: 'd1', type: 'PASSPORT', label: 'Passeport', reviewNote: 'Illisible', reviewedAt: new Date('2026-11-15T10:00:00Z'), createdAt: new Date('2026-11-10T10:00:00Z'), candidateId: 'c1', candidate: cand(), ...o,
  });

  it('détecte un document rejeté hier', async () => {
    const prisma = build();
    prisma.candidateDocument.findMany.mockResolvedValueOnce([doc()]).mockResolvedValueOnce([{ candidateId: 'c1', type: 'PASSPORT', createdAt: new Date('2026-11-10T10:00:00Z') }]);
    const out = await run(prisma);
    expect(out).toEqual([expect.objectContaining({ kind: 'DOCUMENT_REJECTED', entityId: 'd1', vars: expect.objectContaining({ document: 'Passeport', raison: 'Illisible' }) })]);
    const where = prisma.candidateDocument.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: 'orgA', status: 'REJECTED', deletedAt: null });
    expect(where.reviewedAt).toEqual({ gte: new Date(NOW.getTime() - 7 * 86_400_000) });
  });

  it('ignore un document rejeté s’il existe une version plus récente du même type', async () => {
    const prisma = build();
    prisma.candidateDocument.findMany.mockResolvedValueOnce([doc()]).mockResolvedValueOnce([
      { candidateId: 'c1', type: 'PASSPORT', createdAt: new Date('2026-11-10T10:00:00Z') },
      { candidateId: 'c1', type: 'PASSPORT', createdAt: new Date('2026-11-15T12:00:00Z') },
    ]);
    expect(await run(prisma)).toEqual([]);
  });
});

it('toutes les requêtes filtrent par organisation', async () => {
  const prisma = build();
  await run(prisma);
  for (const model of Object.values(prisma)) {
    for (const call of model.findMany.mock.calls) expect(call[0].where.organizationId).toBe('orgA');
  }
});
