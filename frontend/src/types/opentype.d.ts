declare module 'opentype.js' {
  export interface PathCommand { type: 'M' | 'L' | 'C' | 'Q' | 'Z'; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }
  export interface Path { commands: PathCommand[] }
  export interface Glyph { name: string | null; unicode?: number; unicodes: number[]; advanceWidth?: number; index: number; getPath(x: number, y: number, fontSize: number): Path }
  export interface GlyphSet { length: number; get(index: number): Glyph }
  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    names: Record<string, Record<string, string> | undefined>;
    glyphs: GlyphSet;
    charToGlyph(ch: string): Glyph;
    getPath(text: string, x: number, y: number, fontSize: number, options?: Record<string, unknown>): Path;
  }
  export function parse(buffer: ArrayBuffer): Font;
  const opentype: { parse: typeof parse };
  export default opentype;
}
