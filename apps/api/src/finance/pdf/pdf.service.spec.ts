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
