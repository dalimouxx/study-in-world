import { MessageTemplatesService } from './message-templates.service';
import { DEFAULT_TEMPLATES } from './defaults';
import type { AuthUser } from '../common/auth-user';

const actor = (perms: string[] = ['settings.view', 'settings.manage']): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller', permissions: perms, isPlatformAdmin: false,
});

function build() {
  const prisma = {
    messageTemplate: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 't1', ...data })),
    },
    agencySettings: { findUnique: jest.fn().mockResolvedValue({ name: 'Study in World', phone: '+216 75 000 000', timezone: 'Africa/Tunis' }) },
    candidate: { findFirst: jest.fn() },
    prospect: { findFirst: jest.fn() },
  };
  const timeline = { add: jest.fn().mockResolvedValue({}) };
  return { service: new MessageTemplatesService(prisma as never, timeline as never), prisma, timeline };
}

describe('MessageTemplatesService', () => {
  it('ensureDefaults crée les modèles manquants sans jamais écraser', async () => {
    const { service, prisma } = build();
    await service.ensureDefaults('orgA');
    expect(prisma.messageTemplate.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    const { data } = prisma.messageTemplate.createMany.mock.calls[0][0] as { data: { organizationId: string }[] };
    expect(data).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(data.every((d) => d.organizationId === 'orgA')).toBe(true);
  });

  it('renderFor choisit la langue et remplit l’agence', async () => {
    const { service, prisma } = build();
    const tpl = DEFAULT_TEMPLATES.find((t) => t.key === 'PROSPECT_FOLLOW_UP' && t.channel === 'WHATSAPP')!;
    prisma.messageTemplate.findFirst.mockResolvedValue(tpl);
    const ar = await service.renderFor('orgA', 'PROSPECT_FOLLOW_UP', 'WHATSAPP', 'ar', { prenom: 'علي' });
    expect(ar.body).toContain('علي');
    expect(ar.body).toContain('Study in World');
    expect(ar.body).not.toContain('{');
  });

  it('update refuse un modèle d’une autre agence', async () => {
    const { service, prisma } = build();
    prisma.messageTemplate.findFirst.mockResolvedValue(null);
    await expect(service.update(actor(), 'tX', { nameFr: 'x', nameAr: 'x', bodyFr: 'x', bodyAr: 'x' }, {})).rejects.toMatchObject({ status: 404 });
    expect(prisma.messageTemplate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'tX', organizationId: 'orgA' }) }));
  });

  it('reset remet le texte par défaut', async () => {
    const { service, prisma } = build();
    prisma.messageTemplate.findFirst.mockResolvedValue({ id: 't1', organizationId: 'orgA', key: 'WELCOME', channel: 'WHATSAPP', bodyFr: 'modifié' });
    await service.reset(actor(), 't1', {});
    const def = DEFAULT_TEMPLATES.find((t) => t.key === 'WELCOME')!;
    expect(prisma.messageTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bodyFr: def.bodyFr, bodyAr: def.bodyAr }) }));
  });

  it('renderForEntity refuse sans permission de voir candidats ni prospects', async () => {
    const { service } = build();
    await expect(service.renderForEntity(actor(['settings.view']), 'WELCOME', 'WHATSAPP', 'CANDIDATE', 'c1')).rejects.toMatchObject({ status: 403 });
  });

  it('renderForEntity remplit avec le dossier du candidat, dans sa langue', async () => {
    const { service, prisma } = build();
    prisma.messageTemplate.findFirst.mockResolvedValue(DEFAULT_TEMPLATES.find((t) => t.key === 'WELCOME')!);
    prisma.candidate.findFirst.mockResolvedValue({ id: 'c1', firstName: 'Yasmine', lastName: 'Ben Ali', preferredLanguage: 'fr' });
    const out = await service.renderForEntity(actor(['candidate.view']), 'WELCOME', 'WHATSAPP', 'CANDIDATE', 'c1');
    expect(out.body).toContain('Yasmine');
    expect(out.language).toBe('fr');
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'c1', organizationId: 'orgA' }) }));
  });
});

describe('MessageTemplatesService.logSent', () => {
  it('note dans la chronologie du dossier le message WhatsApp envoyé', async () => {
    const { service, prisma, timeline } = build();
    prisma.messageTemplate.findFirst.mockResolvedValue(DEFAULT_TEMPLATES.find((t) => t.key === 'DOCUMENTS_LIST')!);
    prisma.candidate.findFirst.mockResolvedValue({ id: 'c1', firstName: 'Y', lastName: 'B', preferredLanguage: 'fr' });
    await service.logSent(actor(['candidate.view']), { key: 'DOCUMENTS_LIST', entityType: 'CANDIDATE', entityId: 'c1' });
    expect(timeline.add).toHaveBeenCalledWith('orgA', 'CANDIDATE', 'c1', 'NOTE', 'Message WhatsApp : Documents à fournir', 'u1');
  });

  it('refuse un dossier d’une autre agence', async () => {
    const { service, prisma } = build();
    prisma.prospect.findFirst.mockResolvedValue(null);
    await expect(service.logSent(actor(['prospect.view']), { key: 'WELCOME', entityType: 'PROSPECT', entityId: 'pX' })).rejects.toMatchObject({ status: 404 });
  });
});
