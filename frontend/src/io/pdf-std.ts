export type PdfStandard = 'none' | 'x1a' | 'x3' | 'x4' | 'a2b';
export type PdfPrinting = 'none' | 'low' | 'high';
export type PdfChanges = 'none' | 'insert' | 'fill' | 'comment' | 'any';

export interface PdfPermissions { printing: PdfPrinting; changes: PdfChanges; copy: boolean; access: boolean }
export interface PdfSecurity { openPassword: string; permissionsPassword: string; permissions: PdfPermissions }
export interface PdfCompression {
  /** auto keeps JPEG sources as they are and writes everything else with Flate; zip is Flate for all; jpeg is DCT for all colour images. */
  images: 'auto' | 'zip' | 'jpeg';
  jpegQuality: number;
  /** Target resolution in ppi; 0 keeps images as they are. */
  downsamplePpi: number;
  /** Images above this resolution are downsampled; 0 means 1.5 times the target. */
  downsampleAbove: number;
  /** Content streams (page content, forms, shadings, tiles) are Flate compressed; off writes them readable. Images and fonts are not affected. */
  flate: boolean;
}

export const DEFAULT_PERMISSIONS: PdfPermissions = { printing: 'high', changes: 'any', copy: true, access: true };
export const DEFAULT_COMPRESSION: PdfCompression = { images: 'auto', jpegQuality: 0.8, downsamplePpi: 0, downsampleAbove: 0, flate: true };

export const STANDARD_LABELS: Array<[PdfStandard, string]> = [['none', 'None'], ['x1a', 'PDF/X-1a:2001'], ['x3', 'PDF/X-3:2002'], ['x4', 'PDF/X-4:2010'], ['a2b', 'PDF/A-2b']];

export const STANDARD_NOTES: Record<PdfStandard, string> = {
  none: 'Fonts are embedded. Passwords and permissions use AES-256 and are not possible with PDF/X or PDF/A.',
  x1a: 'Version 1.3 with CMYK and spot colours only. Transparency is flattened into pictures; layers are not allowed.',
  x3: 'Version 1.3 with the output intent. Transparency is flattened; RGB stays tagged with the document RGB profile.',
  x4: 'Version 1.6 with the output intent. Live transparency and layers are kept.',
  a2b: 'Archival version 1.7 with an sRGB output intent and every font embedded. Transparency is kept.',
};

export interface StandardRules {
  header: string;
  /** native keeps each colour as drawn; cmyk converts everything to CMYK, gray or spot; rgb to RGB, gray or spot. */
  colour: 'native' | 'cmyk' | 'rgb';
  transparency: boolean;
  layers: boolean;
  /** Fonts with CFF outlines are written as OpenType font files, which PDF 1.3 has no place for. */
  openType: boolean;
  editing: boolean;
  intent: 'none' | 'cmyk' | 'rgb';
}

export function standardRules(s: PdfStandard | undefined): StandardRules {
  switch (s) {
    case 'x1a': return { header: '1.3', colour: 'cmyk', transparency: false, layers: false, openType: false, editing: false, intent: 'cmyk' };
    case 'x3': return { header: '1.3', colour: 'native', transparency: false, layers: false, openType: false, editing: false, intent: 'cmyk' };
    case 'x4': return { header: '1.6', colour: 'native', transparency: true, layers: true, openType: true, editing: false, intent: 'cmyk' };
    case 'a2b': return { header: '1.7', colour: 'rgb', transparency: true, layers: true, openType: true, editing: false, intent: 'rgb' };
    default: return { header: '1.7', colour: 'native', transparency: true, layers: true, openType: true, editing: true, intent: 'none' };
  }
}

export const restricted = (p: PdfPermissions): boolean => p.printing !== 'high' || p.changes !== 'any' || !p.copy || !p.access;
export const securityActive = (s: PdfSecurity | undefined): boolean => !!s && (!!s.openPassword || !!s.permissionsPassword || restricted(s.permissions));

/** The refusal for a combination the file formats forbid, or null when the choices can be written. */
export function pdfRefusal(o: { standard?: PdfStandard; security?: PdfSecurity; layers?: boolean }): string | null {
  const std = o.standard ?? 'none', sec = o.security;
  const name = STANDARD_LABELS.find(([k]) => k === std)?.[1] ?? std;
  if (std !== 'none' && securityActive(sec)) return `${name} files cannot be encrypted. Choose Standard: None to set passwords or permissions, or leave the passwords and permissions off.`;
  if (sec && restricted(sec.permissions) && !sec.permissionsPassword) return 'Restricting printing, changes or copying needs a permissions password. Add one, or allow everything.';
  if (o.layers && !standardRules(std).layers) return `${name} files cannot contain layers (optional content). Turn off Create Acrobat Layers, or choose PDF/X-4, PDF/A-2b or None.`;
  return null;
}

/** The P entry of the Encrypt dictionary: bit 3 print, 4 change, 5 copy, 6 comment, 9 fill forms, 10 accessibility, 11 assemble, 12 high quality print; bits 7, 8 and 13 to 32 are set as the specification asks. */
export function permissionValue(p: PdfPermissions): number {
  let v = 0xfffff0c0;
  if (p.printing !== 'none') v |= 1 << 2;
  if (p.printing === 'high') v |= 1 << 11;
  if (p.changes === 'insert') v |= 1 << 10;
  if (p.changes === 'fill') v |= 1 << 8;
  if (p.changes === 'comment') v |= (1 << 5) | (1 << 8);
  if (p.changes === 'any') v |= (1 << 3) | (1 << 5) | (1 << 8) | (1 << 10);
  if (p.copy) v |= 1 << 4;
  if (p.access) v |= 1 << 9;
  return v | 0;
}

export const standardFrom = (v: unknown): PdfStandard => (v === 'x1a' || v === 'x3' || v === 'x4' || v === 'a2b' ? v : 'none');

export function compressionFrom(a: { image_compression?: unknown; jpeg_quality?: unknown; downsample_ppi?: unknown; downsample_above_ppi?: unknown; compress_line_art?: unknown }): PdfCompression {
  const n = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  return { images: a.image_compression === 'zip' || a.image_compression === 'jpeg' ? a.image_compression : 'auto', jpegQuality: n(a.jpeg_quality, DEFAULT_COMPRESSION.jpegQuality, 0.05, 1), downsamplePpi: n(a.downsample_ppi, 0, 0, 2400), downsampleAbove: n(a.downsample_above_ppi, 0, 0, 4800), flate: a.compress_line_art !== false };
}

export function securityFrom(a: { open_password?: unknown; permissions_password?: unknown; permissions?: unknown }): PdfSecurity | undefined {
  const open = typeof a.open_password === 'string' ? a.open_password : '', owner = typeof a.permissions_password === 'string' ? a.permissions_password : '';
  const raw = (a.permissions && typeof a.permissions === 'object' ? a.permissions : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
  const permissions: PdfPermissions = { printing: pick(raw.printing, ['none', 'low', 'high'] as const, 'high'), changes: pick(raw.changes, ['none', 'insert', 'fill', 'comment', 'any'] as const, 'any'), copy: raw.copy !== false, access: raw.accessibility !== false };
  const s: PdfSecurity = { openPassword: open, permissionsPassword: owner, permissions };
  return securityActive(s) ? s : undefined;
}
