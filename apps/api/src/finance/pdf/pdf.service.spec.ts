import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PdfService, type DocumentHeader } from './pdf.service';

const hasPoppler = (() => {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const itPoppler = hasPoppler ? it : it.skip;

const header = (o: Partial<DocumentHeader> = {}): DocumentHeader => ({
  kind: 'invoice', number: 'FAC-1', date: new Date('2026-11-18T10:00:00Z'), currency: 'TND', lang: 'fr',
  agency: { name: 'Study in World', address: 'Gabès', phone: '+216 75 000 000', email: 'contact@siw.tn', taxId: '1234567/A' },
  candidate: { firstName: 'Yasmine', lastName: 'Ben Ali', phone: '+216 20 000 000', email: 'y@demo.tn' },
  ...o,
});
const items = [{ label: 'Accompagnement dossier', quantity: 1, unitPrice: 2400 }];
const toText = (buf: Buffer) => {
  const dir = mkdtempSync(join(tmpdir(), 'pdf-'));
  writeFileSync(join(dir, 'f.pdf'), buf);
  return execFileSync('pdftotext', ['-layout', join(dir, 'f.pdf'), '-']).toString('utf8');
};

describe('PdfService.document', () => {
  const pdf = new PdfService();

  itPoppler('le PDF français garde ses libellés et son format de montant', async () => {
    const text = toText(await pdf.document(header(), items));
    expect(text).toContain('Facture FAC-1');
    expect(text).toContain('Description');
    expect(text).toContain('Total : 2400.000 TND');
    expect(text).toContain('Matricule fiscal : 1234567/A');
  });

  it('le PDF arabe embarque la police arabe', async () => {
    const buf = await pdf.document(header({ lang: 'ar' }), items);
    expect(buf.toString('latin1')).toContain('NotoNaskhArabic');
  });

  it('le PDF français sans arabe n’embarque pas la police arabe (rendu inchangé)', async () => {
    const buf = await pdf.document(header(), items);
    expect(buf.toString('latin1')).not.toContain('NotoNaskhArabic');
  });

  itPoppler('agence sans nom arabe : le nom actuel s’affiche sur le document arabe', async () => {
    const text = toText(await pdf.document(header({ lang: 'ar' }), items));
    expect(text).toContain('Study');
    expect(text).toContain('FAC-1');
    expect(text).toContain('2400.000');
  });

  it('le reçu et le devis existent dans les deux langues', async () => {
    for (const kind of ['quote', 'receipt'] as const) for (const lang of ['fr', 'ar'] as const) {
      const buf = await pdf.document(header({ kind, lang }), items);
      expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    }
  });
});

describe('PdfService.contract', () => {
  it('contrat arabe signé', async () => {
    const buf = await new PdfService().contract(
      { number: 'CTR-1', date: new Date(), agency: { name: 'Study in World' }, lang: 'ar' },
      'بين وكالة Study in World من جهة،\nو ياسمين بن علي من جهة أخرى.',
      { image: Buffer.from(''), signerName: 'Yasmine Ben Ali', signedAt: new Date() },
    );
    expect(buf.toString('latin1')).toContain('NotoNaskhArabic');
  });
});

describe('PdfService.contract — pages et pied de page', () => {
  const pages = (buf: Buffer) => (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

  itPoppler('un long contrat arabe continue sur les pages suivantes, sans perdre de clause', async () => {
    const content = Array.from({ length: 120 }, (_, i) => `البند ${i + 1}: تلتزم الوكالة بمرافقة المترشح.`).join('\n');
    const buf = await new PdfService().contract({ number: 'CTR-1', date: new Date(), agency: { name: 'Study in World' }, lang: 'ar' }, content, null);
    expect(pages(buf)).toBeGreaterThanOrEqual(3);
    expect(toText(buf)).toContain('120');
  });

  itPoppler('le contrat français garde son pied de page', async () => {
    const buf = await new PdfService().contract({ number: 'CTR-1', date: new Date(), agency: { name: 'Study in World' }, lang: 'fr' }, 'Texte', null);
    expect(toText(buf)).toContain('Document généré par Study in World.');
  });
});

describe('PdfService.document — chiffres arabes', () => {
  itPoppler('les chiffres arabo-indiens (١٢) sont dessinés avec la police arabe, pas en caractères illisibles', async () => {
    const buf = await new PdfService().document(header({ lang: 'ar', agency: { name: 'SIW', addressAr: 'شارع الحبيب بورقيبة ١٢ تونس' } }), items);
    expect(toText(buf)).toMatch(/١٢|12/);
    expect(toText(buf)).not.toContain('fb');
  });
});

describe('PdfService.document — TVA, débours et timbre', () => {
  const taxedItems = [
    { label: 'Accompagnement', quantity: 1, unitPrice: 2000, kind: 'SERVICE' as const, vatRate: 19 },
    { label: 'Inscription université', quantity: 1, unitPrice: 1500, kind: 'DISBURSEMENT' as const, vatRate: 0 },
  ];
  const totals = { subtotal: 2000, vatAmount: 380, disbursements: 1500, stampDuty: 1, total: 3881, taxed: true, vatRate: 19 };

  itPoppler('facture taxée en français : récapitulatif HT, TVA, débours, timbre et TTC', async () => {
    const text = toText(await new PdfService().document(header(), taxedItems, totals));
    for (const s of ['Total HT', 'TVA 19 %', 'Débours', 'Timbre fiscal', 'Total à payer TTC', '3881.000 TND', '380.000 TND']) expect(text).toContain(s);
  });

  itPoppler('facture taxée en arabe : libellés arabes', async () => {
    const text = toText(await new PdfService().document(header({ lang: 'ar' }), taxedItems, totals));
    for (const s of ['3881.000 TND', '380.000 TND', '1.000 TND']) expect(text).toContain(s);
    // Les libellés arabes sont relus sur l'image (pdftotext déforme certaines lettres arabes).
  });

  itPoppler('sans débours : la ligne « Débours » du récapitulatif n’apparaît pas', async () => {
    const text = toText(await new PdfService().document(header(), [taxedItems[0]], { ...totals, disbursements: 0, total: 2381 }));
    expect(text).toContain('Total HT');
    expect(text).not.toContain('Débours :');
  });

  itPoppler('facture non taxée et reçu : rendu actuel, sans « Total HT »', async () => {
    const text = toText(await new PdfService().document(header(), items));
    expect(text).not.toContain('Total HT');
    expect(text).toContain('Total : 2400.000 TND');
  });
});

describe('PdfService.document — débours seuls', () => {
  itPoppler('pas de ligne « TVA 0 % » quand il n’y a aucune TVA', async () => {
    const text = toText(await new PdfService().document(header(), [{ label: 'Visa', quantity: 1, unitPrice: 300, kind: 'DISBURSEMENT', vatRate: 0 }],
      { subtotal: 0, vatAmount: 0, disbursements: 300, stampDuty: 1, total: 301, taxed: true, vatRate: 0 }));
    expect(text).not.toContain('TVA 0 %');
    expect(text).toContain('301.000 TND');
  });
});
