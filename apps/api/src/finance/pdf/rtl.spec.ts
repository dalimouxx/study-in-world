import { hasArabic, visualWords, wrapRtl, type Word } from './rtl';

const texts = (ws: Word[]) => ws.map((w) => w.text);

describe('ordre de lecture arabe (ordre visuel, de gauche à droite)', () => {
  it('détecte l’arabe', () => {
    expect(hasArabic('فاتورة')).toBe(true);
    expect(hasArabic('Facture 12')).toBe(false);
  });

  it('deux mots arabes : le premier mot lu est à droite', () => {
    expect(texts(visualWords('المجموع المطلوب'))).toEqual(['المطلوب', 'المجموع']);
  });

  it('référence latine en fin de phrase arabe', () => {
    expect(texts(visualWords('الفاتورة رقم FAC-2026-0012'))).toEqual(['FAC-2026-0012', 'رقم', 'الفاتورة']);
  });

  it('montant et devise gardent leur ordre latin, à gauche', () => {
    expect(texts(visualWords('المجموع : 2400.000 TND'))).toEqual(['2400.000', 'TND', ':', 'المجموع']);
  });

  it('nom latin au milieu d’une phrase arabe', () => {
    expect(texts(visualWords('السيدة Yasmine Ben Ali مترشحة'))).toEqual(['مترشحة', 'Yasmine', 'Ben', 'Ali', 'السيدة']);
  });

  it('texte français inchangé en direction ltr', () => {
    expect(texts(visualWords('Facture 12', 'ltr'))).toEqual(['Facture', '12']);
  });

  it('marque chaque mot arabe', () => {
    expect(visualWords('رقم FAC-1').map((w) => w.rtl)).toEqual([false, true]);
  });
});

describe('wrapRtl', () => {
  const measure = () => 10;
  it('coupe en lignes logiques puis réordonne chaque ligne', () => {
    const lines = wrapRtl('أ ب ت ث', 25, measure, 2);
    expect(lines.map(texts)).toEqual([['ب', 'أ'], ['ث', 'ت']]);
  });

  it('respecte les retours à la ligne', () => {
    expect(wrapRtl('أ\nب', 1000, measure, 2).map(texts)).toEqual([['أ'], ['ب']]);
  });

  it('une ligne vide reste une ligne (paragraphes du contrat)', () => {
    expect(wrapRtl('أ\n\nب', 1000, measure, 2)).toHaveLength(3);
  });
});
