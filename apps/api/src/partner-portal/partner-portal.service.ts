import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import { AlertsService } from '../alerts/alerts.service';
import type { PartnerAuthUser } from '../common/auth-user';

/**
 * Isolation stricte (section 64) : chaque méthode filtre systématiquement sur `partnerId` — un partenaire ne
 * peut techniquement pas demander les données d'un autre. Volontairement limité à la lecture + commentaire :
 * ni documents ni détails financiers ne sont exposés au portail partenaire dans cette version (voir README).
 */
@Injectable()
export class PartnerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly alerts?: AlertsService,
  ) {}

  profile(partner: PartnerAuthUser) {
    return this.prisma.partner.findFirstOrThrow({
      where: { id: partner.partnerId, organizationId: partner.organizationId },
      select: { id: true, companyName: true, type: true, country: true },
    });
  }

  candidates(partner: PartnerAuthUser) {
    return this.prisma.candidate.findMany({
      where: { organizationId: partner.organizationId, partnerId: partner.partnerId, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, status: true, createdAt: true,
        applications: { select: { id: true, university: true, program: true, country: true, status: true } },
        visaFiles: { select: { id: true, country: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async candidate(partner: PartnerAuthUser, candidateId: string) {
    const found = await this.prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: partner.organizationId, partnerId: partner.partnerId, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, status: true, createdAt: true,
        applications: { select: { id: true, university: true, program: true, country: true, status: true, intake: true } },
        visaFiles: { select: { id: true, country: true, status: true } },
      },
    });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');
    return found;
  }

  async comments(partner: PartnerAuthUser, candidateId: string) {
    await this.assertOwnCandidate(partner, candidateId);
    return this.prisma.partnerComment.findMany({
      where: { organizationId: partner.organizationId, candidateId, partnerUser: { partnerId: partner.partnerId } },
      include: { partnerUser: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(partner: PartnerAuthUser, candidateId: string, content: string) {
    const candidate = await this.assertOwnCandidate(partner, candidateId);
    const comment = await this.prisma.partnerComment.create({
      data: { organizationId: partner.organizationId, candidateId, partnerUserId: partner.id, content },
    });
    this.alerts?.emit({ kind: 'partner_comment', candidateId, name: `${candidate.firstName} ${candidate.lastName}`, partner: `${partner.firstName} ${partner.lastName}` });
    return comment;
  }

  commissions(partner: PartnerAuthUser) {
    return this.prisma.commission.findMany({
      where: { organizationId: partner.organizationId, partnerId: partner.partnerId },
      include: { candidate: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertOwnCandidate(partner: PartnerAuthUser, candidateId: string): Promise<{ firstName: string; lastName: string }> {
    const found = await this.prisma.candidate.findFirst({ where: { id: candidateId, organizationId: partner.organizationId, partnerId: partner.partnerId, deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');
    return found;
  }
}
