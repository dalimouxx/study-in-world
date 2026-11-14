// Calculs des widgets du tableau de bord du portail candidat, à partir des routes API existantes
// (/portal/checklist, /portal/invoices, /portal/applications, /portal/visa-files).
// Volontairement sans aucun import : testé directement par `node --test` (scripts/tests/portal-progress.test.mjs).

export type StepState = 'done' | 'current' | 'upcoming';

/** Pourcentage du dossier complété : éléments faits ou non applicables / total. `null` si la checklist est vide. */
export function checklistCompletion(items: { status: 'PENDING' | 'DONE' | 'NOT_APPLICABLE' }[]): number | null {
  if (!items.length) return null;
  const finished = items.filter((i) => i.status !== 'PENDING').length;
  return Math.round((finished / items.length) * 100);
}

interface InvoiceLike {
  status: string;
  currency: string;
  items: { quantity: number; unitPrice: number }[];
  payments: { amount: number }[];
}

/** Reste à payer, par devise (jamais additionné entre devises), sur les factures émises ou partiellement payées. */
export function outstandingBalance(invoices: InvoiceLike[]): { currency: string; amount: number }[] {
  const byCurrency = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status !== 'ISSUED' && inv.status !== 'PARTIALLY_PAID') continue;
    const total = inv.items.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    const rest = total - paid;
    if (rest > 0) byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + rest);
  }
  return [...byCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Étape du parcours Admission → Visa → Départ.
 * Une candidature acceptée termine l'admission ; un visa approuvé termine le visa (et donc l'admission,
 * même si la candidature n'a pas été saisie comme acceptée) ; le départ n'a pas de donnée de fin.
 */
export function candidateJourney(
  apps: { status: string }[],
  visas: { status: string }[],
): { admission: StepState; visa: StepState; departure: StepState } {
  const visaApproved = visas.some((v) => v.status === 'APPROVED');
  const accepted = visaApproved || apps.some((a) => a.status === 'ACCEPTED');
  if (visaApproved) return { admission: 'done', visa: 'done', departure: 'current' };
  if (accepted) return { admission: 'done', visa: 'current', departure: 'upcoming' };
  return { admission: 'current', visa: 'upcoming', departure: 'upcoming' };
}
