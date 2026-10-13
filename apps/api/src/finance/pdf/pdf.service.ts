import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface DocumentItem {
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface DocumentHeader {
  kind: 'Devis' | 'Facture' | 'Reçu';
  number: string;
  date: Date;
  currency: string;
  agency: { name: string; address?: string | null; phone?: string | null; email?: string | null; taxId?: string | null };
  candidate: { firstName: string; lastName: string; phone: string; email?: string | null };
  extra?: { label: string; value: string }[];
}

const fmt = (n: number, currency: string) => `${n.toFixed(3)} ${currency}`;

/**
 * Génération de PDF pour devis, factures et reçus.
 * NOTE : ces documents sont produits en français uniquement pour l'instant — voir la suggestion
 * correspondante en fin de livraison à propos du rendu correct de l'arabe dans les PDF (mise en forme RTL).
 */
@Injectable()
export class PdfService {
  document(header: DocumentHeader, items: DocumentItem[]): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    doc.fontSize(18).text(header.agency.name, { continued: false });
    doc.fontSize(9).fillColor('#555');
    if (header.agency.address) doc.text(header.agency.address);
    const contactLine = [header.agency.phone, header.agency.email].filter(Boolean).join('  ·  ');
    if (contactLine) doc.text(contactLine);
    if (header.agency.taxId) doc.text(`Matricule fiscal : ${header.agency.taxId}`);
    doc.fillColor('#000');

    doc.moveDown(1.5);
    doc.fontSize(16).text(`${header.kind} ${header.number}`, { align: 'right' });
    doc.fontSize(10).fillColor('#555').text(header.date.toLocaleDateString('fr-TN'), { align: 'right' }).fillColor('#000');

    doc.moveDown(1);
    doc.fontSize(11).text('Client :', { continued: false });
    doc.fontSize(10).text(`${header.candidate.firstName} ${header.candidate.lastName}`);
    doc.text(header.candidate.phone);
    if (header.candidate.email) doc.text(header.candidate.email);

    if (header.extra?.length) {
      doc.moveDown(0.5);
      for (const e of header.extra) doc.fontSize(10).text(`${e.label} : ${e.value}`);
    }

    doc.moveDown(1);
    const top = doc.y;
    doc.fontSize(10).fillColor('#fff').rect(50, top, 495, 20).fill('#0f3350');
    doc.fillColor('#fff').text('Description', 58, top + 5, { width: 260 });
    doc.text('Qté', 320, top + 5, { width: 50, align: 'right' });
    doc.text('Prix unitaire', 375, top + 5, { width: 90, align: 'right' });
    doc.text('Total', 470, top + 5, { width: 70, align: 'right' });
    doc.fillColor('#000');

    let y = top + 20;
    let total = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice;
      total += lineTotal;
      doc.fontSize(10).text(item.label, 58, y + 6, { width: 260 });
      doc.text(String(item.quantity), 320, y + 6, { width: 50, align: 'right' });
      doc.text(fmt(item.unitPrice, header.currency), 375, y + 6, { width: 90, align: 'right' });
      doc.text(fmt(lineTotal, header.currency), 470, y + 6, { width: 70, align: 'right' });
      doc.moveTo(50, y + 22).lineTo(545, y + 22).strokeColor('#e5e5e5').stroke();
      y += 22;
    }

    y += 10;
    doc.fontSize(12).text(`Total : ${fmt(total, header.currency)}`, 50, y, { width: 495, align: 'right' });

    doc.fontSize(8).fillColor('#888').text('Document généré par Study in World.', 50, 780, { width: 495, align: 'center' });

    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    doc.end();
    return done;
  }

  /** Contrat : texte libre déjà rempli (paragraphes), avec le tracé de signature intégré s'il existe. */
  contract(
    header: { number: string; date: Date; agency: { name: string; address?: string | null } },
    content: string,
    signature?: { image: Buffer; signerName: string; signedAt: Date } | null,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    doc.fontSize(18).text(header.agency.name);
    if (header.agency.address) doc.fontSize(9).fillColor('#555').text(header.agency.address).fillColor('#000');
    doc.moveDown(1);
    doc.fontSize(16).text(`Contrat ${header.number}`, { align: 'right' });
    doc.fontSize(10).fillColor('#555').text(header.date.toLocaleDateString('fr-TN'), { align: 'right' }).fillColor('#000');

    doc.moveDown(1.5);
    doc.fontSize(10).text(content, { align: 'left', lineGap: 4 });

    if (signature) {
      doc.moveDown(2);
      const y = doc.y;
      doc.fontSize(9).fillColor('#555').text('Signature du candidat', 50, y);
      try {
        doc.image(signature.image, 50, y + 15, { width: 160, height: 60 });
      } catch {
        /* image invalide : on continue sans bloquer la génération du PDF */
      }
      doc.fontSize(9).text(signature.signerName, 50, y + 80);
      doc.text(`Signé le ${signature.signedAt.toLocaleDateString('fr-TN')}`, 50, y + 93);
      doc.fillColor('#000');
    }

    doc.fontSize(8).fillColor('#888').text('Document généré par Study in World.', 50, 780, { width: 495, align: 'center' });

    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    doc.end();
    return done;
  }
}
