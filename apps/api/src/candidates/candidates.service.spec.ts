import { CandidatesService } from './candidates.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['candidate.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    candidate: { findFirst: jest.fn().mockResolvedValue({ id: 'cand1', status: 'ACTIVE' }), update: jest.fn().mockResolvedValue({ id: 'cand1' }) },
    partner: { findFirst: jest.fn() },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new CandidatesService(prisma as never, audit as never, timeline as never), prisma };
}

/**
 * Audit de sécurité (isolation multi-agence) : un employé ne doit jamais pouvoir lier un candidat à un
 * partenaire d'une autre organisation, ni via un ID inexistant provoquant une erreur de contrainte brute.
 */
describe('CandidatesService.update — validation du partenaire lié', () => {
  it('refuse un partnerId qui n’appartient pas à l’organisation de l’employé (ou inexistant)', async () => {
    const { service, prisma } = build();
    prisma.partner.findFirst.mockResolvedValue(null);
    await expect(service.update(actor(), 'cand1', { partnerId: 'partner-from-another-org' }, {})).rejects.toMatchObject({ status: 400 });
    expect(prisma.candidate.update).not.toHaveBeenCalled();
  });

  it('accepte un partnerId qui appartient bien à l’organisation de l’employé', async () => {
    const { service, prisma } = build();
    prisma.partner.findFirst.mockResolvedValue({ id: 'p1' });
    await service.update(actor(), 'cand1', { partnerId: 'p1' }, {});
    expect(prisma.candidate.update).toHaveBeenCalled();
  });

  it('ne vérifie rien (et n’échoue pas) quand on délie un candidat de son partenaire', async () => {
    const { service, prisma } = build();
    await service.update(actor(), 'cand1', { partnerId: null as unknown as undefined }, {});
    expect(prisma.partner.findFirst).not.toHaveBeenCalled();
    expect(prisma.candidate.update).toHaveBeenCalled();
  });
});
