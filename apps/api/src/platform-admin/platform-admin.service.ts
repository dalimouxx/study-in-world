import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import { SUPER_ADMIN_ROLE } from '../rbac/permissions';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateOrganizationDto, CreatePlatformInvoiceDto, UpdateOrganizationDto, UpdatePlatformInvoiceDto, slugify } from './dto/platform-admin.dto';

/**
 * Gestion des agences elles-mêmes (SaaS multi-agences, section 12) : jamais les données métier d'une agence
 * (candidats, prospects...), toujours déjà isolées par organizationId depuis la Phase 1. Ici on gère
 * uniquement le cycle de vie de l'agence en tant que client de la plateforme — sa création, son abonnement.
 */
@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, candidates: true, prospects: true } } },
    });
    return orgs;
  }

  async get(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true, candidates: true, prospects: true } } },
    });
    if (!org) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Agence introuvable');
    return org;
  }

  /** Scaffolde une agence complète : organisation, paramètres, branche par défaut, rôle Super Admin et son premier compte. */
  async create(actor: AuthUser, dto: CreateOrganizationDto, meta: RequestMeta) {
    const email = dto.adminEmail.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw apiError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Cette adresse e-mail est déjà utilisée');
    }
    const slug = await this.uniqueSlug(dto.slug || slugify(dto.name));

    const permissions = await this.prisma.permission.findMany({ select: { id: true } });
    if (permissions.length === 0) {
      // Ne devrait jamais arriver en usage normal : le catalogue de permissions est seedé une fois pour toute
      // la plateforme au premier déploiement, avant même la création de la première agence.
      throw apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'PERMISSIONS_NOT_SEEDED', 'Le catalogue de permissions n’a pas encore été initialisé sur ce serveur');
    }

    const org = await this.prisma.organization.create({
      data: { name: dto.name, slug, plan: dto.plan ?? 'TRIAL' },
    });
    await this.prisma.agencySettings.create({ data: { organizationId: org.id, name: dto.name } });
    const branch = await this.prisma.branch.create({ data: { organizationId: org.id, code: 'MAIN', name: dto.name } });
    const role = await this.prisma.role.create({
      data: { organizationId: org.id, code: SUPER_ADMIN_ROLE, name: 'Super Admin', description: 'Accès total, non modifiable', isSystem: true },
    });
    await this.prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    const admin = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        roleId: role.id,
        email,
        firstName: dto.adminFirstName,
        lastName: dto.adminLastName,
        passwordHash: await argon2.hash(dto.adminPassword),
        mustChangePassword: true,
      },
    });

    await this.audit.log({ organizationId: org.id, userId: actor.id, action: 'platform.organization_create', entity: 'Organization', entityId: org.id, meta });
    return { organization: org, adminUserId: admin.id };
  }

  async update(actor: AuthUser, id: string, dto: UpdateOrganizationDto, meta: RequestMeta) {
    await this.get(id);
    const org = await this.prisma.organization.update({ where: { id }, data: dto });
    await this.audit.log({ organizationId: id, userId: actor.id, action: 'platform.organization_update', entity: 'Organization', entityId: id, metadata: { ...dto }, meta });
    return org;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base || 'agence';
    let n = 1;
    while (await this.prisma.organization.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  // ----- Facturation manuelle (décision explicite : aucun prestataire de paiement pour l'instant) -----

  async listInvoices(organizationId: string) {
    await this.get(organizationId);
    const invoices = await this.prisma.platformInvoice.findMany({ where: { organizationId }, orderBy: { dueDate: 'desc' } });
    const now = new Date();
    // « overdue » est calculé à la lecture, jamais écrit tout seul en base : le statut PENDING reste la
    // source de vérité tant que l'administrateur de plateforme ne l'a pas lui-même marquée payée ou en retard.
    return invoices.map((inv) => ({ ...inv, isOverdue: inv.status === 'PENDING' && inv.dueDate < now }));
  }

  async createInvoice(actor: AuthUser, organizationId: string, dto: CreatePlatformInvoiceDto, meta: RequestMeta) {
    await this.get(organizationId);
    const invoice = await this.prisma.platformInvoice.create({
      data: {
        organizationId,
        amount: dto.amount,
        currency: dto.currency ?? 'TND',
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        dueDate: new Date(dto.dueDate),
        notes: dto.notes,
      },
    });
    await this.audit.log({ organizationId, userId: actor.id, action: 'platform.invoice_create', entity: 'PlatformInvoice', entityId: invoice.id, meta });
    return invoice;
  }

  async updateInvoice(actor: AuthUser, organizationId: string, invoiceId: string, dto: UpdatePlatformInvoiceDto, meta: RequestMeta) {
    const existing = await this.prisma.platformInvoice.findFirst({ where: { id: invoiceId, organizationId } });
    if (!existing) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Facture introuvable');
    const invoice = await this.prisma.platformInvoice.update({
      where: { id: invoiceId },
      data: { ...dto, ...(dto.status === 'PAID' ? { paidAt: new Date() } : {}) },
    });
    await this.audit.log({ organizationId, userId: actor.id, action: 'platform.invoice_update', entity: 'PlatformInvoice', entityId: invoiceId, metadata: { ...dto }, meta });
    return invoice;
  }
}
