import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user';
import { apiError } from '../common/errors/api-error';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { ReminderChannel } from '@prisma/client';
import type { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
import { formatDateFor, type TemplateVars } from '../message-templates/render';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { detectReminders, type DetectedReminder } from './reminders.detect';
import { DAY_MS, dayRange, localDateKey, localHour } from './time';

export type TodayReminder = {
  key: string;
  kind: DetectedReminder['kind'];
  entityType: DetectedReminder['entityType'];
  entityId: string;
  target: { type: 'CANDIDATE' | 'PROSPECT'; id: string; name: string; phone: string | null; preferredLanguage: 'fr' | 'ar' };
  at: string | null;
  summary: TemplateVars;
  autoChannel: { channel: 'EMAIL' | 'NOTIFICATION'; status: 'SENT' | 'SKIPPED' | 'FAILED'; at: string; error: string | null } | null;
  assignedToId: string | null;
  unassigned: boolean;
  /** Message WhatsApp déjà rempli, dans la langue de la personne (ouvert tel quel au clic, sans aller-retour). */
  whatsappText: string;
};

export type RunSummary = { organizationId: string; counts: Record<string, { SENT: number; SKIPPED: number; FAILED: number }> };

/** Clé anti-doublon : `${kind}:${canal}:${entité}` plus le cycle (jour local ou cycle de facture) s'il y en a un. */
export function dedupeKeyFor(r: Pick<DetectedReminder, 'kind' | 'entityId' | 'cycle'>, channel: ReminderChannel): string {
  return `${r.kind}:${channel}:${r.entityId}${r.cycle ? `:${r.cycle}` : ''}`;
}

const DEFAULT_TZ = 'Africa/Tunis';
const MAX_INVOICE_EMAILS = 3;

/** E-mails automatiques au candidat ; le prospect à relancer donne une notification au conseiller. */
const AUTO_CHANNEL: Record<DetectedReminder['kind'], 'EMAIL' | 'NOTIFICATION'> = {
  APPOINTMENT_TOMORROW: 'EMAIL',
  VISA_APPOINTMENT_TOMORROW: 'EMAIL',
  INVOICE_OVERDUE: 'EMAIL',
  DOCUMENT_REJECTED: 'EMAIL',
  PROSPECT_FOLLOW_UP: 'NOTIFICATION',
};

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'P2002';

/**
 * Tournée du matin des relances. Idempotente : seule une ligne SENT porte la clé exacte (contrainte d'unicité),
 * donc deux tournées — même simultanées (réveil intégré + route extérieure) — n'envoient jamais deux fois.
 * Une relance ignorée (pas d'e-mail, SMTP absent) ou en échec reste à faire et sera retentée.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly timeline: TimelineService,
    private readonly templates: MessageTemplatesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Réveil intégré : chaque heure, traite les agences pour lesquelles il est 07:xx en heure locale. */
  @Cron('0 * * * *')
  async hourly(): Promise<void> {
    if (this.config.get('REMINDERS_CRON_ENABLED', { infer: true }) === false) return;
    try {
      await this.runDue(new Date(), 'cron');
    } catch (e) {
      this.logger.error(`Tournée des relances interrompue : ${(e as Error).message}`);
    }
  }

  async runDue(now: Date, mode: 'cron' | 'external'): Promise<RunSummary[]> {
    const orgs = await this.prisma.organization.findMany({ select: { id: true, settings: { select: { timezone: true } } } });
    const out: RunSummary[] = [];
    for (const org of orgs) {
      const tz = org.settings?.timezone || DEFAULT_TZ;
      if (mode === 'cron' && localHour(now, tz) !== 7) continue;
      out.push(await this.runForOrganization(org.id, now, tz));
    }
    return out;
  }

  async timezoneOf(organizationId: string): Promise<string> {
    const s = await this.prisma.agencySettings.findUnique({ where: { organizationId }, select: { timezone: true } });
    return s?.timezone || DEFAULT_TZ;
  }

  async runForOrganization(organizationId: string, now: Date, timeZone?: string): Promise<RunSummary> {
    const tz = timeZone ?? (await this.timezoneOf(organizationId));
    const summary: RunSummary = { organizationId, counts: {} };
    const count = (kind: string, status: 'SENT' | 'SKIPPED' | 'FAILED') => {
      summary.counts[kind] ??= { SENT: 0, SKIPPED: 0, FAILED: 0 };
      summary.counts[kind][status] += 1;
    };

    const reminders = await detectReminders(this.prisma, organizationId, now, tz);
    for (const r of reminders) {
      try {
        const status = AUTO_CHANNEL[r.kind] === 'EMAIL' ? await this.emailOnce(organizationId, r, now, tz) : await this.notifyOnce(organizationId, r);
        if (status) count(r.kind, status);
      } catch (e) {
        this.logger.error(`Relance ${r.kind} ${r.entityId} : ${(e as Error).message}`);
        count(r.kind, 'FAILED');
      }
    }
    try {
      for (const status of await this.digest(organizationId, reminders, now, tz)) count('DAILY_DIGEST', status);
    } catch (e) {
      this.logger.error(`Récapitulatif du matin : ${(e as Error).message}`);
    }
    this.logger.log(`Relances ${organizationId} : ${JSON.stringify(summary.counts)}`);
    return summary;
  }

  private assertCanSeeReminders(actor: AuthUser) {
    if (!actor.permissions.includes('candidate.view') && !actor.permissions.includes('prospect.view')) {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Permission insuffisante');
    }
  }

  private visibleFor(actor: AuthUser, r: DetectedReminder) {
    return actor.permissions.includes(r.target.type === 'CANDIDATE' ? 'candidate.view' : 'prospect.view');
  }

  /**
   * Page « Relances du jour » : calculée à l'ouverture avec la même détection que la tournée du matin
   * (elle ne dépend donc d'aucun réveil). « mine » = mes relances + les non assignées ; « all » = toute l'agence.
   */
  async today(actor: AuthUser, scope: 'mine' | 'all', now = new Date()): Promise<{ items: TodayReminder[]; doneToday: TodayReminder[] }> {
    this.assertCanSeeReminders(actor);
    const tz = await this.timezoneOf(actor.organizationId);
    const detected = (await detectReminders(this.prisma, actor.organizationId, now, tz))
      .filter((r) => this.visibleFor(actor, r))
      .filter((r) => scope === 'all' || !r.target.assignedToId || r.target.assignedToId === actor.id);
    if (!detected.length) return { items: [], doneToday: [] };

    const since = dayRange(now, tz, 0).start;
    const logs = await this.prisma.reminderLog.findMany({
      where: { organizationId: actor.organizationId, entityId: { in: [...new Set(detected.map((r) => r.entityId))] }, createdAt: { gte: new Date(since.getTime() - 7 * DAY_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    const lang = actor.locale === 'ar' ? 'ar' : 'fr';
    const items: TodayReminder[] = [];
    const doneToday: TodayReminder[] = [];
    for (const r of detected) {
      const key = dedupeKeyFor(r, 'WHATSAPP');
      const autoKey = dedupeKeyFor(r, AUTO_CHANNEL[r.kind]);
      const auto = logs.find((l) => l.dedupeKey === autoKey || l.dedupeKey.startsWith(`${autoKey}#`));
      const when = r.at ? formatDateFor(lang, r.at, tz) : { date: '', heure: '' };
      const row: TodayReminder = {
        key, kind: r.kind, entityType: r.entityType, entityId: r.entityId,
        target: { type: r.target.type, id: r.target.id, name: `${r.target.firstName} ${r.target.lastName}`.trim(), phone: r.target.phone, preferredLanguage: r.target.preferredLanguage },
        at: r.at ? r.at.toISOString() : null,
        summary: { ...r.vars, ...when },
        autoChannel: auto ? { channel: auto.channel as 'EMAIL' | 'NOTIFICATION', status: auto.status, at: auto.createdAt.toISOString(), error: auto.error ?? null } : null,
        assignedToId: r.target.assignedToId,
        unassigned: !r.target.assignedToId,
        whatsappText: (await this.templates.renderFor(actor.organizationId, r.kind, 'WHATSAPP', r.target.preferredLanguage, this.varsFor(r, tz))).body,
      };
      (logs.some((l) => l.dedupeKey === key && l.status === 'SENT') ? doneToday : items).push(row);
    }
    return { items, doneToday };
  }

  /**
   * Le conseiller a envoyé le WhatsApp : la relance est marquée faite (journal + chronologie), et pour un prospect
   * la prochaine relance peut être repoussée (`null` = plus de relance prévue).
   */
  async markDone(actor: AuthUser, dto: { key: string; nextFollowUpAt?: string | null }, now = new Date()): Promise<{ ok: true }> {
    this.assertCanSeeReminders(actor);
    const tz = await this.timezoneOf(actor.organizationId);
    const r = (await detectReminders(this.prisma, actor.organizationId, now, tz)).find((x) => dedupeKeyFor(x, 'WHATSAPP') === dto.key);
    if (!r || !this.visibleFor(actor, r)) throw apiError(HttpStatus.NOT_FOUND, 'REMINDER_NOT_FOUND', 'Relance introuvable');

    const created = await this.prisma.reminderLog
      .create({ data: { organizationId: actor.organizationId, kind: r.kind, entityType: r.entityType, entityId: r.entityId, channel: 'WHATSAPP', dedupeKey: dto.key, status: 'SENT', sentById: actor.id } })
      .then(() => true, (e) => (isUniqueViolation(e) ? false : Promise.reject(e)));
    if (created) {
      const msg = await this.templates.renderFor(actor.organizationId, r.kind, 'WHATSAPP', r.target.preferredLanguage, {});
      await this.timeline.add(actor.organizationId, r.target.type, r.target.id, 'NOTE', `Relance WhatsApp envoyée : ${msg.name}`, actor.id);
    }
    if (r.kind === 'PROSPECT_FOLLOW_UP' && dto.nextFollowUpAt !== undefined) {
      await this.prisma.prospect.update({ where: { id: r.entityId }, data: { nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null } });
    }
    return { ok: true };
  }

  /** Variables communes d'un message : identité de la personne, date et heure formatées dans sa langue. */
  varsFor(r: DetectedReminder, tz: string): TemplateVars {
    const when = r.at ? formatDateFor(r.target.preferredLanguage, r.at, tz) : { date: '', heure: '' };
    const vars: TemplateVars = { prenom: r.target.firstName, nom: r.target.lastName, ...when, ...r.vars };
    if (r.kind === 'INVOICE_OVERDUE' && vars.montant) {
      vars.montant = Number(vars.montant).toLocaleString(r.target.preferredLanguage === 'ar' ? 'ar-TN' : 'fr-TN', { maximumFractionDigits: 3 });
    }
    return vars;
  }

  private async alreadySent(organizationId: string, key: string): Promise<boolean> {
    return !!(await this.prisma.reminderLog.findFirst({ where: { organizationId, dedupeKey: key, status: 'SENT' } }));
  }

  private async logAside(organizationId: string, r: DetectedReminder, channel: ReminderChannel, key: string, status: 'SKIPPED' | 'FAILED', error?: string) {
    await this.prisma.reminderLog.create({
      data: { organizationId, kind: r.kind, entityType: r.entityType, entityId: r.entityId, channel, dedupeKey: `${key}#${new Date().toISOString()}#${Math.random().toString(36).slice(2, 8)}`, status, error },
    });
  }

  /** Verrouille la clé en insérant la ligne SENT ; `false` si une autre tournée l'a déjà fait. */
  private async lock(organizationId: string, r: DetectedReminder, channel: ReminderChannel, key: string): Promise<boolean> {
    try {
      await this.prisma.reminderLog.create({ data: { organizationId, kind: r.kind, entityType: r.entityType, entityId: r.entityId, channel, dedupeKey: key, status: 'SENT' } });
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
  }

  private async unlock(organizationId: string, key: string) {
    await this.prisma.reminderLog.delete({ where: { organizationId_dedupeKey: { organizationId, dedupeKey: key } } });
  }

  private async emailOnce(organizationId: string, r: DetectedReminder, now: Date, tz: string): Promise<'SENT' | 'SKIPPED' | 'FAILED' | null> {
    const key = dedupeKeyFor(r, 'EMAIL');
    if (await this.alreadySent(organizationId, key)) return null;

    if (r.kind === 'INVOICE_OVERDUE') {
      const previous = await this.prisma.reminderLog.findMany({
        where: { organizationId, kind: 'INVOICE_OVERDUE', entityId: r.entityId, channel: 'EMAIL', status: 'SENT' },
        orderBy: { createdAt: 'desc' },
      });
      if (previous.length >= MAX_INVOICE_EMAILS) return null;
      if (previous[0] && now.getTime() - previous[0].createdAt.getTime() < 7 * DAY_MS) return null;
    }

    if (!r.target.email || !this.mail.isConfigured()) {
      await this.logAside(organizationId, r, 'EMAIL', key, 'SKIPPED', !r.target.email ? 'Pas d’adresse e-mail' : 'SMTP non configuré');
      return 'SKIPPED';
    }
    if (!(await this.lock(organizationId, r, 'EMAIL', key))) return null;

    const msg = await this.templates.renderFor(organizationId, r.kind, 'EMAIL', r.target.preferredLanguage, this.varsFor(r, tz));
    try {
      await this.mail.send(r.target.email, msg.subject ?? msg.name, msg.body, toHtml(msg.body, r.target.preferredLanguage));
    } catch (e) {
      await this.unlock(organizationId, key);
      await this.logAside(organizationId, r, 'EMAIL', key, 'FAILED', (e as Error).message);
      return 'FAILED';
    }
    await this.timeline.add(organizationId, r.target.type, r.target.id, 'EMAIL', `Rappel envoyé par e-mail : ${msg.name}`);
    return 'SENT';
  }

  private async notifyOnce(organizationId: string, r: DetectedReminder): Promise<'SENT' | null> {
    if (!r.target.assignedToId) return null; // non assignée : visible dans « Relances du jour », section « Non assignées »
    const key = dedupeKeyFor(r, 'NOTIFICATION');
    if (await this.alreadySent(organizationId, key)) return null;
    if (!(await this.lock(organizationId, r, 'NOTIFICATION', key))) return null;
    const name = `${r.target.firstName} ${r.target.lastName}`.trim();
    await this.notifications.notify(organizationId, r.target.assignedToId, 'REMINDER', `Prospect à relancer : ${name}`, 'Relance prévue aujourd’hui', '/prospects');
    return 'SENT';
  }

  /** Récapitulatif du matin : relances assignées + tâches dues aujourd'hui, pour chaque employé actif concerné. */
  private async digest(organizationId: string, reminders: DetectedReminder[], now: Date, tz: string): Promise<('SENT' | 'SKIPPED')[]> {
    const today = dayRange(now, tz, 0);
    const day = localDateKey(now, tz);
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, firstName: true, email: true, locale: true },
    });
    const tasks = await this.prisma.task.findMany({
      where: { organizationId, status: 'TODO', dueDate: { gte: today.start, lt: today.end }, assignedToId: { not: null } },
      select: { title: true, assignedToId: true },
    });
    const out: ('SENT' | 'SKIPPED')[] = [];
    for (const u of users) {
      const mine = reminders.filter((r) => r.target.assignedToId === u.id);
      const myTasks = tasks.filter((t) => t.assignedToId === u.id);
      if (!mine.length && !myTasks.length) continue;
      const lang = u.locale === 'ar' ? 'ar' : 'fr';
      const lines = [
        ...mine.map((r) => `• ${LABEL[lang][r.kind]} — ${r.target.firstName} ${r.target.lastName}`),
        ...myTasks.map((t) => `• ${lang === 'ar' ? 'مهمة' : 'Tâche'} — ${t.title}`),
      ];
      const fake = { kind: 'DAILY_DIGEST', entityType: 'USER', entityId: u.id, cycle: day } as unknown as DetectedReminder;

      const notifKey = `DAILY_DIGEST:NOTIFICATION:${u.id}:${day}`;
      if (!(await this.alreadySent(organizationId, notifKey)) && (await this.lock(organizationId, fake, 'NOTIFICATION', notifKey))) {
        await this.notifications.notify(organizationId, u.id, 'DAILY_DIGEST', lang === 'ar' ? 'ملخص يومك' : 'Votre journée', lines.slice(0, 5).join('\n'), '/reminders');
        out.push('SENT');
      }

      const mailKey = `DAILY_DIGEST:EMAIL:${u.id}:${day}`;
      if (await this.alreadySent(organizationId, mailKey)) continue;
      if (!u.email || !this.mail.isConfigured()) {
        await this.logAside(organizationId, fake, 'EMAIL', mailKey, 'SKIPPED', !u.email ? 'Pas d’adresse e-mail' : 'SMTP non configuré');
        out.push('SKIPPED');
        continue;
      }
      if (!(await this.lock(organizationId, fake, 'EMAIL', mailKey))) continue;
      const msg = await this.templates.renderFor(organizationId, 'DAILY_DIGEST', 'EMAIL', lang, { prenom: u.firstName, date: formatDateFor(lang, now, tz).date });
      const body = `${msg.body}\n\n${lines.join('\n')}`;
      try {
        await this.mail.send(u.email, msg.subject ?? msg.name, body, toHtml(body, lang));
        out.push('SENT');
      } catch (e) {
        await this.unlock(organizationId, mailKey);
        await this.logAside(organizationId, fake, 'EMAIL', mailKey, 'FAILED', (e as Error).message);
      }
    }
    return out;
  }
}

const LABEL: Record<'fr' | 'ar', Record<DetectedReminder['kind'], string>> = {
  fr: {
    APPOINTMENT_TOMORROW: 'Rendez-vous demain',
    VISA_APPOINTMENT_TOMORROW: 'Rendez-vous visa demain',
    PROSPECT_FOLLOW_UP: 'Prospect à relancer',
    INVOICE_OVERDUE: 'Facture en retard',
    DOCUMENT_REJECTED: 'Document à renvoyer',
  },
  ar: {
    APPOINTMENT_TOMORROW: 'موعد غدًا',
    VISA_APPOINTMENT_TOMORROW: 'موعد تأشيرة غدًا',
    PROSPECT_FOLLOW_UP: 'عميل محتمل يجب متابعته',
    INVOICE_OVERDUE: 'فاتورة متأخرة',
    DOCUMENT_REJECTED: 'وثيقة يجب إعادة إرسالها',
  },
};

/** Version HTML simple et lisible d'un e-mail texte (sens de lecture selon la langue). */
function toHtml(text: string, lang: 'fr' | 'ar'): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0B1230">${esc.replace(/\n/g, '<br>')}</div>`;
}
