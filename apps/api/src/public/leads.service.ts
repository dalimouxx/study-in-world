import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { CreateLeadDto } from './dto/lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  /**
   * Formulaire public (site vitrine). Toujours accepté même en cas de doublon : un prospect qui revient
   * plusieurs fois sur le site ne doit jamais être bloqué, la vérification de doublon reste un choix humain
   * fait plus tard par l'équipe dans le CRM.
   */
  async create(organizationSlug: string, dto: CreateLeadDto) {
    const org = await this.prisma.organization.findFirst({ where: { slug: organizationSlug, isActive: true }, select: { id: true } });
    if (!org) return;

    // Public non authentifié : on ne fait jamais confiance à l'ID reçu sans vérifier qu'il appartient bien à cette agence.
    let desiredCountryId: string | undefined;
    if (dto.desiredCountryId) {
      const country = await this.prisma.country.findFirst({ where: { id: dto.desiredCountryId, organizationId: org.id, isActive: true }, select: { id: true } });
      desiredCountryId = country?.id;
    }

    const prospect = await this.prisma.prospect.create({
      data: {
        organizationId: org.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        source: 'WEBSITE',
        notes: dto.message,
        desiredCountryId,
        desiredProgram: dto.desiredProgram,
        budget: dto.budget,
        campaign: dto.campaign,
      },
    });
    await this.timeline.add(org.id, 'PROSPECT', prospect.id, 'SYSTEM', dto.campaign ? `Demande reçue depuis le site web (${dto.campaign})` : 'Demande reçue depuis le site web');
  }
}
