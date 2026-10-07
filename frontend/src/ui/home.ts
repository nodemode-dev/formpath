import type { Engine } from '../engine';
import { api } from '../io/api';
import { el, setHidden, setText } from './dom';
import { icon } from './icons';

export interface HomeDeps {
  engine: Engine;
  autoShow: () => boolean;
  recent: () => string[];
  openRecent: (name: string) => void;
  run: (command: string) => void;
  preset: (id: string) => void;
}

const QUICK: ReadonlyArray<readonly [string, string, string]> = [['letter', 'Letter', '612 × 792 pt'], ['a4', 'A4', '595 × 842 pt'], ['web', 'Web', '1920 × 1080 px'], ['mobile', 'Mobile', '390 × 844 px'], ['square', 'Post', '1080 × 1080 px'], ['icon', 'Icon', '512 × 512 px']];

export class HomeScreen {
  readonly root = el('<section class="cv-home" aria-label="Home" hidden></section>');
  private readonly list = el('<div class="cv-home-list"></div>');
  private readonly recentBox = el('<div class="cv-home-main" hidden><h2 class="cv-home-title">Recent</h2></div>');
  private forced = false;
  private lastCount = 0;
  private listKey = '';

  constructor(host: HTMLElement, private readonly d: HomeDeps) {
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
    const center = el(`<div class="cv-home-center">
      <h1 class="cv-home-brand">formpth<span class="cv-home-by">by NodeMode</span></h1>
      <p class="cv-home-sub">Vector illustration for print, screens and agents. Start a document, pick a size, or open a file.</p>
      <div class="cv-home-actions"></div>
      <div class="cv-home-presets"></div>
      <p class="cv-home-hint">${icon('image', 14)}<span>Drop an SVG, a PDF made by formpth, a .fpth project or an image anywhere to open or place it.</span></p>
    </div>`);
    const actions = center.querySelector('.cv-home-actions') as HTMLElement;
    for (const [label, cmd, ic, key] of [['New document…', 'new', 'newFile', 'N'], ['Open…', 'open', 'folderOpen', 'O']] as const) {
      const b = el<HTMLButtonElement>(`<button class="cv-home-action" type="button">${icon(ic, 16)}<span class="cv-home-label"></span><kbd class="cv-key"></kbd><kbd class="cv-key"></kbd></button>`);
      setText(b.querySelector('.cv-home-label') as HTMLElement, label);
      const [k1, k2] = Array.from(b.querySelectorAll('kbd'));
      setText(k1, mod);
      setText(k2, key);
      b.addEventListener('click', () => this.d.run(cmd));
      actions.appendChild(b);
    }
    const presets = center.querySelector('.cv-home-presets') as HTMLElement;
    for (const [id, label, size] of QUICK) {
      const b = el<HTMLButtonElement>('<button class="cv-home-preset" type="button"><span class="cv-home-preset-card"></span><span class="cv-home-preset-name"></span><span class="cv-home-preset-size"></span></button>');
      setText(b.querySelector('.cv-home-preset-name') as HTMLElement, label);
      setText(b.querySelector('.cv-home-preset-size') as HTMLElement, size);
      b.dataset.preset = id;
      b.addEventListener('click', () => this.d.preset(id));
      presets.appendChild(b);
    }
    this.recentBox.appendChild(this.list);
    center.appendChild(this.recentBox);
    this.root.append(center);
    host.appendChild(this.root);
    d.engine.on('projects', () => this.sync());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.forced && d.engine.projects.length) { this.forced = false; this.sync(); } });
    this.sync();
  }

  get isShown(): boolean { return !this.root.hidden; }

  show(): void { this.forced = true; this.sync(); }

  sync(): void {
    const n = this.d.engine.projects.length;
    if (n > this.lastCount) this.forced = false;
    this.lastCount = n;
    const on = this.forced || (n === 0 && this.d.autoShow());
    if (on && this.root.hidden) void this.fill();
    setHidden(this.root, !on);
  }

  private async fill(): Promise<void> {
    const names = this.d.recent();
    let modified = new Map<string, number>();
    try { modified = new Map((await api.library()).map((i) => [i.name, i.modified])); } catch { }
    const key = JSON.stringify(names.map((n) => [n, modified.get(n) ?? 0]));
    setHidden(this.recentBox, names.length === 0);
    if (key === this.listKey) return;
    this.listKey = key;
    this.list.textContent = '';
    for (const name of names) {
      const row = el<HTMLButtonElement>(`<button class="cv-home-item" type="button">${icon('pAssets', 18)}<span class="cv-home-name"></span><span class="cv-home-date"></span></button>`);
      setText(row.querySelector('.cv-home-name') as HTMLElement, name);
      const t = modified.get(name);
      setText(row.querySelector('.cv-home-date') as HTMLElement, t ? new Date(t * (t < 1e12 ? 1000 : 1)).toLocaleString() : '');
      row.addEventListener('click', () => this.d.openRecent(name));
      this.list.appendChild(row);
    }
  }
}
