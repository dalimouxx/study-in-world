import { TasksService } from './tasks.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['task.manage'], isPlatformAdmin: false,
});

function build() {
  const prisma = {
    task: {
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 't1', ...(data as object) })),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 't1', title: 'Relancer le candidat', ...(data as object) })),
      findFirst: jest.fn().mockResolvedValue({ id: 't1', organizationId: 'orgA', assignedToId: 'u1' }),
    },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  return { service: new TasksService(prisma as never, notifications as never), prisma, notifications };
}

describe('TasksService — notification d’assignation', () => {
  it('create() ne notifie personne quand on se l’assigne à soi-même (comportement par défaut)', async () => {
    const { service, notifications } = build();
    await service.create(actor(), { title: 'Relancer le candidat', priority: 'MEDIUM' } as never);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('create() notifie la personne quand la tâche est assignée à quelqu’un d’autre', async () => {
    const { service, notifications } = build();
    await service.create(actor(), { title: 'Relancer le candidat', assignedToId: 'advisor2', priority: 'MEDIUM' } as never);
    expect(notifications.notify).toHaveBeenCalledWith('orgA', 'advisor2', 'TASK_ASSIGNED', expect.any(String), 'Relancer le candidat', '/tasks');
  });

  it('update() notifie seulement si la personne assignée change réellement', async () => {
    const { service, prisma, notifications } = build();
    prisma.task.findFirst.mockResolvedValue({ id: 't1', organizationId: 'orgA', assignedToId: 'advisor2' });
    await service.update(actor(), 't1', { assignedToId: 'advisor2' } as never); // ré-assignée à la même personne
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('update() notifie quand la tâche passe d’une personne à une autre', async () => {
    const { service, prisma, notifications } = build();
    prisma.task.findFirst.mockResolvedValue({ id: 't1', organizationId: 'orgA', assignedToId: 'advisor2' });
    await service.update(actor(), 't1', { assignedToId: 'advisor3' } as never);
    expect(notifications.notify).toHaveBeenCalledWith('orgA', 'advisor3', 'TASK_ASSIGNED', expect.any(String), expect.any(String), '/tasks');
  });

  it('update() ne notifie jamais quand on se réassigne la tâche à soi-même', async () => {
    const { service, prisma, notifications } = build();
    prisma.task.findFirst.mockResolvedValue({ id: 't1', organizationId: 'orgA', assignedToId: 'advisor2' });
    await service.update(actor(), 't1', { assignedToId: 'u1' } as never);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
