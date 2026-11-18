// bidi-js ne fournit pas de types : seul ce qui est utilisé pour les PDF arabes est déclaré.
declare module 'bidi-js' {
  interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: { start: number; end: number; level: number }[];
  }
  interface Bidi {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): EmbeddingLevels;
    getReorderedIndices(text: string, levels: EmbeddingLevels, start?: number, end?: number): number[];
    getMirroredCharacter(char: string): string | null;
  }
  export default function bidiFactory(): Bidi;
}
