// bidi-js ne fournit pas de types : seul ce qui est utilisé pour les PDF arabes est déclaré.
declare module 'bidi-js' {
  interface Bidi {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): { levels: Uint8Array; paragraphs: { start: number; end: number; level: number }[] };
  }
  export default function bidiFactory(): Bidi;
}
