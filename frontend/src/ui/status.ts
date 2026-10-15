import { nodeLabel } from '../engine/doc';
import type { Engine, Pt } from '../engine';
import { getTool } from '../extensions/registry';
import { el, q, setDisabled, setText, setTitle, setValue } from './dom';
import { icon } from './icons';

const UNIT: Record<string, number> = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };

export class StatusBar {
  private readonly zoom: HTMLInputElement;
  private readonly boards: HTMLSelectElement;
  private readonly tool: HTMLElement;
  private readonly sel: HTMLElement;
  private readonly pos: HTMLElement;
  private readonly engineEl: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private frame = 0;
  private at: Pt | null = null;
  private boardsKey = '';

  constructor(root: HTMLElement, private readonly engine: Engine) {
    root.append(el(`<div class="cv-status-left">
      <label class="cv-status-zoom" title="Zoom (type a percentage and press Enter)"><input class="cv-status-zoom-input" type="text" inputmode="decimal" aria-label="Zoom"><span>%</span></label>
      <span class="cv-status-sep"></span>
      <button class="cv-status-btn cv-ab-prev" type="button" aria-label="Previous artboard" title="Previous artboard">${icon('chevronLeft', 12)}</button>
      <select class="cv-status-boards" aria-label="Artboard"></select>
      <button class="cv-status-btn cv-ab-next" type="button" aria-label="Next artboard" title="Next artboard">${icon('chevronRight', 12)}</button>
      <span class="cv-status-sep"></span>
      <span class="cv-status-tool"></span>
    </div>`), el('<div class="cv-status-right"><span class="cv-status-sel"></span><span class="cv-status-pos"></span><span class="cv-status-engine"></span></div>'));
    this.zoom = q<HTMLInputElement>(root, '.cv-status-zoom-input');
    this.boards = q<HTMLSelectElement>(root, '.cv-status-boards');
    this.tool = q(root, '.cv-status-tool');
    this.sel = q(root, '.cv-status-sel');
    this.pos = q(root, '.cv-status-pos');
    this.engineEl = q(root, '.cv-status-engine');
    this.prev = q<HTMLButtonElement>(root, '.cv-ab-prev');
    this.next = q<HTMLButtonElement>(root, '.cv-ab-next');
    this.zoom.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = parseFloat(this.zoom.value); if (Number.isFinite(v) && v > 0) engine.zoomTo(v / 100); this.zoom.blur(); }
      if (e.key === 'Escape') { this.zoom.blur(); this.queue(); }
    });
    this.zoom.addEventListener('blur', () => this.queue());
    this.boards.addEventListener('change', () => { const i = Number(this.boards.value); engine.setActiveArtboard(i); engine.fit(); });
    this.prev.addEventListener('click', () => this.step(-1));
    this.next.addEventListener('click', () => this.step(1));
    for (const k of ['viewport', 'tool', 'selection', 'projects', 'active', 'doc', 'options'] as const) engine.on(k, () => this.queue());
    this.queue();
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
    setText(this.tool, getTool(e.tool)?.label ?? '');
    const sel = e.selected();
    setText(this.sel, sel.length === 1 ? nodeLabel(sel[0]) : sel.length ? `${sel.length} objects` : '');
    this.syncPos();
  }
}
