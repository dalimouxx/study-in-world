import { PartnerPortalService } from './partner-portal.service';
import type { PartnerAuthUser } from '../common/auth-user';

const partner = (): PartnerAuthUser => ({ id: 'pu1', organizationId: 'orgA', partnerId: 'p1', email: 'a@a.tn', firstName: 'A', lastName: 'B' });

function build() {
  const prisma = {
    candidate: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    partnerComment: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    commission: { findMany: jest.fn().mockResolvedValue([]) },
    partner: { findFirstOrThrow: jest.fn().mockResolvedValue({}) },
  };
  return { service: new PartnerPortalService(prisma as never), prisma };
}

describe('PartnerPortalService — isolation stricte', () => {
  it('candidates() filtre toujours par organizationId ET partnerId', async () => {
    const { service, prisma } = build();
    await service.candidates(partner());
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'orgA', partnerId: 'p1' }) }));
  });

  it('candidate() refuse un candidat qui n’appartient pas à ce partenaire', async () => {
    const { service, prisma } = build();
    prisma.candidate.findFirst.mockResolvedValue(null);
    await expect(service.candidate(partner(), 'cand-not-mine')).rejects.toMatchObject({ status: 404 });
  });

  it('addComment() refuse d’écrire sur un candidat qui n’appartient pas à ce partenaire', async () => {
    const { service, prisma } = build();
    prisma.candidate.findFirst.mockResolvedValue(null);
    await expect(service.addComment(partner(), 'cand-not-mine', 'texte')).rejects.toMatchObject({ status: 404 });
    expect(prisma.partnerComment.create).not.toHaveBeenCalled();
  });

  it('commissions() filtre toujours par organizationId ET partnerId', async () => {
    const { service, prisma } = build();
    await service.commissions(partner());
    expect(prisma.commission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'orgA', partnerId: 'p1' }) }));
  });
});

describe('PartnerPortalService.profile — défense en profondeur', () => {
  it('filtre toujours par organizationId, même si le partnerId du jeton était déjà vérifié en amont', async () => {
    const { service, prisma } = build();
    await service.profile(partner());
    expect(prisma.partner.findFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'p1', organizationId: 'orgA' }) }));
  });
});
