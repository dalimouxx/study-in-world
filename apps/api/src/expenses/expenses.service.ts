import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CashboxService } from '../cashbox/cashbox.service';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateExpenseDto, ListExpensesQuery } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashbox: CashboxService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListExpensesQuery) {
    const where: Prisma.ExpenseWhereInput = {
      organizationId: actor.organizationId,
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.candidateId ? { candidateId: q.candidateId } : {}),
      ...(q.from || q.to ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
    };
    return this.prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
  }

  /** Chaque dépense est réglée en espèces depuis la caisse ouverte de la branche (le seul mode pris en charge pour l'instant). */
  async create(actor: AuthUser, dto: CreateExpenseDto, meta: RequestMeta) {
    const branchId = dto.branchId ?? actor.branchId;
    if (!branchId) throw new Error('BRANCH_REQUIRED');
    const expense = await this.prisma.expense.create({
      data: {
        organizationId: actor.organizationId,
        branchId,
        candidateId: dto.candidateId,
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        createdById: actor.id,
      },
    });
    await this.cashbox.addMovement(actor.organizationId, branchId, 'OUT', dto.amount, `Dépense : ${dto.description}`, { expenseId: expense.id }, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'expense.create', entity: 'Expense', entityId: expense.id, metadata: { amount: dto.amount, category: dto.category }, meta });
    return expense;
  }
}
