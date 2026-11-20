// Copie exacte de la règle de remplissage de l'API (apps/api/src/message-templates/render.ts), pour l'aperçu en
// direct dans Paramètres → Messages. Sans import : testée par `node --test` avec les mêmes cas que l'API.

export const TEMPLATE_VARIABLES = [
  'prenom', 'nom', 'date', 'heure', 'lieu', 'pays', 'montant', 'devise', 'facture', 'document', 'raison', 'agence', 'telephone_agence',
] as const;

export function renderTemplate(body: string, vars: Partial<Record<string, string>>): string {
  const filled = body.replace(/\{([^{}]+)\}/g, (_m, name: string) => {
    const value = vars[name.trim()];
    return value && value.trim() ? value : '\u0000';
  });
  return filled
    .split('\n')
    .map((line) =>
      line
        .replace(/\s*[:·,\-–]\s*\u0000/g, '')
        .replace(/\u0000\s*[:·,]\s*/g, '')
        .replace(/\u0000/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim(),
    )
    .join('\n');
}
