import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './dto/automation.dto';

const include = { actions: { orderBy: { position: 'asc' } } } satisfies Prisma.AutomationRuleInclude;

@Injectable()
export class AutomationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(actor: AuthUser) {
    return this.prisma.automationRule.findMany({ where: { organizationId: actor.organizationId }, include, orderBy: { createdAt: 'desc' } });
  }

  async get(actor: AuthUser, id: string) {
    const found = await this.prisma.automationRule.findFirst({ where: { id, organizationId: actor.organizationId }, include });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Règle introuvable');
    return found;
  }

  async create(actor: AuthUser, dto: CreateAutomationRuleDto, meta: RequestMeta) {
    const created = await this.prisma.automationRule.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name,
        trigger: dto.trigger,
        triggerValue: dto.triggerValue,
        createdById: actor.id,
        actions: { create: dto.actions.map((a, i) => ({ type: a.type, config: a.config as Prisma.InputJsonValue, position: i })) },
      },
      include,
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'automation.rule.create', entity: 'AutomationRule', entityId: created.id, meta });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateAutomationRuleDto, meta: RequestMeta) {
    await this.get(actor, id);
    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: {
        name: dto.name,
        trigger: dto.trigger,
        triggerValue: dto.triggerValue,
        isActive: dto.isActive,
        ...(dto.actions
          ? { actions: { deleteMany: {}, create: dto.actions.map((a, i) => ({ type: a.type, config: a.config as Prisma.InputJsonValue, position: i })) } }
          : {}),
      },
      include,
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'automation.rule.update', entity: 'AutomationRule', entityId: id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    await this.get(actor, id);
    await this.prisma.automationRule.delete({ where: { id } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'automation.rule.delete', entity: 'AutomationRule', entityId: id, meta });
  }

  executionsFor(actor: AuthUser, candidateId: string) {
    return this.prisma.automationExecution.findMany({
      where: { organizationId: actor.organizationId, candidateId },
      include: { rule: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
