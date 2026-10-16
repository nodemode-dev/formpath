import type { Engine } from '../../engine';
import { el, q, setChecked, setClass, setDisabled, setText, setValue } from '../dom';
import { enhanceSelect } from '../dropdown';
import { icon } from '../icons';

export interface Ctl<T> { el: HTMLElement; set(v: T): void; enable(on: boolean): void }

export function numField(label: string, unit: string, change: (v: number) => void, o: { min?: number; max?: number; step?: number; title?: string; wide?: boolean } = {}): Ctl<number | null> {
  const n = el(`<label class="cv-props-field${o.wide ? ' is-wide' : ''}"><span class="cv-pf-label"></span><span class="cv-num"><input type="text" inputmode="decimal"><span class="cv-unit"></span></span></label>`);
  setText(q(n, '.cv-pf-label'), label);
  setText(q(n, '.cv-unit'), unit);
  if (o.title) n.title = o.title;
  const input = q<HTMLInputElement>(n, 'input');
  let last: number | null = null;
  const commit = (): void => {
    const raw = input.value.trim();
    let v: number;
    try { v = evalNumber(raw); } catch { input.value = last === null ? '' : fmtNum(last); return; }
    if (!Number.isFinite(v)) return;
    if (o.min !== undefined) v = Math.max(o.min, v);
    if (o.max !== undefined) v = Math.min(o.max, v);
    if (v !== last) change(v);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { commit(); input.select(); }
    else if (e.key === 'Escape') { input.value = last === null ? '' : fmtNum(last); input.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const d = (o.step ?? 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1); let v = (last ?? 0) + d; if (o.min !== undefined) v = Math.max(o.min, v); if (o.max !== undefined) v = Math.min(o.max, v); change(v); }
  });
  input.addEventListener('change', commit);
  return {
    el: n,
    set: (v) => { last = v; setValue(input, v === null ? '' : fmtNum(v)); if (v === null && document.activeElement !== input) input.placeholder = '–'; },
    enable: (on) => setDisabled(input, !on),
  };
}

export const fmtNum = (v: number): string => String(Math.round(v * 1000) / 1000);

function evalNumber(src: string): number {
  const s = src.replace(/\s+/g, '').replace(/[a-z%°]+$/i, '');
  let i = 0;
  const num = (): number => {
    if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') throw new Error('bad'); return v; }
    if (s[i] === '-') { i++; return -num(); }
    if (s[i] === '+') { i++; return num(); }
    const m = /^\d*\.?\d+(e[-+]?\d+)?/i.exec(s.slice(i));
    if (!m) throw new Error('bad');
    i += m[0].length;
    return Number(m[0]);
  };
  const term = (): number => { let v = num(); while (s[i] === '*' || s[i] === '/') { const op = s[i++], r = num(); v = op === '*' ? v * r : v / r; } return v; };
  const expr = (): number => { let v = term(); while (s[i] === '+' || s[i] === '-') { const op = s[i++], r = term(); v = op === '+' ? v + r : v - r; } return v; };
  const v = expr();
  if (i !== s.length) throw new Error('bad');
  return v;
}

export function slider(engine: Engine, label: string, min: number, max: number, change: (v: number) => void, o: { step?: number; unit?: string } = {}): Ctl<number> {
  const n = el(`<div class="cv-kit-slider"><span class="cv-pf-label"></span><input class="cv-slider" type="range" min="${min}" max="${max}" step="${o.step ?? 1}"><span class="cv-num"><input type="text" inputmode="decimal"><span class="cv-unit"></span></span></div>`);
  setText(q(n, '.cv-pf-label'), label);
  setText(q(n, '.cv-unit'), o.unit ?? '');
  const r = q<HTMLInputElement>(n, 'input[type="range"]'), t = q<HTMLInputElement>(n, 'input[type="text"]');
  r.addEventListener('pointerdown', () => engine.beginGesture());
  const end = (): void => engine.endGesture();
  r.addEventListener('pointerup', end);
  r.addEventListener('pointercancel', end);
  r.addEventListener('input', () => change(Number(r.value)));
  t.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') t.blur(); });
  t.addEventListener('change', () => { const v = parseFloat(t.value); if (!Number.isFinite(v)) { t.value = r.value; return; } const c = Math.min(max, Math.max(min, v)); r.value = String(c); t.value = fmtNum(c); change(c); });
  return { el: n, set: (v) => { const s = fmtNum(v); setValue(r, s); setValue(t, s); }, enable: (on) => { setDisabled(r, !on); setDisabled(t, !on); } };
}

export function seg(choices: ReadonlyArray<{ id: string; label: string; icon?: string }>, change: (id: string) => void, cls = ''): Ctl<string> {
  const n = el(`<div class="cv-seg ${cls}" role="group"></div>`);
  const bs = choices.map((c) => {
    const b = el<HTMLButtonElement>(`<button type="button" title="${c.label}" aria-label="${c.label}">${c.icon ? icon(c.icon, 16) : ''}</button>`);
    if (!c.icon) setText(b, c.label);
    b.addEventListener('click', () => change(c.id));
    n.appendChild(b);
    return { id: c.id, b };
  });
  return { el: n, set: (v) => { for (const x of bs) { setClass(x.b, 'is-on', x.id === v); x.b.setAttribute('aria-pressed', String(x.id === v)); } }, enable: (on) => { for (const x of bs) setDisabled(x.b, !on); } };
}

export function selectCtl(label: string, choices: ReadonlyArray<readonly [string, string]>, change: (id: string) => void): Ctl<string> & { setChoices(c: ReadonlyArray<readonly [string, string]>): void; allow(ok: (id: string) => boolean): void } {
  const n = el('<label class="cv-props-field is-wide"><span class="cv-pf-label"></span><select class="cv-select"></select></label>');
  setText(q(n, '.cv-pf-label'), label);
  const s = q<HTMLSelectElement>(n, 'select');
  let key = '';
  const fill = (c: ReadonlyArray<readonly [string, string]>): void => {
    const k = c.map((x) => x.join('\u0001')).join('\u0002');
    if (k === key) return;
    key = k;
    s.textContent = '';
    for (const [id, l] of c) { const o = document.createElement('option'); o.value = id; o.textContent = l; s.appendChild(o); }
  };
  fill(choices);
  s.addEventListener('change', () => change(s.value));
  enhanceSelect(s);
  if (!label) q(n, '.cv-pf-label').remove();
  const allow = (ok: (id: string) => boolean): void => { for (const o of Array.from(s.options)) { const off = !!o.value && !ok(o.value); if (o.disabled !== off) o.disabled = off; } };
  return { el: n, set: (v) => setValue(s, v), enable: (on) => setDisabled(s, !on), setChoices: fill, allow };
}

export function check(label: string, change: (v: boolean) => void): Ctl<boolean> {
  const n = el('<label class="cv-check"><input type="checkbox"><span></span></label>');
  setText(q(n, 'span'), label);
  const c = q<HTMLInputElement>(n, 'input');
  c.addEventListener('change', () => change(c.checked));
  return { el: n, set: (v) => setChecked(c, v), enable: (on) => setDisabled(c, !on) };
}

export function iconButton(name: string, label: string, run: (ev: MouseEvent) => void, size = 16): HTMLButtonElement {
  const b = el<HTMLButtonElement>(`<button class="cv-icon-btn cv-kit-btn" type="button" title="${label}" aria-label="${label}">${icon(name, size)}</button>`);
  b.addEventListener('click', run);
  return b;
}

export function section(title: string): HTMLElement { const h = el('<div class="cv-kit-section"></div>'); setText(h, title); return h; }

export function row(...kids: HTMLElement[]): HTMLElement { const r = el('<div class="cv-kit-row"></div>'); r.append(...kids); return r; }

export function page(cls: string): HTMLElement { return el(`<div class="cv-kit-page ${cls}"></div>`); }

export function empty(text: string): HTMLElement { const p = el('<p class="cv-props-none"></p>'); setText(p, text); return p; }
