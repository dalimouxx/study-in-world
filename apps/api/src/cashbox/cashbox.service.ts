import { HttpStatus, Injectable } from '@nestjs/common';
import { CashboxMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CloseCashboxDto, OpenCashboxDto } from './dto/cashbox.dto';

@Injectable()
export class CashboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private branchOf(actor: AuthUser, requested?: string): string {
    const branchId = requested ?? actor.branchId;
    if (!branchId) throw apiError(HttpStatus.BAD_REQUEST, 'BRANCH_REQUIRED', 'Une branche est nécessaire pour la caisse');
    return branchId;
  }

  /** Session ouverte pour la branche, ou null. Utilisé aussi par les autres modules (paiements, dépenses en espèces). */
  async openSessionFor(organizationId: string, branchId: string) {
    return this.prisma.cashboxSession.findFirst({ where: { organizationId, branchId, closedAt: null }, orderBy: { openedAt: 'desc' } });
  }

  async current(actor: AuthUser, branchId?: string) {
    const branch = this.branchOf(actor, branchId);
    const session = await this.openSessionFor(actor.organizationId, branch);
    if (!session) return null;
    const { movements, balance } = await this.withBalance(session.id, session);
    return { ...session, movements, balance };
  }

  async open(actor: AuthUser, dto: OpenCashboxDto, meta: RequestMeta) {
    const branchId = this.branchOf(actor, dto.branchId);
    const existing = await this.openSessionFor(actor.organizationId, branchId);
    if (existing) throw apiError(HttpStatus.CONFLICT, 'CASHBOX_ALREADY_OPEN', 'Une session de caisse est déjà ouverte pour cette branche');
    const session = await this.prisma.cashboxSession.create({
      data: { organizationId: actor.organizationId, branchId, openedById: actor.id, openingAmount: dto.openingAmount, note: dto.note },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'cashbox.open', entity: 'CashboxSession', entityId: session.id, metadata: { openingAmount: dto.openingAmount }, meta });
    return session;
  }

  async close(actor: AuthUser, sessionId: string, dto: CloseCashboxDto, meta: RequestMeta) {
    const session = await this.find(actor, sessionId);
    if (session.closedAt) throw apiError(HttpStatus.CONFLICT, 'CASHBOX_ALREADY_CLOSED', 'Cette session est déjà clôturée');
    const { balance } = await this.withBalance(sessionId, session);
    const updated = await this.prisma.cashboxSession.update({
      where: { id: sessionId },
      data: { closedById: actor.id, closedAt: new Date(), closingAmount: dto.closingAmount, expectedAmount: balance, note: dto.note ?? session.note },
    });
    await this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'cashbox.close',
      entity: 'CashboxSession',
      entityId: sessionId,
      metadata: { expected: balance, counted: dto.closingAmount, discrepancy: dto.closingAmount - balance },
      meta,
    });
    return updated;
  }

  async movements(actor: AuthUser, sessionId: string) {
    await this.find(actor, sessionId);
    return this.prisma.cashboxMovement.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
  }

  async history(actor: AuthUser, branchId?: string) {
    const branch = this.branchOf(actor, branchId);
    return this.prisma.cashboxSession.findMany({ where: { organizationId: actor.organizationId, branchId: branch }, orderBy: { openedAt: 'desc' }, take: 30 });
  }

  /** Ajoute un mouvement à la session ouverte de la branche ; échoue si aucune session n'est ouverte. Utilisé par Finance et Dépenses. */
  async addMovement(
    organizationId: string,
    branchId: string,
    type: CashboxMovementType,
    amount: number,
    reason: string,
    link: { paymentId?: string; expenseId?: string },
    createdById: string,
  ) {
    const session = await this.openSessionFor(organizationId, branchId);
    if (!session) throw apiError(HttpStatus.CONFLICT, 'CASHBOX_CLOSED', 'Aucune session de caisse ouverte pour cette branche. Ouvrez la caisse avant d’enregistrer un mouvement en espèces');
    return this.prisma.cashboxMovement.create({
      data: { organizationId, sessionId: session.id, type, amount, reason, createdById, ...link },
    });
  }

  private async withBalance(sessionId: string, session: { openingAmount: number }) {
    const movements = await this.prisma.cashboxMovement.findMany({ where: { sessionId } });
    const ins = movements.filter((m) => m.type === 'IN').reduce((s, m) => s + m.amount, 0);
    const outs = movements.filter((m) => m.type === 'OUT').reduce((s, m) => s + m.amount, 0);
    const balance = session.openingAmount + ins - outs;
    return { session, movements, totalIn: ins, totalOut: outs, balance };
  }

  private async find(actor: AuthUser, id: string) {
    const session = await this.prisma.cashboxSession.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!session) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Session de caisse introuvable');
    return session;
  }
}
