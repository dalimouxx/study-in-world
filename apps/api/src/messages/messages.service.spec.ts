import { MessagesService } from './messages.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['candidate.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    message: { create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'm1', ...(data as object) })), updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
    candidate: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Ali', lastName: 'Ben', assignedToId: 'advisor1' }) },
  };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new MessagesService(prisma as never, candidates as never, notifications as never, timeline as never), prisma, timeline, notifications };
}

describe('MessagesService', () => {
  it('sendFromStaff marque le message comme déjà lu par l’employé qui l’a écrit', async () => {
    const { service, prisma } = build();
    const msg = await service.sendFromStaff(actor(), 'cand1', { content: 'Bonjour' });
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sender: 'STAFF', senderId: 'u1', readByStaffAt: expect.any(Date) }) }));
    expect((msg as { readByStaffAt: Date }).readByStaffAt).toBeInstanceOf(Date);
  });

  it('sendFromCandidate marque le message comme déjà lu par le candidat qui l’a écrit, sans indiquer d’employé', async () => {
    const { service, prisma } = build();
    await service.sendFromCandidate('orgA', 'cand1', 'Merci !');
    const call = prisma.message.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({ sender: 'CANDIDATE', readByCandidateAt: expect.any(Date) });
    expect(call.data.senderId).toBeUndefined();
  });

  it('sendFromCandidate notifie le conseiller assigné au candidat', async () => {
    const { service, notifications } = build();
    await service.sendFromCandidate('orgA', 'cand1', 'Merci !');
    expect(notifications.notify).toHaveBeenCalledWith('orgA', 'advisor1', 'NEW_MESSAGE', expect.stringContaining('Ali Ben'), 'Merci !', '/candidates/cand1');
  });

  it('sendFromCandidate ne notifie personne si le candidat n’a pas de conseiller assigné', async () => {
    const { service, prisma, notifications } = build();
    prisma.candidate.findUnique.mockResolvedValue({ firstName: 'Ali', lastName: 'Ben', assignedToId: null });
    await service.sendFromCandidate('orgA', 'cand1', 'Merci !');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('markReadByStaff ne touche que les messages envoyés par le candidat', async () => {
    const { service, prisma } = build();
    await service.markReadByStaff('orgA', 'cand1');
    expect(prisma.message.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sender: 'CANDIDATE', readByStaffAt: null }) }));
  });

  it('markReadByCandidate ne touche que les messages envoyés par l’équipe', async () => {
    const { service, prisma } = build();
    await service.markReadByCandidate('orgA', 'cand1');
    expect(prisma.message.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sender: 'STAFF', readByCandidateAt: null }) }));
  });
});
