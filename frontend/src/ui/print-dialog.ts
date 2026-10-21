import type { Project } from '../engine';
import { profileList, refreshProfiles } from '../engine/color-management';
import { platesOf } from '../engine/inks';
import { bleedFor, DEFAULT_MARKS, pageGeometry, type Bleed, type PdfMarks } from '../io/pdf-marks';
import { managed } from '../io/print';
import { DEFAULT_PRINT, MAX_SHEETS, PAPERS, scaleFor, sheetFor, tilesFor, type PaperId, type PrintSettings } from '../io/print-layout';
import { renderRegion } from '../io/raster';
import { numberInput, parseArtboardRange, row, selectOf } from './app-dialogs';
import { Dialog } from './dialogs';
import { el, q, setClass, setDisabled, setText } from './dom';

const SECTIONS = [['general', 'General'], ['marks', 'Marks and Bleed'], ['output', 'Output'], ['color', 'Color Management']] as const;
const PREVIEW_W = 220, PREVIEW_H = 300;

export class PrintDialog extends Dialog {
  private readonly nav = el('<div class="cv-print-nav" role="tablist" aria-label="Print sections"></div>');
  private readonly panes = el('<div class="cv-print-panes"></div>');
  private readonly preview = el<HTMLCanvasElement>('<canvas class="cv-print-canvas" aria-label="Page preview"></canvas>');
  private readonly caption = el('<p class="cv-print-caption" aria-live="polite"></p>');
  private readonly copies = numberInput(1, 99);
  private readonly collate = el<HTMLInputElement>('<input type="checkbox">');
  private readonly range = el<HTMLInputElement>('<input class="cv-input" type="text" placeholder="All, Current or 1-3,5">');
  private readonly media = selectOf([...PAPERS.map((p) => [p[0], p[1]] as const), ['custom', 'Custom']]);
  private readonly customW = numberInput(36, 14400, 1);
  private readonly customH = numberInput(36, 14400, 1);
  private readonly orientation = selectOf([['auto', 'Automatic'], ['portrait', 'Portrait'], ['landscape', 'Landscape']]);
  private readonly placement = selectOf([['center', 'Center'], ['topleft', 'Top left']]);
  private readonly scaling = selectOf([['fit', 'Fit to page'], ['percent', 'Custom scale'], ['tile', 'Tile pages']]);
  private readonly percent = numberInput(1, 1000, 1);
  private readonly overlap = numberInput(0, 360, 1);
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
  private readonly output = selectOf([['composite', 'Composite'], ['separations', 'Separations']]);
  private readonly plateDpi = selectOf([['150', '150 ppi'], ['300', '300 ppi'], ['600', '600 ppi']]);
  private readonly plate = selectOf([['', 'All plates']]);
  private readonly handling = selectOf([['printer', 'Let the printer determine colors'], ['formpath', 'Let formpath determine colors']]);
  private readonly profile = selectOf([['', 'Choose a profile']]);
  private readonly intent = selectOf([['0', 'Perceptual'], ['1', 'Relative Colorimetric'], ['2', 'Saturation'], ['3', 'Absolute Colorimetric']]);
  private readonly inkBtn = el<HTMLButtonElement>('<button class="cv-btn cv-btn-ghost" type="button">Ink Manager...</button>');
  private readonly printBtn: HTMLButtonElement;
  private readonly panesList: HTMLElement[] = [];
  private readonly navBtns: HTMLButtonElement[] = [];
  private readonly thumbs = new Map<string, HTMLCanvasElement>();
  private shown: { img: HTMLCanvasElement; l: number; r: number; t: number; b: number } | null = null;
  private plateKeys = '';
  private project: Project | null = null;
  private current = 0;
  private frame = 0;
  private last: PrintSettings = { ...DEFAULT_PRINT, marks: { ...DEFAULT_MARKS }, custom: { ...DEFAULT_PRINT.custom }, range: [0] };
  private resolve: ((s: PrintSettings | null) => void) | null = null;

  constructor(private readonly openInks: (after: () => void) => void = () => undefined) {
    super('Print', 780);
    q<HTMLElement>(this.scrim, '.cv-dialog').classList.add('cv-print-dialog');
    this.range.title = 'All, Current, or artboard numbers such as 1-3,5';
    this.copies.title = 'The printer itself is chosen in the system print dialog that opens next';
    const pane = (id: string, rows: HTMLElement[]): void => {
      const p = el(`<div class="cv-print-pane" role="tabpanel" data-pane="${id}"></div>`);
      p.append(...rows);
      this.panes.append(p);
      this.panesList.push(p);
    };
    const pair = (label: string, a: HTMLElement, b: HTMLElement): HTMLElement => { const r = row(label, el('<span class="cv-pair"></span>')); r.lastElementChild?.append(a, b); return r; };
    for (const [i, t] of [[this.bleedTop, 'Top'], [this.bleedBottom, 'Bottom'], [this.bleedLeft, 'Left'], [this.bleedRight, 'Right']] as const) { i.setAttribute('aria-label', t); i.title = t; }
    this.customW.setAttribute('aria-label', 'Width'); this.customH.setAttribute('aria-label', 'Height');
    pane('general', [
      row('Printer', el('<span class="cv-print-static">Chosen in the system print dialog</span>')),
      row('Copies', this.copies), row('Collate', this.collate), row('Artboards', this.range),
      row('Paper', this.media), pair('Width, Height (pt)', this.customW, this.customH), row('Orientation', this.orientation),
      row('Placement', this.placement), row('Scaling', this.scaling), row('Scale (%)', this.percent), row('Tile overlap (pt)', this.overlap),
    ]);
    pane('marks', [
      row('Trim Marks', this.markTrim), row('Registration Marks', this.markReg), row('Color Bars', this.markBars), row('Page Information', this.markInfo),
      row('Offset (pt)', this.markOffset), row('Weight (pt)', this.markWeight), row('Bleed', this.bleedMode),
      pair('Top, Bottom', this.bleedTop, this.bleedBottom), pair('Left, Right', this.bleedLeft, this.bleedRight),
    ]);
    pane('output', [
      row('Output', this.output), row('Plate resolution', this.plateDpi), row('Preview plate', this.plate), row('Inks', this.inkBtn),
      el('<p class="cv-note cv-print-note">Composite prints the artwork in colour. Separations print one page per ink as vector art, with blank plates left out. Raster images and effects are printed as gray pictures on each plate.</p>'),
    ]);
    this.inkBtn.addEventListener('click', () => this.openInks(() => this.update()));
    pane('color', [
      row('Color handling', this.handling), row('Printer profile', this.profile), row('Rendering intent', this.intent),
      el('<p class="cv-note cv-print-note">With formpath in charge, colours are converted to the profile you choose and the printer driver must not convert them again.</p>'),
    ]);
    SECTIONS.forEach(([id, label], i) => {
      const b = el<HTMLButtonElement>('<button class="cv-print-tab" type="button" role="tab"></button>');
      b.textContent = label; b.dataset.pane = id;
      b.addEventListener('click', () => this.show(i));
      this.nav.append(b);
      this.navBtns.push(b);
    });
    const side = el('<div class="cv-print-side"></div>');
    side.append(this.preview, this.caption);
    const shell = el('<div class="cv-print"></div>');
    shell.append(this.nav, this.panes, side);
    this.body.append(shell);
    this.button('Cancel', 'ghost', () => this.close());
    this.printBtn = this.button('Print', 'primary', () => this.accept());
    const touch = (): void => this.update();
    for (const c of [this.copies, this.collate, this.range, this.media, this.customW, this.customH, this.orientation, this.placement, this.scaling, this.percent, this.overlap, this.markTrim, this.markReg, this.markBars, this.markInfo, this.markOffset, this.markWeight, this.bleedMode, this.bleedTop, this.bleedBottom, this.bleedLeft, this.bleedRight, this.output, this.plateDpi, this.plate, this.handling, this.profile, this.intent]) {
      c.addEventListener('input', touch);
      c.addEventListener('change', touch);
    }
    this.nav.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      this.show((this.current + (e.key === 'ArrowDown' ? 1 : SECTIONS.length - 1)) % SECTIONS.length);
      this.navBtns[this.current].focus();
    });
    this.onClose = () => { const r = this.resolve; this.resolve = null; this.project = null; this.thumbs.clear(); r?.(null); };
    this.show(0);
  }

  ask(p: Project): Promise<PrintSettings | null> {
    this.project = p;
    this.thumbs.clear();
    this.shown = null;
    this.plateKeys = '';
    this.fill(this.last, p);
    this.range.value = this.last.range.length === p.doc.artboards.length && p.doc.artboards.length > 1 ? 'All' : 'Current';
    this.fillProfiles();
    void refreshProfiles().then(() => { this.fillProfiles(); this.update(); });
    this.show(0);
    this.update();
    return new Promise((res) => { this.resolve = res; this.open(this.range); });
  }

  private show(i: number): void {
    this.current = i;
    this.panesList.forEach((p, k) => { setClass(p, 'is-on', k === i); p.setAttribute('aria-hidden', String(k !== i)); });
    this.navBtns.forEach((b, k) => { setClass(b, 'is-on', k === i); b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
  }

  private fillProfiles(): void {
    const keep = this.profile.value || this.last.profile, list = profileList();
    this.profile.replaceChildren();
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = list.length ? 'Choose a profile' : 'No profiles available';
    this.profile.append(blank);
    for (const p of list) { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.name} (${p.space})`; this.profile.append(o); }
    this.profile.value = list.some((p) => p.id === keep) ? keep : '';
  }

  private fill(s: PrintSettings, p: Project): void {
    this.copies.value = String(s.copies); this.collate.checked = s.collate;
    this.media.value = s.media; this.customW.value = String(Math.round(s.custom.w)); this.customH.value = String(Math.round(s.custom.h));
    this.orientation.value = s.orientation; this.placement.value = s.placement; this.scaling.value = s.scaling; this.percent.value = String(s.percent); this.overlap.value = String(s.overlap);
    const m = s.marks;
    this.markTrim.checked = m.trim; this.markReg.checked = m.registration; this.markBars.checked = m.colorBars; this.markInfo.checked = m.pageInfo;
    this.markOffset.value = String(m.offset); this.markWeight.value = String(m.weight); this.bleedMode.value = m.bleed;
    const c = m.custom ?? p.doc.bleed ?? { t: 0, b: 0, l: 0, r: 0 };
    this.bleedTop.value = String(c.t); this.bleedBottom.value = String(c.b); this.bleedLeft.value = String(c.l); this.bleedRight.value = String(c.r);
    this.output.value = s.output; this.plateDpi.value = String(s.plateDpi); this.handling.value = s.colors; this.intent.value = String(s.intent);
    this.profile.value = s.profile;
  }

  private marks(): PdfMarks {
    const num = (i: HTMLInputElement): number => Math.max(0, Number(i.value) || 0);
    return {
      trim: this.markTrim.checked, registration: this.markReg.checked, colorBars: this.markBars.checked, pageInfo: this.markInfo.checked,
      offset: Math.max(0, Number(this.markOffset.value) || 0), weight: Math.max(0.1, Number(this.markWeight.value) || DEFAULT_MARKS.weight),
      bleed: this.bleedMode.value as PdfMarks['bleed'], custom: { t: num(this.bleedTop), b: num(this.bleedBottom), l: num(this.bleedLeft), r: num(this.bleedRight) },
    };
  }

  private value(): PrintSettings | null {
    const p = this.project;
    if (!p) return null;
    const list = parseArtboardRange(this.range.value, p.doc.artboards.length, p.activeArtboard);
    if (!list) return null;
    return {
      copies: Math.max(1, Math.min(99, Math.round(Number(this.copies.value) || 1))), collate: this.collate.checked, range: list,
      media: this.media.value as PaperId, custom: { w: Number(this.customW.value) || 612, h: Number(this.customH.value) || 792 },
      orientation: this.orientation.value as PrintSettings['orientation'], scaling: this.scaling.value as PrintSettings['scaling'],
      percent: Math.max(1, Math.min(1000, Number(this.percent.value) || 100)), overlap: Math.max(0, Number(this.overlap.value) || 0),
      placement: this.placement.value as PrintSettings['placement'], marks: this.marks(), output: this.output.value as PrintSettings['output'],
      plateDpi: Number(this.plateDpi.value) || 300, colors: this.handling.value as PrintSettings['colors'], profile: this.profile.value, intent: (Number(this.intent.value) || 0) as PrintSettings['intent'],
    };
  }

  private geometry(s: PrintSettings): { w: number; h: number } | null {
    const p = this.project;
    const a = p?.doc.artboards[s.range[0]];
    if (!p || !a) return null;
    const g = pageGeometry(a.w, a.h, bleedFor(p.doc, s.marks), s.marks);
    return { w: g.width, h: g.height };
  }

  private update(): void {
    const p = this.project;
    if (!p) return;
    const ok = !!parseArtboardRange(this.range.value, p.doc.artboards.length, p.activeArtboard);
    setClass(this.range, 'is-invalid', !ok);
    setDisabled(this.customW, this.media.value !== 'custom'); setDisabled(this.customH, this.media.value !== 'custom');
    setDisabled(this.percent, this.scaling.value === 'fit'); setDisabled(this.overlap, this.scaling.value !== 'tile');
    const bleedOn = this.bleedMode.value === 'custom';
    for (const b of [this.bleedTop, this.bleedBottom, this.bleedLeft, this.bleedRight]) setDisabled(b, !bleedOn);
    const sep = this.output.value === 'separations';
    setDisabled(this.plateDpi, !sep);
    const plates = platesOf(p.doc, true), keys = plates.map((x) => x.value).join('|');
    if (keys !== this.plateKeys) {
      const keep = this.plate.value;
      this.plateKeys = keys;
      this.plate.replaceChildren(...[['', 'All plates'], ...plates.map((x) => [x.value, x.label])].map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; }));
      this.plate.value = plates.some((x) => x.value === keep) ? keep : '';
    }
    setDisabled(this.plate, !sep);
    const mine = this.handling.value === 'formpath';
    setDisabled(this.profile, !mine || sep); setDisabled(this.intent, !mine || sep);
    setDisabled(this.handling, sep);
    const s = this.value();
    let msg = 'Choose which artboards to print.', bad = !s;
    if (s) {
      const geo = this.geometry(s);
      if (geo) {
        const sheet = sheetFor(s, geo.w, geo.h), tiles = tilesFor(s, sheet, geo.w, geo.h).length, boards = s.range.length, plates = sep ? Math.max(1, platesOf(p.doc, true).length) : 1;
        const pages = tiles * boards * s.copies * (sep ? plates : 1);
        const paper = s.media === 'custom' ? 'Custom' : (PAPERS.find((x) => x[0] === s.media)?.[1].split(' (')[0] ?? '');
        const pct = Math.round(scaleFor(s, sheet, geo.w, geo.h) * 1000) / 10;
        bad = tiles > MAX_SHEETS || (mine && !sep && !s.profile);
        msg = tiles > MAX_SHEETS ? `This needs ${tiles} sheets, more than the ${MAX_SHEETS} allowed. Choose bigger paper or a smaller scale.`
          : mine && !sep && !s.profile ? 'Choose a printer profile, or let the printer determine colors.'
          : `${tiles} sheet${tiles === 1 ? '' : 's'} of ${paper}, ${sheet.w > sheet.h ? 'landscape' : 'portrait'}, at ${pct}%.${sep ? ' Separations print one page per ink.' : ''}${pages > tiles && !sep ? ` ${pages} pages in all.` : ''}`;
      }
    }
    setClass(this.caption, 'is-bad', bad);
    setText(this.caption, msg);
    setDisabled(this.printBtn, bad);
    this.draw();
  }

  private thumb(s: PrintSettings, bleed: Bleed): { img: HTMLCanvasElement; l: number; r: number; t: number; b: number } | null {
    const p = this.project, i = s.range[0], a = p?.doc.artboards[i];
    if (!p || !a) return null;
    const sep = s.output === 'separations' ? platesOf(p.doc, true).find((x) => x.value === this.plate.value)?.value ?? null : null;
    const prof = s.output === 'composite' && s.colors === 'formpath' && s.profile ? `${s.profile}:${s.intent}` : '';
    const key = [i, bleed.t, bleed.b, bleed.l, bleed.r, sep ?? '', prof].join('|');
    const hit = this.thumbs.get(key);
    if (hit) return hit.width > 1 ? { img: hit, l: bleed.l, r: bleed.r, t: bleed.t, b: bleed.b } : this.shown;
    const hold = document.createElement('canvas');
    hold.width = 1; hold.height = 1;
    this.thumbs.set(key, hold);
    const region = { x: a.x - bleed.l, y: a.y - bleed.t, w: a.w + bleed.l + bleed.r, h: a.h + bleed.t + bleed.b };
    void (async () => {
      let src = p;
      if (prof) { try { src = (await managed(p, s)).project; } catch { src = p; } }
      const c = await renderRegion(src, { region, scale: Math.min(1, 320 / Math.max(region.w, region.h)), transparent: false, bg: a.bg ?? null, separation: sep });
      if (this.project !== p) return;
      this.thumbs.set(key, c);
      this.draw();
    })().catch(() => undefined);
    return this.shown;
  }

  private draw(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); });
  }

  private paint(): void {
    const s = this.value(), p = this.project, cv = this.preview;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(PREVIEW_W * dpr)) { cv.width = Math.round(PREVIEW_W * dpr); cv.height = Math.round(PREVIEW_H * dpr); }
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    const geo = s ? this.geometry(s) : null, a = s && p ? p.doc.artboards[s.range[0]] : null;
    if (!s || !p || !geo || !a) return;
    const css = getComputedStyle(this.scrim), tok = (n: string, d: string): string => css.getPropertyValue(n).trim() || d;
    const sheet = sheetFor(s, geo.w, geo.h), tiles = tilesFor(s, sheet, geo.w, geo.h), k = tiles[0].k;
    if (tiles.length > MAX_SHEETS) return;
    const cw = geo.w * k, ch = geo.h * k;
    const x0 = Math.min(0, ...tiles.map((t) => -t.tx)), x1 = Math.max(cw, ...tiles.map((t) => -t.tx + sheet.w)), y0 = Math.min(0, ...tiles.map((t) => -t.ty)), y1 = Math.max(ch, ...tiles.map((t) => -t.ty + sheet.h));
    const pad = 8, f = Math.min((PREVIEW_W - pad * 2) / (x1 - x0), (PREVIEW_H - pad * 2) / (y1 - y0));
    const ox = (PREVIEW_W - (x1 - x0) * f) / 2, oy = (PREVIEW_H - (y1 - y0) * f) / 2;
    const X = (x: number): number => ox + (x - x0) * f, Y = (y: number): number => PREVIEW_H - oy - (y - y0) * f;
    const edge = tok('--line-3', '#888');
    g.lineWidth = 1;
    tiles.forEach((t, n) => {
      const sx = -t.tx, sy = -t.ty;
      g.fillStyle = '#ffffff'; g.globalAlpha = tiles.length > 1 ? 0.55 : 1;
      g.fillRect(X(sx), Y(sy + sheet.h), sheet.w * f, sheet.h * f);
      g.globalAlpha = 1; g.strokeStyle = edge; g.setLineDash(tiles.length > 1 ? [3, 3] : []);
      g.strokeRect(X(sx) + 0.5, Y(sy + sheet.h) + 0.5, sheet.w * f, sheet.h * f);
      if (tiles.length > 1) { g.fillStyle = tok('--text-muted', '#777'); g.font = '10px system-ui, sans-serif'; g.fillText(String(n + 1), X(sx) + 4, Y(sy + sheet.h) + 12); }
    });
    g.setLineDash([]);
    const bleed = bleedFor(p.doc, s.marks), pg = pageGeometry(a.w, a.h, bleed, s.marks);
    const ax = X(pg.ml * k), ay = Y((pg.mb + a.h) * k), aw = a.w * k * f, ah = a.h * k * f;
    g.strokeStyle = tok('--accent-color', '#f97316'); g.setLineDash([]);
    g.strokeRect(X(0) + 0.5, Y(ch) + 0.5, cw * f, ch * f);
    const img = this.thumb(s, bleed);
    if (img) {
      this.shown = img;
      g.drawImage(img.img, ax - img.l * k * f, ay - img.t * k * f, aw + (img.l + img.r) * k * f, ah + (img.t + img.b) * k * f);
    } else { g.fillStyle = tok('--surface-2', '#ddd'); g.fillRect(ax, ay, aw, ah); }
    const m = s.marks, px = (x: number): number => X(x * k), py = (y: number): number => Y(y * k);
    const gx0 = pg.ml, gy0 = pg.mb, gx1 = pg.ml + a.w, gy1 = pg.mb + a.h, st = pg.start, L = 18;
    g.strokeStyle = '#000000'; g.fillStyle = '#000000'; g.lineWidth = Math.max(0.75, m.weight * k * f);
    const seg = (x1: number, y1: number, x2: number, y2: number): void => { g.beginPath(); g.moveTo(px(x1), py(y1)); g.lineTo(px(x2), py(y2)); g.stroke(); };
    if (m.trim) {
      for (const [x, sx, side] of [[gx0, -1, st.l], [gx1, 1, st.r]] as const) for (const [y, sy, vs] of [[gy0, -1, st.b], [gy1, 1, st.t]] as const) {
        seg(x + sx * side, y, x + sx * (side + L), y);
        seg(x, y + sy * vs, x, y + sy * (vs + L));
      }
    }
    if (m.registration) {
      const r = 4.5, cross = 8;
      const target = (cx: number, cy: number): void => { g.beginPath(); g.arc(px(cx), py(cy), r * k * f, 0, Math.PI * 2); g.stroke(); seg(cx - cross, cy, cx + cross, cy); seg(cx, cy - cross, cx, cy + cross); };
      const mx = (gx0 + gx1) / 2, my = (gy0 + gy1) / 2;
      target(mx, gy0 - st.b - L / 2); target(mx, gy1 + st.t + L / 2); target(gx0 - st.l - L / 2, my); target(gx1 + st.r + L / 2, my);
    }
    if (m.colorBars) {
      const sz = 9, y = gy0 - st.b - sz, room = Math.max(0, Math.floor(((gx1 - gx0) / 2 - 16) / sz));
      ['#00aeef', '#ec008c', '#fff200', '#000000', '#ed1c24', '#00a651', '#2e3192', '#80d7f7', '#f49ac2', '#fff799', '#808080', '#231f20'].slice(0, room).forEach((c, n) => { g.fillStyle = c; g.fillRect(px(gx0 + 16 + n * sz), py(y + sz), sz * k * f, sz * k * f); });
    }
    if (m.pageInfo) { g.fillStyle = '#000000'; g.font = `${Math.max(4, 6 * k * f)}px system-ui, sans-serif`; g.fillText(`${a.name ?? 'Artboard'} | ${new Date().toLocaleDateString()}`, px(gx0 + 16), py(gy1 + st.t + 3)); }
    if (bleed.t + bleed.b + bleed.l + bleed.r > 0) {
      g.strokeStyle = tok('--accent-color', '#f97316'); g.setLineDash([2, 2]);
      g.strokeRect(X((pg.ml - bleed.l) * k) + 0.5, Y((pg.mb + a.h + bleed.t) * k) + 0.5, (a.w + bleed.l + bleed.r) * k * f, (a.h + bleed.t + bleed.b) * k * f);
      g.setLineDash([]);
    }
  }

  private accept(): void {
    const s = this.value();
    if (!s) { this.range.focus(); return; }
    this.last = s;
    const r = this.resolve;
    this.resolve = null;
    this.close();
    r?.(s);
  }
}
