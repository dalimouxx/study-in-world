import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SUPER_ADMIN_ROLE } from '../rbac/permissions';
import type { AuthUser } from '../common/auth-user';

type Urgency = 'overdue' | 'today' | 'soon' | 'upcoming';
export interface DeadlineItem {
  kind: 'APPLICATION' | 'VISA' | 'TASK' | 'APPOINTMENT' | 'INVOICE' | 'PROSPECT';
  id: string;
  candidateId: string | null;
  candidateName: string;
  label: string;
  date: Date;
  daysUntil: number;
  urgency: Urgency;
}

const urgencyOf = (daysUntil: number): Urgency => (daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : daysUntil <= 7 ? 'soon' : 'upcoming');
const daysUntil = (date: Date, now: Date) => Math.floor((date.getTime() - now.getTime()) / 86_400_000);

/**
 * Agrégateur d'échéances (section 49 du cahier des charges) : centralise relances prospects, candidatures,
 * visas, tâches, rendez-vous et factures dont la date approche ou est dépassée, sur une fenêtre de 30 jours.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async deadlines(actor: AuthUser): Promise<{ items: DeadlineItem[]; counts: Record<Urgency, number> }> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 86_400_000);
    const past = new Date(now.getTime() - 30 * 86_400_000); // inclut aussi les retards déjà anciens, jusqu'à 30 jours en arrière
    const can = (p: string) => actor.roleCode === SUPER_ADMIN_ROLE || actor.permissions.includes(p);

    const [applications, visaFiles, tasks, appointments, invoices, prospectFollowUps] = await Promise.all([
      can('candidate.view')
        ? this.prisma.application.findMany({
            where: { organizationId: actor.organizationId, deadline: { gte: past, lte: horizon }, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'WAITLISTED'] } },
            include: { candidate: { select: { firstName: true, lastName: true } } },
          })
        : [],
      can('candidate.view')
        ? this.prisma.visaFile.findMany({
            where: { organizationId: actor.organizationId, appointmentDate: { gte: past, lte: horizon }, status: { in: ['NOT_STARTED', 'PREPARING', 'SUBMITTED'] } },
            include: { candidate: { select: { firstName: true, lastName: true } } },
          })
        : [],
      can('task.view')
        ? this.prisma.task.findMany({
            where: { organizationId: actor.organizationId, dueDate: { gte: past, lte: horizon }, status: 'TODO' },
            include: { assignedTo: { select: { firstName: true, lastName: true } } },
          })
        : [],
      can('appointment.view')
        ? this.prisma.appointment.findMany({ where: { organizationId: actor.organizationId, startAt: { gte: past, lte: horizon }, status: 'SCHEDULED' } })
        : [],
      can('finance.view')
        ? this.prisma.invoice.findMany({
            where: { organizationId: actor.organizationId, dueDate: { gte: past, lte: horizon }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
            include: { candidate: { select: { firstName: true, lastName: true } } },
          })
        : [],
      can('prospect.view')
        ? this.prisma.prospect.findMany({
            where: { organizationId: actor.organizationId, deletedAt: null, nextFollowUpAt: { gte: past, lte: horizon }, status: { notIn: ['CONVERTED', 'LOST'] } },
          })
        : [],
    ]);

    const items: DeadlineItem[] = [
      ...applications.map((a) => ({
        kind: 'APPLICATION' as const,
        id: a.id,
        candidateId: a.candidateId,
        candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`,
        label: `Candidature ${a.university} (${a.program})`,
        date: a.deadline!,
        daysUntil: daysUntil(a.deadline!, now),
        urgency: urgencyOf(daysUntil(a.deadline!, now)),
      })),
      ...visaFiles.map((v) => ({
        kind: 'VISA' as const,
        id: v.id,
        candidateId: v.candidateId,
        candidateName: `${v.candidate.firstName} ${v.candidate.lastName}`,
        label: `Rendez-vous visa ${v.country}`,
        date: v.appointmentDate!,
        daysUntil: daysUntil(v.appointmentDate!, now),
        urgency: urgencyOf(daysUntil(v.appointmentDate!, now)),
      })),
      ...tasks
        .filter((t) => t.relatedType === 'CANDIDATE' && t.relatedId)
        .map((t) => ({
          kind: 'TASK' as const,
          id: t.id,
          candidateId: t.relatedId!,
          candidateName: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '',
          label: `Tâche : ${t.title}`,
          date: t.dueDate!,
          daysUntil: daysUntil(t.dueDate!, now),
          urgency: urgencyOf(daysUntil(t.dueDate!, now)),
        })),
      ...appointments
        .filter((a) => a.relatedType === 'CANDIDATE' && a.relatedId)
        .map((a) => ({
          kind: 'APPOINTMENT' as const,
          id: a.id,
          candidateId: a.relatedId!,
          candidateName: '',
          label: `Rendez-vous : ${a.title}`,
          date: a.startAt,
          daysUntil: daysUntil(a.startAt, now),
          urgency: urgencyOf(daysUntil(a.startAt, now)),
        })),
      ...invoices.map((i) => ({
        kind: 'INVOICE' as const,
        id: i.id,
        candidateId: i.candidateId,
        candidateName: `${i.candidate.firstName} ${i.candidate.lastName}`,
        label: `Facture ${i.number} échue`,
        date: i.dueDate!,
        daysUntil: daysUntil(i.dueDate!, now),
        urgency: urgencyOf(daysUntil(i.dueDate!, now)),
      })),
      ...prospectFollowUps.map((p) => ({
        kind: 'PROSPECT' as const,
        id: p.id,
        candidateId: null,
        candidateName: `${p.firstName} ${p.lastName}`,
        label: `Relance : ${p.firstName} ${p.lastName}`,
        date: p.nextFollowUpAt!,
        daysUntil: daysUntil(p.nextFollowUpAt!, now),
        urgency: urgencyOf(daysUntil(p.nextFollowUpAt!, now)),
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const counts: Record<Urgency, number> = { overdue: 0, today: 0, soon: 0, upcoming: 0 };
    for (const item of items) counts[item.urgency]++;

    return { items, counts };
  }
}
