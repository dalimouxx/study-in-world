import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidates/candidates.service';
import type { AuthUser } from '../common/auth-user';

export type ForecastPeriod = '7d' | '30d' | '3m' | '6m' | '12m';

const PERIOD_DAYS: Record<ForecastPeriod, number> = { '7d': 7, '30d': 30, '3m': 90, '6m': 180, '12m': 365 };

/**
 * Rentabilité candidat (section 43) et prévisions financières (section 44) — une couche d'analyse au-dessus
 * des données déjà enregistrées (paiements, factures, dépenses), sans nouveau modèle de « prévision » : on
 * calcule, on ne stocke pas de projection figée.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
  ) {}

  async candidateProfitability(actor: AuthUser, candidateId: string) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);

    const [payments, expenses] = await Promise.all([
      this.prisma.payment.findMany({ where: { organizationId: actor.organizationId, invoice: { candidateId } }, select: { amount: true } }),
      this.prisma.expense.findMany({ where: { organizationId: actor.organizationId, candidateId }, select: { amount: true, category: true, description: true, date: true } }),
    ]);

    const revenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const margin = revenue - totalExpenses;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

    return { revenue, expenses: totalExpenses, margin, marginPercent, expenseLines: expenses };
  }

  async forecast(actor: AuthUser, period: ForecastPeriod) {
    const now = new Date();
    const since = new Date(now.getTime() - PERIOD_DAYS[period] * 86_400_000);

    const [collectedAgg, openInvoices, expensesAgg] = await Promise.all([
      this.prisma.payment.aggregate({ where: { organizationId: actor.organizationId, paidAt: { gte: since, lte: now } }, _sum: { amount: true } }),
      this.prisma.invoice.findMany({
        where: { organizationId: actor.organizationId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
        include: { items: true, payments: { select: { amount: true } } },
      }),
      this.prisma.expense.aggregate({ where: { organizationId: actor.organizationId, date: { gte: since, lte: now } }, _sum: { amount: true } }),
    ]);

    let toCollect = 0;
    let overdue = 0;
    for (const inv of openInvoices) {
      const total = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = total - paid;
      toCollect += remaining;
      if (inv.dueDate && inv.dueDate < now) overdue += remaining;
    }

    const collected = collectedAgg._sum.amount ?? 0;
    const expenses = expensesAgg._sum.amount ?? 0;

    return { period, collected, toCollect, overdue, expenses, netCashFlow: collected - expenses };
  }
}
