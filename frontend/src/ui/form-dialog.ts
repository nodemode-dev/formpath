import { Dialog } from './dialogs';
import { el, q, setText } from './dom';
import { enhanceSelect } from './dropdown';

export type FieldValue = number | string | boolean;
export type Field =
  | { kind: 'number'; key: string; label: string; value: number; min?: number; max?: number; step?: number; unit?: string }
  | { kind: 'select'; key: string; label: string; value: string; choices: ReadonlyArray<readonly [string, string]> }
  | { kind: 'check'; key: string; label: string; value: boolean }
  | { kind: 'text'; key: string; label: string; value: string; placeholder?: string }
  | { kind: 'color'; key: string; label: string; value: string }
  | { kind: 'note'; text: string };

export interface FormOpts {
  ok?: string;
  preview?: (v: Record<string, FieldValue>) => void;
  unpreview?: () => void;
  cancel?: () => void;
  extra?: { label: string; run: (v: Record<string, FieldValue>) => void };
  width?: number;
}

export const formHooks: { supply: { values: Record<string, FieldValue>; modal: boolean } | null; onResult: ((title: string, v: Record<string, FieldValue> | null) => void) | null } = { supply: null, onResult: null };

function withValues(fields: Field[], values: Record<string, FieldValue>): Field[] {
  return fields.map((f) => {
    if (f.kind === 'note' || !(f.key in values)) return f;
    const v = values[f.key];
    if (f.kind === 'number') return typeof v === 'number' && Number.isFinite(v) ? { ...f, value: v } : f;
    if (f.kind === 'check') return { ...f, value: !!v };
    if (f.kind === 'select') return f.choices.some((c) => c[0] === String(v)) ? { ...f, value: String(v) } : f;
    return { ...f, value: String(v) };
  });
}
const defaults = (fields: Field[]): Record<string, FieldValue> => Object.fromEntries(fields.flatMap((f) => (f.kind === 'note' ? [] : [[f.key, f.value]])));

export class FormDialog extends Dialog {
  private resolve: ((v: Record<string, FieldValue> | null) => void) | null = null;
  private title = '';
  private readers: Array<() => [string, FieldValue]> = [];
  private disposers: Array<() => void> = [];
  private opts: FormOpts = {};
  private readonly okBtn: HTMLButtonElement;
  private readonly extraBtn: HTMLButtonElement;
  private readonly previewBox: HTMLInputElement;
  private readonly previewRow: HTMLElement;
  private settled = false;

  constructor() {
    super('', 380);
    this.extraBtn = this.button('', 'ghost', () => { const v = this.values(); this.opts.extra?.run(v); this.finish(v); });
    this.button('Cancel', '', () => this.close());
    this.okBtn = this.button('OK', 'primary', () => this.finish(this.values()));
    this.previewRow = el('<label class="cv-form-preview"><input type="checkbox" checked><span>Preview</span></label>');
    this.previewBox = q<HTMLInputElement>(this.previewRow, 'input');
    this.foot.prepend(this.previewRow);
    this.previewBox.addEventListener('change', () => this.update());
    this.scrim.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); this.finish(this.values()); } });
    this.onClose = () => { if (!this.settled) { this.settled = true; this.opts.cancel?.(); this.resolve?.(null); this.resolve = null; formHooks.onResult?.(this.title, null); } };
  }

  private values(): Record<string, FieldValue> { return Object.fromEntries(this.readers.map((r) => r())); }

  private update(): void { if (this.opts.preview && this.previewBox.checked) this.opts.preview(this.values()); else if (this.opts.preview) this.opts.unpreview?.(); }

  private finish(v: Record<string, FieldValue>): void {
    if (this.settled) return;
    this.settled = true;
    const r = this.resolve;
    this.resolve = null;
    this.close();
    r?.(v);
    formHooks.onResult?.(this.title, v);
  }

  ask(title: string, given: Field[], opts: FormOpts = {}): Promise<Record<string, FieldValue> | null> {
    const sup = formHooks.supply;
    formHooks.supply = null;
    const fields = sup ? withValues(given, sup.values) : given;
    if (sup && !sup.modal) return Promise.resolve({ ...defaults(fields) });
    this.title = title;
    this.setTitle(title);
    this.opts = opts;
    this.settled = false;
    this.readers = [];
    for (const d of this.disposers.splice(0)) d();
    this.body.textContent = '';
    (this.scrim.querySelector('.cv-dialog') as HTMLElement).style.setProperty('--cv-dialog-w', `${opts.width ?? 380}px`);
    for (const f of fields) {
      if (f.kind === 'note') { const p = el('<p class="cv-note"></p>'); setText(p, f.text); this.body.appendChild(p); continue; }
      if (f.kind === 'number') {
        const box = el(`<span class="cv-num"><input type="number" step="${f.step ?? 'any'}"${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''}><span class="cv-unit"></span></span>`);
        const input = q<HTMLInputElement>(box, 'input');
        input.value = String(Math.round(f.value * 1000) / 1000);
        setText(q(box, '.cv-unit'), f.unit ?? '');
        input.addEventListener('input', () => this.update());
        this.field(f.label, box);
        this.readers.push(() => { let v = parseFloat(input.value); if (!Number.isFinite(v)) v = f.value; if (f.min !== undefined) v = Math.max(f.min, v); if (f.max !== undefined) v = Math.min(f.max, v); return [f.key, v]; });
      } else if (f.kind === 'select') {
        const s = el<HTMLSelectElement>('<select class="cv-select"></select>');
        for (const [id, label] of f.choices) { const o = document.createElement('option'); o.value = id; o.textContent = label; s.appendChild(o); }
        s.value = f.value;
        s.addEventListener('change', () => this.update());
        this.field(f.label, s);
        this.disposers.push(enhanceSelect(s));
        this.readers.push(() => [f.key, s.value]);
      } else if (f.kind === 'check') {
        const row = el('<label class="cv-check"><input type="checkbox"><span></span></label>');
        const c = q<HTMLInputElement>(row, 'input');
        c.checked = f.value;
        setText(q(row, 'span'), f.label);
        c.addEventListener('change', () => this.update());
        this.body.appendChild(row);
        this.readers.push(() => [f.key, c.checked]);
      } else if (f.kind === 'text') {
        const t = el<HTMLInputElement>('<input class="cv-input" type="text">');
        t.value = f.value;
        if (f.placeholder) t.placeholder = f.placeholder;
        t.addEventListener('input', () => this.update());
        this.field(f.label, t);
        this.readers.push(() => [f.key, t.value]);
      } else {
        const box = el('<span class="cv-form-color"><input class="cv-color" type="color" aria-label="Pick a colour"><input class="cv-input" type="text" maxlength="7" spellcheck="false" aria-label="Hex colour"></span>');
        const c = q<HTMLInputElement>(box, 'input[type="color"]'), t = q<HTMLInputElement>(box, 'input[type="text"]');
        const norm = (s: string): string | null => { const m = /^#?([0-9a-f]{6})$/i.exec(s.trim()) ?? /^#?([0-9a-f]{3})$/i.exec(s.trim()); if (!m) return null; const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]; return `#${h.toLowerCase()}`; };
        c.value = norm(f.value) ?? '#000000';
        t.value = c.value.toUpperCase();
        c.addEventListener('input', () => { t.value = c.value.toUpperCase(); this.update(); });
        t.addEventListener('input', () => { const v = norm(t.value); if (v) { c.value = v; this.update(); } });
        t.addEventListener('blur', () => { t.value = c.value.toUpperCase(); });
        this.field(f.label, box);
        this.readers.push(() => [f.key, norm(t.value) ?? c.value]);
      }
    }
    this.okBtn.textContent = opts.ok ?? 'OK';
    this.extraBtn.textContent = opts.extra?.label ?? '';
    this.extraBtn.hidden = !opts.extra;
    this.previewRow.hidden = !opts.preview;
    this.previewBox.checked = true;
    return new Promise((res) => {
      this.resolve = res;
      this.open();
      this.update();
    });
  }
}

let shared: FormDialog | null = null;
export function askForm(title: string, fields: Field[], opts: FormOpts = {}): Promise<Record<string, FieldValue> | null> {
  shared ??= new FormDialog();
  return shared.ask(title, fields, opts);
}
