import { api } from '../io/api';
import { Dialog } from './dialogs';
import { el, patchList, q, setClass, setDisabled, setText, setTitle, setValue } from './dom';
import { icon } from './icons';

const LAST = 'formpath.linkFolder';
interface Entry { key: string; name: string; path: string; dir: boolean; size?: number }
const kb = (n: number): string => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export class FilePathDialog extends Dialog {
  private readonly folder = el<HTMLInputElement>('<input class="cv-input cv-fpd-folder" type="text" spellcheck="false" autocomplete="off">');
  private readonly up = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="Enclosing folder" aria-label="Enclosing folder">${icon('chevronUp', 16)}</button>`);
  private readonly list = el('<div class="cv-fpd-list" role="listbox" aria-label="Files"></div>');
  private readonly picked = el<HTMLInputElement>('<input class="cv-input" type="text" spellcheck="false" autocomplete="off" placeholder="/absolute/path/to/image.png">');
  private readonly note = el('<p class="cv-note cv-fpd-note"></p>');
  private readonly ok: HTMLButtonElement;
  private resolve: ((v: string | null) => void) | null = null;
  private mode: 'file' | 'folder' = 'file';
  private kinds: string[] = [];
  private parent = '';
  private seq = 0;

  constructor() {
    super('Choose a File', 560);
    q<HTMLElement>(this.scrim, '.cv-dialog').classList.add('cv-fpd');
    const head = el('<div class="cv-fpd-head"></div>');
    head.append(this.folder, this.up);
    this.body.append(head, this.list, this.field('Path', this.picked), this.note);
    this.button('Cancel', '', () => this.close());
    this.ok = this.button('Choose', 'primary', () => this.finish());
    this.folder.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void this.load(this.folder.value); } });
    this.folder.addEventListener('change', () => void this.load(this.folder.value));
    this.up.addEventListener('click', () => { if (this.parent) void this.load(this.parent); });
    this.picked.addEventListener('input', () => this.syncOk());
    this.picked.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.finish(); } });
    this.list.addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-fpd-row');
      if (!r) return;
      if (r.dataset.dir === '1') { void this.load(r.dataset.path ?? ''); return; }
      setValue(this.picked, r.dataset.path ?? '');
      for (const x of Array.from(this.list.children)) setClass(x as HTMLElement, 'is-active', x === r);
      this.syncOk();
    });
    this.list.addEventListener('dblclick', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-fpd-row'); if (r && r.dataset.dir !== '1') { setValue(this.picked, r.dataset.path ?? ''); this.finish(); } });
    this.onClose = () => { this.resolve?.(null); this.resolve = null; };
  }

  choose(o: { title: string; mode: 'file' | 'folder'; kinds: string[]; start?: string; ok?: string; note?: string }): Promise<string | null> {
    this.resolve?.(null);
    this.mode = o.mode; this.kinds = o.kinds;
    this.setTitle(o.title);
    setText(this.ok, o.ok ?? (o.mode === 'folder' ? 'Use This Folder' : 'Choose'));
    (this.picked.closest('.cv-field') as HTMLElement).hidden = o.mode === 'folder';
    setValue(this.picked, '');
    setText(this.note, o.note ?? '');
    let start = o.start ?? '';
    try { start = start || localStorage.getItem(LAST) || ''; } catch { }
    void this.load(start || '~');
    this.open(this.folder);
    return new Promise((r) => { this.resolve = r; });
  }

  private syncOk(): void { setDisabled(this.ok, this.mode === 'file' ? !this.picked.value.trim() : !this.folder.value.trim()); }

  private async load(folder: string): Promise<void> {
    const my = ++this.seq;
    try {
      const r = await api.listFolder(folder.trim(), this.kinds, true);
      if (my !== this.seq) return;
      setValue(this.folder, r.folder);
      this.parent = r.parent ?? '';
      setDisabled(this.up, !this.parent);
      try { localStorage.setItem(LAST, r.folder); } catch { }
      const sep = r.folder.includes('\\') && !r.folder.includes('/') ? '\\' : '/';
      const rows: Entry[] = [
        ...(r.dirs ?? []).map((d) => ({ key: `d:${r.folder}${sep}${d}`, name: d, path: `${r.folder.replace(/[\\/]$/, '')}${sep}${d}`, dir: true })),
        ...r.files.map((f) => ({ key: `f:${f.path}`, name: f.name, path: f.path, dir: false, size: f.size })),
      ];
      patchList<Entry>(this.list, rows, {
        key: (x) => x.key,
        create: (x) => { const n = el(`<div class="cv-fpd-row" role="option">${icon(x.dir ? 'folder' : 'image', 14)}<span class="cv-fpd-name"></span><span class="cv-fpd-size"></span></div>`); n.dataset.path = x.path; n.dataset.dir = x.dir ? '1' : '0'; setText(q(n, '.cv-fpd-name'), x.name); setText(q(n, '.cv-fpd-size'), x.size !== undefined ? kb(x.size) : ''); setTitle(n, x.path); return n; },
        update: (n, x) => setClass(n, 'is-active', !x.dir && x.path === this.picked.value),
      });
      if (this.mode === 'folder') setText(this.note, `${r.files.length} image ${r.files.length === 1 ? 'file' : 'files'} in this folder.`);
      else if (!rows.length) setText(this.note, 'This folder has no images or subfolders.');
      this.syncOk();
    } catch (err) {
      if (my === this.seq) setText(this.note, err instanceof Error ? err.message : String(err));
    }
  }

  private finish(): void {
    const v = this.mode === 'file' ? this.picked.value.trim() : this.folder.value.trim();
    if (!v) return;
    const r = this.resolve;
    this.resolve = null;
    this.close();
    r?.(v);
  }
}
