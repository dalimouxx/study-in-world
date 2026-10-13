import { Injectable, Logger } from '@nestjs/common';
import { AutomationActionType, AutomationTrigger, TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';

interface CreateTaskConfig {
  title: string;
  daysOffset?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Moteur WHEN / THEN (section 51 du cahier des charges). Déclenché par les services métier
 * (candidatures, visa, documents) après un changement d'état ; jamais appelé directement par un contrôleur.
 * Chaque exécution est journalisée (AutomationExecution) pour rester visible dans le dossier candidat.
 */
@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async fire(organizationId: string, trigger: AutomationTrigger, triggerValue: string | undefined, candidateId: string, actorId?: string): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        organizationId,
        trigger,
        isActive: true,
        // Une règle sans valeur (triggerValue: null) réagit à tout changement ; sinon elle doit correspondre exactement.
        ...(triggerValue !== undefined ? { OR: [{ triggerValue: null }, { triggerValue }] } : { triggerValue: null }),
      },
      include: { actions: { orderBy: { position: 'asc' } } },
    });
    if (rules.length === 0) return;

    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { assignedToId: true } });

    for (const rule of rules) {
      const done: string[] = [];
      for (const action of rule.actions) {
        try {
          done.push(await this.runAction(organizationId, candidateId, candidate?.assignedToId ?? null, action.type, action.config as Record<string, unknown>, actorId));
        } catch (err) {
          this.logger.warn(`Action ${action.type} de la règle ${rule.id} a échoué : ${(err as Error).message}`);
        }
      }
      if (done.length > 0) {
        await this.prisma.automationExecution.create({
          data: { organizationId, ruleId: rule.id, candidateId, summary: `« ${rule.name} » : ${done.join(' · ')}` },
        });
      }
    }
  }

  private async runAction(
    organizationId: string,
    candidateId: string,
    assignedToId: string | null,
    type: AutomationActionType,
    config: Record<string, unknown>,
    actorId?: string,
  ): Promise<string> {
    switch (type) {
      case 'CREATE_TASK': {
        const c = config as unknown as CreateTaskConfig;
        const dueDate = c.daysOffset ? new Date(Date.now() + c.daysOffset * 86_400_000) : undefined;
        await this.prisma.task.create({
          data: {
            organizationId,
            title: c.title,
            dueDate,
            priority: c.priority ?? 'MEDIUM',
            assignedToId: assignedToId ?? undefined,
            relatedType: 'CANDIDATE',
            relatedId: candidateId,
          },
        });
        return `tâche « ${c.title} » créée`;
      }
      case 'ADD_CHECKLIST_ITEM': {
        const label = String(config.label ?? '').slice(0, 160);
        const last = await this.prisma.checklistItem.findFirst({ where: { organizationId, candidateId }, orderBy: { position: 'desc' } });
        await this.prisma.checklistItem.create({ data: { organizationId, candidateId, label, position: (last?.position ?? -1) + 1 } });
        return `checklist « ${label} » ajoutée`;
      }
      case 'TIMELINE_NOTE': {
        const content = String(config.content ?? '').slice(0, 2000);
        await this.timeline.add(organizationId, 'CANDIDATE', candidateId, TimelineType.SYSTEM, content, actorId);
        return 'note ajoutée';
      }
      default:
        return '';
    }
  }
}
