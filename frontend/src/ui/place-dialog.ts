import { CROP_CHOICES, type PlaceOptions, type PlaceSpec } from '../io/place';
import { selectOf, row } from './app-dialogs';
import { Dialog } from './dialogs';
import { el, q, setClass, setDisabled, setHidden, setText } from './dom';

class PlaceDialog extends Dialog {
  private readonly grid = el('<div class="cv-place-pages" role="listbox" aria-label="Pages"></div>');
  private readonly crop = selectOf(CROP_CHOICES);
  private readonly mode = selectOf([['embed', 'Embed'], ['link', 'Link']]);
  private readonly layers = selectOf([['layers', 'Convert layers to objects'], ['flatten', 'Flatten to a single image']]);
  private readonly cropRow = row('Crop To', this.crop);
  private readonly modeRow = row('Place As', this.mode);
  private readonly layersRow = row('Layers', this.layers);
  private readonly count = el('<p class="cv-place-count"></p>');
  private readonly note = el('<p class="cv-note cv-place-note"></p>');
  private readonly okBtn: HTMLButtonElement;
  private resolve: ((v: PlaceOptions | null) => void) | null = null;
  private spec: PlaceSpec | null = null;
  private cells: HTMLButtonElement[] = [];
  private urls: string[] = [];
  private picked = 0;
  private token = 0;
  private queue: number[] = [];
  private busy = false;
  private watcher: IntersectionObserver | null = null;
  private settled = true;

  constructor() {
    super('Place', 640);
    const wrap = el('<div class="cv-place"></div>'), side = el('<div class="cv-place-side"></div>');
    side.append(this.count, this.cropRow, this.modeRow, this.layersRow, this.note);
    wrap.append(this.grid, side);
    this.body.appendChild(wrap);
    this.button('Cancel', 'ghost', () => this.close());
    this.okBtn = this.button('Place', 'primary', () => this.finish(true));
    this.grid.addEventListener('click', (e) => { const c = (e.target as HTMLElement).closest<HTMLElement>('.cv-place-page'); if (c) this.pick(Number(c.dataset.index)); });
    this.grid.addEventListener('dblclick', (e) => { if ((e.target as HTMLElement).closest('.cv-place-page')) this.finish(true); });
    this.grid.addEventListener('keydown', (e) => {
      const n = this.cells.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); this.pick(Math.min(n - 1, this.picked + 1), true); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); this.pick(Math.max(0, this.picked - 1), true); }
    });
    this.mode.addEventListener('change', () => this.sync());
    this.crop.addEventListener('change', () => this.sync());
    this.layers.addEventListener('change', () => this.sync());
    this.scrim.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); this.finish(true); } });
    this.onClose = () => { this.token++; this.watcher?.disconnect(); for (const u of this.urls) URL.revokeObjectURL(u); this.urls = []; if (!this.settled) { this.settled = true; const r = this.resolve; this.resolve = null; r?.(null); } };
  }

  ask(spec: PlaceSpec): Promise<PlaceOptions | null> {
    this.spec = spec;
    this.setTitle(spec.title);
    setText(this.okBtn, spec.ok);
    this.grid.textContent = '';
    setClass(this.grid, 'is-single', spec.pages.length === 1);
    this.cells = spec.pages.map((p, i) => {
      const c = el<HTMLButtonElement>('<button class="cv-place-page" type="button" role="option"><span class="cv-place-thumb"><img alt="" draggable="false"></span><span class="cv-place-name"></span></button>');
      c.dataset.index = String(i);
      setText(q(c, '.cv-place-name'), p.label);
      const k = (spec.pages.length === 1 ? 240 : 100) / Math.max(p.w, p.h, 1), img = q<HTMLImageElement>(c, 'img');
      img.style.width = `${Math.max(6, Math.round(p.w * k))}px`; img.style.height = `${Math.max(6, Math.round(p.h * k))}px`;
      this.grid.appendChild(c);
      return c;
    });
    const pdf = spec.kind === 'pdf';
    setHidden(this.cropRow, !pdf);
    setHidden(this.modeRow, !spec.canLink);
    setHidden(this.layersRow, !spec.layered);
    this.crop.value = 'bounding';
    this.mode.value = spec.canLink ? 'link' : 'embed';
    this.layers.value = 'layers';
    setHidden(this.grid, spec.pages.length < 2 && !pdf && spec.kind !== 'psd');
    this.picked = -1;
    this.pick(0);
    this.sync();
    this.token++;
    this.queue = [];
    this.watcher?.disconnect();
    this.watcher = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { const i = Number((e.target as HTMLElement).dataset.index); if (!this.queue.includes(i) && !this.cells[i].dataset.done) this.queue.push(i); } void this.drain(); }, { root: this.grid });
    this.settled = false;
    this.open(this.okBtn);
    for (const c of this.cells) this.watcher.observe(c);
    return new Promise((r) => { this.resolve = r; });
  }

  private pick(i: number, focus = false): void {
    if (i === this.picked || !this.cells[i]) return;
    this.picked = i;
    this.cells.forEach((c, k) => { setClass(c, 'is-on', k === i); c.setAttribute('aria-selected', String(k === i)); c.tabIndex = k === i ? 0 : -1; });
    if (focus) { this.cells[i].focus(); this.cells[i].scrollIntoView({ block: 'nearest' }); }
    this.sync();
  }

  private sync(): void {
    const s = this.spec;
    if (!s) return;
    const p = s.pages[this.picked], link = s.canLink && this.mode.value === 'link';
    setDisabled(this.layers, link);
    setText(this.count, s.pages.length > 1 ? `${p?.label ?? ''} of ${s.pages.length}` : p?.label ?? '');
    let text = '';
    if (s.kind === 'pdf') text = link ? 'Link keeps the page as a high-resolution picture that formpath draws again when the file changes.' : 'Embed turns the page into editable paths, type and images in a group.';
    else if (s.kind === 'psd') text = link ? 'A linked Photoshop file is placed as one flattened picture.' : this.layers.value === 'layers' ? 'Each pixel layer becomes an image, with its name, opacity and blend mode. Groups stay groups.' : 'The merged image is placed as a single picture.';
    else text = link ? 'The picture stays linked to its file.' : 'The picture is embedded in the document.';
    setText(this.note, `${s.note ? `${s.note} ` : ''}${text}${s.canLink || s.ok !== 'Place' ? '' : ` ${s.linkHint || 'File > Place Linked keeps it linked to its file.'}`}`);
  }

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const token = this.token;
    try {
      while (this.queue.length && token === this.token) {
        const i = this.queue.shift() as number, c = this.cells[i], spec = this.spec;
        if (!c || !spec || c.dataset.done) continue;
        c.dataset.done = '1';
        let blob: Blob | null = null;
        try { blob = await spec.pages[i].thumb(); } catch { blob = null; }
        if (token !== this.token || !blob) continue;
        const url = URL.createObjectURL(blob);
        this.urls.push(url);
        const img = q<HTMLImageElement>(c, 'img');
        img.src = url;
        setClass(img, 'is-loaded', true);
      }
    } finally { this.busy = false; }
  }

  private finish(ok: boolean): void {
    const s = this.spec;
    if (!ok || !s || this.settled) return;
    this.settled = true;
    const r = this.resolve;
    this.resolve = null;
    const link = s.canLink && this.mode.value === 'link';
    const out: PlaceOptions = { page: this.picked + 1, mode: link ? 'link' : 'embed' };
    if (s.kind === 'pdf') out.crop = this.crop.value as PlaceOptions['crop'];
    if (s.kind === 'psd') out.psd = link ? 'flatten' : (this.layers.value as 'layers' | 'flatten');
    this.close();
    r?.(out);
  }
}

let dialog: PlaceDialog | null = null;

export function askPlace(spec: PlaceSpec): Promise<PlaceOptions | null> {
  dialog ??= new PlaceDialog();
  return dialog.ask(spec);
}
