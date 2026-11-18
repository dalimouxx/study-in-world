// Libellés des documents PDF (devis, facture, reçu, contrat), en français et en arabe — un seul endroit.
export type DocLang = 'fr' | 'ar';
export type DocKind = 'quote' | 'invoice' | 'receipt';

export const LABELS = {
  fr: {
    quote: 'Devis', invoice: 'Facture', receipt: 'Reçu', contract: 'Contrat',
    client: 'Client :', description: 'Description', qty: 'Qté', unitPrice: 'Prix unitaire', total: 'Total',
    totalLine: 'Total :', taxId: 'Matricule fiscal :', generatedBy: (agency: string) => `Document généré par ${agency}.`,
    candidateSignature: 'Signature du candidat', signedOn: 'Signé le', paymentFor: (n: string) => `Paiement — facture ${n}`,
  },
  ar: {
    quote: 'عرض سعر', invoice: 'فاتورة', receipt: 'وصل', contract: 'عقد',
    client: 'الحريف:', description: 'البيان', qty: 'الكمية', unitPrice: 'سعر الوحدة', total: 'المجموع',
    totalLine: 'المجموع:', taxId: 'المعرف الجبائي:', generatedBy: (agency: string) => `وثيقة صادرة عن ${agency}.`,
    candidateSignature: 'إمضاء المترشح', signedOn: 'أُمضي يوم', paymentFor: (n: string) => `دفعة — الفاتورة ${n}`,
  },
} as const;

/** Date d'un document : fr-TN, ou ar-TN en chiffres latins (cohérent avec les montants). */
export function formatDocDate(lang: DocLang, date: Date): string {
  // En arabe : mêmes chiffres latins, sans les marques de direction (U+200F) qu'ajoute Intl et qui couperaient la date.
  const text = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', { numberingSystem: 'latn', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  return text.replace(/[\u200e\u200f\u061c]/g, '');
}

/** Montant : format inchangé dans les deux langues (2400.000 TND). */
export const formatAmount = (n: number, currency: string) => `${n.toFixed(3)} ${currency}`;
