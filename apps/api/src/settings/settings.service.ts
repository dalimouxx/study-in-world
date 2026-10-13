import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { UpdateAgencySettingsDto } from './dto/agency-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Crée les paramètres au premier accès si le seed ne l'a pas fait. */
  async getAgency(organizationId: string) {
    const existing = await this.prisma.agencySettings.findUnique({ where: { organizationId } });
    if (existing) return existing;
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    return this.prisma.agencySettings.create({ data: { organizationId, name: org.name } });
  }

  async updateAgency(actor: AuthUser, dto: UpdateAgencySettingsDto, meta: RequestMeta) {
    await this.getAgency(actor.organizationId);
    const { socialLinks, ...rest } = dto;
    // Chaîne vide => on efface (null), sauf pour le nom qui reste obligatoire.
    const cleaned = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' && k !== 'name' ? null : v]),
    );
    const updated = await this.prisma.agencySettings.update({
      where: { organizationId: actor.organizationId },
      data: { ...cleaned, ...(socialLinks ? { socialLinks: socialLinks as Prisma.InputJsonValue } : {}) },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'settings.update', entity: 'AgencySettings', entityId: updated.id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  /** Sous-ensemble non sensible, exposé sans authentification (site public, page de connexion). */
  async getPublicAgency(slug: string) {
    const org = await this.prisma.organization.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, settings: true },
    });
    if (!org) return null;
    const s = org.settings;
    return {
      name: s?.name ?? org.name,
      logoUrl: s?.logoUrl ?? null,
      logoDarkUrl: s?.logoDarkUrl ?? null,
      faviconUrl: s?.faviconUrl ?? null,
      address: s?.address ?? null,
      phone: s?.phone ?? null,
      whatsapp: s?.whatsapp ?? null,
      email: s?.email ?? null,
      website: s?.website ?? null,
      socialLinks: s?.socialLinks ?? null,
      openingHours: s?.openingHours ?? null,
      footerText: s?.footerText ?? null,
    };
  }
}
