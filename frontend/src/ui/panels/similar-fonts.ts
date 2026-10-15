import { findSimilarFonts } from '../../io/fonts';
import type { SimilarFont } from '../../io/api';
import { el, patchList, setHidden, setText } from '../dom';

interface Row { key: string; label: string; style: string; family: string; score: string; pick: boolean }

let panel: HTMLElement | null = null;
let list: HTMLElement | null = null;
let off: (() => void) | null = null;
let run = 0;

function mount(): HTMLElement {
  if (panel) return panel;
  panel = el('<div class="cv-menu cv-similar" role="listbox" aria-label="Similar fonts" hidden></div>');
  list = panel;
  document.getElementById('overlay-root')?.appendChild(panel);
  return panel;
}

export function closeSimilarFonts(): void {
  run++;
  if (panel) setHidden(panel, true);
  off?.();
  off = null;
}

export async function openSimilarFonts(anchor: HTMLElement, family: string, style: string, onPick: (family: string, style: string) => void): Promise<void> {
  const p = mount(), mine = ++run;
  const fill = (node: HTMLElement, r: Row): void => {
    const kids = node.children;
    setText(kids[0], r.style ? `${r.family} ${r.style}` : r.family);
    setText(kids[1], r.score);
    (node as HTMLButtonElement).disabled = !r.pick;
    node.onclick = r.pick ? () => { closeSimilarFonts(); onPick(r.family, r.style); } : null;
  };
  const show = (rows: Row[]): void => {
    patchList(list ?? p, rows, {
      key: (r) => r.key,
      create: (r) => {
        const b = el<HTMLButtonElement>('<button type="button" class="cv-menu-item" role="option"><span class="cv-similar-name"></span><span class="cv-menu-keys"></span></button>');
        fill(b, r);
        return b;
      },
      update: fill,
    });
  };
  show([{ key: 'busy', label: '', family: 'Searching', style: '', score: '', pick: false }]);
  const a = anchor.getBoundingClientRect();
  p.style.left = `${Math.round(a.left)}px`;
  p.style.top = `${Math.round(a.bottom + 4)}px`;
  p.style.minWidth = `${Math.round(Math.max(a.width, 232))}px`;
  setHidden(p, false);
  off?.();
  const onDown = (e: PointerEvent): void => { if (!p.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeSimilarFonts(); };
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeSimilarFonts(); };
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  off = () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); };
  let found: SimilarFont[] = [];
  try { found = await findSimilarFonts(family, style, 10); } catch { found = []; }
  if (mine !== run) return;
  show(found.length
    ? found.map((f) => ({ key: f.id, label: '', family: f.family, style: f.style, score: `${Math.round(f.score)}%`, pick: true }))
    : [{ key: 'none', label: '', family: 'No similar fonts found', style: '', score: '', pick: false }]);
}
