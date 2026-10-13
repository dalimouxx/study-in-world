import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService, ForecastPeriod } from '../reports/reports.service';
import type { AuthUser } from '../common/auth-user';

const DAY_MS = 86_400_000;

interface AtRiskEntry {
  candidateId: string;
  candidateName: string;
  reasons: string[];
}

/**
 * Section 81 : centre de contrôle direction. Contrairement au Health Score (calculé candidat par candidat),
 * ici tout est agrégé par requêtes groupées — jamais une boucle candidat par candidat — pour rester rapide
 * même avec plusieurs centaines de dossiers actifs.
 */
@Injectable()
export class CommandCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  async today(actor: AuthUser) {
    const organizationId = actor.organizationId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + DAY_MS);

    const [newProspects, uncontacted, appointmentsToday, pendingDocuments, paymentsToday, tasksToday] = await Promise.all([
      this.prisma.prospect.count({ where: { organizationId, deletedAt: null, createdAt: { gte: startOfDay } } }),
      this.prisma.prospect.count({ where: { organizationId, deletedAt: null, status: 'NEW' } }),
      this.prisma.appointment.count({ where: { organizationId, startAt: { gte: startOfDay, lt: endOfDay }, status: 'SCHEDULED' } }),
      this.prisma.candidateDocument.count({ where: { organizationId, deletedAt: null, status: 'PENDING' } }),
      this.prisma.payment.aggregate({ where: { organizationId, paidAt: { gte: startOfDay, lt: endOfDay } }, _sum: { amount: true } }),
      this.prisma.task.count({ where: { organizationId, status: 'TODO', dueDate: { gte: startOfDay, lt: endOfDay } } }),
    ]);

    return { newProspects, uncontacted, appointmentsToday, pendingDocuments, paymentsToday: paymentsToday._sum.amount ?? 0, tasksToday };
  }

  async risks(actor: AuthUser) {
    const organizationId = actor.organizationId;
    const now = new Date();
    const soon = new Date(now.getTime() + 90 * DAY_MS);
    const candidateName = { select: { id: true, firstName: true, lastName: true } };

    const [overdueInvoices, overdueTasks, expiringDocs, missedVisaAppointments, stalledApplications] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, dueDate: { lt: now } },
        select: { number: true, candidate: candidateName },
      }),
      this.prisma.task.findMany({
        where: { organizationId, relatedType: 'CANDIDATE', status: 'TODO', dueDate: { lt: now } },
        select: { title: true, relatedId: true },
      }),
      this.prisma.candidateDocument.findMany({
        where: { organizationId, deletedAt: null, expiryDate: { lt: soon } },
        select: { label: true, expiryDate: true, candidate: candidateName },
      }),
      this.prisma.visaFile.findMany({
        where: { organizationId, appointmentDate: { lt: now }, status: { notIn: ['APPROVED', 'REFUSED'] } },
        select: { country: true, candidate: candidateName },
      }),
      this.prisma.application.findMany({
        where: { organizationId, status: 'DRAFT', deadline: { lt: now } },
        select: { university: true, candidate: candidateName },
      }),
    ]);

    const byCandidate = new Map<string, AtRiskEntry>();
    const add = (id: string, name: string, reason: string) => {
      const entry = byCandidate.get(id) ?? { candidateId: id, candidateName: name, reasons: [] };
      entry.reasons.push(reason);
      byCandidate.set(id, entry);
    };

    for (const inv of overdueInvoices) add(inv.candidate.id, `${inv.candidate.firstName} ${inv.candidate.lastName}`, `Facture ${inv.number} en retard`);
    for (const doc of expiringDocs) {
      const late = doc.expiryDate! < now;
      add(doc.candidate.id, `${doc.candidate.firstName} ${doc.candidate.lastName}`, `${doc.label} ${late ? 'expiré' : 'expire bientôt'}`);
    }
    for (const v of missedVisaAppointments) add(v.candidate.id, `${v.candidate.firstName} ${v.candidate.lastName}`, `Rendez-vous visa (${v.country}) dépassé`);
    for (const a of stalledApplications) add(a.candidate.id, `${a.candidate.firstName} ${a.candidate.lastName}`, `Candidature ${a.university} : date limite dépassée`);

    // Les tâches ne portent que relatedId (pas de relation Prisma directe vers Candidate) : on résout les noms à part.
    const taskCandidateIds = [...new Set(overdueTasks.map((t) => t.relatedId).filter((v): v is string => !!v))];
    const taskCandidates = taskCandidateIds.length
      ? await this.prisma.candidate.findMany({ where: { id: { in: taskCandidateIds }, organizationId }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const taskNames = new Map(taskCandidates.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
    for (const t of overdueTasks) {
      if (t.relatedId && taskNames.has(t.relatedId)) add(t.relatedId, taskNames.get(t.relatedId)!, `Tâche en retard : ${t.title}`);
    }

    const atRiskCandidates = [...byCandidate.values()].sort((a, b) => b.reasons.length - a.reasons.length).slice(0, 10);

    return {
      atRiskCandidates,
      overdueInvoicesCount: overdueInvoices.length,
      expiringDocumentsCount: expiringDocs.length,
      missedVisaAppointmentsCount: missedVisaAppointments.length,
      stalledApplicationsCount: stalledApplications.length,
      overdueTasksCount: overdueTasks.length,
    };
  }

  finance(actor: AuthUser, period: ForecastPeriod) {
    return this.reports.forecast(actor, period);
  }

  async admissions(actor: AuthUser) {
    const organizationId = actor.organizationId;
    const [byStatus, pendingDocuments] = await Promise.all([
      this.prisma.application.groupBy({ by: ['status'], where: { organizationId }, _count: true }),
      this.prisma.candidateDocument.count({ where: { organizationId, deletedAt: null, status: 'PENDING' } }),
    ]);
    const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    return { byStatus: counts, pendingDocuments };
  }

  async visa(actor: AuthUser) {
    const byStatus = await this.prisma.visaFile.groupBy({ by: ['status'], where: { organizationId: actor.organizationId }, _count: true });
    return { byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])) };
  }
}
