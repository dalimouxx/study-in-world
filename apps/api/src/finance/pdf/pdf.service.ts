import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { formatAmount, formatDocDate, LABELS, type DocKind, type DocLang } from './labels';
import { drawText, registerFonts } from './pdf-text';
import type { LineKind, Totals } from '../totals';

export interface DocumentItem {
  label: string;
  quantity: number;
  unitPrice: number;
  kind?: LineKind;
  vatRate?: number;
}

/** Totaux d'un document taxé : le PDF affiche alors la colonne TVA et le récapitulatif HT / TVA / débours / timbre / TTC. */
export type DocumentTotals = Totals & { taxed: boolean; vatRate: number };

export interface DocumentHeader {
  kind: DocKind;
  number: string;
  date: Date;
  currency: string;
  lang: DocLang;
  agency: { name: string; nameAr?: string | null; address?: string | null; addressAr?: string | null; phone?: string | null; email?: string | null; taxId?: string | null };
  candidate: { firstName: string; lastName: string; phone: string; email?: string | null };
  extra?: { label: string; value: string }[];
}

const MARGIN = 50;
const WIDTH = 495; // 595 (A4) − 2 × 50
const RIGHT = MARGIN + WIDTH;
type Align = 'left' | 'right' | 'center';

/**
 * PDF des devis, factures, reçus et contrats, en français ou en arabe. En arabe, la mise en page est en miroir
 * (agence à droite, colonnes du tableau de droite à gauche) et chaque texte passe par drawText (ordre de lecture
 * et police arabe). Un texte sans arabe est dessiné exactement comme avant.
 */
@Injectable()
export class PdfService {
  document(header: DocumentHeader, items: DocumentItem[], totals?: DocumentTotals): Promise<Buffer> {
    const { doc, done } = this.start();
    const L = LABELS[header.lang];
    const rtl = header.lang === 'ar';
    const dir = rtl ? 'rtl' : 'ltr';
    const start: Align = rtl ? 'right' : 'left';
    const end: Align = rtl ? 'left' : 'right';
    const t = (text: string, x: number, y: number, width: number, size: number, align: Align, color = '#000') =>
      drawText(doc, text, { x, y, width, size, align, dir, color });

    // Agence (début de ligne : à gauche en français, à droite en arabe).
    let y = t((rtl && header.agency.nameAr) || header.agency.name, MARGIN, MARGIN, WIDTH, 18, start);
    const address = (rtl && header.agency.addressAr) || header.agency.address;
    if (address) y = t(address, MARGIN, y, WIDTH, 9, start, '#555');
    const contactLine = [header.agency.phone, header.agency.email].filter(Boolean).join('  ·  ');
    if (contactLine) y = t(contactLine, MARGIN, y, WIDTH, 9, start, '#555');
    if (header.agency.taxId) y = t(`${L.taxId} ${header.agency.taxId}`, MARGIN, y, WIDTH, 9, start, '#555');

    // Numéro et date (fin de ligne).
    y = t(`${L[header.kind]} ${header.number}`, MARGIN, y + 20, WIDTH, 16, end);
    y = t(formatDocDate(header.lang, header.date), MARGIN, y, WIDTH, 10, end, '#555');

    // Client.
    y = t(L.client, MARGIN, y + 12, WIDTH, 11, start);
    y = t(`${header.candidate.firstName} ${header.candidate.lastName}`, MARGIN, y, WIDTH, 10, start);
    y = t(header.candidate.phone, MARGIN, y, WIDTH, 10, start);
    if (header.candidate.email) y = t(header.candidate.email, MARGIN, y, WIDTH, 10, start);
    for (const e of header.extra ?? []) y = t(`${e.label} : ${e.value}`, MARGIN, y, WIDTH, 10, start);

    // Tableau : colonnes de gauche à droite en français, en miroir en arabe. Document taxé : colonne « TVA » en plus,
    // prise sur la largeur de la description.
    y += 12;
    const taxed = !!totals?.taxed;
    const cols = rtl
      ? { desc: { x: taxed ? 345 : 285, w: taxed ? 192 : 252, a: 'right' as Align }, vat: { x: 280, w: 60, a: 'center' as Align }, qty: { x: 225, w: 50, a: 'left' as Align }, unit: { x: 130, w: 90, a: 'left' as Align }, tot: { x: 58, w: 70, a: 'left' as Align } }
      : { desc: { x: 58, w: taxed ? 198 : 260, a: 'left' as Align }, vat: { x: 258, w: 60, a: 'center' as Align }, qty: { x: 320, w: 50, a: 'right' as Align }, unit: { x: 375, w: 90, a: 'right' as Align }, tot: { x: 470, w: 70, a: 'right' as Align } };
    doc.rect(MARGIN, y, WIDTH, 20).fill('#0f3350');
    t(L.description, cols.desc.x, y + 5, cols.desc.w, 10, cols.desc.a, '#fff');
    if (taxed) t(L.vat, cols.vat.x, y + 5, cols.vat.w, 10, cols.vat.a, '#fff');
    t(L.qty, cols.qty.x, y + 5, cols.qty.w, 10, cols.qty.a, '#fff');
    t(L.unitPrice, cols.unit.x, y + 5, cols.unit.w, 10, cols.unit.a, '#fff');
    t(L.total, cols.tot.x, y + 5, cols.tot.w, 10, cols.tot.a, '#fff');
    doc.fillColor('#000');

    y += 20;
    let total = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice;
      total += lineTotal;
      const after = t(item.label, cols.desc.x, y + 6, cols.desc.w, 10, cols.desc.a);
      if (taxed) t(item.kind === 'DISBURSEMENT' ? L.disbursement : `${item.vatRate ?? 0} %`, cols.vat.x, y + 7, cols.vat.w, 8, cols.vat.a, '#555');
      t(String(item.quantity), cols.qty.x, y + 6, cols.qty.w, 10, cols.qty.a);
      t(formatAmount(item.unitPrice, header.currency), cols.unit.x, y + 6, cols.unit.w, 10, cols.unit.a);
      t(formatAmount(lineTotal, header.currency), cols.tot.x, y + 6, cols.tot.w, 10, cols.tot.a);
      const rowBottom = Math.max(y + 22, after + 4);
      doc.moveTo(MARGIN, rowBottom).lineTo(RIGHT, rowBottom).strokeColor('#e5e5e5').stroke();
      y = rowBottom;
    }

    if (totals?.taxed) {
      // Récapitulatif : les lignes à zéro (pas de débours, pas de timbre) ne sont pas affichées.
      const money = (n: number) => formatAmount(n, header.currency);
      const rows: [string, number, number][] = [
        [L.subtotalLine, totals.subtotal, 10],
        [L.vatLine(totals.vatRate), totals.vatAmount, 10],
        ...(totals.disbursements > 0 ? [[L.disbursementsLine, totals.disbursements, 10] as [string, number, number]] : []),
        ...(totals.stampDuty > 0 ? [[L.stampLine, totals.stampDuty, 10] as [string, number, number]] : []),
      ];
      let ry = y + 10;
      for (const [label, value, size] of rows) ry = t(`${label} ${money(value)}`, MARGIN, ry, WIDTH, size, end, '#333') + 2;
      // Le récapitulatif est aligné à droite dans les deux langues : le trait aussi.
      doc.moveTo(RIGHT - 220, ry).lineTo(RIGHT, ry).strokeColor('#0f3350').stroke();
      t(`${L.totalTtcLine} ${money(totals.total)}`, MARGIN, ry + 6, WIDTH, 12, end);
    } else {
      t(`${L.totalLine} ${formatAmount(total, header.currency)}`, MARGIN, y + 10, WIDTH, 12, end);
    }
    t(L.generatedBy(header.agency.name), MARGIN, 780, WIDTH, 8, 'center', '#888');

    doc.end();
    return done;
  }

  /** Contrat : texte libre déjà rempli (paragraphes), dans sa langue, avec le tracé de signature s'il existe. */
  contract(
    header: { number: string; date: Date; agency: { name: string; nameAr?: string | null; address?: string | null; addressAr?: string | null }; lang: DocLang },
    content: string,
    signature?: { image: Buffer; signerName: string; signedAt: Date } | null,
  ): Promise<Buffer> {
    const { doc, done } = this.start();
    const L = LABELS[header.lang];
    const rtl = header.lang === 'ar';
    const dir = rtl ? 'rtl' : 'ltr';
    const start: Align = rtl ? 'right' : 'left';
    const end: Align = rtl ? 'left' : 'right';
    const t = (text: string, y: number, size: number, align: Align, color = '#000', lineGap?: number, pageBreak?: boolean) =>
      drawText(doc, text, { x: MARGIN, y, width: WIDTH, size, align, dir, color, lineGap, pageBreak });

    let y = t((rtl && header.agency.nameAr) || header.agency.name, MARGIN, 18, start);
    const address = (rtl && header.agency.addressAr) || header.agency.address;
    if (address) y = t(address, y, 9, start, '#555');
    y = t(`${L.contract} ${header.number}`, y + 12, 16, end);
    y = t(formatDocDate(header.lang, header.date), y, 10, end, '#555');
    // Le texte d'un contrat peut être long : il continue sur les pages suivantes.
    y = t(content, y + 18, 10, start, '#000', 4, true);

    if (signature) {
      if (y > 640) {
        doc.addPage();
        y = MARGIN;
      }
      y += 20;
      t(L.candidateSignature, y, 9, start, '#555');
      try {
        doc.image(signature.image, rtl ? RIGHT - 160 : MARGIN, y + 15, { width: 160, height: 60 });
      } catch {
        /* image invalide : on continue sans bloquer la génération du PDF */
      }
      t(signature.signerName, y + 80, 9, start, '#555');
      t(`${L.signedOn} ${formatDocDate(header.lang, signature.signedAt)}`, y + 93, 9, start, '#555');
    }

    t(L.generatedBy(header.agency.name), 780, 8, 'center', '#888');

    doc.end();
    return done;
  }

  private start() {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    return { doc, done };
  }
}
