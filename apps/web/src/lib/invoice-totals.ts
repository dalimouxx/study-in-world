// Aperçu des totaux pendant la saisie d'un devis ou d'une facture. Même règle que l'API (apps/api/src/finance/totals.ts) :
// TVA sur le total des services, arrondie une fois au millime ; débours sans TVA ; timbre si l'agence applique les taxes.
// Le montant qui fait foi est celui que l'API enregistre et renvoie : ceci ne sert qu'à l'affichage avant création.

export type LineKind = 'SERVICE' | 'DISBURSEMENT';
export type TaxSettings = { taxesEnabled: boolean; vatRate: number; stampDuty: number };
export type Totals = { subtotal: number; vatAmount: number; disbursements: number; stampDuty: number; total: number };

const round3 = (n: number) => Math.round(n * 1000) / 1000;
// Un champ encore vide pendant la saisie (NaN) compte pour 0.
const num = (n: number) => (Number.isFinite(n) ? n : 0);

export function previewTotals(items: { kind?: LineKind; quantity: number; unitPrice: number }[], s: TaxSettings): Totals {
  const amount = (l: { quantity: number; unitPrice: number }) => num(l.quantity) * num(l.unitPrice);
  const subtotal = round3(items.filter((l) => l.kind !== 'DISBURSEMENT').reduce((sum, l) => sum + amount(l), 0));
  const disbursements = round3(items.filter((l) => l.kind === 'DISBURSEMENT').reduce((sum, l) => sum + amount(l), 0));
  const vatAmount = s.taxesEnabled ? round3((subtotal * s.vatRate) / 100) : 0;
  const stampDuty = s.taxesEnabled ? s.stampDuty : 0;
  return { subtotal, vatAmount, disbursements, stampDuty, total: round3(subtotal + vatAmount + disbursements + stampDuty) };
}
