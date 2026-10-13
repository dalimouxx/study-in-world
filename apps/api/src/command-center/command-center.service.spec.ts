import { CommandCenterService } from './command-center.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'DIRECTOR', roleName: 'Directeur',
  permissions: ['command_center.view'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    prospect: { count: jest.fn().mockResolvedValue(0) },
    appointment: { count: jest.fn().mockResolvedValue(0) },
    candidateDocument: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    task: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
    visaFile: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    application: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    candidate: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const reports = { forecast: jest.fn().mockResolvedValue({ period: '30d', collected: 0, toCollect: 0, overdue: 0, expenses: 0, netCashFlow: 0 }) };
  return { service: new CommandCenterService(prisma as never, reports as never), prisma };
}

describe('CommandCenterService.risks', () => {
  it('regroupe plusieurs problèmes du même candidat en une seule entrée', async () => {
    const { service, prisma } = build();
    const cand = { id: 'cand1', firstName: 'Ali', lastName: 'Ben' };
    prisma.invoice.findMany.mockResolvedValue([{ number: 'FAC-1', candidate: cand }]);
    prisma.candidateDocument.findMany.mockResolvedValue([{ label: 'Passeport', expiryDate: new Date(Date.now() - 86_400_000), candidate: cand }]);

    const result = await service.risks(actor());
    expect(result.atRiskCandidates).toHaveLength(1);
    expect(result.atRiskCandidates[0].reasons).toHaveLength(2);
    expect(result.overdueInvoicesCount).toBe(1);
    expect(result.expiringDocumentsCount).toBe(1);
  });

  it('trie les candidats à risque du plus grave au moins grave', async () => {
    const { service, prisma } = build();
    const worse = { id: 'cand1', firstName: 'Ali', lastName: 'Ben' };
    const lighter = { id: 'cand2', firstName: 'Sana', lastName: 'C' };
    prisma.invoice.findMany.mockResolvedValue([{ number: 'FAC-1', candidate: worse }, { number: 'FAC-2', candidate: lighter }]);
    prisma.candidateDocument.findMany.mockResolvedValue([{ label: 'Passeport', expiryDate: new Date(Date.now() - 86_400_000), candidate: worse }]);

    const result = await service.risks(actor());
    expect(result.atRiskCandidates[0].candidateId).toBe('cand1');
  });

  it('limite la liste à 10 candidats à risque', async () => {
    const { service, prisma } = build();
    prisma.invoice.findMany.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({ number: `FAC-${i}`, candidate: { id: `c${i}`, firstName: 'X', lastName: String(i) } })),
    );
    const result = await service.risks(actor());
    expect(result.atRiskCandidates).toHaveLength(10);
  });

  it('résout les noms des candidats liés à une tâche en retard via une requête séparée', async () => {
    const { service, prisma } = build();
    prisma.task.findMany.mockResolvedValue([{ title: 'Relancer', relatedId: 'cand1' }]);
    prisma.candidate.findMany.mockResolvedValue([{ id: 'cand1', firstName: 'Ali', lastName: 'Ben' }]);
    const result = await service.risks(actor());
    expect(result.atRiskCandidates[0].candidateName).toBe('Ali Ben');
    expect(result.overdueTasksCount).toBe(1);
  });
});

describe('CommandCenterService.today', () => {
  it('additionne correctement les paiements du jour, y compris quand il n’y en a aucun', async () => {
    const { service, prisma } = build();
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const result = await service.today(actor());
    expect(result.paymentsToday).toBe(0);
  });
});

describe('CommandCenterService.risks — défense en profondeur', () => {
  it('filtre toujours par organizationId lors de la résolution des noms de candidats liés à une tâche', async () => {
    const { service, prisma } = build();
    prisma.task.findMany.mockResolvedValue([{ title: 'Relancer', relatedId: 'cand1' }]);
    await service.risks(actor());
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'orgA' }) }));
  });
});
