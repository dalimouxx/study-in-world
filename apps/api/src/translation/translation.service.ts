import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/**
 * Traduction automatique français → arabe pour le CMS de la landing page (section « amélioration
 * frontend ») : le Super Admin ne saisit que le texte français, la version arabe est générée ici au
 * moment de l'enregistrement. Comme pour AiAssistantService, repose sur ANTHROPIC_API_KEY — jamais
 * obligatoire : sans clé, ou en cas d'échec de l'appel, on renvoie simplement `null` plutôt que de lever
 * une erreur. LandingPageService garde alors le champ arabe vide et le front retombe sur le français ;
 * l'enregistrement du texte français n'est jamais bloqué par un problème de traduction.
 */
@Injectable()
export class TranslationService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async toArabic(textFr: string): Promise<string | null> {
    const trimmed = textFr.trim();
    if (!trimmed) return null;

    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) return null;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.config.get('ANTHROPIC_MODEL', { infer: true }),
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content:
                "Traduis le texte suivant du français vers l'arabe standard moderne, pour le site public d'une agence d'études à " +
                "l'étranger. Renvoie UNIQUEMENT la traduction, sans guillemets, sans introduction ni commentaire. Garde le même ton " +
                `et une longueur approximativement équivalente.\n\nTexte à traduire :\n${trimmed}`,
            },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = data.content?.find((b) => b.type === 'text')?.text;
      return text?.trim() || null;
    } catch {
      return null;
    }
  }
}
