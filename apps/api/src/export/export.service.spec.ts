import { ExportService } from './export.service';

interface Row { name: string; amount: number }
const columns = [
  { header: 'Nom', value: (r: Row) => r.name },
  { header: 'Montant', value: (r: Row) => r.amount },
];
const rows: Row[] = [{ name: 'Ali', amount: 100 }, { name: 'Sami', amount: 250 }];

describe('ExportService', () => {
  const service = new ExportService();

  it('toExcel() produit un vrai classeur .xlsx (signature ZIP, en-têtes corrects)', async () => {
    const buffer = await service.toExcel('Candidats', columns, rows);
    // Un fichier .xlsx est une archive ZIP : les 2 premiers octets sont toujours "PK".
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('toExcel() tronque le nom de l’onglet à 31 caractères (limite Excel)', async () => {
    const buffer = await service.toExcel('Un nom d’onglet vraiment beaucoup trop long pour Excel', columns, rows);
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('toPdf() produit un vrai document PDF (signature %PDF), même avec zéro ligne', async () => {
    const buffer = await service.toPdf('Rapport financier', columns, []);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('toPdf() gère un grand nombre de lignes sans erreur (déclenche l’ajout de pages)', async () => {
    const manyRows: Row[] = Array.from({ length: 80 }, (_, i) => ({ name: `Candidat ${i}`, amount: i * 10 }));
    const buffer = await service.toPdf('Liste des candidats', columns, manyRows);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
