// Dessin d'un texte dans un PDF pdfkit. Un texte sans arabe passe par le chemin habituel (inchangé) ; un texte
// avec de l'arabe est dessiné mot par mot dans l'ordre visuel (voir rtl.ts), chaque mot dans la police de son
// écriture : pdfkit/fontkit lie alors correctement les lettres arabes à l'intérieur de chaque mot.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hasArabic, wrapRtl, type Word } from './rtl';

export const LATIN_FONT = 'Helvetica';
export const ARABIC_FONT = 'ar';

let arabicFont: Buffer | null = null;

/** Police Noto Naskh Arabic (licence OFL, assets/fonts) : lue une seule fois, en dev comme dans l'image Docker. */
function arabicFontBuffer(): Buffer {
  if (arabicFont) return arabicFont;
  const candidates = [resolve(__dirname, '../../../assets/fonts'), resolve(__dirname, '../../../../assets/fonts'), resolve(process.cwd(), 'assets/fonts')];
  const dir = candidates.find((d) => existsSync(join(d, 'NotoNaskhArabic-Regular.woff')));
  if (!dir) throw new Error('Police arabe introuvable (assets/fonts/NotoNaskhArabic-Regular.woff)');
  arabicFont = readFileSync(join(dir, 'NotoNaskhArabic-Regular.woff'));
  return arabicFont;
}

export function registerFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont(ARABIC_FONT, arabicFontBuffer());
}

export type DrawOptions = {
  x: number;
  y: number;
  width: number;
  size: number;
  align: 'left' | 'right' | 'center';
  dir: 'ltr' | 'rtl';
  color?: string;
  lineGap?: number;
};

/** Décalage vertical des mots latins au milieu de l'arabe, pour aligner les lignes de base des deux polices. */
const LATIN_BASELINE_SHIFT = 0.12;

/** Dessine `text` ; renvoie la position y juste sous le texte. */
export function drawText(doc: PDFKit.PDFDocument, text: string, o: DrawOptions): number {
  if (o.color) doc.fillColor(o.color);
  if (o.dir === 'ltr' && !hasArabic(text)) {
    doc.font(LATIN_FONT).fontSize(o.size).text(text, o.x, o.y, { width: o.width, align: o.align, lineGap: o.lineGap });
    return doc.y;
  }

  const fontOf = (w: Word) => (w.rtl ? ARABIC_FONT : LATIN_FONT);
  const measure = (w: Word) => doc.font(fontOf(w)).fontSize(o.size).widthOfString(w.text);
  const space = doc.font(LATIN_FONT).fontSize(o.size).widthOfString(' ');
  const lineHeight = o.size * 1.5 + (o.lineGap ?? 0);
  const lines = wrapRtl(text, o.width, measure, space);

  let y = o.y;
  for (const words of lines) {
    const widths = words.map(measure);
    const total = widths.reduce((a, b) => a + b, 0) + space * Math.max(0, words.length - 1);
    // En arabe, « left » (début de ligne) signifie à droite ; « right » reste le bord droit.
    const align = o.dir === 'rtl' && o.align === 'left' ? 'right' : o.align;
    let x = align === 'right' ? o.x + o.width - total : align === 'center' ? o.x + (o.width - total) / 2 : o.x;
    words.forEach((w, i) => {
      const dy = w.rtl ? 0 : o.size * LATIN_BASELINE_SHIFT;
      doc.font(fontOf(w)).fontSize(o.size).text(w.text, x, y + dy, { lineBreak: false });
      x += widths[i] + space;
    });
    y += lineHeight;
  }
  doc.y = y;
  return y;
}
