import { AutomationEngineService } from './automation-engine.service';

function build() {
  const prisma = {
    automationRule: { findMany: jest.fn().mockResolvedValue([]) },
    candidate: { findUnique: jest.fn().mockResolvedValue({ assignedToId: 'u1' }) },
    task: { create: jest.fn().mockResolvedValue({}) },
    checklistItem: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    automationExecution: { create: jest.fn().mockResolvedValue({}) },
  };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new AutomationEngineService(prisma as never, timeline as never), prisma, timeline };
}

describe('AutomationEngineService.fire', () => {
  it('ne fait rien si aucune règle active ne correspond', async () => {
    const { service, prisma } = build();
    await service.fire('orgA', 'APPLICATION_STATUS_CHANGED', 'ACCEPTED', 'cand1');
    expect(prisma.automationExecution.create).not.toHaveBeenCalled();
  });

  it('une règle avec triggerValue null réagit à toute valeur', async () => {
    const { service, prisma } = build();
    prisma.automationRule.findMany.mockResolvedValue([
      { id: 'r1', name: 'Toujours', actions: [{ type: 'TIMELINE_NOTE', config: { content: 'note' } }] },
    ]);
    await service.fire('orgA', 'VISA_STATUS_CHANGED', 'APPROVED', 'cand1');
    expect(prisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: [{ triggerValue: null }, { triggerValue: 'APPROVED' }] }) }),
    );
  });

  it('exécute CREATE_TASK avec l’assigné du candidat et journalise l’exécution', async () => {
    const { service, prisma } = build();
    prisma.automationRule.findMany.mockResolvedValue([
      { id: 'r1', name: 'Visa accepté', actions: [{ type: 'CREATE_TASK', config: { title: 'Préparer le départ', daysOffset: 7 } }] },
    ]);
    await service.fire('orgA', 'APPLICATION_STATUS_CHANGED', 'ACCEPTED', 'cand1', 'u9');
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Préparer le départ', assignedToId: 'u1', relatedType: 'CANDIDATE', relatedId: 'cand1' }) }),
    );
    expect(prisma.automationExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ruleId: 'r1', candidateId: 'cand1' }) }),
    );
  });

  it('exécute ADD_CHECKLIST_ITEM en incrémentant la position', async () => {
    const { service, prisma } = build();
    prisma.checklistItem.findFirst.mockResolvedValue({ position: 3 });
    prisma.automationRule.findMany.mockResolvedValue([
      { id: 'r1', name: 'X', actions: [{ type: 'ADD_CHECKLIST_ITEM', config: { label: 'Assurance santé' } }] },
    ]);
    await service.fire('orgA', 'VISA_STATUS_CHANGED', 'APPROVED', 'cand1');
    expect(prisma.checklistItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ label: 'Assurance santé', position: 4 }) }));
  });

  it('une action qui échoue n’empêche pas les autres actions de la règle', async () => {
    const { service, prisma, timeline } = build();
    prisma.task.create.mockRejectedValue(new Error('boom'));
    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'r1', name: 'X',
        actions: [
          { type: 'CREATE_TASK', config: { title: 'échoue' } },
          { type: 'TIMELINE_NOTE', config: { content: 'note malgré tout' } },
        ],
      },
    ]);
    await service.fire('orgA', 'VISA_STATUS_CHANGED', 'APPROVED', 'cand1');
    expect(timeline.add).toHaveBeenCalledWith('orgA', 'CANDIDATE', 'cand1', 'SYSTEM', 'note malgré tout', undefined);
    expect(prisma.automationExecution.create).toHaveBeenCalled(); // la note a réussi, donc l'exécution est journalisée
  });
});
