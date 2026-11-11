import { allNodes, ancestors } from '../engine/doc';
import { geomBounds } from '../engine/bounds';
import { normRect, rectContains, translate } from '../engine/geometry';
import { transformNode } from '../engine/transform';
import { newId, updateNodes } from '../engine/doc';
import { duplicateNodes } from '../engine/ops/objects';
import type { Artboard, Doc, Pt, Rect } from '../engine';
import { registerTool } from '../extensions/registry';
import { CURSORS, cursorFor } from '../ui/cursors';
import { boxHandles } from './select';
import { dragRect, hud, marquee, unitLabel } from './util';

const H = { last: null as Pt | null };
registerTool({
  id: 'hand', label: 'Hand Tool', group: 'hand', order: 90, shortcut: 'H',
  icon: () => 'vHand',
  hint: () => 'Drag to scroll the view. Hold Space with any tool to use the Hand for a moment.',
  cursor: () => (H.last ? 'grabbing' : 'grab'),
  down: (_ctx, p) => { H.last = p.screen; },
  move: (ctx, p) => { if (!H.last) return; ctx.engine.pan(p.screen.x - H.last.x, p.screen.y - H.last.y); H.last = p.screen; },
  up: () => { H.last = null; },
  dblclick: (ctx) => ctx.engine.fitAll(),
  cancel: () => { H.last = null; },
});

const RV = { on: false, start: 0, base: 0 };
registerTool({
  id: 'rotateView', label: 'Rotate View Tool', group: 'hand', order: 91, shortcut: 'Shift+H',
  icon: () => 'vRotateView',
  hint: () => 'Drag to turn the view; Shift snaps to 15 degrees. Double-click resets the view.',
  cursor: () => CURSORS.rotate,
  options: (e) => [{ kind: 'title', text: 'Rotate View' }, { kind: 'number', label: 'Angle', min: -360, max: 360, unit: '°', get: () => e.current?.viewport.rotation ?? 0, set: (v) => e.setViewRotation(v) }, { kind: 'button', label: 'Reset View', run: () => e.setViewRotation(0) }],
  down: (ctx, p) => { const v = ctx.view(); RV.on = true; RV.start = Math.atan2(p.screen.y - v.height / 2, p.screen.x - v.width / 2); RV.base = ctx.engine.current?.viewport.rotation ?? 0; },
  move: (ctx, p) => {
    if (!RV.on) return;
    const v = ctx.view(), a = Math.atan2(p.screen.y - v.height / 2, p.screen.x - v.width / 2);
    let deg = RV.base + ((a - RV.start) * 180) / Math.PI;
    if (p.shift) deg = Math.round(deg / 15) * 15;
    ctx.engine.setViewRotation(deg);
  },
  up: () => { RV.on = false; },
  dblclick: (ctx) => ctx.engine.setViewRotation(0),
  cancel: () => { RV.on = false; },
});

const Z = { on: false, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 } };
registerTool({
  id: 'zoom', label: 'Zoom Tool', group: 'zoom', order: 92, shortcut: 'Z',
  icon: () => 'vZoom',
  hint: () => 'Click to zoom in, Alt-click to zoom out, drag a box to zoom to it. Double-click shows 100%.',
  cursor: (_ctx, p) => (p?.alt ? CURSORS.zoomOut : CURSORS.zoomIn),
  down: (_ctx, p) => { Z.on = true; Z.start = p.doc; Z.cur = p.doc; },
  move: (ctx, p) => { if (!Z.on) return; Z.cur = p.doc; ctx.redraw(); },
  up: (ctx, p) => {
    if (!Z.on) return;
    Z.on = false;
    const e = ctx.engine, pr = e.current, r = normRect(Z.start.x, Z.start.y, p.doc.x, p.doc.y), z = ctx.view().zoom;
    if (!pr) return;
    if (r.w * z > 6 && r.h * z > 6 && !p.alt) { pr.viewport.fitRect(r.x, r.y, r.w, r.h, 8); pr.viewport.fitted = false; e.emit('viewport', null); }
    else e.zoomStep(p.alt ? -1 : 1, p.screen);
    ctx.redraw();
  },
  dblclick: (ctx) => ctx.engine.zoomTo(1),
  overlay: (ctx, g) => { if (Z.on) marquee(ctx, g, Z.start, Z.cur); },
  cancel: (ctx) => { Z.on = false; ctx.redraw(); },
});

export const ARTBOARD_PRESETS: ReadonlyArray<{ id: string; label: string; w: number; h: number }> = [
  { id: 'letter', label: 'Letter', w: 612, h: 792 }, { id: 'legal', label: 'Legal', w: 612, h: 1008 }, { id: 'tabloid', label: 'Tabloid', w: 792, h: 1224 },
  { id: 'a5', label: 'A5', w: 419.53, h: 595.28 }, { id: 'a4', label: 'A4', w: 595.28, h: 841.89 }, { id: 'a3', label: 'A3', w: 841.89, h: 1190.55 },
  { id: 'web', label: 'Web 1920 × 1080', w: 1920, h: 1080 }, { id: 'web-l', label: 'Web 1440 × 900', w: 1440, h: 900 }, { id: 'mobile', label: 'iPhone 390 × 844', w: 390, h: 844 },
  { id: 'tablet', label: 'iPad 820 × 1180', w: 820, h: 1180 }, { id: 'square', label: 'Post 1080 × 1080', w: 1080, h: 1080 }, { id: 'story', label: 'Story 1080 × 1920', w: 1080, h: 1920 },
  { id: 'icon', label: 'Icon 512 × 512', w: 512, h: 512 }, { id: 'card', label: 'Business card 252 × 144', w: 252, h: 144 },
];

let moveArt = true;
const AB = { mode: null as null | 'new' | 'move' | 'resize', i: -1, handle: -1, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, base: null as Rect | null, moved: false, copy: false };

function artboardAt(doc: Doc, p: Pt): number {
  for (let i = doc.artboards.length - 1; i >= 0; i--) { const a = doc.artboards[i]; if (rectContains({ x: a.x, y: a.y, w: a.w, h: a.h }, p)) return i; }
  return -1;
}

function contentsOf(doc: Doc, a: Artboard): string[] {
  return allNodes(doc).filter((n) => n.kind !== 'layer' && !n.locked && ancestors(doc, n.id).every((x) => x.kind === 'layer')).filter((n) => { const b = geomBounds(doc, n); const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; return rectContains({ x: a.x, y: a.y, w: a.w, h: a.h }, c); }).map((n) => n.id);
}

registerTool({
  id: 'artboard', label: 'Artboard Tool', group: 'artboard', order: 85, shortcut: 'Shift+O',
  icon: () => 'vArtboard',
  hint: () => 'Drag on the pasteboard to add an artboard; drag an artboard to move it with its art, Alt-drag to duplicate it; drag a handle to resize. Delete removes the active artboard.',
  cursor: (ctx, p) => {
    const pr = ctx.engine.current;
    if (!p || !pr) return CURSORS.cross;
    const h = abHandle(ctx, p.screen);
    if (h >= 0) return cursorFor(h);
    return artboardAt(pr.doc, p.doc) >= 0 ? 'move' : CURSORS.cross;
  },
  options: (e) => [
    { kind: 'title', text: 'Artboard' },
    { kind: 'select', label: 'Preset', choices: [{ id: '', label: 'Custom' }, ...ARTBOARD_PRESETS.map((x) => ({ id: x.id, label: x.label }))], get: () => { const pr = e.current, a = pr?.doc.artboards[pr.activeArtboard]; return ARTBOARD_PRESETS.find((x) => a && Math.abs(x.w - a.w) < 0.5 && Math.abs(x.h - a.h) < 0.5)?.id ?? ''; }, set: (id) => { const x = ARTBOARD_PRESETS.find((y) => y.id === id), pr = e.current; if (x && pr) e.setArtboard(pr.activeArtboard, { w: x.w, h: x.h }); } },
    { kind: 'button', label: 'Portrait', icon: 'vRect', run: () => { const pr = e.current, a = pr?.doc.artboards[pr.activeArtboard]; if (pr && a && a.w > a.h) e.setArtboard(pr.activeArtboard, { w: a.h, h: a.w }); }, compact: true },
    { kind: 'button', label: 'Landscape', icon: 'vRect', run: () => { const pr = e.current, a = pr?.doc.artboards[pr.activeArtboard]; if (pr && a && a.h > a.w) e.setArtboard(pr.activeArtboard, { w: a.h, h: a.w }); }, compact: true },
    { kind: 'number', label: 'W', min: 1, max: 100000, unit: 'pt', get: () => { const pr = e.current; return pr?.doc.artboards[pr.activeArtboard]?.w ?? null; }, set: (v) => { const pr = e.current; if (pr) e.setArtboard(pr.activeArtboard, { w: v }); } },
    { kind: 'number', label: 'H', min: 1, max: 100000, unit: 'pt', get: () => { const pr = e.current; return pr?.doc.artboards[pr.activeArtboard]?.h ?? null; }, set: (v) => { const pr = e.current; if (pr) e.setArtboard(pr.activeArtboard, { h: v }); } },
    { kind: 'toggle', label: 'Move artwork with artboard', get: () => moveArt, set: (v) => { moveArt = v; e.emit('options', null); } },
    { kind: 'button', label: 'Delete Artboard', icon: 'delete', run: () => { const pr = e.current; if (pr) e.deleteArtboard(pr.activeArtboard); } },
  ],
  keydown: (ctx, ev) => {
    const pr = ctx.engine.current;
    if (!pr) return false;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ctx.engine.deleteArtboard(pr.activeArtboard); return true; }
    if (ev.key === 'Escape' || ev.key === 'Enter') { ctx.engine.setTool('selection'); return true; }
    return false;
  },
  down: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    AB.start = AB.cur = p.doc; AB.moved = false; AB.copy = p.alt;
    const h = abHandle(ctx, p.screen);
    if (h >= 0) { const a = pr.doc.artboards[pr.activeArtboard]; AB.mode = 'resize'; AB.handle = h; AB.i = pr.activeArtboard; AB.base = { x: a.x, y: a.y, w: a.w, h: a.h }; e.beginDrag('Resize Artboard'); return; }
    const i = artboardAt(pr.doc, p.doc);
    if (i >= 0) { e.setActiveArtboard(i); AB.mode = 'move'; AB.i = i; const a = pr.doc.artboards[i]; AB.base = { x: a.x, y: a.y, w: a.w, h: a.h }; e.beginDrag(p.alt ? 'Duplicate Artboard' : 'Move Artboard'); return; }
    AB.mode = 'new';
  },
  move: (ctx, p) => {
    const e = ctx.engine, base = e.dragOrigin;
    AB.cur = ctx.snap(p.doc).p;
    if (Math.hypot(AB.cur.x - AB.start.x, AB.cur.y - AB.start.y) * ctx.view().zoom > 2) AB.moved = true;
    if (AB.mode === 'new') { ctx.redraw(); return; }
    if (!base || !AB.base || !AB.moved) return;
    if (AB.mode === 'move') {
      const dx = AB.cur.x - AB.start.x, dy = AB.cur.y - AB.start.y, a = base.artboards[AB.i];
      const moved: Artboard = { ...a, x: AB.base.x + dx, y: AB.base.y + dy };
      let doc: Doc;
      if (AB.copy) {
        const copy: Artboard = { ...moved, id: newId('a'), name: `${a.name} copy` };
        doc = { ...base, artboards: [...base.artboards, copy] };
        if (moveArt) { const ids = contentsOf(base, a); if (ids.length) doc = duplicateNodes(doc, ids, dx, dy).doc; }
      } else {
        doc = { ...base, artboards: base.artboards.map((x, k) => (k === AB.i ? moved : x)) };
        if (moveArt) doc = updateNodes(doc, contentsOf(base, a), (n) => transformNode(n, translate(dx, dy)));
      }
      e.dragTo(doc);
    } else if (AB.mode === 'resize') {
      const r = AB.base, hs = boxHandles(r), o = hs[(AB.handle + 4) % 8], q = AB.cur;
      let x0 = Math.min(o.x, q.x), x1 = Math.max(o.x, q.x), y0 = Math.min(o.y, q.y), y1 = Math.max(o.y, q.y);
      if (AB.handle === 1 || AB.handle === 5) { x0 = r.x; x1 = r.x + r.w; }
      if (AB.handle === 3 || AB.handle === 7) { y0 = r.y; y1 = r.y + r.h; }
      e.dragTo({ ...base, artboards: base.artboards.map((x, k) => (k === AB.i ? { ...x, x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) } : x)) });
    }
  },
  up: (ctx, p) => {
    const e = ctx.engine, pr = e.current;
    const mode = AB.mode;
    AB.mode = null;
    if (!pr) return;
    if (mode === 'new') {
      const r = dragRect(AB.start, AB.cur, p.shift, p.alt);
      if (r.w * ctx.view().zoom > 4 && r.h * ctx.view().zoom > 4) e.addArtboard(r);
      ctx.redraw();
      return;
    }
    if (e.dragging) { if (AB.moved) e.commitDrag(); else e.cancelDrag(); }
    if (mode === 'move' && AB.copy && AB.moved) e.setActiveArtboard(pr.doc.artboards.length - 1);
  },
  dblclick: (ctx) => ctx.engine.fit(),
  overlay: (ctx, g) => {
    const e = ctx.engine, pr = e.current;
    if (!pr) return;
    const v = ctx.view(), a = pr.doc.artboards[pr.activeArtboard];
    if (a) {
      const s = v.toScreen({ x: a.x, y: a.y }), t = v.toScreen({ x: a.x + a.w, y: a.y + a.h }), r = { x: s.x, y: s.y, w: t.x - s.x, h: t.y - s.y };
      g.save(); g.strokeStyle = ctx.paint().accent; g.lineWidth = 1.5; g.strokeRect(r.x, r.y, r.w, r.h);
      g.fillStyle = '#fff';
      for (const h of boxHandles(r)) { g.fillRect(h.x - 3.5, h.y - 3.5, 7, 7); g.strokeRect(h.x - 3.5, h.y - 3.5, 7, 7); }
      g.restore();
      if (AB.mode === 'move' || AB.mode === 'resize') hud(ctx, g, t, [`W: ${unitLabel(e, a.w)}`, `H: ${unitLabel(e, a.h)}`]);
    }
    if (AB.mode === 'new') { marquee(ctx, g, AB.start, AB.cur); const r = dragRect(AB.start, AB.cur, false, false); hud(ctx, g, v.toScreen(AB.cur), [`W: ${unitLabel(e, r.w)}`, `H: ${unitLabel(e, r.h)}`]); }
  },
  cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); AB.mode = null; ctx.redraw(); },
});

function abHandle(ctx: { engine: import('../engine').Engine; view(): import('../extensions/registry').ViewInfo }, screen: Pt): number {
  const pr = ctx.engine.current;
  if (!pr) return -1;
  const a = pr.doc.artboards[pr.activeArtboard];
  if (!a) return -1;
  const v = ctx.view(), s = v.toScreen({ x: a.x, y: a.y }), t = v.toScreen({ x: a.x + a.w, y: a.y + a.h });
  const hs = boxHandles({ x: s.x, y: s.y, w: t.x - s.x, h: t.y - s.y });
  for (let i = 0; i < 8; i++) if (Math.abs(screen.x - hs[i].x) <= 6 && Math.abs(screen.y - hs[i].y) <= 6) return i;
  return -1;
}
