export interface PdfxParts {
  iccDict: string;
  iccStream: Uint8Array;
  intentDict: (iccRef: number) => string;
  trapped: string;
  version: string;
}

function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (m) => `\\${m}`)})`;
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

export function pdfxParts(profile: Uint8Array, components: 3 | 4, condition: string, info: string): PdfxParts {
  const alt = components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
  return {
    iccDict: `<< /N ${components} /Alternate ${alt} >>`,
    iccStream: profile,
    intentDict: (iccRef: number) => `<< /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier ${pdfString(condition)} /OutputCondition ${pdfString(condition)} /RegistryName (http://www.color.org) /Info ${pdfString(info)} /DestOutputProfile ${iccRef} 0 R >>`,
    trapped: '/Trapped /False',
    version: '/GTS_PDFXVersion (PDF/X-4)',
  };
}
