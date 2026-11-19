// Totaux des devis et factures : HT des services, TVA, débours, timbre fiscal et TTC.
// Calculés une seule fois à la création, puis enregistrés avec le document : un changement de taux dans les
// Paramètres ne modifie jamais un document existant. Un document créé avant cette fonctionnalité (total vide)
// garde son total d'origine, la somme brute de ses lignes.

export type LineKind = 'SERVICE' | 'DISBURSEMENT';
export type TaxSettings = { taxesEnabled: boolean; vatRate: number; stampDuty: number };
export type Totals = { subtotal: number; vatAmount: number; disbursements: number; stampDuty: number; total: number };

type Line = { kind?: LineKind | null; quantity: number; unitPrice: number; vatRate?: number | null };

export const NO_TAXES: TaxSettings = { taxesEnabled: false, vatRate: 0, stampDuty: 0 };

/** Arrondi au millime (le dinar a 3 décimales). */
export const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Taux de TVA d'une ligne : 0 pour un débours ou quand l'agence n'applique pas les taxes. */
export function lineVatRate(kind: LineKind | undefined | null, s: TaxSettings): number {
  return s.taxesEnabled && kind !== 'DISBURSEMENT' ? s.vatRate : 0;
}

/** Totaux d'un nouveau document. La TVA est calculée sur le total des services, arrondie une seule fois. */
export function computeTotals(items: Line[], s: TaxSettings): Totals {
  const amount = (l: Line) => l.quantity * l.unitPrice;
  const services = items.filter((l) => l.kind !== 'DISBURSEMENT');
  const subtotal = round3(services.reduce((sum, l) => sum + amount(l), 0));
  const disbursements = round3(items.filter((l) => l.kind === 'DISBURSEMENT').reduce((sum, l) => sum + amount(l), 0));
  const vatAmount = s.taxesEnabled ? round3((subtotal * s.vatRate) / 100) : 0;
  const stampDuty = s.taxesEnabled ? s.stampDuty : 0;
  return { subtotal, vatAmount, disbursements, stampDuty, total: round3(subtotal + vatAmount + disbursements + stampDuty) };
}

type StoredDocument = {
  items: Line[];
  subtotal?: number | null;
  vatAmount?: number | null;
  disbursements?: number | null;
  stampDuty?: number | null;
  total?: number | null;
};

/**
 * Totaux d'un document existant : ceux enregistrés à sa création, ou, pour un document ancien, la somme brute
 * de ses lignes. `taxed` dit si le document doit afficher le détail HT / TVA / débours / timbre / TTC.
 */
export function documentTotals(doc: StoredDocument): Totals & { taxed: boolean } {
  if (doc.total == null) {
    const t = computeTotals(doc.items.map((l) => ({ ...l, kind: 'SERVICE' })), NO_TAXES);
    return { ...t, taxed: false };
  }
  const t: Totals = {
    subtotal: doc.subtotal ?? 0,
    vatAmount: doc.vatAmount ?? 0,
    disbursements: doc.disbursements ?? 0,
    stampDuty: doc.stampDuty ?? 0,
    total: doc.total,
  };
  return { ...t, taxed: t.vatAmount > 0 || t.stampDuty > 0 || doc.items.some((l) => l.kind === 'DISBURSEMENT') };
}
