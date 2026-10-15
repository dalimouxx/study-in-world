import { HttpStatus, Injectable } from '@nestjs/common';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TranslationService } from '../translation/translation.service';
import {
  CreateLandingFaqItemDto,
  CreateLandingServiceDto,
  CreatePartnerLogoDto,
  CreateTestimonialDto,
  ReorderDto,
  UpdateLandingBrandingDto,
  UpdateLandingContentDto,
  UpdateLandingFaqItemDto,
  UpdateLandingServiceDto,
  UpdatePartnerLogoDto,
  UpdateTestimonialDto,
} from './dto/landing-page.dto';

const ALLOWED_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * CMS de la landing page publique (section « amélioration frontend ») : hero, à propos, SEO, pied de
 * page, logos, services, FAQ, témoignages, logos partenaires. Réservé au Super Admin — voir
 * SuperAdminGuard sur le contrôleur, volontairement distinct de PermissionsGuard (voir sa doc).
 *
 * Chaque champ texte saisi par le Super Admin (toujours en français) déclenche une traduction
 * automatique vers l'arabe via TranslationService ; en l'absence de clé API ou en cas d'échec, le champ
 * arabe reste simplement vide et le site public retombe sur le français — on n'empêche jamais
 * l'enregistrement pour un problème de traduction.
 */
@Injectable()
export class LandingPageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly translation: TranslationService,
  ) {}

  // ---------- Agrégat pour l'interface d'administration ----------

  async getAdmin(organizationId: string) {
    const [content, settings, services, faq, testimonials, partnerLogos] = await Promise.all([
      this.getOrCreateContent(organizationId),
      this.prisma.agencySettings.findUnique({ where: { organizationId } }),
      this.prisma.landingService.findMany({ where: { organizationId }, orderBy: { position: 'asc' } }),
      this.prisma.landingFaqItem.findMany({ where: { organizationId }, orderBy: { position: 'asc' } }),
      this.prisma.testimonial.findMany({ where: { organizationId }, orderBy: { position: 'asc' } }),
      this.prisma.partnerLogo.findMany({ where: { organizationId }, orderBy: { position: 'asc' } }),
    ]);
    return {
      content,
      branding: {
        logoUrl: settings?.logoUrl ?? null,
        logoDarkUrl: settings?.logoDarkUrl ?? null,
        faviconUrl: settings?.faviconUrl ?? null,
        footerTextFr: settings?.footerText ?? null,
        footerTextAr: settings?.footerTextAr ?? null,
      },
      services,
      faq,
      testimonials,
      partnerLogos,
    };
  }

  // ---------- Agrégat public (site vitrine, sans authentification) ----------

  async getPublic(organizationId: string) {
    const [content, services, faq, testimonials, partnerLogos] = await Promise.all([
      this.prisma.landingPageContent.findUnique({ where: { organizationId } }),
      this.prisma.landingService.findMany({ where: { organizationId, isActive: true }, orderBy: { position: 'asc' } }),
      this.prisma.landingFaqItem.findMany({ where: { organizationId, isActive: true }, orderBy: { position: 'asc' } }),
      this.prisma.testimonial.findMany({ where: { organizationId, isActive: true }, orderBy: { position: 'asc' } }),
      this.prisma.partnerLogo.findMany({ where: { organizationId, isActive: true }, orderBy: { position: 'asc' } }),
    ]);
    return { content, services, faq, testimonials, partnerLogos };
  }

  private async getOrCreateContent(organizationId: string) {
    const existing = await this.prisma.landingPageContent.findUnique({ where: { organizationId } });
    if (existing) return existing;
    return this.prisma.landingPageContent.create({ data: { organizationId } });
  }

  // ---------- Image publique (logos, photos) ----------

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const extension = ALLOWED_IMAGE_EXTENSIONS[file.mimetype];
    if (!extension) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_FILE_TYPE', 'Formats acceptés : PNG, JPG, WEBP, SVG');
    const url = await this.storage.savePublic(file.buffer, extension);
    return { url };
  }

  // ---------- Hero / À propos / SEO ----------

  async updateContent(actor: AuthUser, dto: UpdateLandingContentDto, meta: RequestMeta) {
    await this.getOrCreateContent(actor.organizationId);
    const data: Record<string, string | null> = {};
    for (const [frField, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if (frField.endsWith('ImageUrl')) {
        data[frField] = value.trim() === '' ? null : value;
        continue;
      }
      const cleared = value.trim() === '';
      data[frField] = cleared ? null : value;
      const arField = `${frField.slice(0, -2)}Ar`;
      data[arField] = cleared ? null : await this.translation.toArabic(value);
    }
    const updated = await this.prisma.landingPageContent.update({ where: { organizationId: actor.organizationId }, data });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.content.update', entity: 'LandingPageContent', entityId: updated.id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  async updateBranding(actor: AuthUser, dto: UpdateLandingBrandingDto, meta: RequestMeta) {
    const { footerTextFr, ...rest } = dto;
    const data: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      data[k] = v.trim() === '' ? null : v;
    }
    if (footerTextFr !== undefined) {
      const cleared = footerTextFr.trim() === '';
      data.footerText = cleared ? null : footerTextFr;
      data.footerTextAr = cleared ? null : await this.translation.toArabic(footerTextFr);
    }
    const updated = await this.prisma.agencySettings.update({ where: { organizationId: actor.organizationId }, data });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.branding.update', entity: 'AgencySettings', entityId: updated.id, metadata: { fields: Object.keys(dto) }, meta });
    return updated;
  }

  // ---------- Services ----------

  async listServices(organizationId: string) {
    return this.prisma.landingService.findMany({ where: { organizationId }, orderBy: { position: 'asc' } });
  }

  async createService(actor: AuthUser, dto: CreateLandingServiceDto, meta: RequestMeta) {
    const last = await this.prisma.landingService.findFirst({ where: { organizationId: actor.organizationId }, orderBy: { position: 'desc' } });
    const titleAr = await this.translation.toArabic(dto.titleFr);
    const descriptionAr = await this.translation.toArabic(dto.descriptionFr);
    const created = await this.prisma.landingService.create({
      data: { organizationId: actor.organizationId, titleFr: dto.titleFr, titleAr, descriptionFr: dto.descriptionFr, descriptionAr, iconName: dto.iconName, position: (last?.position ?? -1) + 1 },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.service.create', entity: 'LandingService', entityId: created.id, meta });
    return created;
  }

  async updateService(actor: AuthUser, id: string, dto: UpdateLandingServiceDto, meta: RequestMeta) {
    await this.assertOwned(this.prisma.landingService, actor.organizationId, id);
    const { titleFr, descriptionFr, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (titleFr !== undefined) { data.titleFr = titleFr; data.titleAr = await this.translation.toArabic(titleFr); }
    if (descriptionFr !== undefined) { data.descriptionFr = descriptionFr; data.descriptionAr = await this.translation.toArabic(descriptionFr); }
    const updated = await this.prisma.landingService.update({ where: { id }, data });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.service.update', entity: 'LandingService', entityId: id, meta });
    return updated;
  }

  async removeService(actor: AuthUser, id: string, meta: RequestMeta) {
    await this.assertOwned(this.prisma.landingService, actor.organizationId, id);
    await this.prisma.landingService.delete({ where: { id } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.service.remove', entity: 'LandingService', entityId: id, meta });
  }

  async reorderServices(actor: AuthUser, dto: ReorderDto) {
    const owned = await this.prisma.landingService.findMany({ where: { organizationId: actor.organizationId, id: { in: dto.items.map((i) => i.id) } }, select: { id: true } });
    const ownedIds = new Set(owned.map((o) => o.id));
    await Promise.all(dto.items.filter((i) => ownedIds.has(i.id)).map((i) => this.prisma.landingService.update({ where: { id: i.id }, data: { position: i.position } })));
  }

  // ---------- FAQ ----------

  async createFaqItem(actor: AuthUser, dto: CreateLandingFaqItemDto, meta: RequestMeta) {
    const last = await this.prisma.landingFaqItem.findFirst({ where: { organizationId: actor.organizationId }, orderBy: { position: 'desc' } });
    const questionAr = await this.translation.toArabic(dto.questionFr);
    const answerAr = await this.translation.toArabic(dto.answerFr);
    const created = await this.prisma.landingFaqItem.create({
      data: { organizationId: actor.organizationId, questionFr: dto.questionFr, questionAr, answerFr: dto.answerFr, answerAr, position: (last?.position ?? -1) + 1 },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.faq.create', entity: 'LandingFaqItem', entityId: created.id, meta });
    return created;
  }

  async updateFaqItem(actor: AuthUser, id: string, dto: UpdateLandingFaqItemDto, meta: RequestMeta) {
    await this.assertOwned(this.prisma.landingFaqItem, actor.organizationId, id);
    const { questionFr, answerFr, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (questionFr !== undefined) { data.questionFr = questionFr; data.questionAr = await this.translation.toArabic(questionFr); }
    if (answerFr !== undefined) { data.answerFr = answerFr; data.answerAr = await this.translation.toArabic(answerFr); }
    const updated = await this.prisma.landingFaqItem.update({ where: { id }, data });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.faq.update', entity: 'LandingFaqItem', entityId: id, meta });
    return updated;
  }

  async removeFaqItem(actor: AuthUser, id: string, meta: RequestMeta) {
    await this.assertOwned(this.prisma.landingFaqItem, actor.organizationId, id);
    await this.prisma.landingFaqItem.delete({ where: { id } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.faq.remove', entity: 'LandingFaqItem', entityId: id, meta });
  }

  async reorderFaqItems(actor: AuthUser, dto: ReorderDto) {
    const owned = await this.prisma.landingFaqItem.findMany({ where: { organizationId: actor.organizationId, id: { in: dto.items.map((i) => i.id) } }, select: { id: true } });
    const ownedIds = new Set(owned.map((o) => o.id));
    await Promise.all(dto.items.filter((i) => ownedIds.has(i.id)).map((i) => this.prisma.landingFaqItem.update({ where: { id: i.id }, data: { position: i.position } })));
  }

  // ---------- Témoignages ----------

  async createTestimonial(actor: AuthUser, dto: CreateTestimonialDto, meta: RequestMeta) {
    const last = await this.prisma.testimonial.findFirst({ where: { organizationId: actor.organizationId }, orderBy: { position: 'desc' } });
    const quoteAr = await this.translation.toArabic(dto.quoteFr);
    const created = await this.prisma.testimonial.create({
      data: { organizationId: actor.organizationId, name: dto.name, destination: dto.destination ?? null, quoteFr: dto.quoteFr, quoteAr, position: (last?.position ?? -1) + 1 },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.testimonial.create', entity: 'Testimonial', entityId: created.id, meta });
    return created;
  }

  async updateTestimonial(actor: AuthUser, id: string, dto: UpdateTestimonialDto, meta: RequestMeta) {
    await this.assertOwned(this.prisma.testimonial, actor.organizationId, id);
    const { quoteFr, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (quoteFr !== undefined) { data.quoteFr = quoteFr; data.quoteAr = await this.translation.toArabic(quoteFr); }
    const updated = await this.prisma.testimonial.update({ where: { id }, data });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.testimonial.update', entity: 'Testimonial', entityId: id, meta });
    return updated;
  }

  async removeTestimonial(actor: AuthUser, id: string, meta: RequestMeta) {
    await this.assertOwned(this.prisma.testimonial, actor.organizationId, id);
    await this.prisma.testimonial.delete({ where: { id } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.testimonial.remove', entity: 'Testimonial', entityId: id, meta });
  }

  async reorderTestimonials(actor: AuthUser, dto: ReorderDto) {
    const owned = await this.prisma.testimonial.findMany({ where: { organizationId: actor.organizationId, id: { in: dto.items.map((i) => i.id) } }, select: { id: true } });
    const ownedIds = new Set(owned.map((o) => o.id));
    await Promise.all(dto.items.filter((i) => ownedIds.has(i.id)).map((i) => this.prisma.testimonial.update({ where: { id: i.id }, data: { position: i.position } })));
  }

  // ---------- Logos partenaires ----------

  async createPartnerLogo(actor: AuthUser, dto: CreatePartnerLogoDto, meta: RequestMeta) {
    const last = await this.prisma.partnerLogo.findFirst({ where: { organizationId: actor.organizationId }, orderBy: { position: 'desc' } });
    const created = await this.prisma.partnerLogo.create({
      data: { organizationId: actor.organizationId, name: dto.name, logoUrl: dto.logoUrl, position: (last?.position ?? -1) + 1 },
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.partner_logo.create', entity: 'PartnerLogo', entityId: created.id, meta });
    return created;
  }

  async updatePartnerLogo(actor: AuthUser, id: string, dto: UpdatePartnerLogoDto, meta: RequestMeta) {
    await this.assertOwned(this.prisma.partnerLogo, actor.organizationId, id);
    const updated = await this.prisma.partnerLogo.update({ where: { id }, data: dto });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.partner_logo.update', entity: 'PartnerLogo', entityId: id, meta });
    return updated;
  }

  async removePartnerLogo(actor: AuthUser, id: string, meta: RequestMeta) {
    await this.assertOwned(this.prisma.partnerLogo, actor.organizationId, id);
    await this.prisma.partnerLogo.delete({ where: { id } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'landing_page.partner_logo.remove', entity: 'PartnerLogo', entityId: id, meta });
  }

  async reorderPartnerLogos(actor: AuthUser, dto: ReorderDto) {
    const owned = await this.prisma.partnerLogo.findMany({ where: { organizationId: actor.organizationId, id: { in: dto.items.map((i) => i.id) } }, select: { id: true } });
    const ownedIds = new Set(owned.map((o) => o.id));
    await Promise.all(dto.items.filter((i) => ownedIds.has(i.id)).map((i) => this.prisma.partnerLogo.update({ where: { id: i.id }, data: { position: i.position } })));
  }

  // ---------- Aides communes ----------

  /** Vérifie qu'un élément (service, FAQ, témoignage, logo) appartient bien à l'organisation de l'acteur. */
  private async assertOwned(
    delegate: { findFirst: (args: { where: { id: string; organizationId: string } }) => Promise<unknown> },
    organizationId: string,
    id: string,
  ): Promise<void> {
    const found = await delegate.findFirst({ where: { id, organizationId } });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Élément introuvable');
  }
}
