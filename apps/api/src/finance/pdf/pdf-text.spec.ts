import { drawText } from './pdf-text';

/** Faux document pdfkit : enregistre les appels ; largeur d'un texte = 5 × nombre de caractères. */
function fakeDoc() {
  const calls: { font: string; text: string; x: number; y: number; opts: Record<string, unknown> }[] = [];
  let font = 'Helvetica';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = {
    font: jest.fn((f: string) => { font = f; return doc; }),
    fontSize: jest.fn(() => doc),
    fillColor: jest.fn(() => doc),
    widthOfString: jest.fn((t: string) => t.length * 5),
    heightOfString: jest.fn(() => 12),
    text: jest.fn((text: string, x: number, y: number, opts: Record<string, unknown>) => { calls.push({ font, text, x, y, opts }); return doc; }),
    y: 0,
  };
  return { doc, calls };
}

describe('drawText', () => {
  it('texte latin : un seul appel, comme avant', () => {
    const { doc, calls } = fakeDoc();
    drawText(doc as never, 'Total : 2400.000 TND', { x: 50, y: 100, width: 495, size: 12, align: 'right', dir: 'ltr' });
    expect(calls).toEqual([expect.objectContaining({ font: 'Helvetica', text: 'Total : 2400.000 TND', x: 50, y: 100, opts: expect.objectContaining({ width: 495, align: 'right' }) })]);
  });

  it('arabe : un appel par mot, dans l’ordre visuel, aligné à droite sur x + width', () => {
    const { doc, calls } = fakeDoc();
    drawText(doc as never, 'المجموع المطلوب', { x: 50, y: 100, width: 495, size: 12, align: 'right', dir: 'rtl' });
    expect(calls.map((c) => c.text)).toEqual(['المطلوب', 'المجموع']);
    expect(calls.every((c) => c.font === 'ar')).toBe(true);
    expect(calls[0].x).toBeLessThan(calls[1].x);
    const last = calls[1];
    expect(last.x + 'المجموع'.length * 5).toBeCloseTo(545);
  });

  it('mot latin dans une phrase arabe : police latine pour ce mot', () => {
    const { doc, calls } = fakeDoc();
    drawText(doc as never, 'رقم FAC-1', { x: 0, y: 0, width: 300, size: 12, align: 'right', dir: 'rtl' });
    expect(calls.map((c) => [c.text, c.font])).toEqual([['FAC-1', 'Helvetica'], ['رقم', 'ar']]);
  });

  it('renvoie la position sous le texte, et passe à la ligne si c’est trop large', () => {
    const { doc, calls } = fakeDoc();
    const y = drawText(doc as never, 'كلمة كلمة كلمة', { x: 0, y: 10, width: 45, size: 10, align: 'right', dir: 'rtl' });
    expect(new Set(calls.map((c) => c.y)).size).toBeGreaterThan(1);
    expect(y).toBeGreaterThan(10);
  });

  it('ne lève pas sur des caractères rares (chiffres arabes-indiens, ﷺ)', () => {
    const { doc } = fakeDoc();
    expect(() => drawText(doc as never, '٠١٢ ﷺ', { x: 0, y: 0, width: 300, size: 12, align: 'right', dir: 'rtl' })).not.toThrow();
  });
});
