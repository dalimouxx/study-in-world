// Libellés des documents PDF (devis, facture, reçu, contrat), en français et en arabe — un seul endroit.
export type DocLang = 'fr' | 'ar';
export type DocKind = 'quote' | 'invoice' | 'receipt';

export const LABELS = {
  fr: {
    quote: 'Devis', invoice: 'Facture', receipt: 'Reçu', contract: 'Contrat',
    client: 'Client :', description: 'Description', qty: 'Qté', unitPrice: 'Prix unitaire', total: 'Total',
    totalLine: 'Total :', taxId: 'Matricule fiscal :', generatedBy: (agency: string) => `Document généré par ${agency}.`,
    candidateSignature: 'Signature du candidat', signedOn: 'Signé le', paymentFor: (n: string) => `Paiement — facture ${n}`,
    vat: 'TVA', disbursement: 'Débours', subtotalLine: 'Total HT :', vatLine: (rate: number) => `TVA ${rate} % :`,
    disbursementsLine: 'Débours :', stampLine: 'Timbre fiscal :', totalTtcLine: 'Total à payer TTC :',
  },
  ar: {
    quote: 'عرض سعر', invoice: 'فاتورة', receipt: 'وصل', contract: 'عقد',
    client: 'الحريف:', description: 'البيان', qty: 'الكمية', unitPrice: 'سعر الوحدة', total: 'المجموع',
    totalLine: 'المجموع:', taxId: 'المعرف الجبائي:', generatedBy: (agency: string) => `وثيقة صادرة عن ${agency}.`,
    candidateSignature: 'إمضاء المترشح', signedOn: 'أُمضي يوم', paymentFor: (n: string) => `دفعة — الفاتورة ${n}`,
    vat: 'الأداء', disbursement: 'مصاريف مسبقة', subtotalLine: 'المجموع دون اعتبار الأداءات:',
    // Le taux en toutes lettres (« 19 بالمائة ») : « 19% » collé au montant serait mal ordonné dans la ligne.
    vatLine: (rate: number) => `الأداء على القيمة المضافة ${rate} بالمائة:`, disbursementsLine: 'مصاريف مسبقة:',
    stampLine: 'الطابع الجبائي:', totalTtcLine: 'المجموع باعتبار الأداءات:',
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

/**
 * Nom du fichier PDF dans sa langue (« فاتورة-FAC-2026-0012.pdf »), et en-tête Content-Disposition qui le porte en
 * UTF-8, avec un nom ASCII de secours en français (« Facture-FAC-2026-0012.pdf », sans accents).
 */
export function pdfFile(kind: DocKind | 'contract', lang: DocLang, number: string): { filename: string; disposition: string } {
  const filename = `${LABELS[lang][kind]}-${number}.pdf`;
  const ascii = `${LABELS.fr[kind]}-${number}.pdf`.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/"/g, '');
  return { filename, disposition: `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}` };
}
