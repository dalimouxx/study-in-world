// Génère des PDF d'exemple (devis, facture, reçu, contrat) en français et en arabe dans .pdf-samples/,
// pour les relire à l'œil (pdftoppm). Usage : npx ts-node scripts/pdf-samples.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PdfService, type DocumentHeader } from '../src/finance/pdf/pdf.service';
import { computeTotals } from '../src/finance/totals';

const out = join(__dirname, '..', '.pdf-samples');
mkdirSync(out, { recursive: true });
const pdf = new PdfService();
const agency = { name: 'Study in World', nameAr: 'ستادي إن وورلد', address: '12 avenue Habib Bourguiba, Gabès', addressAr: '12 شارع الحبيب بورقيبة، قابس', phone: '+216 75 000 000', email: 'contact@studyinworld.net', taxId: '1234567/A/M/000' };
const candidate = { firstName: 'Yasmine', lastName: 'Ben Ali', phone: '+216 20 000 000', email: 'yasmine@demo.tn' };
const items = [
  { label: 'Accompagnement complet du dossier', quantity: 1, unitPrice: 2400 },
  { label: 'ترجمة الوثائق الرسمية', quantity: 3, unitPrice: 45.5 },
];
const kinds: DocumentHeader['kind'][] = ['quote', 'invoice', 'receipt'];

(async () => {
  for (const lang of ['fr', 'ar'] as const) {
    for (const kind of kinds) {
      const buf = await pdf.document({ kind, number: 'FAC-2026-0012', date: new Date(), currency: 'TND', lang, agency, candidate }, items);
      writeFileSync(join(out, `${kind}-${lang}.pdf`), buf);
    }
    // Facture taxée : service à 19 % + débours + timbre.
    const taxedItems = [
      { label: 'Accompagnement complet du dossier', quantity: 1, unitPrice: 2000, kind: 'SERVICE' as const, vatRate: 19 },
      { label: lang === 'ar' ? 'رسوم التسجيل بالجامعة' : 'Frais d’inscription université', quantity: 1, unitPrice: 1500, kind: 'DISBURSEMENT' as const, vatRate: 0 },
    ];
    const totals = { ...computeTotals(taxedItems, { taxesEnabled: true, vatRate: 19, stampDuty: 1 }), taxed: true, vatRate: 19 };
    writeFileSync(join(out, `invoice-taxed-${lang}.pdf`), await pdf.document({ kind: 'invoice', number: 'FAC-2026-0013', date: new Date(), currency: 'TND', lang, agency, candidate }, taxedItems, totals));
    const content =
      lang === 'ar'
        ? 'بين وكالة Study in World، من جهة،\nوالسيدة Yasmine Ben Ali، صاحبة جواز السفر رقم X1234567، المشار إليها بـ «المترشح»، من جهة أخرى،\n\nتم الاتفاق على ما يلي:\n- مرافقة كاملة للملف × 1 : 2400.000 TND\nالمجموع : 2400.000 TND'
        : "Entre l'agence Study in World, d'une part,\net Yasmine Ben Ali, titulaire du passeport X1234567, ci-après « le candidat », d'autre part,\n\nil a été convenu ce qui suit :\n- Accompagnement complet du dossier × 1 : 2400.000 TND\nTotal : 2400.000 TND";
    const buf = await pdf.contract({ number: 'CTR-2026-0003', date: new Date(), agency, lang }, content, null);
    writeFileSync(join(out, `contract-${lang}.pdf`), buf);
  }
  console.log('PDF écrits dans', out);
})();
