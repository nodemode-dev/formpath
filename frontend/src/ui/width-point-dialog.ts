import { findNode } from '../engine/doc';
import { firstStroke } from '../engine/paint';
import type { Engine } from '../engine';
import { askForm } from './form-dialog';

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export async function editWidthPoint(engine: Engine): Promise<void> {
  const pr = engine.current, ws = engine.widthSel, n = pr ? findNode(pr.doc, ws.id) : null, s = n?.kind === 'path' ? firstStroke(n.ap) : null, i = ws.idx[0];
  if (!s?.profile || i === undefined || !s.profile[i]) { engine.notice('Select a width point with the Width tool first.'); return; }
  const prof = s.profile, q = prof[i], hw = s.width / 2, s1 = r3(q.l * hw), s2 = r3(q.r * hw), total = r3(s1 + s2);
  let deleted = false;
  const v = await askForm('Width Point Edit', [
    { kind: 'number', key: 'side1', label: 'Side 1', value: s1, min: 0, max: 5000, step: 0.1, unit: 'pt' },
    { kind: 'number', key: 'side2', label: 'Side 2', value: s2, min: 0, max: 5000, step: 0.1, unit: 'pt' },
    { kind: 'number', key: 'total', label: 'Total Width', value: total, min: 0, max: 10000, step: 0.1, unit: 'pt' },
    { kind: 'check', key: 'adjust', label: 'Adjust adjoining width points', value: false },
    { kind: 'note', text: 'Change Side 1 and Side 2 for an asymmetric width, or Total Width to scale both sides together.' },
  ], {
    ok: 'OK',
    extra: { label: 'Delete', run: () => { deleted = true; const keep = prof.filter((_, j) => j !== i); engine.setWidthPoints(keep.length ? keep : null, [ws.id], 'Delete Width Point'); engine.widthSel = { id: ws.id, idx: [] }; } },
  });
  if (!v || deleted) return;
  let a = Number(v.side1), b = Number(v.side2);
  const tot = Number(v.total);
  if (a === s1 && b === s2 && tot !== total) { if (s1 + s2 > 1e-9) { a = (s1 * tot) / (s1 + s2); b = (s2 * tot) / (s1 + s2); } else { a = tot / 2; b = tot / 2; } }
  if (!Number.isFinite(a) || !Number.isFinite(b) || hw <= 0) return;
  const nl = Math.max(0, a) / hw, nr = Math.max(0, b) / hw, next = prof.map((p) => ({ ...p }));
  next[i] = { ...q, l: nl, r: nr };
  if (v.adjust) {
    const fl = q.l > 1e-9 ? nl / q.l : 1, fr = q.r > 1e-9 ? nr / q.r : 1;
    for (const j of [i - 1, i + 1]) if (next[j]) { next[j].l *= fl; next[j].r *= fr; }
  }
  engine.setWidthPoints(next, [ws.id], 'Edit Width Point');
}
