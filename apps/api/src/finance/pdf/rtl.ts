// Ordre de lecture des textes arabes dans les PDF. pdfkit (via fontkit) lie correctement les lettres À
// L'INTÉRIEUR d'un mot arabe, mais place les mots d'une phrase de gauche à droite. On calcule donc, mot par mot,
// l'ordre visuel selon l'algorithme bidirectionnel Unicode (niveaux de bidi-js, puis règle L2 appliquée aux mots).
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export type Word = { text: string; rtl: boolean };

export function hasArabic(text: string): boolean {
  return ARABIC.test(text);
}

/** Mots d'une ligne dans l'ordre visuel, de gauche à droite. */
export function visualWords(line: string, base: 'rtl' | 'ltr' = 'rtl'): Word[] {
  if (!line.trim()) return [];
  const { levels } = bidi.getEmbeddingLevels(line, base);
  const words: (Word & { level: number })[] = [];
  for (const m of line.matchAll(/\S+/g)) words.push({ text: m[0], rtl: hasArabic(m[0]), level: levels[m.index ?? 0] ?? 0 });
  const max = Math.max(...words.map((w) => w.level));
  // Règle L2 : du niveau le plus haut au niveau 1, inverser chaque suite contiguë de mots de niveau ≥ k.
  for (let k = max; k >= 1; k--) {
    for (let a = 0; a < words.length; a++) {
      if (words[a].level < k) continue;
      let b = a;
      while (b + 1 < words.length && words[b + 1].level >= k) b++;
      const run = words.slice(a, b + 1).reverse();
      words.splice(a, run.length, ...run);
      a = b;
    }
  }
  return words.map(({ text, rtl }) => ({ text, rtl }));
}

/**
 * Découpe un texte en lignes qui tiennent dans `maxWidth` (dans l'ordre LOGIQUE, pour que le premier mot lu
 * soit en haut), puis met chaque ligne dans l'ordre visuel. Un « \n » force une nouvelle ligne ; une ligne vide
 * est conservée (paragraphes).
 */
export function wrapRtl(text: string, maxWidth: number, measure: (w: Word) => number, spaceWidth: number): Word[][] {
  const out: Word[][] = [];
  for (const paragraph of text.split('\n')) {
    const logical = paragraph.split(/\s+/).filter(Boolean);
    if (!logical.length) {
      out.push([]);
      continue;
    }
    let line: string[] = [];
    let width = 0;
    for (const t of logical) {
      const w = measure({ text: t, rtl: hasArabic(t) });
      const next = line.length ? width + spaceWidth + w : w;
      if (line.length && next > maxWidth) {
        out.push(visualWords(line.join(' ')));
        line = [t];
        width = w;
      } else {
        line.push(t);
        width = next;
      }
    }
    out.push(visualWords(line.join(' ')));
  }
  return out;
}
