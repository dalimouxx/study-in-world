// Remplissage des modèles de messages : une seule fonction, partagée par les e-mails automatiques, la page
// « Relances du jour » et le bouton « Envoyer un message ». Une variable inconnue ou vide n'apparaît jamais.

export const TEMPLATE_VARIABLES = [
  'prenom', 'nom', 'date', 'heure', 'lieu', 'pays', 'montant', 'devise', 'facture', 'document', 'raison', 'agence', 'telephone_agence',
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
export type TemplateVars = Partial<Record<TemplateVariable, string>>;

export function renderTemplate(body: string, vars: TemplateVars): string {
  const filled = body.replace(/\{([^{}]+)\}/g, (_m, name: string) => {
    const value = (vars as Record<string, string | undefined>)[name.trim()];
    return value && value.trim() ? value : '\u0000';
  });
  return filled
    .split('\n')
    .map((line) =>
      line
        // une variable absente emporte le séparateur qui la précède (« Lieu : {lieu} » → « Lieu »)
        .replace(/\s*[:·,\-–]\s*\u0000/g, '')
        .replace(/\u0000\s*[:·,]\s*/g, '')
        .replace(/\u0000/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim(),
    )
    .join('\n');
}

/** Date et heure d'un événement, dans la langue du destinataire et le fuseau de l'agence. */
export function formatDateFor(lang: 'fr' | 'ar', date: Date, timeZone: string): { date: string; heure: string } {
  const locale = lang === 'ar' ? 'ar-TN' : 'fr-TN';
  return {
    date: new Intl.DateTimeFormat(locale, { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date),
    heure: new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date),
  };
}
