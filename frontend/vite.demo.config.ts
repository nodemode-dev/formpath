import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const DEMO_PORT = 5293;
const PAGES: Record<string, { out: string; title: string }> = {
  poster: { out: '../demo', title: 'formpath demo: Poster and type' },
  icons: { out: '../demos/icons', title: 'formpath demo: Icons and a logo' },
  pattern: { out: '../demos/pattern', title: 'formpath demo: Patterns and colour' },
};

const inlineWorkers = (): Plugin => ({
  name: 'formpath-demo-inline-workers',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.ts$/.test(id) || id.includes('node_modules')) return null;
    const found = /new Worker\(new URL\('(\.\/[\w.-]+\.ts)', import\.meta\.url\), \{ type: 'module'(?:, name: [^}]+)? \}\)/g;
    if (!found.test(code)) return null;
    found.lastIndex = 0;
    const imports: string[] = [];
    const out = code.replace(found, (_all, file: string) => { const v = `InlineWorker${imports.length}`; imports.push(`import ${v} from '${file}?worker&inline';`); return `new ${v}()`; });
    return { code: `${imports.join('\n')}\n${out}`, map: null };
  },
});

const demoPage = (mode: string): Plugin => ({
  name: 'formpath-demo-page',
  enforce: 'pre',
  transform(html, id) {
    if (!id.endsWith('/frontend/index.html')) return null;
    return html
      .replace('<script type="module" src="/src/main.ts"></script>', '<script type="module" src="../demo/src/main.ts"></script>')
      .replace(/\s*<link rel="(?:icon|apple-touch-icon|preload|manifest)"[^>]*>/g, '')
      .replace(/<html([^>]*)>/, `<html$1 data-demo="building" data-demo-id="${mode}">`)
      .replace('</head>', '  <style>html[data-demo="building"] #app { visibility: hidden !important; } html[data-demo="building"]::before { content: "Starting formpath"; position: fixed; left: 0; right: 0; top: calc(50% - 30px); font: 13px -apple-system, "Segoe UI", system-ui, sans-serif; color: #a8a8b8; text-align: center; } html[data-demo="building"]::after { content: ""; position: fixed; left: calc(50% - 90px); top: calc(50% - 2px); width: 180px; height: 3px; border-radius: 2px; background: linear-gradient(90deg, #3A7BFF, #9A5CFF 30%, #FF4F7A 62%, #FFAE2B) 0 0 / 60px 3px no-repeat #1f1f26; animation: demo-start 1.4s ease-in-out infinite alternate; } @keyframes demo-start { to { background-position: 120px 0; } }</style>\n</head>')
      .replace(/<title>[^<]*<\/title>/, `<title>${PAGES[mode].title}</title>`);
  },
});

const symbol = (cp: number): boolean => (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x1f000 && cp <= 0x1faff);
const unit = (n: number): string => `\\u${n.toString(16).toUpperCase().padStart(4, '0')}`;
const escapeSymbols = (): Plugin => ({
  name: 'formpath-demo-escape-symbols',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type !== 'chunk') continue;
      let out = '';
      for (const ch of file.code) {
        const cp = ch.codePointAt(0) ?? 0;
        out += !symbol(cp) ? ch : cp > 0xffff ? unit(0xd800 + ((cp - 0x10000) >> 10)) + unit(0xdc00 + ((cp - 0x10000) & 0x3ff)) : unit(cp);
      }
      file.code = out;
    }
  },
});

const classicScript = (): Plugin => ({
  name: 'formpath-demo-classic-script',
  enforce: 'post',
  transformIndexHtml(html) {
    const tag = /<script type="module" crossorigin src="([^"]+)"><\/script>\s*/;
    const found = html.match(tag);
    if (!found) return html;
    return html.replace(tag, '').replace('</body>', `<script defer src="${found[1]}"></script>\n</body>`).replace(/ crossorigin(?=[ >])/g, '');
  },
});

export default defineConfig(({ mode }) => {
  const page = PAGES[mode] ?? PAGES.poster;
  const id = PAGES[mode] ? mode : 'poster';
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    publicDir: false,
    worker: { format: 'iife' },
    plugins: [inlineWorkers(), demoPage(id), classicScript(), escapeSymbols()],
    server: { host: false, port: DEMO_PORT, strictPort: true, fs: { allow: ['..'] } },
    preview: { host: false, port: DEMO_PORT + 1, strictPort: true },
    build: {
      outDir: fileURLToPath(new URL(page.out, import.meta.url)),
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: false,
      assetsInlineLimit: (file: string) => /inter-latin-(400|500|600|700|900)-normal\.woff$/.test(file),
      modulePreload: false,
      chunkSizeWarningLimit: 20000,
      rollupOptions: {
        output: {
          format: 'iife' as const,
          inlineDynamicImports: true,
          entryFileNames: 'assets/demo.js',
          assetFileNames: (info: { names?: string[] }) => (info.names?.some((n) => n.endsWith('.css')) ? 'assets/demo.css' : 'assets/[name][extname]'),
        },
      },
    },
  };
});
