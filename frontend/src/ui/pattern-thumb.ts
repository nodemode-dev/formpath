import type { Engine, PatternDef } from '../engine';
import { renderRegion } from '../io/raster';

const done = new WeakMap<PatternDef, string>();
const busy = new WeakSet<PatternDef>();
const listeners = new Set<() => void>();

export function onPatternThumb(fn: () => void): void { listeners.add(fn); }

export function patternThumb(engine: Engine, id: string): string | null {
  const p = engine.current, def = p?.doc.patterns.find((d) => d.id === id);
  if (!p || !def) return null;
  const ready = done.get(def);
  if (ready) return ready;
  if (busy.has(def)) return null;
  busy.add(def);
  void (async () => {
    try {
      const S = 64, c = await renderRegion(p, { region: def.tile, scale: S / 2 / Math.max(1, def.tile.w), transparent: true, only: [def.art] });
      const cv = document.createElement('canvas');
      cv.width = S; cv.height = S;
      const g = cv.getContext('2d'), pat = g?.createPattern(c, 'repeat');
      if (!g || !pat) return;
      pat.setTransform(new DOMMatrix([S / 2 / c.width, 0, 0, S / 2 / c.height, 0, 0]));
      g.fillStyle = pat;
      g.fillRect(0, 0, S, S);
      done.set(def, `url("${cv.toDataURL('image/png')}") 0 0 / 100% 100%`);
      listeners.forEach((fn) => fn());
    } catch { done.set(def, ''); } finally { busy.delete(def); }
  })();
  return null;
}
