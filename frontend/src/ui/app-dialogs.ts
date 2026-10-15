import { VERSION } from '../version';
import type { Engine, Units } from '../engine';
import { api, type Capabilities, type LibraryItem } from '../io/api';
import { comboOf, formatKeys, type Commands } from './commands';
import { confirmAction, Dialog } from './dialogs';
import { el, escapeHtml, patchList, q, setClass, setDisabled, setHidden, setText, setValue } from './dom';
import { LANGUAGES, language, setLanguage } from '../i18n';
import { icon } from './icons';
import { brandMark } from './brand';
import { ANCHOR_SIZES, CHECKER_COLORS, CHECKER_SIZES, SNAP_ANGLE_SETS, loadPrefs, RECOVERY_CHOICES, savePrefs, UNIT_CHOICES, type CheckerColors, type CheckerSize, type Prefs } from './prefs';
import { readChoice, setAccent, setIntensity, setTheme, themeSwatchesHtml, THEMES } from './themes';
import { toast } from './toast';
import { ARTBOARD_PRESETS } from '../tools/view';
import { DXF_UNITS, type DxfUnit } from '../io/dxf';
import type { TiffCompression } from '../io/tiff';
import { DEFAULT_MARKS, type PdfMarks } from '../io/pdf-marks';

const UNIT_K: Record<Units, number> = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };

export function row(label: string, ...controls: HTMLElement[]): HTMLElement { const r = el('<label class="cv-dialog-row"><span></span></label>'); setText(q(r, 'span'), label); r.append(...controls); return r; }
export function numberInput(min: number, max: number, step = 1): HTMLInputElement { return el<HTMLInputElement>(`<input class="cv-input cv-input-num" type="number" min="${min}" max="${max}" step="${step}">`); }
export function selectOf(choices: ReadonlyArray<readonly [string, string]>): HTMLSelectElement { const s = el<HTMLSelectElement>('<select class="cv-input"></select>'); for (const [v, t] of choices) { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); } return s; }

export class NewDocumentDialog extends Dialog {
  private readonly name = el<HTMLInputElement>('<input class="cv-input" type="text" value="Untitled-1">');
  private readonly presets = el('<div class="cv-newdoc-presets" role="listbox" aria-label="Presets"></div>');
  private readonly w = numberInput(1, 163440, 0.01);
  private readonly h = numberInput(1, 163440, 0.01);
  private readonly units = selectOf(UNIT_CHOICES);
  private readonly boards = numberInput(1, 100);
  private readonly mode = selectOf([['rgb', 'RGB Color'], ['cmyk', 'CMYK Color']]);
  private units0: Units = 'pt';
  private count = 1;

  constructor(private readonly engine: Engine) {
    super('New Document', 640);
    for (const p of ARTBOARD_PRESETS) {
      const b = el<HTMLButtonElement>(`<button class="cv-newdoc-preset" type="button" role="option"><span class="cv-newdoc-card"></span><span class="cv-newdoc-name"></span><span class="cv-newdoc-size"></span></button>`);
      setText(q(b, '.cv-newdoc-name'), p.label.replace(/ \d.*$/, ''));
      setText(q(b, '.cv-newdoc-size'), `${Math.round(p.w)} × ${Math.round(p.h)}`);
      const card = q(b, '.cv-newdoc-card'), k = 44 / Math.max(p.w, p.h);
      card.style.width = `${Math.max(8, Math.round(p.w * k))}px`; card.style.height = `${Math.max(8, Math.round(p.h * k))}px`;
      b.dataset.preset = p.id;
      b.addEventListener('click', () => this.preset(p.id));
      this.presets.appendChild(b);
    }
    const side = el('<div class="cv-newdoc-side"></div>');
    side.append(row('Name', this.name), row('Width', this.w), row('Height', this.h), row('Units', this.units), row('Artboards', this.boards), row('Color Mode', this.mode));
    const wrap = el('<div class="cv-newdoc"></div>');
    wrap.append(this.presets, side);
    this.body.appendChild(wrap);
    this.units.addEventListener('change', () => { const to = this.units.value as Units, k = UNIT_K[this.units0] / UNIT_K[to]; this.w.value = String(Math.round(Number(this.w.value) * k * 100) / 100); this.h.value = String(Math.round(Number(this.h.value) * k * 100) / 100); this.units0 = to; });
    this.button('Cancel', 'ghost', () => this.close());
    this.button('Create', 'primary', () => this.create());
    this.scrim.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.create(); } });
  }

  preset(id: string): void {
    const p = ARTBOARD_PRESETS.find((x) => x.id === id);
    if (!p) return;
    const px = /^(web|web-l|mobile|tablet|square|story|icon)$/.test(id);
    this.units.value = px ? 'px' : 'pt'; this.units0 = this.units.value as Units;
    this.w.value = String(Math.round(p.w * 100) / 100); this.h.value = String(Math.round(p.h * 100) / 100);
    for (const b of Array.from(this.presets.children) as HTMLElement[]) setClass(b, 'is-on', b.dataset.preset === id);
  }

  show(): void {
    this.count++;
    this.name.value = `Untitled-${this.count}`;
    if (!this.w.value) this.preset('letter');
    this.boards.value = this.boards.value || '1';
    this.open(this.name);
    this.name.select();
  }

  createPreset(id: string): void { this.preset(id); this.create(); }

  private create(): void {
    const u = this.units.value as Units, k = UNIT_K[u];
    const w = Math.max(1, Number(this.w.value) || 612) * k, h = Math.max(1, Number(this.h.value) || 792) * k;
    this.engine.newDocument(w, h, { title: this.name.value.trim() || 'Untitled', units: u, colorMode: this.mode.value === 'cmyk' ? 'cmyk' : 'rgb', artboards: Math.max(1, Math.min(100, Math.round(Number(this.boards.value) || 1))) });
    this.close();
  }
}

export interface OpenActions { openLibrary(name: string): Promise<boolean>; openFiles(files: File[]): Promise<void> }

export class OpenDialog extends Dialog {
  private readonly list = el('<div class="cv-list" role="listbox" aria-label="Saved projects"></div>');
  private readonly empty = el('<div class="cv-list-empty" hidden>No saved projects yet.</div>');
  private readonly status = el('<p class="cv-note">Projects saved in the formpth library.</p>');
  private readonly fileInput = el<HTMLInputElement>('<input type="file" accept=".fpth,.svg,.svgz,.pdf,.ai,.eps,.epsf,.ps,.dxf,.dwg,.png,.jpg,.jpeg,.webp,.gif" multiple hidden>');
  private readonly openBtn: HTMLButtonElement;
  private readonly deleteBtn: HTMLButtonElement;
  private items: LibraryItem[] = [];
  private selected: string | null = null;

  constructor(private readonly actions: OpenActions) {
    super('Open', 520);
    this.body.append(this.status, this.list, this.empty);
    const r = el(`<div class="cv-welcome-actions"><button class="cv-btn" type="button">${icon('upload', 14)}From disk (.fpth, .svg, .pdf, .ai, .eps, .dxf, images)</button></div>`);
    this.body.append(r, el('<p class="cv-note">DWG drawings from R2000 to R2018 (except R2007) open directly. For other DWG versions, install a DWG converter or save the drawing as DXF in your CAD program.</p>'), this.fileInput);
    q(r, 'button').addEventListener('click', () => this.fileInput.click());
    this.deleteBtn = this.button('Delete', 'danger', () => void this.deleteSelected());
    this.button('Cancel', 'ghost', () => this.close());
    this.openBtn = this.button('Open', 'primary', () => void this.openSelected());
    this.list.addEventListener('click', (e) => { const x = (e.target as HTMLElement).closest<HTMLElement>('.cv-list-row'); if (x?.dataset.key) { this.selected = x.dataset.key; this.sync(); } });
    this.list.addEventListener('dblclick', (e) => { const x = (e.target as HTMLElement).closest<HTMLElement>('.cv-list-row'); if (x?.dataset.key) { this.selected = x.dataset.key; void this.openSelected(); } });
    this.fileInput.addEventListener('change', () => { const files = Array.from(this.fileInput.files ?? []); this.fileInput.value = ''; if (!files.length) return; this.close(); void actions.openFiles(files); });
  }

  pickFiles(): void { this.fileInput.click(); }

  async show(): Promise<void> { this.selected = null; this.sync(); this.open(this.openBtn); await this.reload(); }

  private async reload(): Promise<void> {
    try { this.items = await api.library(); setText(this.status, 'Projects saved in the formpth library.'); }
    catch (err) { this.items = []; setText(this.status, err instanceof Error ? err.message : String(err)); }
    if (this.selected && !this.items.some((i) => i.name === this.selected)) this.selected = null;
    patchList(this.list, this.items, {
      key: (i) => i.name,
      create: (i) => { const n = el(`<button class="cv-list-row" type="button" role="option">${icon('pAssets', 14)}<span class="cv-list-name"></span><span class="cv-list-meta"></span></button>`); this.updateRow(n, i); return n; },
      update: (n, i) => this.updateRow(n, i),
    });
    setHidden(this.empty, this.items.length > 0);
    this.sync();
  }

  private updateRow(n: HTMLElement, i: LibraryItem): void {
    setText(q(n, '.cv-list-name'), i.name);
    const when = new Date(i.modified * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const size = i.size >= 1048576 ? `${(i.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(i.size / 1024))} KB`;
    setText(q(n, '.cv-list-meta'), `${when} · ${size}`);
  }

  private sync(): void {
    for (const c of Array.from(this.list.children)) setClass(c, 'is-selected', (c as HTMLElement).dataset.key === this.selected);
    setDisabled(this.openBtn, !this.selected);
    setDisabled(this.deleteBtn, !this.selected);
  }

  private async openSelected(): Promise<void> { if (this.selected && await this.actions.openLibrary(this.selected)) this.close(); }

  private async deleteSelected(): Promise<void> {
    const name = this.selected;
    if (!name || !(await confirmAction('Delete project?', `${name} will be removed from the library. This cannot be undone.`, 'Delete', true))) return;
    try { await api.deleteLibrary(name); toast(`Deleted ${name}.`); } catch (err) { toast(err instanceof Error ? err.message : String(err), 'error'); }
    this.selected = null;
    await this.reload();
  }
}

export class SettingsDialog extends Dialog {
  private readonly grid = el('<div class="nm-theme-grid" role="group" aria-label="Theme"></div>');
  private readonly accent = el<HTMLInputElement>('<input class="cv-input" type="color" aria-label="Accent color">');
  private readonly intensity = el<HTMLInputElement>('<input class="cv-slider" type="range" min="0" max="150" step="5" aria-label="Accent intensity">');
  private readonly nav = el('<div class="cv-prefs-nav" role="tablist"></div>');
  private readonly sections = new Map<string, HTMLElement>();
  private prefs: Prefs = loadPrefs();
  private readonly ctl: Record<string, HTMLInputElement | HTMLSelectElement> = {};
  private readonly libNow = el('<p class="cv-note" role="status"></p>');
  private readonly libPath = el<HTMLInputElement>('<input class="cv-input" type="text" spellcheck="false" aria-label="Library folder">');
  private readonly libMove = el<HTMLInputElement>('<input type="checkbox" checked aria-label="Move my projects there">');
  private readonly llmUrl = el<HTMLInputElement>('<input class="cv-input" type="url" spellcheck="false" placeholder="http://localhost:11434/v1" aria-label="Language model address">');
  private readonly llmModel = el<HTMLInputElement>('<input class="cv-input" type="text" spellcheck="false" list="cv-llm-models" placeholder="llama3.2" aria-label="Language model">');
  private readonly llmModels = el('<datalist id="cv-llm-models"></datalist>');
  private readonly llmVision = el<HTMLInputElement>('<input type="checkbox" aria-label="The model reads images">');
  private readonly llmKey = el<HTMLInputElement>('<input class="cv-input" type="password" autocomplete="off" aria-label="Language model key">');
  private readonly llmNote = el('<p class="cv-note" role="status">Any OpenAI-compatible service: Ollama (http://localhost:11434/v1) or LM Studio (http://localhost:1234/v1) on this computer, or OpenAI, OpenRouter and others with a key. The engine keeps the key in your system password store and never shows it.</p>');
  private readonly mcpNote = el('<p class="cv-note" role="status"></p>');
  workspaceLock: { get(): boolean; set(on: boolean): void } | null = null;

  constructor(private readonly onPrefs: (p: Prefs) => void) {
    super('Preferences', 640);
    const t = document.createElement('template');
    t.innerHTML = themeSwatchesHtml();
    this.grid.append(t.content);
    const pages = el('<div class="cv-prefs-pages"></div>');
    const add = (name: string, ...content: HTMLElement[]): void => {
      const tab = el<HTMLButtonElement>('<button class="cv-prefs-tab" type="button" role="tab"></button>');
      tab.textContent = name;
      tab.addEventListener('click', () => this.showSection(name));
      this.nav.appendChild(tab);
      const pg = el('<div class="cv-prefs-page" role="tabpanel"></div>');
      pg.append(...content);
      pages.appendChild(pg);
      this.sections.set(name, pg);
    };
    const check = (key: keyof Prefs, label: string): HTMLElement => { const c = el<HTMLInputElement>('<input type="checkbox">'); c.setAttribute('aria-label', label); c.addEventListener('change', () => this.change({ [key]: c.checked } as Partial<Prefs>)); this.ctl[key] = c; return row(label, c); };
    const num = (key: keyof Prefs, label: string, min: number, max: number, step = 1): HTMLElement => { const c = numberInput(min, max, step); c.setAttribute('aria-label', label); c.addEventListener('change', () => { const v = Number(c.value); if (Number.isFinite(v)) this.change({ [key]: Math.min(max, Math.max(min, v)) } as Partial<Prefs>); }); c.addEventListener('keydown', (e) => e.stopPropagation()); this.ctl[key] = c; return row(label, c); };
    const sel = (key: keyof Prefs, label: string, choices: ReadonlyArray<readonly [string, string]>): HTMLElement => { const s = selectOf(choices); s.setAttribute('aria-label', label); s.addEventListener('change', () => this.change({ [key]: key === 'recoverySeconds' ? Number(s.value) : s.value } as Partial<Prefs>)); this.ctl[key] = s; return row(label, s); };
    const color = (key: 'guideColor' | 'gridColor', label: string): HTMLElement => { const c = el<HTMLInputElement>('<input class="cv-input" type="color">'); c.setAttribute('aria-label', label); c.addEventListener('input', () => this.change({ [key]: c.value } as Partial<Prefs>)); const b = el<HTMLButtonElement>('<button class="cv-btn" type="button">Theme colour</button>'); b.addEventListener('click', () => this.change({ [key]: '' } as Partial<Prefs>)); this.ctl[key] = c; return row(label, c, b); };
    const reset = el<HTMLButtonElement>('<button class="cv-btn" type="button">Reset All Preferences...</button>');
    reset.addEventListener('click', () => { void confirmAction('Reset all preferences?', 'Every preference, the panel arrangement and the tools shown go back to how formpth comes; your documents and library are kept. formpth reloads.', 'Reset').then((ok) => { if (!ok) return; for (const k of Object.keys(localStorage)) if (k.startsWith('formpth.') || k === 'nodemode_ui_settings') localStorage.removeItem(k); location.reload(); }); });
    add('General', check('autoShowHome', 'Show the Home screen when no document is open'), num('keyIncrement', 'Keyboard increment (pt)', 0.01, 1000, 0.1), check('scaleStrokes', 'Scale strokes and effects'), check('scaleCorners', 'Scale corners'), check('previewBounds', 'Use preview bounds'), check('showGenerative', 'Show generative features'), reset);
    this.intensity.addEventListener('input', () => setIntensity(Number(this.intensity.value) / 100));
    const lang = el<HTMLSelectElement>(`<select class="cv-select" translate="no" aria-label="Language">${LANGUAGES.map(([c, n]) => `<option value="${c}">${escapeHtml(n)}</option>`).join('')}</select>`);
    lang.value = language();
    lang.addEventListener('change', () => setLanguage(lang.value));
    add('Interface', row('Language', lang), el('<p class="cv-note">formpth reloads in the chosen language.</p>'), row('Theme', this.grid), row('Accent', this.accent), row('Accent intensity', this.intensity), el('<p class="cv-note">Theme and accent are shared with NodeMode and formvis on this device.</p>'));
    const lock = el<HTMLInputElement>('<input type="checkbox" aria-label="Lock workspace">');
    lock.addEventListener('change', () => this.workspaceLock?.set(lock.checked));
    this.ctl.lock = lock;
    add('Workspace', row('Lock workspace', lock), check('narrowCollapse', 'Show the side column as icons in a narrow window'));
    add('Selection & Snapping', num('snapTolerance', 'Snapping tolerance (screen px)', 1, 20), sel('snapAngleSet', 'Smart Guides construction angles', SNAP_ANGLE_SETS), sel('anchorSize', 'Anchor point and handle display size', ANCHOR_SIZES), check('zoomWheel', 'Zoom with the scroll wheel'), el('<p class="cv-note">On, the wheel zooms about the pointer and Ctrl, Cmd or Alt with the wheel scrolls; off, the other way round.</p>'));
    add('Units', sel('units', 'Default units for new documents', UNIT_CHOICES), el('<p class="cv-note">A document keeps its own units, set in File > Document Setup; rulers and fields show them.</p>'));
    add('Guides & Grid', color('guideColor', 'Guides'), color('gridColor', 'Grid'), num('gridSpacing', 'Gridline every (pt)', 1, 5000), num('gridSubdivisions', 'Subdivisions', 1, 64), check('gridInBack', 'Grids in back'), sel('checkerSize', 'Transparency grid size', CHECKER_SIZES), sel('checkerColors', 'Transparency grid colours', CHECKER_COLORS));
    const libApply = el<HTMLButtonElement>('<button class="cv-btn" type="button">Use this folder</button>');
    libApply.addEventListener('click', () => void this.applyLibrary());
    add('File Handling', this.libNow, row('Library folder', this.libPath), row('Move my projects there', this.libMove), libApply, check('restoreSession', 'Reopen the documents that were open when formpth closed'), sel('recoverySeconds', 'Keep recovery data, within', RECOVERY_CHOICES), num('historyStates', 'Undo steps kept', 10, 1000));
    const agents = el<HTMLInputElement>('<input type="checkbox" aria-label="Allow outside agents">');
    agents.addEventListener('change', () => { this.change({ agentsAllowed: agents.checked }); window.dispatchEvent(new CustomEvent('formpth:agents', { detail: agents.checked })); });
    this.ctl.agentsAllowed = agents;
    const save = el<HTMLButtonElement>('<button type="button" class="cv-btn cv-btn-ghost">Save</button>'), chk = el<HTMLButtonElement>('<button type="button" class="cv-btn cv-btn-ghost">Check</button>'), forget = el<HTMLButtonElement>('<button type="button" class="cv-btn cv-btn-ghost">Forget key</button>');
    save.addEventListener('click', () => void this.saveLlm(false));
    forget.addEventListener('click', () => void this.saveLlm(true));
    chk.addEventListener('click', () => void this.checkLlm());
    const llmButtons = el('<div class="cv-improve"></div>');
    llmButtons.append(save, chk, forget);
    const nm = el<HTMLInputElement>('<input class="cv-input" type="url" spellcheck="false" aria-label="NodeMode address">');
    nm.addEventListener('change', () => { if (/^https?:\/\/./.test(nm.value.trim())) this.change({ nodemodeUrl: nm.value.trim() }); });
    this.ctl.nodemodeUrl = nm;
    add('Plugins & Agents', row('Allow outside agents (MCP)', agents), this.mcpNote,
      el('<h3 class="cv-prefs-sub">Language model (Assistant)</h3>'), row('Address', this.llmUrl), row('Model', this.llmModel, this.llmModels), row('API key', this.llmKey), row('The model reads images', this.llmVision), llmButtons, this.llmNote,
      el('<h3 class="cv-prefs-sub">NodeMode</h3>'), row('NodeMode address', nm));
    const wrap = el('<div class="cv-prefs"></div>');
    wrap.append(this.nav, pages);
    this.body.appendChild(wrap);
    this.button('Done', 'primary', () => this.close());
    this.grid.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-id]'); if (!b?.dataset.themeId) return; setTheme(b.dataset.themeId); this.syncTheme(); });
    this.accent.addEventListener('input', () => { setAccent(this.accent.value); this.syncTheme(); });
    this.scrim.addEventListener('keydown', (e) => e.stopPropagation());
    this.showSection('General');
  }

  show(section?: string): void {
    this.prefs = loadPrefs();
    for (const [k, c] of Object.entries(this.ctl)) {
      const v = k === 'lock' ? this.workspaceLock?.get() ?? false : (this.prefs as unknown as Record<string, unknown>)[k];
      if (c instanceof HTMLInputElement && c.type === 'checkbox') c.checked = !!v;
      else if (c instanceof HTMLInputElement && c.type === 'color') c.value = String(v || (k === 'guideColor' ? '#4fdfff' : '#808080'));
      else setValue(c, String(v ?? ''));
    }
    this.intensity.value = String(Math.round((readChoice().intensity ?? 1) * 100));
    void this.refreshLibrary();
    void this.loadLlm();
    void api.mcpStatus().then((s) => setText(this.mcpNote, s ? `Lets Claude Code, Codex, Cursor or another MCP client draw in the open document; each change is an undoable step. Endpoint: ${s.endpoint} (${s.tools} tools). Claude Code: claude mcp add --transport http formpth ${s.endpoint}, or the stdio bridge ./formpth mcp.` : 'The engine is offline: start it with ./formpth boot to connect agents.'));
    if (section && this.sections.has(section)) this.showSection(section);
    this.syncTheme();
    this.open();
  }

  private syncTheme(): void {
    const c = readChoice();
    setValue(this.accent, c.accentColor);
    for (const b of Array.from(this.grid.querySelectorAll<HTMLElement>('[data-theme-id]'))) {
      const id = b.dataset.themeId ?? '', active = id === c.theme;
      setClass(b, 'is-active', active);
      const border = active ? c.accentColor : THEMES[id]?.vars['--border-color'] ?? '';
      if (b.dataset.border !== border) { b.dataset.border = border; b.style.borderColor = border; }
    }
  }

  private showSection(name: string): void {
    for (const [n, pg] of this.sections) setHidden(pg, n !== name);
    for (const tab of Array.from(this.nav.children) as HTMLElement[]) { const on = tab.textContent === name; setClass(tab, 'is-active', on); tab.setAttribute('aria-selected', String(on)); }
  }

  private change(patch: Partial<Prefs>): void { this.prefs = { ...this.prefs, ...patch }; savePrefs(this.prefs); this.onPrefs(this.prefs); }

  private async refreshLibrary(): Promise<void> {
    const f = await api.libraryFolder();
    if (!f) { setText(this.libNow, 'The library folder shows when the engine is running.'); return; }
    this.libPath.value = f.folder;
    setText(this.libNow, f.fixed ? `The library is in ${f.folder}, set by FORMPTH_LIBRARY_DIR.` : `The library is in ${f.folder}.${f.synced.length ? ` Synced folders found: ${f.synced.map((s) => s.label).join(', ')}.` : ''}`);
  }

  private async applyLibrary(): Promise<void> {
    try { const r = await api.setLibraryFolder(this.libPath.value.trim(), this.libMove.checked); setText(this.libNow, `The library is in ${r.folder}${r.moved ? `; ${r.moved} project${r.moved === 1 ? '' : 's'} moved there` : ''}.`); }
    catch (err) { setText(this.libNow, err instanceof Error ? err.message : 'The library could not move there.'); }
  }

  private async loadLlm(): Promise<void> {
    const s = await api.llmStatus();
    if (!s) { setText(this.llmNote, 'The formpth engine is offline: the Assistant needs it.'); return; }
    if (document.activeElement !== this.llmUrl) this.llmUrl.value = s.baseUrl;
    if (document.activeElement !== this.llmModel) this.llmModel.value = s.model;
    this.llmKey.value = '';
    this.llmKey.placeholder = s.hasKey ? 'Saved (type to replace)' : 'Optional for a service on this computer';
    this.llmVision.checked = !!s.vision;
  }

  private async saveLlm(forget: boolean): Promise<void> {
    try { const s = await api.llmSave(this.llmUrl.value.trim(), this.llmModel.value.trim(), forget ? null : this.llmKey.value.trim() || null, forget, this.llmVision.checked); this.llmKey.value = ''; setText(this.llmNote, forget ? 'Key forgotten.' : `Saved: ${s.model} at ${s.baseUrl}.`); }
    catch (err) { setText(this.llmNote, err instanceof Error ? err.message : 'Could not save.'); }
  }

  private async checkLlm(): Promise<void> {
    await this.saveLlm(false);
    try { const models = await api.llmModels(); this.llmModels.replaceChildren(...models.map((m) => { const o = document.createElement('option'); o.value = m; return o; })); setText(this.llmNote, `Answering, with ${models.length} model${models.length === 1 ? '' : 's'}.`); }
    catch (err) { setText(this.llmNote, err instanceof Error ? err.message : 'Could not reach the service.'); }
  }
}

const TOOL_KEYS: ReadonlyArray<[string, string]> = [['Hold for the Hand tool', 'Space'], ['Swap Fill and Stroke', 'Shift+X'], ['Default Fill and Stroke', 'D'], ['Fill or Stroke in front', 'X'], ['Color, Gradient, None', ', . /'], ['Nudge, Shift for 10x', 'Arrows'], ['Brush and eraser size', '[  ]'], ['Cycle drawing modes', 'Shift+D']];

export class ShortcutsDialog extends Dialog {
  private readonly search = el<HTMLInputElement>('<input class="cv-input" type="search" placeholder="Search commands" aria-label="Search shortcuts">');
  private readonly list = el('<div class="cv-list cv-keys-list" aria-label="Keyboard shortcuts"></div>');
  private readonly note = el('<div class="cv-shortcuts-note" role="status"></div>');
  private capturing: string | null = null;

  constructor(private readonly commands: Commands, private readonly tools: () => Array<{ label: string; key: string }>) {
    super('Keyboard Shortcuts', 620);
    this.body.append(this.search, this.note, this.list);
    this.search.addEventListener('input', () => this.render());
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    this.button('Reset All', 'ghost', () => { this.commands.resetKeys(); this.save(); this.render(); });
    this.button('Close', 'primary', () => this.close());
    window.addEventListener('keydown', (e) => this.capture(e), true);
  }

  show(): void { this.capturing = null; this.search.value = ''; setText(this.note, ''); this.render(); this.open(); }

  private save(): void { savePrefs({ ...loadPrefs(), shortcuts: this.commands.overrides() }); }

  private capture(e: KeyboardEvent): void {
    if (!this.capturing || !this.isOpen) return;
    e.preventDefault(); e.stopPropagation();
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    const id = this.capturing;
    this.capturing = null;
    if (e.key === 'Escape') { this.render(); return; }
    const combo = comboOf(e), other = this.commands.forCombo(combo);
    if (other && other.id !== id) setText(this.note, `${formatKeys(combo)} moved from ${this.commands.label(other)}.`);
    this.commands.setKeys(id, [combo]);
    this.save();
    this.render();
  }

  private render(): void {
    const needle = this.search.value.trim().toLowerCase();
    const rows = this.commands.all().filter((c) => !c.id.startsWith('plugin:')).map((c) => ({ id: c.id, label: this.commands.label(c).replace(/\.\.\.$/, ''), keys: (c.keys ?? []).map(formatKeys).join(', ') }))
      .filter((r) => r.label && (!needle || r.label.toLowerCase().includes(needle) || r.keys.toLowerCase().includes(needle))).sort((a, b) => a.label.localeCompare(b.label));
    const nodes: HTMLElement[] = rows.map((r) => {
      const n = el('<div class="cv-list-row cv-keys-row"><span class="cv-list-name"></span><span class="cv-list-meta"></span><button type="button" class="cv-btn cv-btn-ghost">Change</button><button type="button" class="cv-btn cv-btn-ghost">Remove</button></div>');
      setText(q(n, '.cv-list-name'), r.label);
      setText(q(n, '.cv-list-meta'), this.capturing === r.id ? 'Press the new keys (Esc cancels)' : r.keys || 'none');
      const [change, remove] = [...n.querySelectorAll('button')] as HTMLButtonElement[];
      remove.disabled = !r.keys;
      change.addEventListener('click', () => { this.capturing = r.id; this.render(); });
      remove.addEventListener('click', () => { this.commands.setKeys(r.id, []); this.save(); this.render(); });
      return n;
    });
    for (const t of [...this.tools().map((x) => [`${x.label}`, x.key] as [string, string]), ...TOOL_KEYS]) if (!needle || t[0].toLowerCase().includes(needle)) {
      const n = el('<div class="cv-list-row cv-keys-row is-tool"><span class="cv-list-name"></span><span class="cv-list-meta"></span></div>');
      setText(q(n, '.cv-list-name'), t[0]); setText(q(n, '.cv-list-meta'), t[1]);
      nodes.push(n);
    }
    this.list.replaceChildren(...nodes);
  }
}

export class AboutDialog extends Dialog {
  private readonly engineLine = el('<p class="cv-note"></p>');
  constructor() {
    super('About formpth', 440);
    this.body.appendChild(el(`<div class="cv-welcome-title">${brandMark(28)}formpth ${VERSION}</div>`));
    this.body.appendChild(el('<p class="cv-note">Vector illustration for the web and the desktop, in the NodeMode design system, driven by people and agents alike.</p>'));
    this.body.appendChild(this.engineLine);
    this.body.appendChild(el('<p class="cv-note">Apache License 2.0. Copyright 2026 nodemode-ai. Third-party notices are in NOTICE.md.</p>'));
    this.button('Close', 'primary', () => this.close());
  }
  show(caps: Capabilities | null): void {
    setText(this.engineLine, caps ? `Engine ${caps.version}${caps.desktop ? ' (desktop)' : ''} · library in ${caps.libraryDir} · system fonts ${caps.fonts ? 'available' : 'unavailable'}` : 'Engine offline. Start it with ./formpth boot.');
    this.open();
  }
}

export type ExportFormat = 'svg' | 'pdf' | 'ai' | 'png' | 'jpg' | 'webp' | 'tiff' | 'eps' | 'dxf';
export interface TiffExportChoice { compression: TiffCompression; cmyk: boolean; ppi: number }
export interface CadChoice { version: 'R12' | '2000'; units: DxfUnit; scale: number; text: 'text' | 'outlines'; lineweights: boolean }
export interface ExportChoice { format: ExportFormat; scope: 'artboard' | 'all' | 'art' | 'selection'; artboard: number; scale: number; quality: number; transparent: boolean; outlineText: boolean; preserve: boolean; liveText?: boolean; standard?: 'none' | 'x4'; cmyk?: boolean; cad?: CadChoice; artboards?: number[]; tiff?: TiffExportChoice; marks?: PdfMarks }

export function parseArtboardRange(text: string, count: number, current: number): number[] | null {
  const t = text.trim().toLowerCase();
  if (!t || t === 'current') return [current];
  if (t === 'all') return Array.from({ length: count }, (_, i) => i);
  const out = new Set<number>();
  for (const part of t.split(/[\s,]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > count) return null;
    for (let i = a; i <= b; i++) out.add(i - 1);
  }
  return out.size ? [...out].sort((x, y) => x - y) : null;
}

export class ExportDialog extends Dialog {
  private readonly format = selectOf([['svg', 'SVG (.svg)'], ['pdf', 'PDF (.pdf)'], ['ai', 'Illustrator (.ai)'], ['eps', 'EPS (.eps)'], ['dxf', 'AutoCAD Interchange (.dxf)'], ['png', 'PNG (.png)'], ['jpg', 'JPEG (.jpg)'], ['webp', 'WebP (.webp)'], ['tiff', 'TIFF (.tiff)']]);
  private readonly tiffCompression = selectOf([['none', 'None'], ['packbits', 'PackBits'], ['lzw', 'LZW'], ['deflate', 'Deflate']]);
  private readonly tiffColor = selectOf([['rgb', 'RGB'], ['cmyk', 'CMYK']]);
  private readonly markTrim = el<HTMLInputElement>('<input type="checkbox">');
  private readonly markReg = el<HTMLInputElement>('<input type="checkbox">');
  private readonly markBars = el<HTMLInputElement>('<input type="checkbox">');
  private readonly markInfo = el<HTMLInputElement>('<input type="checkbox">');
  private readonly markOffset = numberInput(0, 144, 0.25);
  private readonly markWeight = numberInput(0.1, 10, 0.05);
  private readonly bleedMode = selectOf([['none', 'None'], ['document', 'Use Document Bleed'], ['custom', 'Custom']]);
  private readonly bleedTop = numberInput(0, 720, 0.25);
  private readonly bleedBottom = numberInput(0, 720, 0.25);
  private readonly bleedLeft = numberInput(0, 720, 0.25);
  private readonly bleedRight = numberInput(0, 720, 0.25);
  private readonly epsColor = selectOf([['rgb', 'RGB'], ['cmyk', 'CMYK']]);
  private readonly cadVersion = selectOf([['2000', 'AutoCAD 2000 (splines, fills, lineweights)'], ['R12', 'AutoCAD R12 (polylines only)']]);
  private readonly cadUnits = selectOf(DXF_UNITS);
  private readonly cadScale = numberInput(0.0001, 100000, 0.0001);
  private readonly cadText = selectOf([['text', 'Text objects'], ['outlines', 'Outlines']]);
  private readonly cadWeights = el<HTMLInputElement>('<input type="checkbox">');
  private readonly scope = selectOf([['artboard', 'Active artboard'], ['all', 'All artboards'], ['art', 'All art (trimmed)'], ['selection', 'Selection']]);
  private readonly scale = selectOf([['0.5', '0.5x (36 ppi)'], ['1', '1x (72 ppi)'], ['2', '2x (144 ppi)'], ['3', '3x'], ['4', '4x'], ['4.1667', '300 ppi']]);
  private readonly range = el<HTMLInputElement>('<input class="cv-input" type="text" value="Current" placeholder="All, Current or 1-3,5">');
  private count = 1;
  private readonly quality = numberInput(1, 100);
  private readonly transparent = el<HTMLInputElement>('<input type="checkbox">');
  private readonly outline = el<HTMLInputElement>('<input type="checkbox">');
  private readonly preserve = el<HTMLInputElement>('<input type="checkbox" checked>');
  private readonly liveText = el<HTMLInputElement>('<input type="checkbox" checked>');
  private readonly standard = selectOf([['none', 'None'], ['x4', 'PDF/X-4:2010']]);
  private readonly rows: Record<string, HTMLElement> = {};
  private resolve: ((c: ExportChoice | null) => void) | null = null;
  private artboard = 0;

  constructor() {
    super('Export', 440);
    q<HTMLElement>(this.scrim, '.cv-dialog').classList.add('cv-export');
    this.rows.format = row('Format', this.format);
    this.rows.scope = row('Export', this.scope);
    this.rows.range = row('Range', this.range);
    this.range.title = 'All, Current, or artboard numbers such as 1-3,5';
    this.rows.scale = row('Resolution', this.scale);
    this.rows.quality = row('Quality (%)', this.quality);
    this.rows.transparent = row('Transparent background', this.transparent);
    this.rows.preserve = row('Preserve formpth editing (reopens fully editable)', this.preserve);
    this.rows.outline = row('Convert type to outlines', this.outline);
    this.rows.liveText = row('Preserve text as live text', this.liveText);
    this.liveText.title = 'Writes selectable, searchable text with the fonts embedded. Type with gradients, effects or an unavailable font is outlined instead.';
    this.rows.standard = row('Standard', this.standard);
    this.standard.title = 'PDF/X-4 embeds the document CMYK profile as the output intent (Edit > Color Settings) and leaves out formpth editing data.';
    this.rows.epsColor = row('Color', this.epsColor);
    this.rows.cadVersion = row('Version', this.cadVersion);
    this.rows.cadUnits = row('Units', this.cadUnits);
    this.rows.cadScale = row('Drawing scale', this.cadScale);
    this.cadScale.title = 'Drawing units per unit of art: 100 writes a 1:100 drawing at full size';
    this.rows.cadText = row('Type as', this.cadText);
    this.rows.cadWeights = row('Scale lineweights', this.cadWeights);
    this.cadUnits.value = 'mm';
    this.cadScale.value = '1';
    this.rows.tiffCompression = row('Compression', this.tiffCompression);
    this.rows.tiffColor = row('Color', this.tiffColor);
    this.tiffCompression.value = 'lzw';
    this.rows.markTrim = row('Trim Marks', this.markTrim);
    this.rows.markReg = row('Registration Marks', this.markReg);
    this.rows.markBars = row('Color Bars', this.markBars);
    this.rows.markInfo = row('Page Information', this.markInfo);
    this.rows.markOffset = row('Offset (pt)', this.markOffset);
    this.rows.markWeight = row('Weight (pt)', this.markWeight);
    this.markOffset.value = String(DEFAULT_MARKS.offset);
    this.markWeight.value = String(DEFAULT_MARKS.weight);
    this.rows.bleedMode = row('Bleed', this.bleedMode);
    this.bleedMode.value = 'document';
    for (const [i, t] of [[this.bleedTop, 'Top'], [this.bleedBottom, 'Bottom'], [this.bleedLeft, 'Left'], [this.bleedRight, 'Right']] as const) { i.value = '0'; i.setAttribute('aria-label', t); i.title = t; }
    this.rows.bleedTB = row('Top, Bottom', el('<span class="cv-pair"></span>'));
    this.rows.bleedTB.lastElementChild?.append(this.bleedTop, this.bleedBottom);
    this.rows.bleedLR = row('Left, Right', el('<span class="cv-pair"></span>'));
    this.rows.bleedLR.lastElementChild?.append(this.bleedLeft, this.bleedRight);
    this.bleedMode.addEventListener('change', () => this.sync());
    this.body.append(...Object.values(this.rows));
    this.format.addEventListener('change', () => this.sync());
    this.scope.addEventListener('change', () => this.sync());
    this.range.addEventListener('input', () => setClass(this.range, 'is-invalid', !parseArtboardRange(this.range.value, this.count, this.artboard)));
    this.button('Cancel', 'ghost', () => this.close());
    this.button('Export', 'primary', () => { if (!parseArtboardRange(this.range.value, this.count, this.artboard)) { this.range.focus(); return; } const r = this.resolve; this.resolve = null; this.close(); r?.(this.value()); });
    this.onClose = () => { const r = this.resolve; this.resolve = null; r?.(null); };
    this.quality.value = '92';
  }

  ask(format: ExportFormat, artboard: number, hasSelection: boolean, cmyk = false, count = 1): Promise<ExportChoice | null> {
    this.format.value = format;
    this.count = Math.max(1, count);
    this.range.value = 'Current';
    setClass(this.range, 'is-invalid', false);
    this.epsColor.value = cmyk ? 'cmyk' : 'rgb';
    this.artboard = artboard;
    (this.scope.querySelector('option[value="selection"]') as HTMLOptionElement).disabled = !hasSelection;
    if (this.scope.value === 'selection' && !hasSelection) this.scope.value = 'artboard';
    return new Promise((res) => { this.resolve = res; this.open(); this.reserve(); });
  }

  private reserve(): void {
    const keep = this.format.selectedIndex, keepBleed = this.bleedMode.value;
    this.body.style.minHeight = '';
    this.bleedMode.value = 'custom';
    let h = 0;
    for (let i = 0; i < this.format.options.length; i++) { this.format.selectedIndex = i; this.sync(); h = Math.max(h, this.body.offsetHeight); }
    this.bleedMode.value = keepBleed;
    this.format.selectedIndex = keep;
    this.sync();
    this.body.style.minHeight = `${h}px`;
  }

  private sync(): void {
    const f = this.format.value, raster = f === 'png' || f === 'jpg' || f === 'webp' || f === 'tiff';
    setHidden(this.rows.range, f === 'dxf' || this.scope.value !== 'artboard');
    setHidden(this.rows.scale, !raster);
    setHidden(this.rows.quality, !(f === 'jpg' || f === 'webp'));
    setHidden(this.rows.transparent, !(f === 'png' || f === 'webp' || f === 'tiff'));
    for (const k of ['tiffCompression', 'tiffColor']) setHidden(this.rows[k], f !== 'tiff');
    for (const k of ['markTrim', 'markReg', 'markBars', 'markInfo', 'markOffset', 'markWeight', 'bleedMode']) setHidden(this.rows[k], f !== 'pdf');
    for (const k of ['bleedTB', 'bleedLR']) setHidden(this.rows[k], f !== 'pdf' || this.bleedMode.value !== 'custom');
    setHidden(this.rows.outline, f !== 'svg');
    setHidden(this.rows.liveText, f !== 'pdf' && f !== 'ai');
    setHidden(this.rows.standard, f !== 'pdf');
    setHidden(this.rows.preserve, !(f === 'svg' || f === 'pdf' || f === 'eps'));
    setHidden(this.rows.epsColor, f !== 'eps');
    for (const k of ['cadVersion', 'cadUnits', 'cadScale', 'cadText', 'cadWeights']) setHidden(this.rows[k], f !== 'dxf');
  }

  private value(): ExportChoice {
    const f = this.format.value as ExportFormat;
    const cad: CadChoice = { version: this.cadVersion.value === 'R12' ? 'R12' : '2000', units: this.cadUnits.value as DxfUnit, scale: Math.max(1e-4, Number(this.cadScale.value) || 1), text: this.cadText.value === 'outlines' ? 'outlines' : 'text', lineweights: this.cadWeights.checked };
    const list = this.scope.value === 'artboard' && f !== 'dxf' ? parseArtboardRange(this.range.value, this.count, this.artboard) : null;
    const num = (i: HTMLInputElement): number => Math.max(0, Number(i.value) || 0);
    const scale = Number(this.scale.value) || 1;
    const tiff: TiffExportChoice = { compression: this.tiffCompression.value as TiffCompression, cmyk: this.tiffColor.value === 'cmyk', ppi: Math.round(72 * scale) };
    const marks: PdfMarks = { trim: this.markTrim.checked, registration: this.markReg.checked, colorBars: this.markBars.checked, pageInfo: this.markInfo.checked, offset: num(this.markOffset), weight: Math.max(0.1, Number(this.markWeight.value) || DEFAULT_MARKS.weight), bleed: this.bleedMode.value as PdfMarks['bleed'], custom: { t: num(this.bleedTop), b: num(this.bleedBottom), l: num(this.bleedLeft), r: num(this.bleedRight) } };
    return { tiff, marks, format: f, scope: this.scope.value as ExportChoice['scope'], artboard: list && list.length === 1 ? list[0] : this.artboard, artboards: list && list.length > 1 ? list : undefined, scale: Number(this.scale.value) || 1, quality: Math.max(0.01, Math.min(1, (Number(this.quality.value) || 92) / 100)), transparent: this.transparent.checked, outlineText: this.outline.checked, preserve: this.preserve.checked, liveText: this.liveText.checked, standard: this.standard.value === 'x4' ? 'x4' : 'none', cmyk: this.epsColor.value === 'cmyk', cad };
  }
}

export class ScreensDialog extends Dialog {
  private readonly boards = el('<div class="cv-screens-boards"></div>');
  private readonly formats = el('<div class="cv-screens-formats"></div>');
  private resolve: ((v: { artboards: number[]; items: Array<{ scale: number; format: string; suffix: string }> } | null) => void) | null = null;

  constructor() {
    super('Export for Screens', 560);
    this.body.append(el('<h3 class="cv-prefs-sub">Artboards</h3>'), this.boards, el('<h3 class="cv-prefs-sub">Formats</h3>'), this.formats);
    const add = el<HTMLButtonElement>('<button type="button" class="cv-btn cv-btn-ghost">Add Scale</button>');
    add.addEventListener('click', () => this.addRow(2, 'png', '@2x'));
    this.body.appendChild(add);
    this.button('Cancel', 'ghost', () => this.close());
    this.button('Export Artboards', 'primary', () => { const r = this.resolve; this.resolve = null; this.close(); r?.(this.value()); });
    this.onClose = () => { const r = this.resolve; this.resolve = null; r?.(null); };
    this.addRow(1, 'png', '');
    this.addRow(2, 'png', '@2x');
    this.addRow(1, 'svg', '');
  }

  private addRow(scale: number, format: string, suffix: string): void {
    const r = el('<div class="cv-screens-row"></div>');
    const s = selectOf([['0.5', '0.5x'], ['1', '1x'], ['1.5', '1.5x'], ['2', '2x'], ['3', '3x'], ['4', '4x']]), f = selectOf([['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP'], ['svg', 'SVG'], ['pdf', 'PDF']]), x = el<HTMLInputElement>('<input class="cv-input" type="text" aria-label="Suffix" placeholder="suffix">');
    s.value = String(scale); f.value = format; x.value = suffix;
    x.addEventListener('keydown', (e) => e.stopPropagation());
    const del = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" aria-label="Remove">${icon('close', 14)}</button>`);
    del.addEventListener('click', () => r.remove());
    r.append(s, x, f, del);
    this.formats.appendChild(r);
  }

  ask(names: string[], active: number): Promise<{ artboards: number[]; items: Array<{ scale: number; format: string; suffix: string }> } | null> {
    this.boards.replaceChildren(...names.map((n, i) => { const l = el('<label class="cv-check"><input type="checkbox"><span></span></label>'); (l.querySelector('input') as HTMLInputElement).checked = names.length === 1 || i === active || names.length <= 6; (l.querySelector('input') as HTMLInputElement).dataset.i = String(i); setText(l.querySelector('span') as HTMLElement, `${i + 1} ${n}`); return l; }));
    return new Promise((res) => { this.resolve = res; this.open(); });
  }

  private value(): { artboards: number[]; items: Array<{ scale: number; format: string; suffix: string }> } {
    const artboards = Array.from(this.boards.querySelectorAll<HTMLInputElement>('input:checked')).map((c) => Number(c.dataset.i));
    const items = Array.from(this.formats.children).map((r) => { const [s, x, f] = Array.from(r.querySelectorAll<HTMLInputElement | HTMLSelectElement>('select, input')); return { scale: Number(s.value) || 1, suffix: x.value, format: f.value }; });
    return { artboards, items };
  }
}

export type { CheckerColors, CheckerSize };
