import { allNodes } from '../engine/doc';
import { documentInfo, documentInfoText, type Project } from '../engine';
import { api, type FilePart } from './api';
import { bundledFontFile } from './fonts';
import { serialize } from './project-io';

export interface PackageOptions {
  name?: string;
  folder: string;
  copyLinks: boolean;
  copyFonts: boolean;
  separateLinks: boolean;
  relink: boolean;
  report: boolean;
  zip?: boolean;
}
export interface PackageResult { links: number; fonts: number; missingLinks: string[]; missingFonts: string[]; files?: string[]; folder?: string; zip?: Blob }

export async function packageProject(p: Project, o: PackageOptions): Promise<PackageResult> {
  const { manifest, files } = serialize(p);
  const paths = new Set<string>();
  for (const n of allNodes(p.doc)) {
    if (n.kind === 'image' && n.linked?.path) paths.add(n.linked.path);
    if (n.kind === 'group' && n.trace?.src.linked?.path) paths.add(n.trace.src.linked.path);
  }
  const info = documentInfo(p.doc);
  const fonts = info.fonts.map((f) => ({ family: f.font, style: f.style }));
  const fontFiles: FilePart[] = [], fontMap: Record<string, string> = {};
  if (o.copyFonts) {
    for (const f of fonts) {
      const b = await bundledFontFile(f.family, f.style);
      if (!b || fontMap[b.name]) continue;
      fontFiles.push(b);
      fontMap[b.name] = `${f.family}|${f.style}`;
    }
  }
  const res = await api.packageFull({
    name: o.name ?? p.doc.title ?? p.name, manifest: JSON.stringify(manifest), links: JSON.stringify([...paths]), fonts: JSON.stringify(fonts), font_map: JSON.stringify(fontMap),
    report: o.report ? documentInfoText(info) : '', folder: o.folder, copy_links: String(o.copyLinks), copy_fonts: String(o.copyFonts),
    separate_links: String(o.separateLinks), relink_copies: String(o.relink), as_zip: String(!!o.zip),
  }, files, fontFiles);
  if (o.zip) {
    const head = res.headers.get('X-Package-Summary');
    return { ...(head ? (JSON.parse(head) as PackageResult) : { links: 0, fonts: 0, missingLinks: [], missingFonts: [] }), zip: await res.blob() };
  }
  return (await res.json()) as PackageResult;
}
