import { allNodes, nodeLabel } from '../engine/doc';
import type { Engine, Pt } from '../engine';
import { getTool } from '../extensions/registry';
import { el, pendingClass, q, setClass, setDisabled, setText, setTitle, setValue, type Disposer } from './dom';
import { t } from '../i18n';
import { icon } from './icons';

const UNIT: Record<string, number> = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };
const INFO_KEY = 'formpath.statusInfo';
const INFO_KINDS = ['artboards', 'objects', 'mode', 'timing'] as const;
type InfoKind = (typeof INFO_KINDS)[number];

export class StatusBar {
  private readonly zoom: HTMLInputElement;
  private readonly boards: HTMLSelectElement;
  private readonly hint: HTMLElement;
  private readonly dims: HTMLElement;
  private readonly info: HTMLElement;
  private readonly busy: HTMLElement;
  private readonly sel: HTMLElement;
  private readonly pos: HTMLElement;
  private readonly engineEl: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private frame = 0;
  private at: Pt | null = null;
  private boardsKey = '';
  private hintSegs: string[] = [];
  private hintKey = '\u0000';
  private errText = '';
  private errTimer = 0;
  private infoKind: InfoKind = 'artboards';
  private busySince = 0;
  private lastMs = -1;
  private dismiss: Disposer | null = null;

  constructor(root: HTMLElement, private readonly engine: Engine) {
    root.append(
      el(`<div class="cv-st-tools" role="group" aria-label="History and zoom">
      <button class="cv-icon-btn cv-st-btn" type="button" data-cmd="undo">${icon('undo', 14)}</button>
      <button class="cv-icon-btn cv-st-btn" type="button" data-cmd="redo">${icon('redo', 14)}</button>
      <span class="cv-sep"></span>
      <button class="cv-icon-btn cv-st-btn" type="button" data-cmd="zoom-out">${icon('zoomOut', 14)}</button>
      <input class="cv-st-zoom" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" aria-label="Zoom percent" title="Zoom: type a percent and press Enter">
      <button class="cv-icon-btn cv-st-btn" type="button" data-cmd="zoom-in">${icon('zoomIn', 14)}</button>
      <button class="cv-icon-btn cv-st-btn" type="button" data-cmd="fit">${icon('fitView', 14)}</button>
    </div>`),
      el(`<div class="cv-st-boards">
      <button class="cv-status-btn cv-ab-prev" type="button" aria-label="Previous artboard" title="Previous artboard">${icon('chevronLeft', 12)}</button>
      <select class="cv-status-boards" aria-label="Artboard"></select>
      <button class="cv-status-btn cv-ab-next" type="button" aria-label="Next artboard" title="Next artboard">${icon('chevronRight', 12)}</button>
    </div>`),
      el('<span class="cv-st-dims"></span>'),
      el('<button class="cv-st-info" type="button"></button>'),
      el('<span class="cv-st-hint"></span>'),
      el('<span class="cv-st-sel"></span>'),
      el('<span class="cv-st-pos"></span>'),
      el('<span class="cv-st-engine"></span>'),
      el('<span class="cv-st-busy" role="status">Working</span>'));
    this.zoom = q<HTMLInputElement>(root, '.cv-st-zoom');
    this.boards = q<HTMLSelectElement>(root, '.cv-status-boards');
    this.hint = q(root, '.cv-st-hint');
    this.dims = q(root, '.cv-st-dims');
    this.info = q(root, '.cv-st-info');
    this.busy = q(root, '.cv-st-busy');
    this.sel = q(root, '.cv-st-sel');
    this.pos = q(root, '.cv-st-pos');
    this.engineEl = q(root, '.cv-st-engine');
    this.prev = q<HTMLButtonElement>(root, '.cv-ab-prev');
    this.next = q<HTMLButtonElement>(root, '.cv-ab-next');
    this.zoom.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = parseFloat(this.zoom.value.replace(',', '.')); if (Number.isFinite(v) && v > 0 && engine.current) engine.zoomTo(v / 100); this.zoom.blur(); }
      if (e.key === 'Escape') { this.zoom.blur(); this.queue(); }
    });
    this.zoom.addEventListener('focus', () => this.zoom.select());
    this.zoom.addEventListener('blur', () => this.queue());
    this.boards.addEventListener('change', () => { const i = Number(this.boards.value); engine.setActiveArtboard(i); engine.fit(); });
    this.prev.addEventListener('click', () => this.step(-1));
    this.next.addEventListener('click', () => this.step(1));
    try { const k = localStorage.getItem(INFO_KEY) as InfoKind | null; if (k && INFO_KINDS.includes(k)) this.infoKind = k; } catch { this.infoKind = 'artboards'; }
    this.info.addEventListener('click', (e) => {
      const n = INFO_KINDS.length;
      this.infoKind = INFO_KINDS[(INFO_KINDS.indexOf(this.infoKind) + (e.shiftKey ? n - 1 : 1)) % n];
      try { localStorage.setItem(INFO_KEY, this.infoKind); } catch { this.syncInfo(); }
      this.syncInfo();
    });
    new ResizeObserver(() => this.fitHint()).observe(this.hint);
    for (const k of ['viewport', 'tool', 'selection', 'projects', 'active', 'doc', 'options'] as const) engine.on(k, () => this.queue());
    engine.on('notice', (n) => { if (n.kind === 'error') this.flashError(n.text); });
    engine.on('busy', (on) => {
      if (on) { if (!this.dismiss) this.dismiss = pendingClass(this.busy); if (!this.busySince) this.busySince = performance.now(); }
      else { this.dismiss?.(); this.dismiss = null; if (this.busySince) { this.lastMs = performance.now() - this.busySince; this.busySince = 0; this.queue(); } }
    });
    this.queue();
  }

  private flashError(text: string): void {
    this.errText = text;
    this.syncHint();
    window.clearTimeout(this.errTimer);
    this.errTimer = window.setTimeout(() => { this.errText = ''; this.syncHint(); }, 6000);
  }

  private syncHint(): void {
    const tool = getTool(this.engine.tool), raw = tool ? tool.hint(this.engine) : '', key = this.errText || raw;
    if (key === this.hintKey) return;
    this.hintKey = key;
    setClass(this.hint, 'is-error', !!this.errText);
    if (this.errText) { this.hintSegs = []; setText(this.hint, this.errText); setTitle(this.hint, this.errText); return; }
    setTitle(this.hint, '');
    this.hintSegs = raw ? raw.split(' · ').map((s) => t(s)) : [];
    if (!this.hintSegs.length) setText(this.hint, '');
    this.fitHint();
  }

  private fitHint(): void {
    const segs = this.hintSegs;
    if (!segs.length || this.errText) return;
    let n = segs.length;
    setText(this.hint, segs.join(' · '));
    while (n > 1 && this.hint.scrollWidth > this.hint.clientWidth) { n--; setText(this.hint, segs.slice(0, n).join(' · ')); }
    setTitle(this.hint, n < segs.length || this.hint.scrollWidth > this.hint.clientWidth ? segs.join(' · ') : '');
  }

  private syncInfo(): void {
    const p = this.engine.current, kind = this.infoKind;
    let text = '', tip = '';
    if (kind === 'timing') {
      text = `${t('Timing')}: ${this.lastMs < 0 ? '-' : this.lastMs < 1000 ? `${Math.round(this.lastMs)} ms` : `${(this.lastMs / 1000).toFixed(1)} s`}`;
      tip = t('How long the last operation took');
    } else if (p && kind === 'artboards') {
      text = `${t('Artboards')}: ${p.doc.artboards.length}`;
      tip = t('Artboards in the document');
    } else if (p && kind === 'objects') {
      text = `${t('Objects')}: ${allNodes(p.doc).length}`;
      tip = t('Layers, groups and objects in the document');
    } else if (p && kind === 'mode') {
      text = `${p.doc.colorMode === 'cmyk' ? 'CMYK' : 'RGB'} · ${p.doc.units}`;
      tip = t('Color mode and document units');
    }
    setText(this.info, text);
    setTitle(this.info, `${tip}${tip ? '. ' : ''}${t('Click for the next readout, Shift+click for the previous.')}`);
  }

  private step(d: number): void {
    const p = this.engine.current;
    if (!p) return;
    const n = p.doc.artboards.length, i = (p.activeArtboard + d + n) % n;
    this.engine.setActiveArtboard(i);
    this.engine.fit();
  }

  setPointer(p: Pt | null): void { this.at = p; this.syncPos(); }

  setEngine(text: string, title = ''): void { setText(this.engineEl, text); setTitle(this.engineEl, title || text); }

  private queue(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); });
  }

  private syncPos(): void {
    const p = this.engine.current;
    if (!p || !this.at) { setText(this.pos, ''); return; }
    const ab = p.doc.artboards[p.activeArtboard] ?? { x: 0, y: 0 }, k = UNIT[p.doc.units] ?? 1;
    const f = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);
    setText(this.pos, `X ${f((this.at.x - ab.x) / k)}  Y ${f((this.at.y - ab.y) / k)} ${p.doc.units}`);
  }

  private sync(): void {
    const e = this.engine, p = e.current;
    if (document.activeElement !== this.zoom) setValue(this.zoom, p ? String(Math.round(p.viewport.zoom * 1000) / 10) : '');
    setDisabled(this.zoom, !p);
    const boards = p?.doc.artboards ?? [], key = boards.map((a) => a.name).join('\u0001');
    if (key !== this.boardsKey) {
      this.boardsKey = key;
      this.boards.textContent = '';
      boards.forEach((a, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = `${i + 1} ${a.name}`; this.boards.appendChild(o); });
    }
    if (p) setValue(this.boards, String(p.activeArtboard));
    setDisabled(this.boards, !p);
    setDisabled(this.prev, boards.length < 2);
    setDisabled(this.next, boards.length < 2);
    const ab = p?.doc.artboards[p.activeArtboard], k = p ? UNIT[p.doc.units] ?? 1 : 1, f = (v: number): string => String(Math.round((v / k) * 100) / 100);
    setText(this.dims, p && ab ? `${f(ab.w)} × ${f(ab.h)} ${p.doc.units}` : '');
    this.syncInfo();
    this.syncHint();
    const sel = e.selected();
    setText(this.sel, sel.length === 1 ? nodeLabel(sel[0]) : sel.length ? `${sel.length} objects` : '');
    this.syncPos();
  }
}
