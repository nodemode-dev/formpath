import { allNodes, newDoc } from '../../engine/doc';
import { geomBounds } from '../../engine/bounds';
import { renderNode } from '../../engine/render';
import type { Artboard, Doc, Engine, ImageNode, SymbolDef, VNode } from '../../engine';
import type { SymbolLibrary } from '../../engine/symbol-libraries';
import { el, patchList, q, setClass, setDisabled, setHtml, setText, setTitle } from '../dom';
import type { LinkManager, LinkState } from '../../io/links';
import { icon } from '../icons';
import { askForm } from '../form-dialog';
import { selectCtl } from './kit';

function thumbArt(doc: Doc, c: HTMLCanvasElement, art: VNode): void {
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  const b = geomBounds(doc, art);
  if (!Number.isFinite(b.x) || b.w <= 0 && b.h <= 0) return;
  const k = Math.min((c.width - 8) / Math.max(1e-6, b.w), (c.height - 8) / Math.max(1e-6, b.h));
  g.setTransform(k, 0, 0, k, c.width / 2 - (b.x + b.w / 2) * k, c.height / 2 - (b.y + b.h / 2) * k);
  try { renderNode(g, art, { doc, scale: k, outline: false, assets: () => null }); } catch { }
}
function thumb(engine: Engine, c: HTMLCanvasElement, s: SymbolDef): void { if (engine.doc) thumbArt(engine.doc, c, s.art); }

export class SymbolsPanel {
  readonly body = el('<div class="cv-kit-page cv-symp"></div>');
  private readonly grid = el('<div class="cv-symp-grid" role="listbox" aria-label="Symbols"></div>');
  private frame = 0;

  private readonly note = el('<p class="cv-note cv-symp-note"></p>');
  private readonly btns = new Map<string, HTMLButtonElement>();

  constructor(private readonly engine: Engine, private readonly run: (cmd: string) => void, private readonly menus: { library: (anchor: HTMLElement) => void; panel: (anchor: HTMLElement) => void }) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (key: string, name: string, label: string, act: (b: HTMLButtonElement) => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => act(b)); foot.appendChild(b); this.btns.set(key, b); };
    mk('lib', 'library', 'Symbol Libraries menu', (b) => this.menus.library(b));
    mk('place', 'download', 'Place Symbol Instance', () => this.place());
    mk('replace', 'refresh', 'Replace the selected instances with this symbol', () => this.run('symbol-replace'));
    mk('break', 'unlink', 'Break Link to Symbol', () => engine.breakSymbolLink());
    mk('options', 'settings', 'Symbol Options', () => this.run('symbol-options'));
    mk('new', 'add', 'New Symbol from the selection', () => this.run('new-symbol'));
    mk('delete', 'delete', 'Delete Symbol', () => this.run('symbol-delete'));
    mk('more', 'more3', 'Symbols panel menu', (b) => this.menus.panel(b));
    this.grid.addEventListener('click', (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>('.cv-symp-tile'); if (!t?.dataset.key) return; engine.currentSymbol = t.dataset.key; engine.emit('options', null); this.sync(); });
    this.grid.addEventListener('dblclick', (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>('.cv-symp-tile'); if (t?.dataset.key) { engine.currentSymbol = t.dataset.key; engine.enterSymbolEdit(t.dataset.key); } });
    this.body.append(this.grid, this.note, foot);
    for (const k of ['doc', 'active', 'projects', 'options', 'selection'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private place(): void {
    const e = this.engine, p = e.current, id = e.currentSymbol ?? e.doc?.symbols[0]?.id;
    if (!p || !id) return;
    const v = p.viewport;
    e.placeSymbol(id, v.toDoc(v.centerX, v.height / 2));
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private readonly drawn = new WeakMap<HTMLElement, unknown>();

  private sync(): void {
    const e = this.engine, doc = e.doc, cur = e.symbolDef(), insts = e.selectedInstances(), session = e.symbolSession;
    patchList<SymbolDef>(this.grid, doc?.symbols ?? [], {
      key: (s) => s.id,
      create: (s) => { const b = el('<button class="cv-symp-tile" type="button" role="option"><canvas width="64" height="64"></canvas><span class="cv-symp-badge" aria-hidden="true"></span></button>'); this.fill(b, s); return b; },
      update: (b, s) => this.fill(b, s),
    });
    const on = (k: string, v: boolean): void => { const b = this.btns.get(k); if (b) setDisabled(b, !v); };
    on('place', !!doc && !!(cur ?? doc.symbols[0])); on('replace', !!cur && insts.length > 0); on('break', insts.length > 0);
    on('options', !!cur); on('new', e.hasSelection && !session); on('delete', !!cur && !session); on('lib', true); on('more', !!doc);
    setText(this.note, session ? `Editing ${doc?.symbols.find((s) => s.id === session.symbol)?.name ?? 'symbol'}: every instance follows. Press Escape or double-click outside to exit.` : cur ? `${cur.name} · ${cur.type === 'dynamic' ? 'Dynamic' : 'Static'}${cur.slice ? ' · 9-slice scaling' : ''}. Double-click to edit the symbol.` : doc?.symbols.length ? 'Pick a symbol, or double-click one to edit it.' : 'No symbols yet. Select artwork and click New Symbol, or open a Symbol Library.');
  }

  private fill(b: HTMLElement, s: SymbolDef): void {
    const label = `${s.name}${s.type === 'dynamic' ? ' · dynamic' : ''}${s.slice ? ' · 9-slice' : ''}`;
    setTitle(b, label);
    if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    setClass(b, 'is-picked', this.engine.currentSymbol === s.id);
    setClass(b, 'is-dynamic', s.type === 'dynamic');
    if (this.drawn.get(b) !== s.art) { this.drawn.set(b, s.art); thumb(this.engine, q<HTMLCanvasElement>(b, 'canvas'), s); }
  }
}

export class SymbolLibraryPanel {
  readonly body = el('<div class="cv-kit-page cv-libp cv-symlibp"></div>');
  private readonly grid = el('<div class="cv-symp-grid cv-libp-grid" role="listbox" aria-label="Library symbols"></div>');
  private readonly pick;
  private readonly note = el('<p class="cv-note cv-libp-note"></p>');
  private readonly addAll: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private opened: SymbolLibrary[] = [];
  private cur: SymbolLibrary | null = null;
  private stub: Doc | null = null;

  constructor(private readonly engine: Engine, private readonly menu: (anchor: HTMLElement) => void) {
    this.pick = selectCtl('', [['', 'No library open']], (id) => { const l = this.opened.find((x) => x.id === id); if (l) { this.cur = l; this.sync(); } });
    const head = el('<div class="cv-kit-row cv-libp-head"></div>');
    head.appendChild(this.pick.el);
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: (b: HTMLButtonElement) => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => run(b)); foot.appendChild(b); return b; };
    mk('library', 'Symbol Libraries menu', (b) => this.menu(b));
    this.addAll = mk('add', 'Add every symbol of this library to the Symbols panel', () => { if (this.cur) { const ids = engine.addLibrarySymbols(this.cur.symbols); engine.notice(`Added ${ids.length} symbols from ${this.cur.name}.`); } });
    this.closeBtn = mk('close', 'Close this library', () => { const i = this.opened.findIndex((l) => l.id === this.cur?.id); this.opened = this.opened.filter((l) => l.id !== this.cur?.id); this.cur = this.opened[Math.max(0, i - 1)] ?? null; this.sync(); });
    const use = (ev: Event, place: boolean): void => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('.cv-symp-tile'), lib = this.cur, s = lib && t ? lib.symbols[Number(t.dataset.i)] : null;
      if (!s) return;
      if (!engine.doc) { engine.notice('Open a document to use library symbols.'); return; }
      const [id] = engine.addLibrarySymbols([s]);
      const p = engine.current;
      if (place && id && p) { const v = p.viewport; engine.placeSymbol(id, v.toDoc(v.centerX, v.height / 2)); }
    };
    this.grid.addEventListener('click', (ev) => use(ev, false));
    this.grid.addEventListener('dblclick', (ev) => use(ev, true));
    this.body.append(head, this.grid, this.note, foot);
    engine.on('projects', () => this.sync());
    this.sync();
  }

  show(lib: SymbolLibrary): void { this.opened = [...this.opened.filter((l) => l.id !== lib.id), lib]; this.cur = lib; this.sync(); }
  get current(): SymbolLibrary | null { return this.cur; }

  private sync(): void {
    const lib = this.cur;
    this.pick.setChoices(this.opened.length ? this.opened.map((l) => [l.id, `${l.user ? 'User Defined · ' : ''}${l.name}`] as const) : [['', 'No library open']]);
    this.pick.set(lib?.id ?? '');
    setDisabled(this.addAll, !lib || !this.engine.doc);
    setDisabled(this.closeBtn, !lib);
    setText(this.note, lib ? `${lib.symbols.length} symbols. Click one to add it to the Symbols panel; double-click to place an instance.` : 'Open a library from Window > Symbol Libraries or the menu below.');
    const rows = lib ? lib.symbols.map((s, i) => ({ k: `${lib.id}|${i}`, i, s })) : [];
    patchList(this.grid, rows, {
      key: (r) => r.k,
      create: (r) => {
        const b = el('<button class="cv-symp-tile" type="button" role="option"><canvas width="64" height="64"></canvas><span class="cv-symp-badge" aria-hidden="true"></span></button>');
        b.dataset.i = String(r.i);
        const label = `${r.s.name}${r.s.slice ? ' · 9-slice' : ''}`;
        setTitle(b, label);
        b.setAttribute('aria-label', label);
        setClass(b, 'is-dynamic', r.s.type === 'dynamic');
        const doc = this.engine.doc ?? (this.stub ??= newDoc(10, 10));
        thumbArt(doc, q<HTMLCanvasElement>(b, 'canvas'), r.s.art);
        return b;
      },
      update: () => undefined,
    });
  }
}

export const PRESET_SIZES: ReadonlyArray<readonly [string, string, number, number]> = [
  ['letter', 'Letter', 612, 792], ['a4', 'A4', 595.28, 841.89], ['a3', 'A3', 841.89, 1190.55], ['tabloid', 'Tabloid', 792, 1224], ['web', 'Web 1920 × 1080', 1920, 1080], ['mobile', 'iPhone 390 × 844', 390, 844], ['square', 'Post 1080 × 1080', 1080, 1080], ['icon', 'Icon 512 × 512', 512, 512],
];

export class ArtboardsPanel {
  readonly body = el('<div class="cv-kit-page cv-abp"></div>');
  private readonly list = el('<div class="cv-abp-list" role="listbox" aria-label="Artboards"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); };
    mk('canvasGrid', 'Rearrange All Artboards', () => void (async () => { const v = await askForm('Rearrange All Artboards', [{ kind: 'number', key: 'cols', label: 'Columns', value: 2, min: 1, max: 50 }, { kind: 'number', key: 'gap', label: 'Spacing', value: 20, min: 0, max: 5000, unit: 'pt' }]); if (v) engine.rearrangeArtboards(Math.round(Number(v.cols)), Number(v.gap)); })());
    mk('chevronUp', 'Move Up', () => this.reorder(-1));
    mk('chevronDown', 'Move Down', () => this.reorder(1));
    mk('add', 'New Artboard', () => { const p = engine.current; if (!p) return; const a = p.doc.artboards[p.activeArtboard] ?? { x: 0, y: 0, w: 612, h: 792 }; const right = Math.max(...p.doc.artboards.map((x) => x.x + x.w)); engine.addArtboard({ x: right + 40, y: a.y, w: a.w, h: a.h }); });
    mk('delete', 'Delete Artboard', () => { const p = engine.current; if (p) engine.deleteArtboard(p.activeArtboard); });
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-abp-row'); if (!r) return; const i = Number(r.dataset.i); if ((e.target as HTMLElement).closest('.cv-abp-opts')) { void this.options(i); return; } engine.setActiveArtboard(i); engine.fit(); });
    this.list.addEventListener('dblclick', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-abp-row'); if (r) void this.options(Number(r.dataset.i)); });
    this.body.append(this.list, foot);
    for (const k of ['doc', 'active', 'projects', 'options'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private reorder(d: number): void {
    const p = this.engine.current;
    if (!p) return;
    const i = p.activeArtboard, j = i + d;
    if (j < 0 || j >= p.doc.artboards.length) return;
    this.engine.edit('Reorder Artboards', (doc) => { const a = doc.artboards.slice(); [a[i], a[j]] = [a[j], a[i]]; return { ...doc, artboards: a }; });
    this.engine.setActiveArtboard(j);
  }

  async options(i: number): Promise<void> {
    const p = this.engine.current, a = p?.doc.artboards[i];
    if (!p || !a) return;
    const v = await askForm('Artboard Options', [
      { kind: 'text', key: 'name', label: 'Name', value: a.name },
      { kind: 'select', key: 'preset', label: 'Preset', value: PRESET_SIZES.find((x) => Math.abs(x[2] - a.w) < 0.5 && Math.abs(x[3] - a.h) < 0.5)?.[0] ?? 'custom', choices: [['custom', 'Custom'], ...PRESET_SIZES.map((x) => [x[0], x[1]] as const)] },
      { kind: 'number', key: 'x', label: 'X', value: a.x, unit: 'pt' }, { kind: 'number', key: 'y', label: 'Y', value: a.y, unit: 'pt' },
      { kind: 'number', key: 'w', label: 'Width', value: a.w, min: 1, unit: 'pt' }, { kind: 'number', key: 'h', label: 'Height', value: a.h, min: 1, unit: 'pt' },
      { kind: 'color', key: 'bg', label: 'Background', value: '#ffffff' },
      { kind: 'check', key: 'transparent', label: 'Transparent background', value: !a.bg },
    ]);
    if (!v) return;
    const pre = PRESET_SIZES.find((x) => x[0] === v.preset), presetChanged = v.preset !== 'custom' && pre && (Math.abs(pre[2] - a.w) > 0.5 || Math.abs(pre[3] - a.h) > 0.5);
    const hex = String(v.bg), bg = v.transparent ? null : { kind: 'rgb' as const, r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
    const patch: Partial<Artboard> = { name: String(v.name) || a.name, x: Number(v.x), y: Number(v.y), w: presetChanged && pre ? pre[2] : Number(v.w), h: presetChanged && pre ? pre[3] : Number(v.h), bg };
    this.engine.setArtboard(i, patch);
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const p = this.engine.current, list = (p?.doc.artboards ?? []).map((a, i) => ({ a, i }));
    patchList(this.list, list, {
      key: (x) => x.a.id,
      create: (x) => { const r = el(`<div class="cv-abp-row" role="option"><span class="cv-abp-n"></span><span class="cv-abp-name"></span><span class="cv-abp-size"></span><button class="cv-abp-opts" type="button" title="Artboard Options" aria-label="Artboard Options">${icon('pArtboards', 14)}</button></div>`); this.fill(r, x.a, x.i); return r; },
      update: (r, x) => this.fill(r, x.a, x.i),
    });
  }

  private fill(r: HTMLElement, a: Artboard, i: number): void {
    r.dataset.i = String(i);
    setText(q(r, '.cv-abp-n'), String(i + 1));
    setText(q(r, '.cv-abp-name'), a.name);
    setText(q(r, '.cv-abp-size'), `${Math.round(a.w)} × ${Math.round(a.h)}`);
    setClass(r, 'is-active', this.engine.current?.activeArtboard === i);
  }
}

const FLAG: Record<LinkState, string> = { linked: 'link', modified: 'refresh', missing: 'warning', embedded: '', unknown: 'info' };
const STATE: Record<LinkState, string> = { linked: 'Linked', modified: 'Modified', missing: 'Missing', embedded: 'Embedded', unknown: 'Linked' };

export class LinksPanel {
  readonly body = el('<div class="cv-kit-page cv-linkp"></div>');
  private readonly list = el('<div class="cv-linkp-list" role="listbox" aria-label="Links"></div>');
  private readonly note = el('<p class="cv-note cv-linkp-note"></p>');
  private readonly btns = new Map<string, HTMLButtonElement>();
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly links: LinkManager, private readonly run: (cmd: string) => void, private readonly menu: (anchor: HTMLElement) => void, private readonly canLink: () => boolean) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (key: string, name: string, label: string, act: (b: HTMLButtonElement) => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => act(b)); foot.appendChild(b); this.btns.set(key, b); };
    mk('relink', 'link', 'Relink', () => this.run('link-relink'));
    mk('goto', 'search', 'Go To Link', () => this.run('link-goto'));
    mk('update', 'refresh', 'Update Link', () => this.run('link-update'));
    mk('embed', 'download', 'Embed Image', () => this.run('link-embed'));
    mk('info', 'info', 'Link Info', () => this.run('link-info'));
    mk('more', 'more3', 'Links panel menu', (b) => this.menu(b));
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-linkp-row'); if (r?.dataset.key) engine.select([r.dataset.key]); });
    this.list.addEventListener('dblclick', (e) => { if ((e.target as HTMLElement).closest('.cv-linkp-row')) this.run('link-info'); });
    this.body.append(this.list, this.note, foot);
    for (const k of ['doc', 'active', 'selection', 'projects'] as const) engine.on(k, () => this.queue());
    links.onChange = () => this.queue();
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const imgs = this.links.images();
    const sel = new Set(this.engine.selectedIds());
    patchList<ImageNode>(this.list, imgs, {
      key: (n) => n.id,
      create: (n) => { const r = el(`<div class="cv-linkp-row" role="option">${icon('image', 14)}<span class="cv-linkp-flag" aria-hidden="true"></span><span class="cv-linkp-name"></span><span class="cv-linkp-state"></span></div>`); this.fill(r, n, sel); return r; },
      update: (r, n) => this.fill(r, n, sel),
    });
    const pick = imgs.find((n) => sel.has(n.id)), st = pick ? this.links.state(pick) : null;
    const on = (k: string, v: boolean): void => { const b = this.btns.get(k); if (b) setDisabled(b, !v); };
    on('relink', !!pick); on('goto', !!pick); on('update', st === 'modified'); on('embed', !!pick?.linked); on('info', !!pick); on('more', !!this.engine.doc);
    const count = (s: LinkState): number => imgs.filter((n) => this.links.state(n) === s).length;
    const linked = imgs.filter((n) => n.linked).length, mod = count('modified'), miss = count('missing');
    setText(this.note, !imgs.length ? (this.canLink() ? 'No placed images. File > Place Linked keeps an image linked to its file on disk.' : 'No placed images. This browser cannot keep links to files, so placed images are embedded in the document.')
      : `${imgs.length} ${imgs.length === 1 ? 'image' : 'images'}, ${linked} linked${mod ? `, ${mod} modified` : ''}${miss ? `, ${miss} missing` : ''}.${this.canLink() ? '' : ' This browser cannot link files: images are embedded.'}`);
  }

  private fill(r: HTMLElement, n: ImageNode, sel: Set<string>): void {
    const st = this.links.state(n);
    setText(q(r, '.cv-linkp-name'), n.linked?.name ?? n.name ?? n.link ?? n.src);
    setText(q(r, '.cv-linkp-state'), STATE[st]);
    setHtml(q(r, '.cv-linkp-flag'), FLAG[st] ? icon(FLAG[st], 12) : '', FLAG[st]);
    setTitle(r, `${n.linked?.path ?? n.linked?.name ?? 'Embedded in the document'} · ${n.w} × ${n.h} px${st === 'modified' ? ' · changed on disk' : st === 'missing' ? ' · the file is missing' : ''}`);
    setClass(r, 'is-active', sel.has(n.id));
    setClass(r, 'is-modified', st === 'modified');
    setClass(r, 'is-missing', st === 'missing');
  }
}
