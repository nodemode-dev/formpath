import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import adapter from '../src/dock-adapter.ts?raw';
import panels from '../src/ui/dock.ts?raw';
import { jsonLegacy, moveLegacy, readState, type DockStore } from '../src/dock/state';

const KEY = 'formpath.agentDock';
const OLD = 'formpath.terminal';
const DEFAULTS = { h: 280, w: 420 };

function store(seed: Record<string, string>): DockStore & { all: Map<string, string> } {
  const all = new Map(Object.entries(seed));
  return { all, getItem: (k) => all.get(k) ?? null, setItem: (k, v) => { all.set(k, v); }, removeItem: (k) => { all.delete(k); } };
}

describe('the agent dock remembers its place under its own key', () => {
  it('the adapter and the pre-paint script name the same keys, and not the panel dock key', () => {
    expect(adapter).toContain(`DOCK_KEY = '${KEY}'`);
    expect(adapter).toContain(`DOCK_LEGACY = ['${OLD}']`);
    expect(html).toContain(`localStorage.getItem('${KEY}') || localStorage.getItem('${OLD}')`);
    expect(panels).toContain("const KEY = 'formpath.dock'");
    expect(KEY).not.toBe('formpath.dock');
  });

  it('the old state moves once and the old key is removed', () => {
    const s = store({ [OLD]: JSON.stringify({ open: true, h: 333 }), 'formpath.dock': '["layers"]' });
    expect(moveLegacy(s, KEY, jsonLegacy([OLD]), DEFAULTS)).toBe(true);
    expect(s.all.has(OLD)).toBe(false);
    expect(s.all.get('formpath.dock')).toBe('["layers"]');
    expect(readState(s, KEY, jsonLegacy([OLD]), DEFAULTS)).toEqual({ open: true, side: 'bottom', h: 333, w: 420, tab: '' });
    expect(moveLegacy(s, KEY, jsonLegacy([OLD]), DEFAULTS)).toBe(false);
  });

  it('a moved layout arrives as seen, so the guide is kept for new people', () => {
    expect(adapter).toContain('legacy: jsonLegacy(DOCK_LEGACY, true)');
    const s = store({ [OLD]: JSON.stringify({ open: false, h: 333 }) });
    expect(moveLegacy(s, KEY, jsonLegacy([OLD], true), DEFAULTS)).toBe(true);
    expect(JSON.parse(s.all.get(KEY) ?? '{}')).toEqual({ open: false, side: 'bottom', h: 333, w: 420, tab: '', seen: true });
    expect(s.all.has(OLD)).toBe(false);
  });

  it('a state already under the new key is never overwritten by an old one', () => {
    const s = store({ [KEY]: JSON.stringify({ open: false, side: 'right', h: 200, w: 500, tab: 'chat' }), [OLD]: JSON.stringify({ open: true, h: 333 }) });
    expect(moveLegacy(s, KEY, jsonLegacy([OLD]), DEFAULTS)).toBe(false);
    expect(readState(s, KEY, jsonLegacy([OLD]), DEFAULTS)).toEqual({ open: false, side: 'right', h: 200, w: 500, tab: 'chat' });
  });
});
