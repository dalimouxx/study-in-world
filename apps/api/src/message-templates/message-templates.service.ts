import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { apiError } from '../common/errors/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import { DEFAULT_TEMPLATES } from './defaults';
import type { UpdateMessageTemplateDto } from './dto/message-template.dto';
import { renderTemplate, type TemplateVars } from './render';

type Channel = 'WHATSAPP' | 'EMAIL';
type Lang = 'fr' | 'ar';

/** Modèles de messages modifiables par l'agence (Paramètres → Messages), remplis par `renderTemplate`. */
@Injectable()
export class MessageTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  /** Crée les modèles par défaut qui manquent encore, sans jamais écraser un texte modifié par l'agence. */
  async ensureDefaults(organizationId: string): Promise<void> {
    await this.prisma.messageTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({ organizationId, ...t })),
      skipDuplicates: true,
    });
  }

  async list(actor: AuthUser) {
    await this.ensureDefaults(actor.organizationId);
    return this.prisma.messageTemplate.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: [{ isSystem: 'desc' }, { key: 'asc' }, { channel: 'asc' }],
    });
  }

  private async find(actor: AuthUser, id: string) {
    const tpl = await this.prisma.messageTemplate.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!tpl) throw apiError(HttpStatus.NOT_FOUND, 'TEMPLATE_NOT_FOUND', 'Modèle introuvable');
    return tpl;
  }

  async update(actor: AuthUser, id: string, dto: UpdateMessageTemplateDto, _meta: RequestMeta) {
    await this.find(actor, id);
    return this.prisma.messageTemplate.update({ where: { id }, data: dto });
  }

  async reset(actor: AuthUser, id: string, _meta: RequestMeta) {
    const tpl = await this.find(actor, id);
    const def = DEFAULT_TEMPLATES.find((t) => t.key === tpl.key && t.channel === tpl.channel);
    if (!def) throw apiError(HttpStatus.BAD_REQUEST, 'NO_DEFAULT', 'Ce modèle n’a pas de texte par défaut');
    const { nameFr, nameAr, subjectFr, subjectAr, bodyFr, bodyAr } = def;
    return this.prisma.messageTemplate.update({ where: { id }, data: { nameFr, nameAr, subjectFr: subjectFr ?? null, subjectAr: subjectAr ?? null, bodyFr, bodyAr } });
  }

  /** Remplit un modèle pour une agence ; `agence` et `telephone_agence` viennent des paramètres de l'agence. */
  async renderFor(organizationId: string, key: string, channel: Channel, lang: Lang, vars: TemplateVars) {
    let tpl = await this.prisma.messageTemplate.findFirst({ where: { organizationId, key, channel } });
    if (!tpl) {
      await this.ensureDefaults(organizationId);
      tpl = await this.prisma.messageTemplate.findFirst({ where: { organizationId, key, channel } });
    }
    if (!tpl) throw apiError(HttpStatus.NOT_FOUND, 'TEMPLATE_NOT_FOUND', 'Modèle introuvable');
    const agency = await this.prisma.agencySettings.findUnique({ where: { organizationId } });
    const all: TemplateVars = { agence: agency?.name ?? '', telephone_agence: agency?.phone ?? '', ...vars };
    const subject = lang === 'ar' ? tpl.subjectAr : tpl.subjectFr;
    return {
      name: lang === 'ar' ? tpl.nameAr : tpl.nameFr,
      subject: subject ? renderTemplate(subject, all) : undefined,
      body: renderTemplate(lang === 'ar' ? tpl.bodyAr : tpl.bodyFr, all),
    };
  }

  private async findPerson(actor: AuthUser, entityType: 'CANDIDATE' | 'PROSPECT', entityId: string) {
    const perm = entityType === 'CANDIDATE' ? 'candidate.view' : 'prospect.view';
    if (!actor.permissions.includes(perm)) throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Permission insuffisante');
    const where = { id: entityId, organizationId: actor.organizationId, deletedAt: null };
    const select = { id: true, firstName: true, lastName: true, preferredLanguage: true } as const;
    const person =
      entityType === 'CANDIDATE' ? await this.prisma.candidate.findFirst({ where, select }) : await this.prisma.prospect.findFirst({ where, select });
    if (!person) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Dossier introuvable');
    return person;
  }

  /** Trace dans la chronologie du dossier qu'un message WhatsApp a été envoyé depuis un modèle. */
  async logSent(actor: AuthUser, dto: { key: string; entityType: 'CANDIDATE' | 'PROSPECT'; entityId: string }) {
    await this.findPerson(actor, dto.entityType, dto.entityId);
    const tpl = await this.prisma.messageTemplate.findFirst({ where: { organizationId: actor.organizationId, key: dto.key, channel: 'WHATSAPP' } });
    if (!tpl) throw apiError(HttpStatus.NOT_FOUND, 'TEMPLATE_NOT_FOUND', 'Modèle introuvable');
    await this.timeline.add(actor.organizationId, dto.entityType, dto.entityId, 'NOTE', `Message WhatsApp : ${tpl.nameFr}`, actor.id);
    return { ok: true };
  }

  /** Bouton « Envoyer un message » : remplit le modèle avec les données du dossier, dans sa langue préférée. */
  async renderForEntity(actor: AuthUser, key: string, channel: Channel, entityType: 'CANDIDATE' | 'PROSPECT', entityId: string) {
    const person = await this.findPerson(actor, entityType, entityId);
    const language = (person.preferredLanguage as Lang) ?? 'fr';
    const out = await this.renderFor(actor.organizationId, key, channel, language, { prenom: person.firstName, nom: person.lastName });
    return { ...out, language };
  }

}
