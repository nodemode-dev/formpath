import type { Commands } from './commands';
import { el, setClass, setHidden, setText } from './dom';
import { icon } from './icons';
import { readChoice, setTheme } from './themes';
import { enhanceSelect } from './dropdown';

export interface Workspace { id: string; label: string; order: string[]; hidden: string[]; propsColumn: boolean }
export const WORKSPACES: readonly Workspace[] = [
  { id: 'essentials', label: 'Essentials', order: ['color', 'layers', 'appearance', 'stroke', 'symbols', 'navigator'], hidden: ['stroke', 'symbols', 'navigator'], propsColumn: true },
  { id: 'classic', label: 'Essentials Classic', order: ['color', 'stroke', 'appearance', 'symbols', 'navigator', 'layers'], hidden: ['navigator'], propsColumn: true },
  { id: 'painting', label: 'Painting', order: ['color', 'symbols', 'appearance', 'stroke', 'navigator', 'layers'], hidden: ['navigator'], propsColumn: true },
  { id: 'typography', label: 'Typography', order: ['color', 'appearance', 'stroke', 'symbols', 'navigator', 'layers'], hidden: ['symbols', 'navigator', 'stroke'], propsColumn: true },
  { id: 'layout', label: 'Layout', order: ['navigator', 'color', 'appearance', 'stroke', 'symbols', 'layers'], hidden: ['symbols'], propsColumn: true },
  { id: 'web', label: 'Web', order: ['color', 'appearance', 'symbols', 'stroke', 'navigator', 'layers'], hidden: ['stroke', 'navigator'], propsColumn: true },
];

const RENAMED: Record<string, string> = {};

export interface TitleToolsDeps {
  commands: Commands;
  arrange: (w: Workspace) => void;
  locked: () => boolean;
  setLocked: (on: boolean) => void;
  dock?: (kind: 'claude' | 'shell') => void;
}

export class TitleTools {
  readonly root = el('<div class="cv-title-tools"></div>');
  private readonly results = el('<div class="cv-search-results" role="listbox"></div>');
  private readonly pop = el('<div class="cv-search-pop" hidden><input class="cv-search-input" type="search" placeholder="Search commands" aria-label="Search commands"></div>');
  private picked = 0;
  private readonly claudeBtn = el<HTMLButtonElement>(`<button class="cv-tt-btn" type="button" title="Claude Code" aria-label="Claude Code" aria-pressed="false">${icon('agent', 16)}</button>`);
  private readonly shellBtn = el<HTMLButtonElement>(`<button class="cv-tt-btn" type="button" title="Terminal" aria-label="Terminal" aria-pressed="false">${icon('terminal', 16)}</button>`);

  constructor(host: HTMLElement, private readonly d: TitleToolsDeps) {
    const theme = el<HTMLButtonElement>('<button class="cv-tt-btn cv-tt-bare" type="button" title="Light or dark" aria-label="Light or dark"></button>');
    const search = el<HTMLButtonElement>(`<button class="cv-tt-btn" type="button" title="Search commands" aria-label="Search commands">${icon('search', 16)}</button>`);
    this.claudeBtn.addEventListener('click', () => d.dock?.('claude'));
    this.shellBtn.addEventListener('click', () => d.dock?.('shell'));
    const ws = el<HTMLSelectElement>(`<select class="cv-tt-select" aria-label="Workspace"><optgroup label="Built-in">${WORKSPACES.map((w) => `<option value="${w.id}">${w.label}</option>`).join('')}</optgroup></select>`);
    const lock = el<HTMLButtonElement>('<button class="cv-tt-btn" type="button"></button>');
    const syncTheme = (): void => { const light = readChoice().theme === 'light'; theme.innerHTML = icon(light ? 'moon' : 'sun', 17); theme.setAttribute('aria-pressed', String(light)); };
    theme.addEventListener('click', () => { setTheme(readChoice().theme === 'light' ? 'studio' : 'light'); syncTheme(); });
    syncTheme();
    try { const saved = localStorage.getItem('formpath.workspace') ?? 'essentials'; ws.value = RENAMED[saved] ?? saved; } catch { }
    ws.addEventListener('change', () => {
      const w = WORKSPACES.find((x) => x.id === ws.value);
      if (!w) return;
      try { localStorage.setItem('formpath.workspace', w.id); } catch { }
      d.arrange(w);
    });
    const syncLock = (): void => {
      const on = d.locked();
      lock.innerHTML = icon(on ? 'lock' : 'unlock', 15);
      lock.classList.toggle('is-on', on);
      lock.setAttribute('aria-pressed', String(on));
      lock.title = on ? 'Unlock the workspace' : 'Lock the workspace';
      lock.setAttribute('aria-label', lock.title);
    };
    lock.addEventListener('click', () => { d.setLocked(!d.locked()); syncLock(); });
    syncLock();
    this.pop.appendChild(this.results);
    const input = this.pop.querySelector('input') as HTMLInputElement;
    search.addEventListener('click', () => this.open());
    input.addEventListener('input', () => { this.picked = 0; this.fill(input.value); });
    input.addEventListener('keydown', (e) => {
      const n = this.results.children.length;
      if (e.key === 'Escape') { this.close(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (n) { this.picked = (this.picked + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; this.mark(); } return; }
      if (e.key === 'Enter') { const b = this.results.children[this.picked] as HTMLElement | undefined; if (b) b.click(); }
    });
    document.addEventListener('pointerdown', (e) => { if (!this.pop.hidden && !this.pop.contains(e.target as Node) && !search.contains(e.target as Node)) this.close(); });
    this.root.append(theme, search, this.claudeBtn, this.shellBtn, ws, lock, this.pop);
    enhanceSelect(ws);
    host.appendChild(this.root);
  }

  syncDock(open: boolean, kind: string | null): void {
    for (const [k, b] of [['claude', this.claudeBtn], ['shell', this.shellBtn]] as const) {
      const on = open && kind === k;
      setClass(b, 'is-on', on);
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
    }
  }

  open(): void {
    setHidden(this.pop, false);
    const input = this.pop.querySelector('input') as HTMLInputElement;
    input.value = '';
    this.picked = 0;
    this.fill('');
    input.focus();
  }

  close(): void { setHidden(this.pop, true); }

  private fill(q: string): void {
    const c = this.d.commands, needle = q.trim().toLowerCase();
    const found = c.all().filter((cmd) => c.enabled(cmd) && c.label(cmd) && (!needle || c.label(cmd).toLowerCase().includes(needle))).slice(0, 8);
    this.results.textContent = '';
    for (const cmd of found) {
      const b = el<HTMLButtonElement>('<button class="cv-search-item" type="button" role="option"><span class="cv-search-label"></span><span class="cv-search-keys"></span></button>');
      setText(b.querySelector('.cv-search-label') as HTMLElement, c.label(cmd).replace(/\.\.\.$/, '…'));
      setText(b.querySelector('.cv-search-keys') as HTMLElement, c.keyLabel(cmd));
      b.addEventListener('click', () => { this.close(); c.run(cmd.id); });
      this.results.appendChild(b);
    }
    this.mark();
  }

  private mark(): void {
    Array.from(this.results.children).forEach((b, i) => { (b as HTMLElement).classList.toggle('is-picked', i === this.picked); b.setAttribute('aria-selected', String(i === this.picked)); });
  }
}
