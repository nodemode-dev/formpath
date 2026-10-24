import type { Engine } from '../engine';
import { el, setClass, setHidden, setText } from './dom';
import { HomeFiles } from './home-files';
import { icon } from './icons';

export interface HomeDeps {
  engine: Engine;
  autoShow: () => boolean;
  afterClose: () => boolean;
  recent: () => string[];
  openRecent: (name: string) => void;
  run: (command: string) => void;
  preset: (id: string) => void;
}

type Page = 'start' | 'recent' | 'projects';

const PRESETS: ReadonlyArray<{ id: string; name: string; w: number; h: number; unit: string }> = [
  { id: 'letter', name: 'Letter', w: 612, h: 792, unit: 'pt' },
  { id: 'a4', name: 'A4', w: 595, h: 842, unit: 'pt' },
  { id: 'web', name: 'Web', w: 1920, h: 1080, unit: 'px' },
  { id: 'mobile', name: 'Mobile', w: 390, h: 844, unit: 'px' },
  { id: 'square', name: 'Post', w: 1080, h: 1080, unit: 'px' },
  { id: 'icon', name: 'Icon', w: 512, h: 512, unit: 'px' },
];

const FORMATS = ['FPTH', 'SVG', 'PDF', 'PNG', 'JPEG', 'WEBP'];

export class HomeScreen {
  readonly root = el('<section class="cv-home" aria-label="Home" hidden></section>');
  private readonly pages = new Map<Page, HomeFiles>();
  private page: Page = 'start';
  private forced = false;
  private lastCount = 0;
  private hadDocument = false;
  private back!: HTMLElement;

  constructor(host: HTMLElement, private readonly d: HomeDeps) {
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
    const navItem = (v: Page, ic: string, label: string): string => `<button class="cv-home-nav-item" type="button" data-v="${v}">${icon(ic, 16)}<span>${label}</span>${v === 'start' ? '' : '<span class="cv-home-count">0</span>'}</button>`;
    const cmdItem = (cmd: string, ic: string, label: string): string => `<button class="cv-home-nav-item" type="button" data-cmd="${cmd}">${icon(ic, 16)}<span>${label}</span></button>`;
    const key = (k: string): string => `<kbd class="cv-key">${mod}</kbd><kbd class="cv-key">${k}</kbd>`;
    const formats = FORMATS.map((f) => `<span class="cv-home-format">${f}</span>`).join('');
    const sizes = PRESETS.map((p) => `<button class="cv-home-size" type="button" data-preset="${p.id}"><span class="cv-home-size-box"><span style="aspect-ratio: ${p.w} / ${p.h}"></span></span><span class="cv-home-size-name">${p.name}</span><span class="cv-home-size-meta">${p.w} × ${p.h} ${p.unit}</span></button>`).join('');
    this.root.innerHTML = `<nav class="cv-home-nav" aria-label="Home">
      <div class="cv-home-brand">formpath <span>by nodemode.ai</span></div>
      ${navItem('start', 'image', 'Start')}${navItem('recent', 'history', 'Recent')}${navItem('projects', 'folder', 'Projects')}
      <div class="cv-home-nav-sep"></div>
      <div class="cv-home-nav-title">Create</div>
      ${cmdItem('new', 'newFile', 'New document')}${cmdItem('open', 'folderOpen', 'Open')}
      <div class="cv-home-nav-foot"><button class="cv-home-nav-item cv-home-back" type="button" data-back hidden>${icon('chevronLeft', 16)}<span>Back to Canvas</span></button>${cmdItem('settings', 'settings', 'Preferences')}${cmdItem('help', 'info', 'Help')}</div>
    </nav>
    <div class="cv-home-main">
      <div class="cv-home-narrow">${navItem('start', 'image', 'Start')}${navItem('recent', 'history', 'Recent')}${navItem('projects', 'folder', 'Projects')}</div>
      <div class="cv-home-page" data-page="start">
        <div class="cv-home-head"><div><h1 class="cv-home-title"></h1><p class="cv-home-sub">Open a drawing or a project, or start a new document.</p></div></div>
        <div class="cv-home-hero">
          <span class="cv-home-hero-icon">${icon('image', 26)}</span>
          <div class="cv-home-hero-text"><div class="cv-home-hero-title">Start from a drawing</div>
            <div class="cv-home-hero-sub">Drop an SVG, a PDF made by formpath, a .fpth project or an image anywhere in the window to open or place it. Projects open with every path, appearance and effect still editable.</div>
            <div class="cv-home-formats">${formats}</div></div>
          <div class="cv-home-hero-actions">
            <button class="cv-home-action is-primary" type="button" data-cmd="new">${icon('newFile', 16)}<span class="cv-home-label">New document...</span>${key('N')}</button>
            <button class="cv-home-action" type="button" data-cmd="open">${icon('folderOpen', 16)}<span class="cv-home-label">Open...</span>${key('O')}</button>
          </div>
        </div>
        <section class="cv-home-section"><div class="cv-home-section-head"><h2 class="cv-home-section-title">Recent</h2><button class="cv-btn cv-btn-ghost" type="button" data-v="recent">See all</button></div><div class="cv-home-slot" data-slot="start"></div></section>
        <section class="cv-home-section"><div class="cv-home-section-head"><h2 class="cv-home-section-title">New document</h2><button class="cv-btn cv-btn-ghost" type="button" data-cmd="new">More sizes...</button></div><div class="cv-home-sizes">${sizes}</div></section>
      </div>
      <div class="cv-home-page" data-page="recent" hidden><div class="cv-home-head"><div><h1 class="cv-home-title">Recent</h1><p class="cv-home-sub">Documents you opened or saved, newest first.</p></div></div><div class="cv-home-slot" data-slot="recent"></div></div>
      <div class="cv-home-page" data-page="projects" hidden><div class="cv-home-head"><div><h1 class="cv-home-title">Projects</h1><p class="cv-home-sub">Everything in the project library folder.</p></div><div class="cv-home-head-actions"><button class="cv-btn" type="button" data-cmd="settings">${icon('folder', 14)}Library folder...</button></div></div><div class="cv-home-slot" data-slot="projects"></div></div>
    </div>`;
    this.back = this.root.querySelector('[data-back]') as HTMLElement;
    const deps = { recent: d.recent, openRecent: d.openRecent };
    const count = (v: Page) => (n: number): void => { for (const c of Array.from(this.root.querySelectorAll(`[data-v="${v}"] .cv-home-count`))) setText(c, String(n)); };
    const mount = (slot: Page, files: HomeFiles): void => { (this.root.querySelector(`[data-slot="${slot}"]`) as HTMLElement).appendChild(files.root); this.pages.set(slot, files); };
    mount('start', new HomeFiles(deps, { tab: 'recent', limit: 8, compact: true, onCount: count('recent') }));
    mount('recent', new HomeFiles(deps, { tab: 'recent', onCount: count('recent') }));
    mount('projects', new HomeFiles(deps, { tab: 'projects', onCount: count('projects') }));
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-back]')) { this.forced = false; this.sync(); return; }
      const v = (t.closest('[data-v]') as HTMLElement | null)?.dataset.v as Page | undefined;
      if (v) { this.show(v); return; }
      const preset = (t.closest('[data-preset]') as HTMLElement | null)?.dataset.preset;
      if (preset) this.d.preset(preset);
    });
    host.appendChild(this.root);
    d.engine.on('projects', () => this.sync());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.forced && d.engine.projects.length) { this.forced = false; this.sync(); } });
    this.paint();
    this.sync();
  }

  private paint(): void {
    for (const n of Array.from(this.root.querySelectorAll<HTMLElement>('.cv-home-page'))) setHidden(n, n.dataset.page !== this.page);
    for (const n of Array.from(this.root.querySelectorAll<HTMLElement>('.cv-home-nav-item[data-v]'))) setClass(n, 'is-active', n.dataset.v === this.page);
    const h = new Date().getHours();
    setText(this.root.querySelector('[data-page="start"] .cv-home-title'), h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
  }

  private fill(): void {
    void this.pages.get(this.page)?.refresh();
    for (const [p, f] of this.pages) if (p !== this.page && p !== 'start' && !(p === 'recent' && this.page === 'start')) void f.refresh();
  }

  get isShown(): boolean { return !this.root.hidden; }

  show(page?: Page): void {
    if (page && page !== this.page) { this.page = page; this.paint(); if (!this.root.hidden) this.fill(); }
    this.forced = true;
    this.sync();
  }

  sync(): void {
    const n = this.d.engine.projects.length;
    if (n > this.lastCount) this.forced = false;
    this.lastCount = n;
    if (n > 0) this.hadDocument = true;
    const on = this.forced || (n === 0 && (this.hadDocument ? this.d.afterClose() : this.d.autoShow()));
    if (on && this.root.hidden) { this.paint(); this.fill(); }
    setHidden(this.root, !on);
    setHidden(this.back, n === 0);
  }
}
