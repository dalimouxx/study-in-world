// Mémoire : 20 factures arabes d'affilée ; l'écart de rss doit rester sous 50 Mo (plan gratuit à 512 Mo).
import { PdfService } from '../src/finance/pdf/pdf.service';

async function main() {
  const pdf = new PdfService();
  const header = {
    kind: 'invoice' as const, number: 'FAC-2026-0012', date: new Date(), currency: 'TND', lang: 'ar' as const,
    agency: { name: 'Study in World', nameAr: 'ستادي إن وورلد', addressAr: '12 شارع الحبيب بورقيبة، قابس', taxId: '1234567/A/M/000' },
    candidate: { firstName: 'Yasmine', lastName: 'Ben Ali', phone: '+216 20 000 000', email: 'yasmine@demo.tn' },
  };
  const items = [{ label: 'Accompagnement complet du dossier', quantity: 1, unitPrice: 2400 }, { label: 'ترجمة الوثائق الرسمية', quantity: 3, unitPrice: 45.5 }];
  await pdf.document(header, items); // premier rendu : chargement de la police (une seule fois)
  global.gc?.();
  const before = process.memoryUsage().rss;
  for (let i = 0; i < 20; i++) await pdf.document(header, items);
  global.gc?.();
  const after = process.memoryUsage().rss;
  console.log(`rss avant ${(before / 1e6).toFixed(1)} Mo, après 20 factures ${(after / 1e6).toFixed(1)} Mo, écart ${((after - before) / 1e6).toFixed(1)} Mo`);
}
void main();
