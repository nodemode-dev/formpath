export interface PdfxParts {
  iccDict: string;
  iccStream: Uint8Array;
  intentDict: (iccRef: number) => string;
  trapped: string;
  version: string;
}

export type PdfXLevel = 'x1a' | 'x3' | 'x4';

export function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (m) => `\\${m}`)})`;
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

export function pdfxParts(profile: Uint8Array, components: 3 | 4, condition: string, info: string, level: PdfXLevel = 'x4'): PdfxParts {
  const alt = components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
  return {
    iccDict: `<< /N ${components} /Alternate ${alt} >>`,
    iccStream: profile,
    intentDict: (iccRef: number) => `<< /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier ${pdfString(condition)} /OutputCondition ${pdfString(condition)} /RegistryName (http://www.color.org) /Info ${pdfString(info)} /DestOutputProfile ${iccRef} 0 R >>`,
    trapped: '/Trapped /False',
    version: level === 'x1a' ? '/GTS_PDFXVersion (PDF/X-1:2001) /GTS_PDFXConformance (PDF/X-1a:2001)' : level === 'x3' ? '/GTS_PDFXVersion (PDF/X-3:2002)' : '/GTS_PDFXVersion (PDF/X-4)',
  };
}

/** PDF/A output intent: the profile stream is an RGB ICC profile and the intent has subtype GTS_PDFA1 (the subtype name is shared by all parts of PDF/A). */
export function pdfaParts(profile: Uint8Array, name: string): PdfxParts {
  return {
    iccDict: '<< /N 3 >>',
    iccStream: profile,
    intentDict: (iccRef: number) => `<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier ${pdfString(name)} /OutputCondition ${pdfString(name)} /RegistryName (http://www.color.org) /Info ${pdfString(name)} /DestOutputProfile ${iccRef} 0 R >>`,
    trapped: '',
    version: '',
  };
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The XMP packet for PDF/A-2b. Title, creator tool, producer and the two dates repeat the Info dictionary character for character, which is what the part 2 rule on synchronised metadata asks for. */
export function xmpPdfA(o: { title: string; producer: string; iso: string; docId: string }): string {
  const id = o.docId.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(o.title)}</rdf:li></rdf:Alt></dc:title><xmp:CreateDate>${o.iso}</xmp:CreateDate><xmp:ModifyDate>${o.iso}</xmp:ModifyDate><xmp:MetadataDate>${o.iso}</xmp:MetadataDate><xmp:CreatorTool>formpth</xmp:CreatorTool><pdf:Producer>${esc(o.producer)}</pdf:Producer><xmpMM:DocumentID>uuid:${id}</xmpMM:DocumentID><xmpMM:VersionID>1</xmpMM:VersionID><xmpMM:RenditionClass>default</xmpMM:RenditionClass></rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`;
}
