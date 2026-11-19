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
  /** Passer à la page suivante quand le texte arrive en bas de page (texte long : corps du contrat). */
  pageBreak?: boolean;
};

/** Décalage vertical des mots latins au milieu de l'arabe, pour aligner les lignes de base des deux polices. */
const LATIN_BASELINE_SHIFT = 0.12;

type Run = { text: string; font: string };

/** Le glyphe existe-t-il dans la police arabe ? (lu dans fontkit, mis en cache par caractère) */
const arabicCoverage = new Map<number, boolean>();
function arabicHas(doc: PDFKit.PDFDocument, cp: number): boolean {
  let has = arabicCoverage.get(cp);
  if (has === undefined) {
    doc.font(ARABIC_FONT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const font = (doc as any)._font?.font;
    has = typeof font?.hasGlyphForCodePoint === 'function' ? Boolean(font.hasGlyphForCodePoint(cp)) : true;
    arabicCoverage.set(cp, has);
  }
  return has;
}

/**
 * Morceaux d'un mot dans l'ordre visuel (gauche → droite). Un mot latin reste entier en Helvetica. Un mot arabe est
 * coupé là où la police arabe n'a pas le glyphe ; ses morceaux se lisent de droite à gauche, donc on inverse leur ordre.
 */
export function splitRuns(doc: PDFKit.PDFDocument, w: Word): Run[] {
  // Morceau de gauche à droite sans arabe : Helvetica entier. Avec des chiffres arabo-indiens (١٢), qui se lisent
  // de gauche à droite mais n'existent pas dans Helvetica, chaque caractère arabe passe par la police arabe.
  if (!w.rtl && !hasArabic(w.text)) return [{ text: w.text, font: LATIN_FONT }];
  const runs: Run[] = [];
  for (const ch of w.text) {
    const font = (w.rtl || hasArabic(ch)) && arabicHas(doc, ch.codePointAt(0)!) ? ARABIC_FONT : LATIN_FONT;
    const last = runs[runs.length - 1];
    // Dans un morceau de gauche à droite, un caractère en police arabe est dessiné seul : fontkit retournerait
    // sinon l'ordre de la suite (١٢ deviendrait ٢١).
    if (last && last.font === font && (w.rtl || font === LATIN_FONT)) last.text += ch;
    else runs.push({ text: ch, font });
  }
  return w.rtl ? runs.reverse() : runs;
}

/** Dessine `text` ; renvoie la position y juste sous le texte. */
export function drawText(doc: PDFKit.PDFDocument, text: string, o: DrawOptions): number {
  if (o.color) doc.fillColor(o.color);
  // En arabe, « left » (début de ligne) signifie à droite ; « right » reste le bord droit.
  const align = o.dir === 'rtl' && o.align === 'left' ? 'right' : o.align;
  if (!hasArabic(text)) {
    // Texte sans arabe (montant, nom, téléphone) : chemin pdfkit habituel, lu de gauche à droite même en arabe
    // (pdfkit passe lui-même à la page suivante).
    doc.font(LATIN_FONT).fontSize(o.size).text(text, o.x, o.y, { width: o.width, align, lineGap: o.lineGap });
    return doc.y;
  }

  // Un mot arabe peut contenir des signes absents de la police arabe (« : », chiffres…) : on le découpe en
  // morceaux, chacun dans une police qui possède ses glyphes, sinon pdfkit dessine un carré vide.
  const runsOf = (w: Word) => splitRuns(doc, w);
  const measureRuns = (runs: Run[]) => runs.reduce((sum, r) => sum + doc.font(r.font).fontSize(o.size).widthOfString(r.text), 0);
  const space = doc.font(LATIN_FONT).fontSize(o.size).widthOfString(' ');
  const measure = (w: Word) => (w.space ? space : measureRuns(runsOf(w)));
  const lineHeight = o.size * 1.5 + (o.lineGap ?? 0);
  const lines = wrapRtl(text, o.width, measure, space);

  let y = o.y;
  for (const words of lines) {
    if (o.pageBreak && y + lineHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    const widths = words.map(measure);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = align === 'right' ? o.x + o.width - total : align === 'center' ? o.x + (o.width - total) / 2 : o.x;
    words.forEach((w, i) => {
      let rx = x;
      if (w.space) {
        x += widths[i];
        return;
      }
      for (const r of runsOf(w)) {
        const dy = r.font === ARABIC_FONT ? 0 : o.size * LATIN_BASELINE_SHIFT;
        doc.font(r.font).fontSize(o.size).text(r.text, rx, y + dy, { lineBreak: false });
        rx += doc.widthOfString(r.text);
      }
      x += widths[i];
    });
    y += lineHeight;
  }
  doc.y = y;
  return y;
}
