import { HealthScoreService } from './health-score.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['candidate.view'],
  isPlatformAdmin: false,
});

const completeCandidate = { id: 'cand1', status: 'ACTIVE', birthDate: new Date(), nationality: 'TN', passportNumber: 'X1', email: 'a@a.tn' };
const passportDoc = (overrides = {}) => ({ id: 'd1', type: 'PASSPORT', label: 'Passeport', status: 'APPROVED', expiryDate: null, ...overrides });
const requiredDocs = [passportDoc(), { id: 'd2', type: 'DIPLOMA', label: 'Diplôme', status: 'APPROVED', expiryDate: null }, { id: 'd3', type: 'PHOTO', label: 'Photo', status: 'APPROVED', expiryDate: null }];

function build() {
  const prisma = {
    candidate: { findUniqueOrThrow: jest.fn().mockResolvedValue(completeCandidate) },
    candidateDocument: { findMany: jest.fn().mockResolvedValue(requiredDocs) },
    application: { findMany: jest.fn().mockResolvedValue([{ id: 'a1', status: 'SUBMITTED', university: 'X', deadline: null }]) },
    visaFile: { findMany: jest.fn().mockResolvedValue([]) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
    task: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  return { service: new HealthScoreService(prisma as never, candidates as never), prisma };
}

describe('HealthScoreService.compute', () => {
  it('un dossier complet sans aucun problème obtient 100 et la catégorie "good"', async () => {
    const { service } = build();
    const result = await service.compute(actor(), 'cand1');
    expect(result.score).toBe(100);
    expect(result.category).toBe('good');
    expect(result.issues).toHaveLength(0);
  });

  it('un document manquant est signalé en IMPORTANT et pénalise le score', async () => {
    const { service, prisma } = build();
    prisma.candidateDocument.findMany.mockResolvedValue(requiredDocs.filter((d) => d.type !== 'DIPLOMA'));
    const result = await service.compute(actor(), 'cand1');
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DOCUMENT_MISSING', severity: 'IMPORTANT' })]));
    expect(result.score).toBe(85);
  });

  it('un passeport déjà expiré est CRITIQUE, pas seulement IMPORTANT', async () => {
    const { service, prisma } = build();
    prisma.candidateDocument.findMany.mockResolvedValue([passportDoc({ expiryDate: new Date(Date.now() - 86_400_000) }), requiredDocs[1], requiredDocs[2]]);
    const result = await service.compute(actor(), 'cand1');
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DOCUMENT_EXPIRED', severity: 'CRITICAL' })]));
  });

  it('une facture en retard est toujours CRITIQUE', async () => {
    const { service, prisma } = build();
    prisma.invoice.findMany.mockResolvedValue([{ id: 'i1', number: 'FAC-1', dueDate: new Date(Date.now() - 86_400_000) }]);
    const result = await service.compute(actor(), 'cand1');
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVOICE_OVERDUE', severity: 'CRITICAL' })]));
  });

  it('le score ne descend jamais sous 0 même avec de nombreux problèmes cumulés', async () => {
    const { service, prisma } = build();
    prisma.candidate.findUniqueOrThrow.mockResolvedValue({ id: 'cand1', status: 'ACTIVE', birthDate: null, nationality: null, passportNumber: null, email: null });
    prisma.candidateDocument.findMany.mockResolvedValue([]);
    prisma.invoice.findMany.mockResolvedValue([{ id: 'i1', number: 'FAC-1', dueDate: new Date(Date.now() - 86_400_000) }]);
    prisma.visaFile.findMany.mockResolvedValue([{ id: 'v1', country: 'Italie', status: 'PREPARING', appointmentDate: new Date(Date.now() - 86_400_000) }]);
    prisma.task.findMany.mockResolvedValue([{ id: 't1', dueDate: new Date(Date.now() - 86_400_000) }]);
    const result = await service.compute(actor(), 'cand1');
    expect(result.score).toBe(0);
    expect(result.category).toBe('risk');
  });

  it('les problèmes sont triés du plus grave au moins grave', async () => {
    const { service, prisma } = build();
    prisma.candidateDocument.findMany.mockResolvedValue(requiredDocs.filter((d) => d.type !== 'DIPLOMA'));
    prisma.candidate.findUniqueOrThrow.mockResolvedValue({ ...completeCandidate, birthDate: null });
    const result = await service.compute(actor(), 'cand1');
    expect(result.issues[0].severity).toBe('IMPORTANT');
    expect(result.issues[result.issues.length - 1].severity).toBe('ATTENTION');
  });
});
