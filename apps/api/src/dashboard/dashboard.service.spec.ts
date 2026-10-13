import { DashboardService } from './dashboard.service';
import type { AuthUser } from '../common/auth-user';

const actor = (permissions: string[]): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions,
  isPlatformAdmin: false,
});

function build() {
  const soon = new Date(Date.now() + 2 * 86_400_000);
  const overdue = new Date(Date.now() - 3 * 86_400_000);
  const prisma = {
    application: { findMany: jest.fn().mockResolvedValue([{ id: 'a1', candidateId: 'c1', university: 'X', program: 'Y', deadline: soon, candidate: { firstName: 'Ali', lastName: 'B' } }]) },
    visaFile: { findMany: jest.fn().mockResolvedValue([]) },
    task: { findMany: jest.fn().mockResolvedValue([{ id: 't1', title: 'Relancer', dueDate: overdue, relatedType: 'CANDIDATE', relatedId: 'c2', assignedTo: { firstName: 'Sana', lastName: 'C' } }]) },
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
    invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', number: 'FAC-1', dueDate: soon, candidateId: 'c3', candidate: { firstName: 'X', lastName: 'Y' } }]) },
    prospect: { findMany: jest.fn().mockResolvedValue([{ id: 'p1', firstName: 'Nour', lastName: 'Z', nextFollowUpAt: overdue }]) },
  };
  return { service: new DashboardService(prisma as never), prisma };
}

describe('DashboardService.deadlines', () => {
  it('n’interroge pas les factures sans finance.view', async () => {
    const { service, prisma } = build();
    await service.deadlines(actor(['candidate.view', 'task.view', 'appointment.view']));
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('n’interroge pas les relances prospects sans prospect.view', async () => {
    const { service, prisma } = build();
    await service.deadlines(actor(['candidate.view', 'task.view', 'appointment.view']));
    expect(prisma.prospect.findMany).not.toHaveBeenCalled();
  });

  it('inclut les relances prospects avec prospect.view', async () => {
    const { service } = build();
    const result = await service.deadlines(actor(['prospect.view']));
    const prospectItem = result.items.find((i) => i.kind === 'PROSPECT');
    expect(prospectItem?.candidateId).toBeNull();
    expect(prospectItem?.urgency).toBe('overdue');
  });

  it('inclut les factures avec finance.view et classe correctement l’urgence', async () => {
    const { service } = build();
    const result = await service.deadlines(actor(['candidate.view', 'task.view', 'appointment.view', 'finance.view']));
    const invoiceItem = result.items.find((i) => i.kind === 'INVOICE');
    expect(invoiceItem?.urgency).toBe('soon');
    const taskItem = result.items.find((i) => i.kind === 'TASK');
    expect(taskItem?.urgency).toBe('overdue');
    expect(result.counts.overdue).toBeGreaterThanOrEqual(1);
  });

  it('un Super Admin voit tout même sans permissions explicites', async () => {
    const { service, prisma } = build();
    await service.deadlines({ ...actor([]), roleCode: 'SUPER_ADMIN' });
    expect(prisma.invoice.findMany).toHaveBeenCalled();
  });
});
