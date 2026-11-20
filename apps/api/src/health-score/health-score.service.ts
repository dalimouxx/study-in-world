import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidates/candidates.service';
import type { AuthUser } from '../common/auth-user';

export type IssueSeverity = 'CRITICAL' | 'IMPORTANT' | 'ATTENTION' | 'INFO';

export interface HealthIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
}

const PENALTY: Record<IssueSeverity, number> = { CRITICAL: 25, IMPORTANT: 15, ATTENTION: 5, INFO: 2 };
const REQUIRED_DOCUMENT_TYPES = ['PASSPORT', 'DIPLOMA', 'PHOTO'];
const DAY_MS = 86_400_000;

/**
 * Health Score (section 21) + détection de problèmes (section 26), fusionnés en un seul calcul : à chaque
 * problème détecté correspond une pénalité, jamais une décision automatique — juste un signal pour le
 * conseiller. Recalculé à la demande, jamais stocké (les données sous-jacentes bougent trop souvent pour
 * qu'un score en base reste fiable).
 */
@Injectable()
export class HealthScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
  ) {}

  async compute(actor: AuthUser, candidateId: string) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const now = new Date();

    const [candidate, documents, applications, visaFiles, invoices, tasks] = await Promise.all([
      this.prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } }),
      this.prisma.candidateDocument.findMany({ where: { organizationId: actor.organizationId, candidateId, deletedAt: null } }),
      this.prisma.application.findMany({ where: { organizationId: actor.organizationId, candidateId } }),
      this.prisma.visaFile.findMany({ where: { organizationId: actor.organizationId, candidateId } }),
      this.prisma.invoice.findMany({ where: { organizationId: actor.organizationId, candidateId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } }, include: { payments: true } }),
      this.prisma.task.findMany({ where: { organizationId: actor.organizationId, relatedType: 'CANDIDATE', relatedId: candidateId, status: 'TODO' } }),
    ]);

    const issues: HealthIssue[] = [];

    // Informations personnelles (section 21 : "Informations personnelles : X %")
    const missingFields = [
      !candidate.birthDate && 'birthDate', !candidate.nationality && 'nationality', !candidate.passportNumber && 'passportNumber', !candidate.email && 'email',
    ].filter(Boolean);
    if (missingFields.length > 0) {
      issues.push({ severity: 'ATTENTION', code: 'PROFILE_INCOMPLETE', message: `Profil incomplet (${missingFields.length} champ${missingFields.length > 1 ? 's' : ''} manquant${missingFields.length > 1 ? 's' : ''})` });
    }

    // Documents requis
    for (const type of REQUIRED_DOCUMENT_TYPES) {
      const doc = documents.find((d) => d.type === type);
      if (!doc) issues.push({ severity: 'IMPORTANT', code: 'DOCUMENT_MISSING', message: `Document manquant : ${type}` });
      else if (doc.status === 'REJECTED') issues.push({ severity: 'IMPORTANT', code: 'DOCUMENT_REJECTED', message: `Document rejeté : ${doc.label}` });
    }

    // Documents expirés / bientôt expirés
    for (const doc of documents) {
      if (!doc.expiryDate) continue;
      const daysLeft = Math.floor((doc.expiryDate.getTime() - now.getTime()) / DAY_MS);
      if (daysLeft < 0) issues.push({ severity: 'CRITICAL', code: 'DOCUMENT_EXPIRED', message: `${doc.label} expiré depuis ${Math.abs(daysLeft)} jour(s)` });
      else if (daysLeft <= 90) issues.push({ severity: daysLeft <= 30 ? 'CRITICAL' : 'IMPORTANT', code: 'DOCUMENT_EXPIRING', message: `${doc.label} expire dans ${daysLeft} jour(s)` });
    }

    // Candidatures
    const activeApplications = applications.filter((a) => !['REJECTED', 'WITHDRAWN'].includes(a.status));
    if (candidate.status === 'ACTIVE' && applications.length === 0) {
      issues.push({ severity: 'ATTENTION', code: 'NO_APPLICATION', message: 'Aucune candidature créée' });
    }
    for (const app of activeApplications) {
      if (app.deadline) {
        const daysLeft = Math.floor((app.deadline.getTime() - now.getTime()) / DAY_MS);
        if (daysLeft < 0 && app.status === 'DRAFT') issues.push({ severity: 'CRITICAL', code: 'APPLICATION_DEADLINE_PASSED', message: `Date limite dépassée : ${app.university}` });
        else if (daysLeft <= 7 && app.status === 'DRAFT') issues.push({ severity: 'IMPORTANT', code: 'APPLICATION_DEADLINE_SOON', message: `Date limite dans ${daysLeft} jour(s) : ${app.university}` });
      }
    }

    // Visa
    for (const v of visaFiles) {
      if (v.appointmentDate && v.appointmentDate < now && !['APPROVED', 'REFUSED'].includes(v.status)) {
        issues.push({ severity: 'CRITICAL', code: 'VISA_APPOINTMENT_PASSED', message: `Rendez-vous visa (${v.country}) dépassé sans mise à jour du statut` });
      }
    }

    // Finance
    for (const inv of invoices) {
      if (inv.dueDate && inv.dueDate < now) {
        issues.push({ severity: 'CRITICAL', code: 'INVOICE_OVERDUE', message: `Facture ${inv.number} en retard de paiement` });
      }
    }

    // Tâches en retard
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < now);
    if (overdueTasks.length > 0) {
      issues.push({ severity: 'IMPORTANT', code: 'TASKS_OVERDUE', message: `${overdueTasks.length} tâche(s) en retard` });
    }

    const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + PENALTY[i.severity], 0));
    const category: 'good' | 'watch' | 'risk' = score >= 75 ? 'good' : score >= 45 ? 'watch' : 'risk';

    return { score, category, issues: issues.sort((a, b) => PENALTY[b.severity] - PENALTY[a.severity]) };
  }
}
