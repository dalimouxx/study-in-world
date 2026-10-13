import { AiAssistantService } from './ai-assistant.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['candidate.view'],
  isPlatformAdmin: false,
});

function build(apiKey?: string) {
  const prisma = {
    candidate: { findFirst: jest.fn().mockResolvedValue({ id: 'cand1', firstName: 'Ali', lastName: 'Ben', status: 'ACTIVE', nationality: 'TN', passportNumber: 'X1', applications: [], visaFiles: [], _count: { documents: 0 } }) },
    timelineEntry: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const healthScore = { compute: jest.fn().mockResolvedValue({ score: 90, category: 'good', issues: [] }) };
  const config = { get: jest.fn((key: string) => ({ ANTHROPIC_API_KEY: apiKey, ANTHROPIC_MODEL: 'claude-sonnet-5' })[key]) };
  return { service: new AiAssistantService(prisma as never, healthScore as never, config as never), prisma };
}

describe('AiAssistantService — sans clé configurée', () => {
  it('summary() refuse clairement plutôt que d’échouer silencieusement', async () => {
    const { service } = build(undefined);
    await expect(service.summary(actor(), 'cand1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'AI_NOT_CONFIGURED' }) });
  });

  it('draftMessage() refuse clairement plutôt que d’échouer silencieusement', async () => {
    const { service } = build(undefined);
    await expect(service.draftMessage(actor(), 'cand1', 'rappelle le passeport')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'AI_NOT_CONFIGURED' }) });
  });

  it('refuse pour un candidat introuvable avant même de vérifier la clé API', async () => {
    const { service, prisma } = build(undefined);
    prisma.candidate.findFirst.mockResolvedValue(null);
    await expect(service.summary(actor(), 'cand-other-org')).rejects.toMatchObject({ status: 404 });
  });
});

describe('AiAssistantService — avec clé configurée', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('renvoie le texte de la réponse Anthropic', async () => {
    const { service } = build('sk-ant-fake');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: '  Résumé du dossier.  ' }] }) }) as never;
    const text = await service.summary(actor(), 'cand1');
    expect(text).toBe('Résumé du dossier.');
  });

  it('renvoie une erreur claire si l’API distante échoue', async () => {
    const { service } = build('sk-ant-fake');
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;
    await expect(service.summary(actor(), 'cand1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'AI_UNAVAILABLE' }) });
  });

  it('renvoie une erreur claire si la requête réseau échoue', async () => {
    const { service } = build('sk-ant-fake');
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never;
    await expect(service.summary(actor(), 'cand1')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'AI_UNAVAILABLE' }) });
  });
});
