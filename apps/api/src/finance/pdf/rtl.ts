// Ordre de lecture des textes arabes dans les PDF. pdfkit (via fontkit) lie correctement les lettres À
// L'INTÉRIEUR d'un mot arabe, mais place les mots d'une phrase de gauche à droite. On calcule donc l'ordre visuel
// selon l'algorithme bidirectionnel Unicode (bidi-js), puis on dessine la ligne morceau par morceau.
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Morceau à dessiner : texte d'un seul niveau de direction (`rtl` = à façonner de droite à gauche), ou espace. */
const LRI = '\u2066';
const PDI = '\u2069';
// Passage latin : commence et finit par une lettre latine ou un chiffre, sans aucun caractère arabe au milieu.
// (\u00D7 U+00D7 et \u00F7 U+00F7 sont des signes, pas des lettres.)
const LATIN_SPAN = /[A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F](?:[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]*[A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F])?/g;

/**
 * Isole chaque passage latin (nom, montant « 2400.000 TND », matricule « 1234567/A/M/000 », référence) : il
 * s'affiche d'un bloc, de gauche à droite, au lieu d'être découpé par l'algorithme autour des « / », « . » et espaces.
 */
function isolateLatin(line: string): string {
  const count = (s: string, c: string) => s.split(c).length - 1;
  let out = '';
  let pos = 0;
  for (const m of line.matchAll(LATIN_SPAN)) {
    let start = m.index ?? 0;
    let end = start + m[0].length;
    if (start < pos) continue;
    // On garde dans le bloc la parenthèse fermante d'une parenthèse ouverte dedans (« (CF) ») et le « / » final
    // d'une adresse web ; et symétriquement la parenthèse ouvrante d'une fermante restée seule dans le bloc.
    for (;;) {
      const span = line.slice(start, end);
      const c = line[end];
      if (c === '/' || (c === ')' && count(span, '(') > count(span, ')')) || (c === ']' && count(span, '[') > count(span, ']'))) end++;
      else break;
    }
    for (;;) {
      const span = line.slice(start, end);
      const c = line[start - 1];
      if (start > pos && ((c === '(' && count(span, ')') > count(span, '(')) || (c === '[' && count(span, ']') > count(span, '[')))) start--;
      else break;
    }
    out += line.slice(pos, start) + LRI + line.slice(start, end) + PDI;
    pos = end;
  }
  return out + line.slice(pos);
}

export type Word = { text: string; rtl: boolean; space?: boolean };

export function hasArabic(text: string): boolean {
  return ARABIC.test(text);
}

/**
 * Une ligne dans l'ordre visuel (de gauche à droite), en morceaux à dessiner l'un après l'autre, espaces compris.
 * L'ordre est calculé caractère par caractère (algorithme bidirectionnel Unicode complet, avec les signes en miroir
 * comme « »), puis les caractères sont regroupés : un morceau `rtl` garde l'ordre logique de ses lettres, car
 * pdfkit/fontkit les lie et les place lui-même de droite à gauche.
 */
export function visualLine(line: string, base: 'rtl' | 'ltr' = 'rtl'): Word[] {
  if (!line.trim()) return [];
  if (base === 'rtl') line = isolateLatin(line);
  const embedding = bidi.getEmbeddingLevels(line, base);
  const { levels } = embedding;
  const out: Word[] = [];
  let current: { chars: string[]; level: number; last: number } | null = null;
  const flush = () => {
    if (!current) return;
    const rtl = current.level % 2 === 1;
    out.push({ text: (rtl ? current.chars.reverse() : current.chars).join(''), rtl });
    current = null;
  };
  for (const i of bidi.getReorderedIndices(line, embedding)) {
    if (line[i] === LRI || line[i] === PDI) continue;
    const odd = levels[i] % 2 === 1;
    // Signe en miroir dans un passage de droite à gauche : ( ↔ ), « ↔ » (getMirroredCharactersMap ne renvoie rien).
    const ch = (odd && bidi.getMirroredCharacter(line[i])) || line[i];
    if (/\s/.test(ch)) {
      flush();
      if (!out.length || !out[out.length - 1].space) out.push({ text: ' ', rtl: false, space: true });
      continue;
    }
    // Dans un passage de droite à gauche, seules les lettres arabes forment des morceaux (à lier) ; un autre signe
    // (« : », guillemet, chiffre isolé…) est un morceau d'un caractère, déjà à sa place et dans son sens visuel.
    if (odd && !hasArabic(ch)) {
      flush();
      out.push({ text: ch, rtl: true });
      continue;
    }
    // Nouveau morceau quand le niveau change ou que les caractères ne se suivent plus dans le texte logique.
    if (current && (levels[i] !== current.level || Math.abs(i - current.last) !== 1)) flush();
    if (!current) current = { chars: [], level: levels[i], last: i };
    current.chars.push(ch);
    current.last = i;
  }
  flush();
  while (out.length && out[0].space) out.shift();
  while (out.length && out[out.length - 1].space) out.pop();
  return out;
}

/** Morceaux visibles d'une ligne, sans les espaces (pratique pour les tests). */
export function visualWords(line: string, base: 'rtl' | 'ltr' = 'rtl'): Word[] {
  return visualLine(line, base).filter((w) => !w.space);
}

/** Un mot plus large que la colonne (longue adresse e-mail, référence) est coupé en morceaux qui y tiennent. */
function breakLongWord(token: string, maxWidth: number, measure: (w: Word) => number): string[] {
  const rtl = hasArabic(token);
  if (measure({ text: token, rtl }) <= maxWidth) return [token];
  const parts: string[] = [];
  let current = '';
  for (const ch of token) {
    if (current && measure({ text: current + ch, rtl }) > maxWidth) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Découpe un texte en lignes qui tiennent dans `maxWidth` (dans l'ordre LOGIQUE, pour que le premier mot lu
 * soit en haut), puis met chaque ligne dans l'ordre visuel. Un « \n » force une nouvelle ligne ; une ligne vide
 * est conservée (paragraphes). Chaque ligne contient ses espaces (morceaux `space`).
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
    for (const t of logical.flatMap((tok) => breakLongWord(tok, maxWidth, measure))) {
      const w = measure({ text: t, rtl: hasArabic(t) });
      const next = line.length ? width + spaceWidth + w : w;
      if (line.length && next > maxWidth) {
        out.push(visualLine(line.join(' ')));
        line = [t];
        width = w;
      } else {
        line.push(t);
        width = next;
      }
    }
    out.push(visualLine(line.join(' ')));
  }
  return out;
}
