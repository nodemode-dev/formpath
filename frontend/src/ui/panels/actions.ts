import type { Engine, RecordedOp } from '../../engine';
import { newId } from '../../engine/doc';
import { reflow } from '../../engine/flow';
import { applyDataSetDoc, fileStem } from '../../engine/variables';
import { api } from '../../io/api';
import { projectBlob, renderAs, resolveImages } from '../../io/data-merge';
import { zipFiles } from '../../io/zip';
import type { Command, Commands } from '../commands';
import { anyDialogOpen, confirmAction, promptName } from '../dialogs';
import { el, patchList, q, setClass, setDisabled, setText, setTitle } from '../dom';
import { askForm, formHooks, type Field, type FieldValue } from '../form-dialog';
import { icon } from '../icons';

export type ActionStep =
  | { kind: 'command'; id: string; label: string; values?: Record<string, FieldValue>; dialog?: string; modal?: boolean; on: boolean }
  | { kind: 'op'; op: RecordedOp; label: string; on: boolean }
  | { kind: 'stop'; message: string; cont: boolean; on: boolean };
export interface Action { id: string; name: string; steps: ActionStep[] }
export interface ActionSet { id: string; name: string; actions: Action[] }
export interface ActionsHost { openFile(f: File): Promise<void>; deliver(blob: Blob, name: string): Promise<void>; notify(t: string, kind?: 'info' | 'error'): void; version: string; desktop(): boolean }
export interface BatchOpts { set: string; action: string; source: 'folder' | 'datasets'; folder?: string; kinds?: string[]; dest: 'folder' | 'zip'; out?: string; format: 'same' | 'fpth' | 'svg' | 'pdf' | 'png'; name?: string | null; stopOnError: boolean }
export interface BatchResult { done: number; failed: number; files: string[]; log: string; logPath: string | null; zip: boolean }

export const FORMAT = 'com.nodemode.formpth.actions';
const SKIP = /^(undo|redo|zoom|fit|actual|panel-|toggle-|screen-|help|about|settings|shortcuts|play-action|action-|recent-|open|new$|save|download-project|export|print|close-tab|copy-error-log|manage-plugins|assistant|reset-panels|graph-data|tool-)/;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const r2 = (v: number): number => Math.round(v * 100) / 100;

function predefined(): ActionSet {
  const c = (id: string, label: string, values?: Record<string, FieldValue>, dialog?: string): ActionStep => ({ kind: 'command', id, label, on: true, ...(values ? { values, dialog } : {}) });
  const a = (name: string, steps: ActionStep[]): Action => ({ id: newId('a'), name, steps });
  return {
    id: newId('as'), name: 'Default Actions', actions: [
      a('Outline and expand', [c('outline-stroke', 'Outline Stroke'), c('expand-appearance', 'Expand Appearance')]),
      a('Rotate 90° clockwise', [c('rotate-dialog', 'Rotate', { angle: -90 }, 'Rotate')]),
      a('Scale 50%', [c('scale-dialog', 'Scale', { h: 50, v: 50, uniform: true }, 'Scale')]),
      a('Reflect horizontally', [c('reflect-dialog', 'Reflect', { axis: 'vertical' }, 'Reflect')]),
      a('Move 10 pt right', [c('move-dialog', 'Move', { dx: 10, dy: 0 }, 'Move')]),
      a('Opacity 50%', [{ kind: 'op', op: { op: 'props', patch: { opacity: 0.5 } }, label: 'Opacity 50%', on: true }]),
      a('Soft drop shadow', [c('fx-stylize.drop_shadow', 'Drop Shadow', { mode: 'multiply', opacity: 50, x: 4, y: 4, blur: 6, color: '#000000' }, 'Drop Shadow')]),
      a('Simplify', [c('simplify', 'Simplify', { precision: 60 }, 'Simplify')]),
      a('Type to outlines', [c('select-text', 'All Text Objects'), c('create-outlines', 'Create Outlines')]),
      a('Grayscale', [c('colors-grayscale', 'Convert to Grayscale')]),
    ],
  };
}

export function opLabel(op: RecordedOp): string {
  switch (op.op) {
    case 'transform': { const m = op.m; if (Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[3] - 1) < 1e-9 && Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9) return `${op.copy ? 'Copy' : 'Move'}: ${r2(m[4])}, ${r2(m[5])} pt`; const ang = (-Math.atan2(m[1], m[0]) * 180) / Math.PI, sx = Math.hypot(m[0], m[1]), sy = (m[0] * m[3] - m[1] * m[2]) / (sx || 1); return `${op.name}${op.copy ? ' (copy)' : ''}: ${Math.abs(ang) > 0.01 ? `${r2(ang)}° ` : ''}${Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4 ? `${r2(sx * 100)}% × ${r2(sy * 100)}%` : ''}`.trim(); }
    case 'add': return `${op.name} (${op.nodes.length} object${op.nodes.length === 1 ? '' : 's'})`;
    case 'fill': return 'Set Fill';
    case 'stroke': return op.patch.width !== undefined && !op.patch.paint ? `Stroke Weight ${op.patch.width} pt` : 'Set Stroke';
    case 'props': return op.patch.opacity !== undefined ? `Opacity ${Math.round(Number(op.patch.opacity) * 100)}%` : op.patch.blend ? `Blending Mode ${String(op.patch.blend)}` : 'Object Options';
    case 'style': return `Graphic Style: ${op.id}`;
  }
}

const valueText = (v: Record<string, FieldValue>): string => Object.entries(v).slice(0, 4).map(([k, x]) => `${k} ${typeof x === 'number' ? r2(x) : String(x)}`).join(', ');
export const stepLabel = (s: ActionStep): string => (s.kind === 'stop' ? `Stop: ${s.message}` : s.kind === 'op' ? s.label : s.values ? `${s.label}: ${valueText(s.values)}` : s.label);

function validSet(x: unknown): ActionSet | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as { name?: unknown; actions?: unknown };
  if (typeof o.name !== 'string' || !Array.isArray(o.actions)) return null;
  const actions = o.actions.filter((a): a is Action => !!a && typeof a === 'object' && typeof (a as Action).name === 'string' && Array.isArray((a as Action).steps)).map((a) => ({
    id: typeof a.id === 'string' ? a.id : newId('a'), name: a.name,
    steps: a.steps.filter((s) => s && typeof s === 'object' && ['command', 'op', 'stop'].includes((s as ActionStep).kind)).map((s) => ({ ...s, on: (s as ActionStep).on !== false })) as ActionStep[],
  }));
  return { id: newId('as'), name: o.name.slice(0, 80), actions };
}

interface Row { key: string; level: 0 | 1 | 2; label: string; set: ActionSet; action?: Action; step?: number }

export class ActionsPanel {
  readonly body = el('<div class="cv-kit-page cv-actp"><div class="cv-actp-list" role="tree" aria-label="Actions"></div><div class="cv-actp-status"></div></div>');
  private readonly list: HTMLElement;
  private readonly status: HTMLElement;
  private sets: ActionSet[] = [];
  private picked: { set: string; action?: string; step?: number } | null = null;
  private recording: { set: string; action: string } | null = null;
  private pendingDialog: ActionStep | null = null;
  private inflight = 0;
  private playing = false;
  private offline = false;
  private readonly b: Record<string, HTMLButtonElement> = {};
  private readonly saveTimers = new Map<string, number>();
  private readonly file: HTMLInputElement;

  constructor(private readonly engine: Engine, private readonly commands: Commands, private readonly host: ActionsHost) {
    this.list = q(this.body, '.cv-actp-list');
    this.status = q(this.body, '.cv-actp-status');
    const foot = el('<div class="cv-panel-foot cv-actp-foot"></div>');
    const mk = (k: string, ic: string, label: string, run: () => void): void => { const x = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(ic, 16)}</button>`); x.addEventListener('click', run); foot.appendChild(x); this.b[k] = x; };
    mk('stop', 'actStop', 'Stop Playing or Recording', () => this.stopRecording());
    mk('record', 'actRecord', 'Begin Recording into the chosen action', () => this.startRecording());
    mk('play', 'play', 'Play the chosen action (from the chosen step)', () => void this.playPicked());
    mk('newset', 'actFolder', 'New Action Set', () => void this.newSet());
    mk('new', 'add', 'New Action', () => void this.newAction());
    mk('stopstep', 'warning', 'Insert Stop', () => void this.insertStop());
    mk('up', 'chevronUp', 'Move Up', () => this.move(-1));
    mk('down', 'chevronDown', 'Move Down', () => this.move(1));
    mk('dup', 'duplicate', 'Duplicate', () => this.duplicate());
    mk('delete', 'delete', 'Delete', () => void this.remove());
    mk('load', 'load', 'Load Actions (.fpaction)', () => this.file.click());
    mk('savefile', 'save', 'Save Actions to a file (.fpaction)', () => void this.saveToFile());
    mk('batch', 'actBatch', 'Batch...', () => void this.batchDialog());
    this.body.appendChild(foot);
    this.file = el<HTMLInputElement>('<input type="file" accept=".fpaction,.json,application/json" hidden>');
    this.body.appendChild(this.file);
    this.file.addEventListener('change', () => { const f = this.file.files?.[0]; this.file.value = ''; if (f) void f.text().then((t) => this.loadText(t, f.name)); });
    this.list.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, r = t.closest<HTMLElement>('.cv-actp-row');
      if (!r) return;
      const row = this.rowOf(r.dataset.key ?? '');
      if (!row) return;
      if (t.closest('.cv-actp-on')) { this.toggleOn(row); return; }
      if (t.closest('.cv-actp-modal')) { this.toggleModal(row); return; }
      this.picked = { set: row.set.id, action: row.action?.id, step: row.step };
      this.sync();
    });
    this.list.addEventListener('dblclick', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-actp-row'), row = r ? this.rowOf(r.dataset.key ?? '') : null; if (row) void this.editRow(row); });
    commands.onBefore = () => { engine.recordMute++; };
    commands.onAfter = () => { engine.recordMute = Math.max(0, engine.recordMute - 1); };
    commands.onRun = (c) => this.onCommand(c);
    formHooks.onResult = (title, v) => {
      const st = this.pendingDialog;
      this.pendingDialog = null;
      if (st && st.kind === 'command' && v) { st.values = { ...v }; st.dialog = title; this.touchRecording(); }
      setTimeout(() => { this.inflight = Math.max(0, this.inflight - 1); }, 0);
    };
    engine.recorder = (op) => {
      if (!this.recording || this.playing || this.inflight > 0 || anyDialogOpen()) return;
      this.append({ kind: 'op', op: JSON.parse(JSON.stringify(op)) as RecordedOp, label: opLabel(op), on: true });
    };
    void this.load();
  }

  private async load(): Promise<void> {
    let fromLib: ActionSet[] = [];
    try { const r = await api.actionSets(); fromLib = r.sets.map((x) => validSet(x.set)).filter((s): s is ActionSet => !!s); }
    catch { this.offline = true; }
    this.sets = fromLib;
    let legacy: Array<{ name: string; steps: Array<{ id: string; label: string }> }> = [];
    try { const v = JSON.parse(localStorage.getItem('formpth.actions') ?? '[]'); if (Array.isArray(v)) legacy = v; } catch { }
    if (legacy.length && !this.offline) {
      this.sets.push({ id: newId('as'), name: 'My Actions', actions: legacy.filter((a) => a && Array.isArray(a.steps)).map((a) => ({ id: newId('a'), name: String(a.name || 'Action'), steps: a.steps.map((s) => ({ kind: 'command' as const, id: String(s.id), label: String(s.label ?? s.id), on: true })) })) });
      try { localStorage.removeItem('formpth.actions'); } catch { }
    }
    if (!this.sets.length) this.sets.push(predefined());
    if (!this.offline) for (const s of this.sets) if (!fromLib.some((x) => x.name === s.name)) this.save(s);
    this.sync();
  }

  get list_(): ActionSet[] { return this.sets; }
  describe(): Array<{ set: string; actions: Array<{ name: string; steps: Array<Record<string, unknown>> }> }> {
    return this.sets.map((s) => ({ set: s.name, actions: s.actions.map((x) => ({ name: x.name, steps: x.steps.map((st) => ({ label: stepLabel(st), on: st.on, ...(st.kind === 'command' ? { command: st.id, ...(st.values ? { values: st.values, modal: !!st.modal } : {}) } : st.kind === 'op' ? { op: st.op.op } : { stop: st.message, continue: st.cont }) })) })) }));
  }

  private findAction(set: string | undefined, action: string): { set: ActionSet; action: Action } | null {
    for (const s of this.sets) { if (set && s.name !== set && s.id !== set) continue; const a = s.actions.find((x) => x.name === action || x.id === action); if (a) return { set: s, action: a }; }
    return null;
  }

  private save(s: ActionSet): void {
    if (this.offline) return;
    clearTimeout(this.saveTimers.get(s.id));
    this.saveTimers.set(s.id, window.setTimeout(() => { this.saveTimers.delete(s.id); void api.saveActionSet(s.name, this.fileOf(s)).catch((err) => { this.offline = true; this.host.notify(`Could not save the action set: ${err instanceof Error ? err.message : String(err)}`, 'error'); this.sync(); }); }, 250));
  }

  private fileOf(s: ActionSet): Record<string, unknown> { return { format: FORMAT, version: 1, name: s.name, actions: s.actions }; }

  private rows(): Row[] {
    const out: Row[] = [];
    for (const s of this.sets) {
      out.push({ key: s.id, level: 0, label: s.name, set: s });
      for (const a of s.actions) {
        out.push({ key: `${s.id}/${a.id}`, level: 1, label: a.name, set: s, action: a });
        if (this.picked?.action === a.id || this.recording?.action === a.id) a.steps.forEach((st, i) => out.push({ key: `${s.id}/${a.id}/${i}`, level: 2, label: stepLabel(st), set: s, action: a, step: i }));
      }
    }
    return out;
  }
  private rowOf(key: string): Row | null { return this.rows().find((r) => r.key === key) ?? null; }

  private sync(): void {
    patchList(this.list, this.rows(), {
      key: (r) => r.key,
      create: (r) => { const n = el(`<div class="cv-actp-row" role="treeitem"><button class="cv-actp-on" type="button" aria-label="Include">${icon('check', 12)}</button><button class="cv-actp-modal" type="button" aria-label="Show the dialog when played">${icon('menu', 12)}</button><span class="cv-actp-label"></span></div>`); this.fill(n, r); return n; },
      update: (n, r) => this.fill(n, r),
    });
    const p = this.picked, a = p?.action ? this.findAction(p.set, p.action) : null;
    setDisabled(this.b.record, !a || this.playing);
    setDisabled(this.b.play, !a || this.playing || !!this.recording);
    setDisabled(this.b.stop, !this.recording && !this.playing);
    setDisabled(this.b.stopstep, !a);
    setDisabled(this.b.up, !p || (!p.action && this.sets.length < 2));
    setDisabled(this.b.down, !p || (!p.action && this.sets.length < 2));
    setDisabled(this.b.dup, !p);
    setDisabled(this.b.delete, !p);
    setDisabled(this.b.savefile, !p);
    setClass(this.b.record, 'is-active', !!this.recording);
    setText(this.status, this.recording ? `Recording into ${this.findAction(this.recording.set, this.recording.action)?.action.name ?? ''}: menu commands with their dialog values, transforms, drawing and paint are added.` : this.playing ? 'Playing...' : this.offline ? 'The engine is offline: actions are kept for this session only.' : '');
  }

  private fill(n: HTMLElement, r: Row): void {
    const st = r.step !== undefined ? r.action?.steps[r.step] : undefined;
    setText(q(n, '.cv-actp-label'), r.label);
    setClass(n, 'is-set', r.level === 0);
    setClass(n, 'is-step', r.level === 2);
    const on = st ? st.on : r.action ? r.action.steps.every((x) => x.on) : r.set.actions.every((a) => a.steps.every((x) => x.on));
    setClass(q(n, '.cv-actp-on'), 'is-off', !on);
    const modal = st?.kind === 'command' && !!st.values;
    setClass(q(n, '.cv-actp-modal'), 'is-hidden', !modal);
    setClass(q(n, '.cv-actp-modal'), 'is-on', modal && st?.kind === 'command' && !!st.modal);
    const picked = !!this.picked && this.picked.set === r.set.id && this.picked.action === r.action?.id && this.picked.step === r.step;
    setClass(n, 'is-picked', picked);
    setClass(n, 'is-recording', r.level === 1 && this.recording?.action === r.action?.id);
    n.setAttribute('aria-selected', String(picked));
    setTitle(n, r.level === 0 ? `${r.set.actions.length} actions · double-click to rename` : r.level === 1 ? `${r.action?.steps.length ?? 0} steps · double-click to rename` : st?.kind === 'command' && st.values ? 'Double-click to edit the recorded values' : st?.kind === 'stop' ? 'Double-click to edit the message' : '');
  }

  private toggleOn(r: Row): void {
    const steps = r.step !== undefined && r.action ? [r.action.steps[r.step]] : r.action ? r.action.steps : r.set.actions.flatMap((a) => a.steps);
    const on = !steps.every((s) => s.on);
    for (const s of steps) s.on = on;
    this.save(r.set); this.sync();
  }

  private toggleModal(r: Row): void {
    const st = r.step !== undefined ? r.action?.steps[r.step] : undefined;
    if (st?.kind !== 'command' || !st.values) return;
    st.modal = !st.modal;
    this.save(r.set); this.sync();
  }

  private async editRow(r: Row): Promise<void> {
    if (r.level === 0) { const nm = await promptName('Action Set Options', r.set.name, 'Rename'); if (nm && nm !== r.set.name) { const old = r.set.name; r.set.name = nm.replace(/[\\/:*?"<>|]/g, '-'); if (!this.offline) void api.deleteActionSet(old).catch(() => undefined); this.save(r.set); this.sync(); } return; }
    if (r.level === 1 && r.action) { const nm = await promptName('Action Options', r.action.name, 'Rename'); if (nm) { r.action.name = nm; this.save(r.set); this.sync(); } return; }
    const st = r.step !== undefined ? r.action?.steps[r.step] : undefined;
    if (!st) return;
    if (st.kind === 'stop') { const v = await askForm('Record Stop', [{ kind: 'text', key: 'message', label: 'Message', value: st.message }, { kind: 'check', key: 'cont', label: 'Allow Continue', value: st.cont }]); if (v) { st.message = String(v.message); st.cont = !!v.cont; this.save(r.set); this.sync(); } return; }
    if (st.kind === 'command' && st.values) {
      const fields: Field[] = Object.entries(st.values).map(([k, x]) => (typeof x === 'number' ? { kind: 'number', key: k, label: k, value: x } : typeof x === 'boolean' ? { kind: 'check', key: k, label: k, value: x } : /^#[0-9a-f]{6}$/i.test(String(x)) ? { kind: 'color', key: k, label: k, value: String(x) } : { kind: 'text', key: k, label: k, value: String(x) }));
      const v = await askForm(`Edit ${st.label}`, [...fields, { kind: 'check', key: '__modal', label: 'Show the dialog when played', value: !!st.modal }]);
      if (v) { st.modal = !!v.__modal; delete v.__modal; st.values = v; this.save(r.set); this.sync(); }
      return;
    }
    if (st.kind === 'op' && st.op.op === 'transform') {
      const m = st.op.m;
      const v = await askForm(`Edit ${st.label}`, [{ kind: 'note', text: 'The transform is applied about the centre of whatever is selected when the action plays; e and f move it.' }, ...(['a', 'b', 'c', 'd', 'e', 'f'] as const).map((k, i) => ({ kind: 'number' as const, key: k, label: k, value: m[i] })), { kind: 'check', key: 'copy', label: 'Copy', value: st.op.copy }]);
      if (v) { const c = st.op.c, mm: [number, number, number, number, number, number] = [Number(v.a), Number(v.b), Number(v.c), Number(v.d), Number(v.e), Number(v.f)]; st.op = { ...st.op, m: mm, c, copy: !!v.copy }; st.label = opLabel(st.op); this.save(r.set); this.sync(); }
    }
  }

  private onCommand(c: Command): void {
    if (!this.recording || this.playing || SKIP.test(c.id)) return;
    const st: ActionStep = { kind: 'command', id: c.id, label: this.commands.label(c).replace(/\.\.\.$/, ''), on: true };
    this.append(st);
    if (anyDialogOpen()) { this.pendingDialog = st; this.inflight++; }
  }

  private append(st: ActionStep): void {
    const r = this.recording, f = r ? this.findAction(r.set, r.action) : null;
    if (!f) return;
    const at = this.picked?.action === f.action.id && this.picked.step !== undefined ? this.picked.step + 1 : f.action.steps.length;
    f.action.steps.splice(at, 0, st);
    this.picked = { set: f.set.id, action: f.action.id, step: at };
    this.save(f.set); this.sync();
  }
  private touchRecording(): void { const r = this.recording, f = r ? this.findAction(r.set, r.action) : null; if (f) { this.save(f.set); this.sync(); } }

  private startRecording(): void {
    const p = this.picked, f = p?.action ? this.findAction(p.set, p.action) : null;
    if (!f) return;
    this.recording = { set: f.set.id, action: f.action.id };
    this.sync();
    this.host.notify('Recording: menu commands (with their dialog values), transform drags, drawing and paint changes are added to the action.');
  }
  private stopRecording(): void { this.recording = null; this.pendingDialog = null; this.stopFlag = true; this.sync(); }

  private async newSet(): Promise<void> {
    const nm = await promptName('New Set', `Set ${this.sets.length + 1}`, 'OK');
    if (!nm) return;
    const s: ActionSet = { id: newId('as'), name: nm.replace(/[\\/:*?"<>|]/g, '-'), actions: [] };
    this.sets.push(s); this.picked = { set: s.id }; this.save(s); this.sync();
  }

  private async newAction(): Promise<void> {
    let s = this.sets.find((x) => x.id === this.picked?.set) ?? this.sets[this.sets.length - 1];
    const v = await askForm('New Action', [{ kind: 'text', key: 'name', label: 'Name', value: `Action ${(s?.actions.length ?? 0) + 1}` }, { kind: 'select', key: 'set', label: 'Set', value: s?.id ?? '', choices: this.sets.map((x) => [x.id, x.name] as const) }], { ok: 'Record' });
    if (!v) return;
    s = this.sets.find((x) => x.id === v.set) ?? s;
    if (!s) { s = { id: newId('as'), name: 'My Actions', actions: [] }; this.sets.push(s); }
    const a: Action = { id: newId('a'), name: String(v.name) || 'Action', steps: [] };
    s.actions.push(a);
    this.picked = { set: s.id, action: a.id };
    this.recording = { set: s.id, action: a.id };
    this.save(s); this.sync();
  }

  private async insertStop(): Promise<void> {
    const p = this.picked, f = p?.action ? this.findAction(p.set, p.action) : null;
    if (!f) return;
    const v = await askForm('Record Stop', [{ kind: 'text', key: 'message', label: 'Message', value: 'Check the artwork, then continue.' }, { kind: 'check', key: 'cont', label: 'Allow Continue', value: true }]);
    if (!v) return;
    const at = p?.step !== undefined ? p.step + 1 : f.action.steps.length;
    f.action.steps.splice(at, 0, { kind: 'stop', message: String(v.message), cont: !!v.cont, on: true });
    this.picked = { set: f.set.id, action: f.action.id, step: at };
    this.save(f.set); this.sync();
  }

  private move(d: number): void {
    const p = this.picked;
    if (!p) return;
    const s = this.sets.find((x) => x.id === p.set);
    if (!s) return;
    if (p.action && p.step !== undefined) { const a = s.actions.find((x) => x.id === p.action); if (!a) return; const j = p.step + d; if (j < 0 || j >= a.steps.length) return; [a.steps[p.step], a.steps[j]] = [a.steps[j], a.steps[p.step]]; p.step = j; }
    else if (p.action) { const i = s.actions.findIndex((x) => x.id === p.action), j = i + d; if (i < 0 || j < 0 || j >= s.actions.length) return; [s.actions[i], s.actions[j]] = [s.actions[j], s.actions[i]]; }
    else { const i = this.sets.indexOf(s), j = i + d; if (j < 0 || j >= this.sets.length) return; [this.sets[i], this.sets[j]] = [this.sets[j], this.sets[i]]; }
    this.save(s); this.sync();
  }

  private duplicate(): void {
    const p = this.picked, s = this.sets.find((x) => x.id === p?.set);
    if (!p || !s) return;
    if (p.action && p.step !== undefined) { const a = s.actions.find((x) => x.id === p.action); if (a) { a.steps.splice(p.step + 1, 0, JSON.parse(JSON.stringify(a.steps[p.step])) as ActionStep); p.step++; } }
    else if (p.action) { const a = s.actions.find((x) => x.id === p.action); if (a) { const c: Action = { ...JSON.parse(JSON.stringify(a)) as Action, id: newId('a'), name: `${a.name} copy` }; s.actions.splice(s.actions.indexOf(a) + 1, 0, c); this.picked = { set: s.id, action: c.id }; } }
    else { const c: ActionSet = { ...JSON.parse(JSON.stringify(s)) as ActionSet, id: newId('as'), name: `${s.name} copy` }; c.actions = c.actions.map((a) => ({ ...a, id: newId('a') })); this.sets.push(c); this.picked = { set: c.id }; this.save(c); }
    this.save(s); this.sync();
  }

  private async remove(): Promise<void> {
    const p = this.picked, s = this.sets.find((x) => x.id === p?.set);
    if (!p || !s) return;
    if (p.action && p.step !== undefined) { const a = s.actions.find((x) => x.id === p.action); if (a) { a.steps.splice(p.step, 1); p.step = a.steps.length ? Math.min(p.step, a.steps.length - 1) : undefined; } }
    else if (p.action) { s.actions = s.actions.filter((x) => x.id !== p.action); this.picked = { set: s.id }; if (this.recording?.action === p.action) this.recording = null; }
    else {
      if (!(await confirmAction('Delete action set?', `${s.name} and its ${s.actions.length} actions will be removed from the library.`, 'Delete', true))) return;
      this.sets = this.sets.filter((x) => x !== s); this.picked = null;
      if (!this.offline) void api.deleteActionSet(s.name).catch(() => undefined);
      this.sync(); return;
    }
    this.save(s); this.sync();
  }

  private loadText(text: string, name: string): void {
    try {
      const s = validSet(JSON.parse(text));
      if (!s) throw new Error('it is not a formpth action set.');
      let nm = s.name, i = 2;
      while (this.sets.some((x) => x.name === nm)) nm = `${s.name} ${i++}`;
      s.name = nm;
      this.sets.push(s); this.picked = { set: s.id }; this.save(s); this.sync();
      this.host.notify(`Loaded ${s.name}: ${s.actions.length} actions.`);
    } catch (err) { this.host.notify(`${name}: ${err instanceof Error ? err.message : String(err)}`, 'error'); }
  }

  private async saveToFile(): Promise<void> {
    const s = this.sets.find((x) => x.id === this.picked?.set);
    if (!s) return;
    await this.host.deliver(new Blob([JSON.stringify(this.fileOf(s), null, 1)], { type: 'application/json' }), `${s.name}.fpaction`);
  }

  private stopFlag = false;
  private async settle(): Promise<void> {
    await sleep(0);
    for (let i = 0; i < 6000 && (anyDialogOpen() || this.engine.isBusy); i++) { if (this.stopFlag && !anyDialogOpen()) break; await sleep(50); }
    await sleep(0);
  }

  private async playPicked(): Promise<void> {
    const p = this.picked, f = p?.action ? this.findAction(p.set, p.action) : null;
    if (!f) return;
    const r = await this.runAction(f.action, p?.step ?? 0, true);
    this.host.notify(`Played ${f.action.name}: ${r.ran} of ${r.total} steps ran${r.stopped ? `; stopped: ${r.stopped}` : ''}.`);
  }

  play(id?: string): void { const p = this.picked, f = id ? this.findAction(undefined, id) : p?.action ? this.findAction(p.set, p.action) : null; if (f) void this.runAction(f.action, 0, true); }

  async playNamed(set: string | undefined, action: string, interactive = false): Promise<{ ran: number; total: number; stopped: string | null } | null> {
    const f = this.findAction(set, action);
    return f ? this.runAction(f.action, 0, interactive) : null;
  }

  private async runAction(a: Action, from: number, interactive: boolean): Promise<{ ran: number; total: number; stopped: string | null }> {
    if (this.playing) return { ran: 0, total: 0, stopped: 'another action is playing' };
    this.playing = true; this.stopFlag = false; this.sync();
    let ran = 0, stopped: string | null = null;
    const steps = a.steps.slice(from).filter((s) => s.on);
    try {
      for (const st of steps) {
        if (this.stopFlag) { stopped = 'stopped'; break; }
        if (st.kind === 'stop') {
          if (!interactive) { if (st.cont) continue; stopped = st.message; break; }
          const go = await confirmAction('Action stopped', st.message, st.cont ? 'Continue' : 'Stop');
          if (!go || !st.cont) { stopped = st.message; break; }
          continue;
        }
        if (st.kind === 'op') { this.engine.recordMute++; try { if (this.engine.playOp(st.op)) ran++; } finally { this.engine.recordMute = Math.max(0, this.engine.recordMute - 1); } await this.settle(); continue; }
        if (st.values) formHooks.supply = { values: st.values, modal: interactive && !!st.modal };
        const ok = this.commands.run(st.id);
        if (!ok) formHooks.supply = null;
        else ran++;
        await this.settle();
        formHooks.supply = null;
      }
    } finally { this.playing = false; this.sync(); }
    return { ran, total: steps.length, stopped };
  }

  openBatch(): void { void this.batchDialog(); }
  private async batchDialog(): Promise<void> {
    const all = this.sets.flatMap((s) => s.actions.map((a) => [`${s.id}/${a.id}`, `${s.name} › ${a.name}`] as const));
    if (!all.length) { this.host.notify('Record an action first.'); return; }
    const p = this.picked, cur = p?.action ? `${p.set}/${p.action}` : all[0][0], d = this.engine.doc;
    const texts = (d?.variables ?? []).filter((v) => v.kind === 'text');
    const v = await askForm('Batch', [
      { kind: 'select', key: 'act', label: 'Play', value: cur, choices: all },
      { kind: 'select', key: 'source', label: 'Source', value: 'folder', choices: [['folder', 'Folder (.fpth, SVG and PDF files)'], ['datasets', `Data Sets of this document (${d?.dataSets?.length ?? 0})`]] },
      { kind: 'text', key: 'folder', label: 'Source folder', value: '', placeholder: '/Users/you/Documents/in' },
      { kind: 'select', key: 'format', label: 'Save as', value: 'same', choices: [['same', 'The source format (.fpth for data sets)'], ['fpth', 'formpth project (.fpth)'], ['svg', 'SVG'], ['pdf', 'PDF'], ['png', 'PNG']] },
      { kind: 'select', key: 'dest', label: 'Destination', value: this.host.desktop() ? 'folder' : 'zip', choices: [['folder', 'A folder (through the engine)'], ['zip', 'A zip download']] },
      { kind: 'text', key: 'out', label: 'Destination folder', value: '', placeholder: '/Users/you/Documents/out' },
      { kind: 'select', key: 'name', label: 'Name data set files from', value: '', choices: [['', 'Data set name'], ...texts.map((t) => [t.name, t.name] as const)] },
      { kind: 'select', key: 'errors', label: 'Errors', value: 'log', choices: [['log', 'Log errors to a file and go on'], ['stop', 'Stop for errors']] },
    ], { ok: 'Run', width: 460 });
    if (!v) return;
    const [setId, actId] = String(v.act).split('/');
    this.host.notify('Batch running: each file opens, plays the action and is saved; the log is written at the end.');
    const r = await this.batch({ set: setId, action: actId, source: v.source as 'folder', folder: String(v.folder), dest: v.dest as 'folder', out: String(v.out), format: v.format as 'same', name: String(v.name) || null, stopOnError: v.errors === 'stop' }).catch((err: unknown) => { this.host.notify(err instanceof Error ? err.message : String(err), 'error'); return null; });
    if (r) this.host.notify(`Batch: ${r.done} done, ${r.failed} failed${r.logPath ? `; log at ${r.logPath}` : r.zip ? '; the log is in the zip' : ''}.`, r.failed ? 'error' : 'info');
  }

  async batch(o: BatchOpts): Promise<BatchResult> {
    const f = this.findAction(o.set, o.action);
    if (!f) throw new Error('There is no such action: list the actions and pass a set and action name.');
    if (o.dest === 'folder' && !o.out?.trim()) throw new Error('Give the destination folder as an absolute path, or choose a zip download.');
    const e = this.engine, home = e.current?.id ?? null, log: string[] = [`formpth batch: ${f.set.name} › ${f.action.name}`, `started ${new Date().toISOString()}`], out: Array<{ name: string; blob: Blob }> = [], files: string[] = [];
    let done = 0, failed = 0;
    const emit = async (name: string, blob: Blob): Promise<void> => { if (o.dest === 'folder') files.push(await api.writeFile(String(o.out).trim(), name, blob)); else { out.push({ name, blob }); files.push(name); } };
    const render = async (fmt: string, stem: string): Promise<void> => {
      const p = e.current;
      if (!p) throw new Error('nothing is open');
      const ab = Math.min(p.activeArtboard, p.doc.artboards.length - 1);
      await emit(`${stem}.${fmt}`, fmt === 'fpth' ? await projectBlob(p) : await renderAs(p, fmt as 'svg', ab, 1, this.host.version));
    };
    if (o.source === 'folder') {
      const kinds = o.kinds?.length ? o.kinds : ['.fpth', '.svg', '.pdf'];
      const { files: src } = await api.listFolder(String(o.folder ?? '').trim(), kinds);
      if (!src.length) throw new Error(`There are no ${kinds.join(', ')} files in that folder.`);
      for (const s of src) {
        const before = new Set(e.projects.map((x) => x.id));
        try {
          const blob = await api.readFile(s.path);
          await this.host.openFile(new File([blob], s.name));
          const opened = e.projects.find((x) => !before.has(x.id));
          if (!opened) throw new Error('could not open it');
          const r = await this.runAction(f.action, 0, false);
          if (r.stopped) throw new Error(`the action stopped: ${r.stopped}`);
          const ext = s.name.split('.').pop()?.toLowerCase() ?? 'fpth', fmt = o.format === 'same' ? (ext === 'svgz' ? 'svg' : ext === 'ai' ? 'pdf' : ext) : o.format;
          await render(fmt, s.name.replace(/\.[^.]+$/, ''));
          done++; log.push(`ok    ${s.name} (${r.ran} steps)`);
        } catch (err) {
          failed++; log.push(`error ${s.name}: ${err instanceof Error ? err.message : String(err)}`);
          if (o.stopOnError) break;
        } finally {
          for (const p of e.projects.filter((x) => !before.has(x.id))) e.closeProject(p.id);
          if (home) e.switchTo(home);
        }
      }
    } else {
      const p = e.current, sets = p?.doc.dataSets ?? [];
      if (!p || !sets.length) throw new Error('This document has no data sets: capture or import some in the Variables panel.');
      for (let i = 0; i < sets.length; i++) {
        let tmp: string | null = null;
        try {
          const images = await resolveImages(p, i, (t) => log.push(`warn  ${sets[i].name}: ${t}`));
          const q = e.addProject(reflow(applyDataSetDoc(p.doc, i, images)), `${p.name} ${sets[i].name}`);
          tmp = q.id;
          for (const [k, b] of p.assets) q.assets.set(k, b);
          q.activeArtboard = p.activeArtboard;
          const r = await this.runAction(f.action, 0, false);
          if (r.stopped) throw new Error(`the action stopped: ${r.stopped}`);
          await render(o.format === 'same' ? 'fpth' : o.format, fileStem(p.doc, sets[i], o.name ?? null, i));
          done++; log.push(`ok    ${sets[i].name} (${r.ran} steps)`);
        } catch (err) {
          failed++; log.push(`error ${sets[i].name}: ${err instanceof Error ? err.message : String(err)}`);
          if (o.stopOnError) break;
        } finally {
          if (tmp) e.closeProject(tmp);
          if (home) e.switchTo(home);
        }
      }
    }
    log.push(`finished ${new Date().toISOString()}: ${done} done, ${failed} failed`);
    const text = log.join('\n') + '\n';
    let logPath: string | null = null;
    if (o.dest === 'folder') { try { logPath = await api.writeFile(String(o.out).trim(), 'formpth-batch-log.txt', new Blob([text], { type: 'text/plain' })); } catch { } }
    else { out.push({ name: 'formpth-batch-log.txt', blob: new Blob([text], { type: 'text/plain' }) }); await this.host.deliver(await zipFiles(out), `${f.action.name}-batch.zip`); }
    return { done, failed, files, log: text, logPath, zip: o.dest !== 'folder' };
  }
}
