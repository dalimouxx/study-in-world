import { RemindersService } from './reminders.service';
import { detectReminders, type DetectedReminder } from './reminders.detect';
import type { AuthUser } from '../common/auth-user';

jest.mock('./reminders.detect', () => ({ detectReminders: jest.fn() }));
const detect = detectReminders as jest.MockedFunction<typeof detectReminders>;

const actor = (perms = ['candidate.view', 'prospect.view'], id = 'u1'): AuthUser => ({
  id, organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller', permissions: perms, isPlatformAdmin: false,
});
const rem = (id: string, assignedToId: string | null, o: Partial<DetectedReminder> = {}): DetectedReminder => ({
  kind: 'APPOINTMENT_TOMORROW', entityType: 'APPOINTMENT', entityId: id, cycle: '', at: new Date('2026-11-17T09:00:00Z'), vars: {},
  target: { type: 'CANDIDATE', id: `c-${id}`, firstName: 'Y', lastName: 'B', phone: '+216200', email: null, preferredLanguage: 'fr', assignedToId }, ...o,
});

function build() {
  const logs: { dedupeKey: string; status: string; channel: string; entityId: string; createdAt: Date }[] = [];
  const prisma = {
    reminderLog: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(logs)),
      create: jest.fn().mockImplementation(({ data }) => {
        if (logs.some((l) => l.dedupeKey === data.dedupeKey)) return Promise.reject(Object.assign(new Error('u'), { code: 'P2002' }));
        logs.push({ createdAt: new Date(), ...data });
        return Promise.resolve(data);
      }),
    },
    agencySettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Africa/Tunis' }) },
    prospect: { update: jest.fn().mockResolvedValue({}) },
  };
  const timeline = { add: jest.fn().mockResolvedValue({}) };
  const templates = { renderFor: jest.fn().mockResolvedValue({ name: 'Rappel', body: 'x' }) };
  const service = new RemindersService(prisma as never, {} as never, {} as never, timeline as never, templates as never, { get: jest.fn() } as never);
  return { service, prisma, timeline, logs };
}

beforeEach(() => detect.mockReset());

describe('Relances du jour', () => {
  it('« mine » renvoie mes relances et les non assignées (à part), pas celles des autres', async () => {
    const { service } = build();
    detect.mockResolvedValue([rem('a1', 'u1'), rem('a2', 'u2'), rem('a3', null)]);
    const out = await service.today(actor(), 'mine');
    expect(out.items.map((i) => i.entityId).sort()).toEqual(['a1', 'a3']);
    expect(out.items.find((i) => i.entityId === 'a3')!.unassigned).toBe(true);
  });

  it('« all » renvoie toute l’agence', async () => {
    const { service } = build();
    detect.mockResolvedValue([rem('a1', 'u1'), rem('a2', 'u2')]);
    expect((await service.today(actor(), 'all')).items).toHaveLength(2);
  });

  it('cache les relances de candidats sans la permission candidate.view', async () => {
    const { service } = build();
    detect.mockResolvedValue([rem('a1', 'u1'), rem('p1', 'u1', { kind: 'PROSPECT_FOLLOW_UP', entityType: 'PROSPECT', cycle: '2026-11-16', target: { ...rem('x', 'u1').target, type: 'PROSPECT', id: 'p1' } })]);
    const out = await service.today(actor(['prospect.view']), 'all');
    expect(out.items.map((i) => i.entityId)).toEqual(['p1']);
  });

  it('refuse sans aucune des deux permissions', async () => {
    const { service } = build();
    await expect(service.today(actor(['settings.view']), 'mine')).rejects.toMatchObject({ status: 403 });
  });

  it('une relance marquée faite passe dans « faites aujourd’hui »', async () => {
    const { service } = build();
    detect.mockResolvedValue([rem('a1', 'u1')]);
    await service.markDone(actor(), { key: 'APPOINTMENT_TOMORROW:WHATSAPP:a1' });
    const out = await service.today(actor(), 'mine');
    expect(out.items).toHaveLength(0);
    expect(out.doneToday.map((i) => i.entityId)).toEqual(['a1']);
  });

  it('done revalide la clé (404 si inconnue ou d’une autre agence)', async () => {
    const { service } = build();
    detect.mockResolvedValue([rem('a1', 'u1')]);
    await expect(service.markDone(actor(), { key: 'APPOINTMENT_TOMORROW:WHATSAPP:zzz' })).rejects.toMatchObject({ status: 404 });
    expect(detect).toHaveBeenCalledWith(expect.anything(), 'orgA', expect.any(Date), 'Africa/Tunis');
  });

  it('done est idempotent et note la chronologie une seule fois', async () => {
    const { service, timeline } = build();
    detect.mockResolvedValue([rem('a1', 'u1')]);
    await service.markDone(actor(), { key: 'APPOINTMENT_TOMORROW:WHATSAPP:a1' });
    await service.markDone(actor(), { key: 'APPOINTMENT_TOMORROW:WHATSAPP:a1' });
    expect(timeline.add).toHaveBeenCalledTimes(1);
    expect(timeline.add).toHaveBeenCalledWith('orgA', 'CANDIDATE', 'c-a1', 'NOTE', expect.stringContaining('WhatsApp'), 'u1');
  });

  it('done met à jour la prochaine relance du prospect (null = aucune)', async () => {
    const { service, prisma } = build();
    const p = rem('p1', 'u1', { kind: 'PROSPECT_FOLLOW_UP', entityType: 'PROSPECT', cycle: '2026-11-16', target: { ...rem('x', 'u1').target, type: 'PROSPECT', id: 'p1' } });
    detect.mockResolvedValue([p]);
    await service.markDone(actor(), { key: 'PROSPECT_FOLLOW_UP:WHATSAPP:p1:2026-11-16', nextFollowUpAt: '2026-11-19T08:00:00.000Z' });
    expect(prisma.prospect.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { nextFollowUpAt: new Date('2026-11-19T08:00:00.000Z') } });
  });
});
