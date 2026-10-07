import { updateNodes } from '../../engine/doc';
import { effectDef, effectDefaults } from '../../engine/effects';
import { effect } from '../../engine/paint';
import type { Doc, Engine } from '../../engine';
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

export async function effectDialog(engine: Engine, id: string, at?: { node: string; index: number }): Promise<boolean> {
  const def = effectDef(id);
  if (!def) return false;
  const ids = at ? [at.node] : engine.targetIds();
  if (!ids.length) { engine.notice(`Select an object to apply ${def.label}.`); return false; }
  const node = at ? engine.nodeById(at.node) : null;
  const start = { ...effectDefaults(id), ...(at && node ? node.ap.effects[at.index]?.params ?? {} : engine.lastEffect?.id === id ? engine.lastEffect.params : {}) };
  const fields: Field[] = def.params.map((p): Field => {
    const v = start[p.key];
    if (p.kind === 'number') return { kind: 'number', key: p.key, label: p.label, value: Number(v), min: p.min, max: p.max, step: p.step, unit: p.unit };
    if (p.kind === 'boolean') return { kind: 'check', key: p.key, label: p.label, value: !!v };
    if (p.kind === 'color') return { kind: 'color', key: p.key, label: p.label, value: String(v) };
    if (p.kind === 'text') return { kind: 'text', key: p.key, label: p.label, value: String(v ?? '') };
    return { kind: 'select', key: p.key, label: p.label, value: String(v), choices: (p.choices ?? []).map((c) => [c, titleCase(c)] as const) };
  });
  const r = await previewEdit(engine, def.label, fields, (origin, v) => updateNodes(origin, ids, (n) => ({
    ...n,
    ap: { ...n.ap, effects: at ? n.ap.effects.map((e, i) => (i === at.index ? { ...e, params: v } : e)) : [...n.ap.effects, effect(id, v)] },
  })));
  if (r) engine.lastEffect = { id, params: r };
  return !!r;
}
