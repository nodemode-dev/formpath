import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';
import { vi } from 'vitest';
import { setShaping } from '../src/engine/text';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function useXmlParser(): void {
  vi.stubGlobal('DOMParser', DOMParser);
}

class MeasureCanvas {
  getContext(): { font: string; measureText(t: string): { width: number } } {
    return {
      font: '',
      measureText(this: { font: string }, t: string) {
        const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 16);
        return { width: t.length * size * 0.6 };
      },
    };
  }
}

export function useBundledFonts(): void {
  vi.stubGlobal('OffscreenCanvas', MeasureCanvas);
  vi.stubGlobal('fetch', async (url: string) => {
    const file = decodeURIComponent(String(url).split('?')[0]).replace(/^\/@fs/, '');
    const path = file.startsWith(root) ? file : join(root, file);
    const data = await readFile(path);
    return { ok: true, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  });
  setShaping(null);
}
