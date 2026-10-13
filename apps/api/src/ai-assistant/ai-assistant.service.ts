import { HttpStatus, Injectable } from '@nestjs/common';
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

  private async call(prompt: string): Promise<string> {
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_NOT_CONFIGURED', 'Assistant IA non configuré');

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.get('ANTHROPIC_MODEL', { infer: true }), max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      });
    } catch {
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');
    }
    if (!res.ok) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((b) => b.type === 'text')?.text;
    if (!text) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'AI_UNAVAILABLE', 'Assistant IA momentanément indisponible');
    return text.trim();
  }
}
