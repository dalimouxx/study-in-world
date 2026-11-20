import type { ReminderKind } from '@prisma/client';
import type { TemplateVars } from '../message-templates/render';
import type { PrismaService } from '../prisma/prisma.service';
import { DAY_MS, dayRange, localDateKey } from './time';

export type ReminderTarget = {
  type: 'CANDIDATE' | 'PROSPECT';
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  preferredLanguage: 'fr' | 'ar';
  assignedToId: string | null;
};

export type DetectedReminder = {
  kind: Exclude<ReminderKind, 'DAILY_DIGEST'>;
  entityType: 'APPOINTMENT' | 'VISA_FILE' | 'PROSPECT' | 'INVOICE' | 'DOCUMENT';
  entityId: string;
  target: ReminderTarget;
  /** Valeurs brutes du message ; la date et l'heure sont formatées par le service dans la langue du destinataire. */
  vars: TemplateVars;
  /** Date de l'événement (rendez-vous, échéance, revue du document). */
  at: Date | null;
  /** Partie variable de la clé : '' (une fois), 'YYYY-MM-DD' (une fois par jour), 'c<n>' (cycle de 7 jours d'une facture). */
  cycle: string;
};

type CandidateRow = {
  id: string; firstName: string; lastName: string; phone: string | null; email: string | null;
  preferredLanguage: string; assignedToId: string | null; status?: string; deletedAt?: Date | null;
};

const candidateSelect = { id: true, firstName: true, lastName: true, phone: true, email: true, preferredLanguage: true, assignedToId: true, status: true, deletedAt: true } as const;

const isActiveCandidate = (c: CandidateRow | null | undefined): c is CandidateRow => !!c && !c.deletedAt && c.status !== 'ARCHIVED';

const toTarget = (type: 'CANDIDATE' | 'PROSPECT', c: CandidateRow): ReminderTarget => ({
  type, id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone ?? null, email: c.email ?? null,
  preferredLanguage: c.preferredLanguage === 'ar' ? 'ar' : 'fr', assignedToId: c.assignedToId ?? null,
});

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Relances à faire pour une agence à l'instant `now` (fuseau de l'agence). Une seule détection, utilisée à la fois
 * par la tournée du matin (e-mails, notifications) et par la page « Relances du jour » : les deux voient toujours
 * exactement la même liste.
 */
export async function detectReminders(prisma: PrismaService, organizationId: string, now: Date, timeZone: string): Promise<DetectedReminder[]> {
  const today = dayRange(now, timeZone, 0);
  const tomorrow = dayRange(now, timeZone, 1);
  const out: DetectedReminder[] = [];

  // 1. Rendez-vous de demain liés à un candidat (pas de relation Prisma directe : relatedType/relatedId).
  const appointments = await prisma.appointment.findMany({
    where: { organizationId, status: 'SCHEDULED', relatedType: 'CANDIDATE', startAt: { gte: tomorrow.start, lt: tomorrow.end } },
    select: { id: true, relatedId: true, startAt: true, location: true, title: true },
  });
  if (appointments.length) {
    const ids = [...new Set(appointments.map((a) => a.relatedId).filter((v): v is string => !!v))];
    const candidates = await prisma.candidate.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null, status: { not: 'ARCHIVED' } },
      select: candidateSelect,
    });
    const byId = new Map(candidates.map((c) => [c.id, c as CandidateRow]));
    for (const a of appointments) {
      const c = a.relatedId ? byId.get(a.relatedId) : undefined;
      if (!isActiveCandidate(c)) continue;
      out.push({ kind: 'APPOINTMENT_TOMORROW', entityType: 'APPOINTMENT', entityId: a.id, target: toTarget('CANDIDATE', c), vars: { lieu: a.location ?? '' }, at: a.startAt, cycle: '' });
    }
  }

  // 2. Rendez-vous visa de demain, dossier encore ouvert.
  const visas = await prisma.visaFile.findMany({
    where: { organizationId, appointmentDate: { gte: tomorrow.start, lt: tomorrow.end }, status: { notIn: ['APPROVED', 'REFUSED'] } },
    select: { id: true, country: true, appointmentDate: true, candidate: { select: candidateSelect } },
  });
  for (const v of visas) {
    if (!isActiveCandidate(v.candidate as CandidateRow)) continue;
    out.push({ kind: 'VISA_APPOINTMENT_TOMORROW', entityType: 'VISA_FILE', entityId: v.id, target: toTarget('CANDIDATE', v.candidate as CandidateRow), vars: { pays: v.country }, at: v.appointmentDate, cycle: '' });
  }

  // 3. Prospects à relancer aujourd'hui (ou en retard) : une relance par jour tant que la date n'est pas repoussée.
  const prospects = await prisma.prospect.findMany({
    where: { organizationId, deletedAt: null, status: { notIn: ['CONVERTED', 'LOST'] }, nextFollowUpAt: { lt: today.end } },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, preferredLanguage: true, assignedToId: true, nextFollowUpAt: true },
  });
  const todayKey = localDateKey(now, timeZone);
  for (const p of prospects) {
    out.push({ kind: 'PROSPECT_FOLLOW_UP', entityType: 'PROSPECT', entityId: p.id, target: toTarget('PROSPECT', p as CandidateRow), vars: {}, at: p.nextFollowUpAt, cycle: todayKey });
  }

  // 4. Factures en retard avec un reste à payer : un cycle tous les 7 jours de retard.
  const invoices = await prisma.invoice.findMany({
    where: { organizationId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, dueDate: { lt: today.start } },
    select: {
      id: true, number: true, currency: true, dueDate: true,
      items: { select: { quantity: true, unitPrice: true } }, payments: { select: { amount: true } },
      candidate: { select: candidateSelect },
    },
  });
  for (const inv of invoices) {
    if (!isActiveCandidate(inv.candidate as CandidateRow) || !inv.dueDate) continue;
    const rest = round3(inv.items.reduce((s, l) => s + l.quantity * l.unitPrice, 0) - inv.payments.reduce((s, p) => s + p.amount, 0));
    if (rest <= 0) continue;
    const daysLate = Math.floor((now.getTime() - inv.dueDate.getTime()) / DAY_MS);
    out.push({
      kind: 'INVOICE_OVERDUE', entityType: 'INVOICE', entityId: inv.id, target: toTarget('CANDIDATE', inv.candidate as CandidateRow),
      vars: { facture: inv.number, montant: String(rest), devise: inv.currency }, at: inv.dueDate, cycle: `c${Math.floor(daysLate / 7)}`,
    });
  }

  // 5. Documents rejetés dans les 7 derniers jours, sauf si une version plus récente du même type a été déposée.
  const rejected = await prisma.candidateDocument.findMany({
    where: { organizationId, status: 'REJECTED', deletedAt: null, reviewedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
    select: { id: true, type: true, label: true, reviewNote: true, reviewedAt: true, createdAt: true, candidateId: true, candidate: { select: candidateSelect } },
  });
  if (rejected.length) {
    const siblings = await prisma.candidateDocument.findMany({
      where: { organizationId, deletedAt: null, candidateId: { in: [...new Set(rejected.map((d) => d.candidateId))] }, type: { in: [...new Set(rejected.map((d) => d.type))] } },
      select: { candidateId: true, type: true, createdAt: true },
    });
    for (const d of rejected) {
      if (!isActiveCandidate(d.candidate as CandidateRow)) continue;
      const replaced = siblings.some((s) => s.candidateId === d.candidateId && s.type === d.type && s.createdAt > d.createdAt);
      if (replaced) continue;
      out.push({
        kind: 'DOCUMENT_REJECTED', entityType: 'DOCUMENT', entityId: d.id, target: toTarget('CANDIDATE', d.candidate as CandidateRow),
        vars: { document: d.label, raison: d.reviewNote ?? '' }, at: d.reviewedAt, cycle: '',
      });
    }
  }

  return out;
}
