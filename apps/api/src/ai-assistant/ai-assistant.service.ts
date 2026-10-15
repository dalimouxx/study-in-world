import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HealthScoreService } from '../health-score/health-score.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser } from '../common/auth-user';
import type { Env } from '../config/env';

/**
 * Assistant IA (Phase 10) : entièrement optionnel — sans ANTHROPIC_API_KEY configurée, renvoie une erreur
 * claire plutôt que d'échouer silencieusement. N'écrit jamais rien lui-même dans la base : chaque appel
 * renvoie un texte que l'employé relit et modifie avant de l'utiliser (résumé affiché en lecture, message
 * copié dans la messagerie existante). Le contenu du prompt vient entièrement de données réelles de la base —
 * jamais d'invention de faits sur le candidat au-delà de ce qui est fourni.
 */
@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthScore: HealthScoreService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async summary(actor: AuthUser, candidateId: string): Promise<string> {
    const [candidate, health, timeline] = await Promise.all([
      this.prisma.candidate.findFirst({
        where: { id: candidateId, organizationId: actor.organizationId, deletedAt: null },
        include: {
          applications: { select: { university: true, program: true, country: true, status: true } },
          visaFiles: { select: { country: true, status: true } },
          _count: { select: { documents: true } },
        },
      }),
      this.healthScore.compute(actor, candidateId),
      this.prisma.timelineEntry.findMany({ where: { organizationId: actor.organizationId, entityType: 'CANDIDATE', entityId: candidateId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    if (!candidate) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');

    const facts = [
      `Candidat : ${candidate.firstName} ${candidate.lastName}, statut ${candidate.status}.`,
      `Nationalité : ${candidate.nationality ?? 'non renseignée'}. Passeport : ${candidate.passportNumber ?? 'non renseigné'}.`,
      `Score de santé du dossier : ${health.score}/100 (${health.category}).`,
      health.issues.length > 0
        ? `Problèmes détectés : ${health.issues.map((i) => `[${i.severity}] ${i.message}`).join(' ; ')}.`
        : 'Aucun problème détecté sur le dossier.',
      candidate.applications.length > 0
        ? `Candidatures : ${candidate.applications.map((a) => `${a.university} (${a.program}, ${a.country}) — ${a.status}`).join(' ; ')}.`
        : 'Aucune candidature créée.',
      candidate.visaFiles.length > 0 ? `Visa : ${candidate.visaFiles.map((v) => `${v.country} — ${v.status}`).join(' ; ')}.` : 'Aucun dossier visa.',
      `${candidate._count.documents} document(s) déposé(s).`,
      timeline.length > 0 ? `Derniers événements : ${timeline.map((t) => t.content).join(' ; ')}.` : '',
    ].filter(Boolean).join('\n');

    return this.call(
      'Tu es l’assistant d’une conseillère ou d’un conseiller dans une agence d’études à l’étranger. On te donne les faits réels ' +
        'd’un dossier candidat ci-dessous. Rédige un résumé concis (5 à 8 lignes), en français, à destination du conseiller : ' +
        'où en est ce dossier, ce qui va bien, ce qui nécessite une action de sa part. N’invente aucun fait qui ne figure pas ' +
        'ci-dessous. Ne donne aucun conseil juridique ou médical.\n\nFaits du dossier :\n' + facts,
    );
  }

  async draftMessage(actor: AuthUser, candidateId: string, instruction: string): Promise<string> {
    const candidate = await this.prisma.candidate.findFirst({ where: { id: candidateId, organizationId: actor.organizationId, deletedAt: null }, select: { firstName: true, lastName: true } });
    if (!candidate) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Candidat introuvable');

    return this.call(
      `Tu rédiges, pour le compte d'une agence d'études à l'étranger, un court message destiné au candidat ${candidate.firstName} ` +
        `${candidate.lastName}, à envoyer via la messagerie de son espace personnel. Ton chaleureux mais professionnel, en français, ` +
        `3 à 5 phrases maximum, sans formule d'ouverture ni de signature (juste le corps du message). ` +
        `Voici ce que le conseiller souhaite communiquer : « ${instruction} ». N'invente aucune information sur le dossier du candidat ` +
        `au-delà de cette instruction — ne mentionne pas de statut, date ou document précis qui ne serait pas cité ci-dessus.`,
    );
  }

  /** Champs texte d'une fiche pays ("destination"), rédigés par l'IA à partir du seul nom du pays. */
  private static readonly COUNTRY_FIELDS = [
    'description', 'universitySystem', 'advantages', 'costOfLiving', 'tuitionFeesInfo', 'languages',
    'admissionConditions', 'languageLevel', 'applicationProcess', 'visaInfo', 'housingInfo',
    'insuranceInfo', 'studentWorkInfo', 'transportInfo', 'calendarInfo', 'documentsInfo', 'faq',
  ] as const;

  /** Champs texte d'une fiche établissement, rédigés par l'IA à partir du nom, de la ville et du pays. */
  private static readonly UNIVERSITY_FIELDS = [
    'description', 'feesInfo', 'calendarInfo', 'deadlinesInfo', 'conditionsInfo', 'languageLevel', 'extraInfo',
  ] as const;

  /**
   * Brouillon de fiche destination (Phase « catalogue »), même logique que summary()/draftMessage() : jamais
   * écrit en base, un texte à relire et corriger avant d'enregistrer. Seule la correction avant enregistrement
   * garantit qu'une imprécision de l'IA (visa, coûts, démarches) ne se retrouve jamais publiée sans relecture
   * humaine — le prompt demande explicitement de rester général plutôt que d'inventer un chiffre précis.
   */
  async draftCountryContent(name: string): Promise<Record<string, string>> {
    const text = await this.call(
      `Tu rédiges, pour le compte d'une agence d'études à l'étranger qui conseille des étudiants tunisiens/maghrébins, ` +
        `une fiche destination pour le pays « ${name} ». Réponds UNIQUEMENT avec un objet JSON (sans texte autour, sans ` +
        `balise markdown) contenant exactement ces clés, chacune avec une valeur texte en français : ` +
        `${AiAssistantService.COUNTRY_FIELDS.join(', ')}. Chaque texte doit être concis (2 à 5 phrases, sauf "languages" ` +
        `et "languageLevel" qui tiennent sur une ligne), informatif et utile à un futur candidat. Si un fait précis ` +
        `(chiffre, procédure, délai) t'est incertain ou peut avoir changé, reste général plutôt que d'inventer une valeur exacte.`,
      2200,
    );
    return this.parseJsonFields(text, AiAssistantService.COUNTRY_FIELDS);
  }

  /** Brouillon de fiche établissement — même principe que draftCountryContent(). */
  async draftUniversityContent(name: string, city: string, countryName: string): Promise<Record<string, string>> {
    const text = await this.call(
      `Tu rédiges, pour le compte d'une agence d'études à l'étranger qui conseille des étudiants tunisiens/maghrébins, ` +
        `une fiche établissement pour « ${name} », situé à ${city} (${countryName}). Réponds UNIQUEMENT avec un objet ` +
        `JSON (sans texte autour, sans balise markdown) contenant exactement ces clés, chacune avec une valeur texte en ` +
        `français : ${AiAssistantService.UNIVERSITY_FIELDS.join(', ')}. Chaque texte doit être concis (2 à 4 phrases, ` +
        `sauf "languageLevel" qui tient sur une ligne). Si un fait précis (frais exacts, date limite, délai) t'est ` +
        `incertain ou peut avoir changé, reste général plutôt que d'inventer une valeur exacte.`,
      1200,
    );
    return this.parseJsonFields(text, AiAssistantService.UNIVERSITY_FIELDS);
  }

  private parseJsonFields(text: string, fields: readonly string[]): Record<string, string> {
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');
    }
    const record = parsed as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const field of fields) {
      const value = record[field];
      result[field] = typeof value === 'string' ? value.trim() : '';
    }
    return result;
  }

  private async call(prompt: string, maxTokens = 800): Promise<string> {
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_NOT_CONFIGURED', 'Assistant IA non configuré');

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.get('ANTHROPIC_MODEL', { infer: true }), max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      });
    } catch (err) {
      // Jamais de clé API dans les logs — seulement le message d'erreur réseau (DNS, timeout, etc.).
      this.logger.error(`Appel à l'API Anthropic impossible : ${err instanceof Error ? err.message : String(err)}`);
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');
    }
    if (!res.ok) {
      // Cause la plus fréquente : clé invalide (401), ou compte sans crédit (400/403 "credit balance too low").
      let body = '';
      try {
        body = await res.text();
      } catch {
        /* corps illisible : on logue au moins le statut HTTP ci-dessous */
      }
      this.logger.error(`L'API Anthropic a répondu ${res.status} : ${body.slice(0, 500)}`);
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((b) => b.type === 'text')?.text;
    if (!text) {
      this.logger.error(`Réponse Anthropic sans texte exploitable : ${JSON.stringify(data).slice(0, 500)}`);
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');
    }
    return text.trim();
  }
}
