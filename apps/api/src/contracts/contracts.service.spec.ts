import { ContractsService } from './contracts.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ACCOUNTANT', roleName: 'Comptable',
  permissions: ['finance.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    candidate: { findFirst: jest.fn().mockResolvedValue({ id: 'cand1', firstName: 'Ali', lastName: 'Ben', passportNumber: 'X123' }) },
    quote: { findFirst: jest.fn() },
    agencySettings: { findUnique: jest.fn().mockResolvedValue({ name: 'Study in World', currency: 'TND', contractTemplate: null }) },
    contract: {
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'ctr1', status: 'DRAFT', ...(data as object) })),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const counter = { next: jest.fn().mockResolvedValue('CTR-2026-0001') };
  const storage = { save: jest.fn().mockResolvedValue('sig-path'), read: jest.fn() };
  const pdfService = { contract: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new ContractsService(prisma as never, candidates as never, counter as never, storage as never, pdfService as never, audit as never, timeline as never), prisma, storage };
}

describe('ContractsService.create', () => {
  it('refuse si ni devis ni lignes ne sont fournis', async () => {
    const { service } = build();
    await expect(service.create(actor(), 'cand1', {}, {})).rejects.toMatchObject({ status: 400 });
  });

  it('reprend les lignes du devis et calcule le total correctement', async () => {
    const { service, prisma } = build();
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1', items: [{ label: 'Frais de dossier', quantity: 1, unitPrice: 500 }] });
    const created = await service.create(actor(), 'cand1', { quoteId: 'q1' }, {});
    expect((created as { totalAmount: number }).totalAmount).toBe(500);
    expect((created as { content: string }).content).toContain('Ali Ben');
    expect((created as { content: string }).content).toContain('500.000 TND');
  });

  it('accepte des lignes manuelles sans devis', async () => {
    const { service } = build();
    const created = await service.create(actor(), 'cand1', { items: [{ label: 'Service X', quantity: 2, unitPrice: 100 }] }, {});
    expect((created as { totalAmount: number }).totalAmount).toBe(200);
  });
});

describe('ContractsService.sign', () => {
  it('refuse de signer un contrat déjà signé', async () => {
    const { service, prisma } = build();
    prisma.contract.findFirst.mockResolvedValue({ id: 'ctr1', status: 'SIGNED', number: 'CTR-2026-0001' });
    await expect(
      service.sign('orgA', 'cand1', 'ctr1', { signatureImage: 'aGVsbG8=', signerName: 'Ali', method: 'DRAWN' }, {}),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CONTRACT_SIGNED' }) });
  });

  it('refuse de signer un contrat annulé', async () => {
    const { service, prisma } = build();
    prisma.contract.findFirst.mockResolvedValue({ id: 'ctr1', status: 'CANCELLED', number: 'CTR-2026-0001' });
    await expect(
      service.sign('orgA', 'cand1', 'ctr1', { signatureImage: 'aGVsbG8=', signerName: 'Ali', method: 'DRAWN' }, {}),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CONTRACT_CANCELLED' }) });
  });

  it('enregistre la signature et fige le statut sur SIGNED', async () => {
    const { service, prisma, storage } = build();
    prisma.contract.findFirst.mockResolvedValue({ id: 'ctr1', status: 'DRAFT', number: 'CTR-2026-0001' });
    await service.sign('orgA', 'cand1', 'ctr1', { signatureImage: 'aGVsbG8=', signerName: 'Ali Ben', method: 'DRAWN' }, {}, 'u1');
    expect(storage.save).toHaveBeenCalled();
    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SIGNED', signerName: 'Ali Ben', signatureMethod: 'DRAWN' }) }),
    );
  });
});

describe('ContractsService.setStatus', () => {
  it('refuse de changer le statut d’un contrat déjà signé', async () => {
    const { service, prisma } = build();
    prisma.contract.findFirst.mockResolvedValue({ id: 'ctr1', status: 'SIGNED' });
    await expect(service.setStatus(actor(), 'ctr1', 'CANCELLED', {})).rejects.toMatchObject({ status: 409 });
  });
});
