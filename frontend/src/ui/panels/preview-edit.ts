import { updateNodes } from '../../engine/doc';
import { effectDef, effectDefaults, isItemEffect } from '../../engine/effects';
import { effect } from '../../engine/paint';
import type { Doc, Effect, Engine } from '../../engine';
import { askForm, type Field, type FieldValue } from '../form-dialog';

type Built = Doc | { doc: Doc; select?: string[] };

export async function previewEdit(engine: Engine, title: string, fields: Field[], build: (origin: Doc, v: Record<string, FieldValue>) => Built, opts: { ok?: string; extra?: { label: string; build: (origin: Doc, v: Record<string, FieldValue>) => Built } } = {}): Promise<Record<string, FieldValue> | null> {
  if (!engine.current) return null;
  engine.beginDrag(title);
  const origin = engine.dragOrigin as Doc;
  const docOf = (b: Built): Doc => ('layers' in b ? b : b.doc);
  const safe = (f: () => Built): Built | null => { try { return f(); } catch (err) { engine.notice(`${title}: ${err instanceof Error ? err.message : String(err)}`, 'error'); return null; } };
  let usedExtra = false;
  const r = await askForm(title, fields, {
    ok: opts.ok,
    preview: (v) => { const b = safe(() => build(origin, v)); if (b) engine.dragTo(docOf(b)); },
    unpreview: () => engine.dragTo(origin),
    cancel: () => engine.cancelDrag(),
    extra: opts.extra ? { label: opts.extra.label, run: () => { usedExtra = true; } } : undefined,
  });
  if (!r) { if (engine.dragging) engine.cancelDrag(); return null; }
  const b = safe(() => (usedExtra && opts.extra ? opts.extra.build(origin, r) : build(origin, r)));
  if (!b) { engine.cancelDrag(); return null; }
  engine.dragTo(docOf(b));
  engine.commitDrag('layers' in b ? undefined : b.select);
  return r;
}

const titleCase = (s: string): string => s.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

export interface EffectSlot { node: string; index: number; item?: number }

export async function effectDialog(engine: Engine, id: string, slot?: EffectSlot): Promise<boolean> {
  const def = effectDef(id);
  if (!def) return false;
  const at = slot && slot.item !== undefined && !isItemEffect(id) ? { node: slot.node, index: -1 } : slot;
  if (slot?.item !== undefined && at?.item === undefined) engine.notice(`${def.label} applies to the whole object, not to one fill or stroke.`);
  const ids = at ? [at.node] : engine.targetIds();
  if (!ids.length) { engine.notice(`Select an object to apply ${def.label}.`); return false; }
  const node = at ? engine.nodeById(at.node) : null, list = node ? (at?.item !== undefined ? node.ap.items[at.item]?.effects : node.ap.effects) : undefined;
  if (at && !list) return false;
  const editing = !!at && at.index >= 0;
  const start = { ...effectDefaults(id), ...(editing && list ? list[at.index]?.params ?? {} : engine.lastEffect?.id === id ? engine.lastEffect.params : {}) };
  const fields: Field[] = def.params.map((p): Field => {
    const v = start[p.key];
    if (p.kind === 'number') return { kind: 'number', key: p.key, label: p.label, value: Number(v), min: p.min, max: p.max, step: p.step, unit: p.unit };
    if (p.kind === 'boolean') return { kind: 'check', key: p.key, label: p.label, value: !!v };
    if (p.kind === 'color') return { kind: 'color', key: p.key, label: p.label, value: String(v) };
    if (p.kind === 'text') return { kind: 'text', key: p.key, label: p.label, value: String(v ?? '') };
    return { kind: 'select', key: p.key, label: p.label, value: String(v), choices: (p.choices ?? []).map((c) => [c, titleCase(c)] as const) };
  });
  const put = (fx: Effect[], v: Effect['params']): Effect[] => (editing && at ? fx.map((e, i) => (i === at.index ? { ...e, params: v } : e)) : [...fx, effect(id, v)]);
  const r = await previewEdit(engine, def.label, fields, (origin, v) => updateNodes(origin, ids, (n) => ({
    ...n,
    ap: at?.item !== undefined ? { ...n.ap, items: n.ap.items.map((it, i) => (i === at.item ? { ...it, effects: put(it.effects, v) } : it)) } : { ...n.ap, effects: put(n.ap.effects, v) },
  })));
  if (r) engine.lastEffect = { id, params: r };
  return !!r;
}
