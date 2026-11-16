import { RemindersService, dedupeKeyFor } from './reminders.service';
import { detectReminders, type DetectedReminder } from './reminders.detect';

jest.mock('./reminders.detect', () => ({ detectReminders: jest.fn() }));
const detect = detectReminders as jest.MockedFunction<typeof detectReminders>;

const NOW = new Date('2026-11-16T06:30:00Z'); // 07:30 à Tunis
const target = (o: object = {}) => ({ type: 'CANDIDATE' as const, id: 'c1', firstName: 'Yasmine', lastName: 'B', phone: '+216200', email: 'y@demo.tn', preferredLanguage: 'fr' as const, assignedToId: 'u1', ...o });
const appointment = (o: Partial<DetectedReminder> = {}): DetectedReminder => ({
  kind: 'APPOINTMENT_TOMORROW', entityType: 'APPOINTMENT', entityId: 'a1', target: target(), vars: { lieu: 'Agence' }, at: new Date('2026-11-17T09:00:00Z'), cycle: '', ...o,
});

function build({ smtp = true } = {}) {
  const logs: { dedupeKey: string; status: string; createdAt: Date; kind: string; entityId: string; channel: string }[] = [];
  const prisma = {
    reminderLog: {
      findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(logs.find((l) => l.dedupeKey === where.dedupeKey && (!where.status || l.status === where.status)) ?? null)),
      findMany: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(logs.filter((l) => l.kind === where.kind && l.entityId === where.entityId && l.channel === where.channel && l.status === where.status).sort((a, b) => +b.createdAt - +a.createdAt)),
      ),
      create: jest.fn().mockImplementation(({ data }) => {
        if (logs.some((l) => l.dedupeKey === data.dedupeKey)) return Promise.reject(Object.assign(new Error('unique'), { code: 'P2002' }));
        const row = { createdAt: new Date(), ...data };
        logs.push(row);
        return Promise.resolve(row);
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        const i = logs.findIndex((l) => l.dedupeKey === where.organizationId_dedupeKey.dedupeKey);
        if (i >= 0) logs.splice(i, 1);
        return Promise.resolve({});
      }),
    },
    agencySettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Africa/Tunis' }) },
    organization: { findMany: jest.fn().mockResolvedValue([{ id: 'orgA', settings: { timezone: 'Africa/Tunis' } }]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    task: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const mail = { send: jest.fn().mockResolvedValue(undefined), isConfigured: jest.fn().mockReturnValue(smtp) };
  const notifications = { notify: jest.fn().mockResolvedValue({}) };
  const timeline = { add: jest.fn().mockResolvedValue({}) };
  const templates = { renderFor: jest.fn().mockResolvedValue({ name: 'Rappel', subject: 'Sujet', body: 'Corps' }) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new RemindersService(prisma as never, mail as never, notifications as never, timeline as never, templates as never, config as never);
  return { service, prisma, mail, notifications, timeline, logs };
}

beforeEach(() => detect.mockReset());

describe('RemindersService.runForOrganization', () => {
  it('envoie l’e-mail de rappel de rendez-vous, journalise SENT et note la chronologie', async () => {
    const { service, mail, logs, timeline } = build();
    detect.mockResolvedValue([appointment()]);
    await service.runForOrganization('orgA', NOW);
    expect(mail.send).toHaveBeenCalledWith('y@demo.tn', 'Sujet', 'Corps', expect.any(String));
    expect(logs).toEqual([expect.objectContaining({ dedupeKey: 'APPOINTMENT_TOMORROW:EMAIL:a1', status: 'SENT' })]);
    expect(timeline.add).toHaveBeenCalledWith('orgA', 'CANDIDATE', 'c1', 'EMAIL', expect.stringContaining('Rappel'));
  });

  it('deux tournées le même jour n’envoient qu’une fois', async () => {
    const { service, mail } = build();
    detect.mockResolvedValue([appointment()]);
    await service.runForOrganization('orgA', NOW);
    await service.runForOrganization('orgA', NOW);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('deux tournées concurrentes n’envoient qu’une fois (contrainte d’unicité)', async () => {
    const { service, mail } = build();
    detect.mockResolvedValue([appointment()]);
    await Promise.all([service.runForOrganization('orgA', NOW), service.runForOrganization('orgA', NOW)]);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('un SKIPPED ne verrouille pas la clé : l’e-mail part quand l’adresse est ajoutée', async () => {
    const { service, mail, logs } = build();
    detect.mockResolvedValueOnce([appointment({ target: target({ email: null }) })]);
    await service.runForOrganization('orgA', NOW);
    expect(mail.send).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ status: 'SKIPPED' });
    expect(logs[0].dedupeKey.startsWith('APPOINTMENT_TOMORROW:EMAIL:a1#')).toBe(true);
    detect.mockResolvedValueOnce([appointment()]);
    await service.runForOrganization('orgA', NOW);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('sans SMTP : SKIPPED, jamais SENT', async () => {
    const { service, mail, logs } = build({ smtp: false });
    detect.mockResolvedValue([appointment()]);
    await service.runForOrganization('orgA', NOW);
    expect(mail.send).not.toHaveBeenCalled();
    expect(logs.map((l) => l.status)).toEqual(['SKIPPED']);
  });

  it('facture : au plus 3 e-mails, 7 jours d’écart minimum', async () => {
    const { service, mail, logs } = build();
    const inv = (cycle: string) => ({ ...appointment(), kind: 'INVOICE_OVERDUE' as const, entityType: 'INVOICE' as const, entityId: 'i1', cycle, vars: { facture: 'F1', montant: '100', devise: 'TND' } });
    for (const [i, cycle] of ['c0', 'c1', 'c2', 'c3'].entries()) {
      detect.mockResolvedValueOnce([inv(cycle)]);
      await service.runForOrganization('orgA', new Date(NOW.getTime() + i * 8 * 86_400_000));
      logs.filter((l) => l.status === 'SENT').forEach((l) => (l.createdAt = new Date(0))); // les envois précédents sont « anciens »
    }
    expect(mail.send).toHaveBeenCalledTimes(3);
    // même cycle mais dernier envoi récent : rien
    const { service: s2, mail: m2, logs: l2 } = build();
    l2.push({ dedupeKey: 'INVOICE_OVERDUE:EMAIL:i1:c0', status: 'SENT', createdAt: new Date(NOW.getTime() - 2 * 86_400_000), kind: 'INVOICE_OVERDUE', entityId: 'i1', channel: 'EMAIL' });
    detect.mockResolvedValueOnce([inv('c1')]);
    await s2.runForOrganization('orgA', NOW);
    expect(m2.send).not.toHaveBeenCalled();
  });

  it('un échec d’envoi n’arrête pas la tournée et libère la clé', async () => {
    const { service, mail, logs } = build();
    mail.send.mockRejectedValueOnce(new Error('SMTP down')).mockResolvedValueOnce(undefined);
    detect.mockResolvedValue([appointment(), appointment({ entityId: 'a2' })]);
    await service.runForOrganization('orgA', NOW);
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(logs.find((l) => l.dedupeKey.startsWith('APPOINTMENT_TOMORROW:EMAIL:a1'))).toMatchObject({ status: 'FAILED' });
    expect(logs.some((l) => l.dedupeKey === 'APPOINTMENT_TOMORROW:EMAIL:a1')).toBe(false);
    expect(logs.find((l) => l.dedupeKey === 'APPOINTMENT_TOMORROW:EMAIL:a2')).toMatchObject({ status: 'SENT' });
  });

  it('prospect à relancer : notification au conseiller assigné, rien sans conseiller', async () => {
    const { service, notifications, mail } = build();
    const p = { ...appointment(), kind: 'PROSPECT_FOLLOW_UP' as const, entityType: 'PROSPECT' as const, entityId: 'p1', cycle: '2026-11-16', target: target({ type: 'PROSPECT', id: 'p1' }) };
    detect.mockResolvedValue([p, { ...p, entityId: 'p2', target: target({ type: 'PROSPECT', id: 'p2', assignedToId: null }) }]);
    await service.runForOrganization('orgA', NOW);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith('orgA', 'u1', 'REMINDER', expect.any(String), expect.any(String), '/prospects');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('récapitulatif du matin : seulement les employés actifs, une fois par jour', async () => {
    const { service, prisma, notifications } = build();
    detect.mockResolvedValue([appointment()]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', firstName: 'Sami', email: 'sami@demo.tn', locale: 'fr' }]);
    await service.runForOrganization('orgA', NOW);
    await service.runForOrganization('orgA', NOW);
    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA', status: 'ACTIVE', deletedAt: null });
    expect(notifications.notify.mock.calls.filter((c) => c[2] === 'DAILY_DIGEST')).toHaveLength(1);
  });
});

describe('RemindersService.runDue', () => {
  it('le réveil intégré ne traite que les agences à 07:xx locale', async () => {
    const { service, prisma } = build();
    prisma.organization.findMany.mockResolvedValue([
      { id: 'orgTunis', settings: { timezone: 'Africa/Tunis' } },
      { id: 'orgTokyo', settings: { timezone: 'Asia/Tokyo' } },
    ]);
    detect.mockResolvedValue([]);
    const out = await service.runDue(NOW, 'cron');
    expect(out.map((r) => r.organizationId)).toEqual(['orgTunis']);
  });

  it('le réveil extérieur traite toutes les agences', async () => {
    const { service, prisma } = build();
    prisma.organization.findMany.mockResolvedValue([{ id: 'a', settings: null }, { id: 'b', settings: { timezone: 'Asia/Tokyo' } }]);
    detect.mockResolvedValue([]);
    expect((await service.runDue(NOW, 'external')).map((r) => r.organizationId)).toEqual(['a', 'b']);
  });
});

it('dedupeKeyFor', () => {
  expect(dedupeKeyFor(appointment(), 'EMAIL')).toBe('APPOINTMENT_TOMORROW:EMAIL:a1');
  expect(dedupeKeyFor({ ...appointment(), cycle: 'c2' }, 'WHATSAPP')).toBe('APPOINTMENT_TOMORROW:WHATSAPP:a1:c2');
});
