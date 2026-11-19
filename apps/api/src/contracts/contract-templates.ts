// Modèles de contrat par défaut, utilisés quand l'agence n'a pas rédigé le sien dans les Paramètres.
// Les deux langues ont exactement les mêmes espaces réservés {{…}}.
import type { DocLang } from '../finance/pdf/labels';

export const DEFAULT_TEMPLATE = `Entre l'agence {{agency_name}}, d'une part,
et {{candidate_name}}, titulaire du passeport {{candidate_passport}}, ci-après « le candidat », d'autre part,

il a été convenu ce qui suit :

L'agence s'engage à fournir au candidat les services suivants :
{{services}}

Montant total : {{total}} {{currency}}

Fait le {{date}}, référence {{number}}.`;

/** Traduction fidèle du modèle français, en arabe standard. À faire relire par l'agence. */
export const DEFAULT_TEMPLATE_AR = `بين وكالة {{agency_name}}، من جهة،
والسيد(ة) {{candidate_name}}، صاحب(ة) جواز السفر رقم {{candidate_passport}}، المشار إليه(ا) فيما يلي بـ «المترشح»، من جهة أخرى،

تم الاتفاق على ما يلي:

تلتزم الوكالة بأن تقدم للمترشح الخدمات التالية:
{{services}}

المبلغ الجملي: {{total}} {{currency}}

حرر في {{date}}، المرجع {{number}}.`;

/** Modèle à utiliser : celui de l'agence dans la langue du contrat, sinon le modèle par défaut de cette langue. */
export function contractTemplate(lang: DocLang, settings: { contractTemplate?: string | null; contractTemplateAr?: string | null } | null): string {
  if (lang === 'ar') return settings?.contractTemplateAr?.trim() ? settings.contractTemplateAr : DEFAULT_TEMPLATE_AR;
  return settings?.contractTemplate?.trim() ? settings.contractTemplate : DEFAULT_TEMPLATE;
}
