import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface ExportColumn<T> {
  header: string;
  width?: number;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Export Excel/PDF générique pour les listes et rapports (candidats, prospects, finance). Volontairement
 * simple — une feuille, un tableau — plutôt qu'une mise en forme avancée : ce que demandent réellement ces
 * exports, c'est de pouvoir ouvrir les données ailleurs (trier, filtrer, imprimer), pas un document soigné.
 */
@Injectable()
export class ExportService {
  async toExcel<T>(sheetName: string, columns: ExportColumn<T>[], rows: T[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Study in World';
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel limite les noms d'onglet à 31 caractères

    sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 22 }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF9' } };

    for (const row of rows) {
      sheet.addRow(columns.map((c) => c.value(row) ?? ''));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async toPdf<T>(title: string, columns: ExportColumn<T>[], rows: T[]): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: rows.length > 0 && columns.length > 5 ? 'landscape' : 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(16).text(title);
    doc.fontSize(9).fillColor('#555').text(new Date().toLocaleDateString('fr-TN')).fillColor('#000');
    doc.moveDown(1);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    let y = doc.y;

    const drawHeader = () => {
      doc.fontSize(9).fillColor('#fff').rect(doc.page.margins.left, y, pageWidth, 20).fill('#0f3350');
      columns.forEach((c, i) => doc.fillColor('#fff').text(c.header, doc.page.margins.left + i * colWidth + 4, y + 5, { width: colWidth - 8 }));
      doc.fillColor('#000');
      y += 22;
    };

    drawHeader();
    rows.forEach((row, idx) => {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
      if (idx % 2 === 1) doc.rect(doc.page.margins.left, y, pageWidth, 18).fill('#F5F9FF').fillColor('#000');
      columns.forEach((c, i) => doc.fontSize(8).text(String(c.value(row) ?? ''), doc.page.margins.left + i * colWidth + 4, y + 4, { width: colWidth - 8 }));
      y += 18;
    });

    doc.end();
    return done;
  }
}
