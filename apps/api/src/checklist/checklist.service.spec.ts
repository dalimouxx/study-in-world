import { ChecklistService } from './checklist.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['checklist.manage', 'visa.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    checklistItem: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'ci1', ...(data as object) })), createMany: jest.fn().mockResolvedValue({ count: 8 }), update: jest.fn(), delete: jest.fn() },
    visaFile: { findFirst: jest.fn() },
  };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new ChecklistService(prisma as never, candidates as never, audit as never, timeline as never), prisma };
}

describe('ChecklistService — isolation candidat / dossier visa', () => {
  it('la checklist générale du candidat exclut les éléments propres à un dossier visa', async () => {
    const { service, prisma } = build();
    await service.list(actor(), 'cand1');
    expect(prisma.checklistItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ visaFileId: null }) }));
  });

  it('createForVisa attribue le candidateId du dossier visa, pas un paramètre arbitraire', async () => {
    const { service, prisma } = build();
    prisma.visaFile.findFirst.mockResolvedValue({ id: 'v1', candidateId: 'cand-from-visa', organizationId: 'orgA' });
    await service.createForVisa(actor(), 'v1', 'Traduction du diplôme');
    expect(prisma.checklistItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ candidateId: 'cand-from-visa', visaFileId: 'v1' }) }));
  });

  it('createForVisa refuse un dossier visa d’une autre organisation', async () => {
    const { service, prisma } = build();
    prisma.visaFile.findFirst.mockResolvedValue(null);
    await expect(service.createForVisa(actor(), 'v-other-org', 'X')).rejects.toMatchObject({ status: 404 });
  });
});
