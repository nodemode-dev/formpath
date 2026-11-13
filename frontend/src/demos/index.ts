import type { McpResult } from '../automation/agent-bridge';
import type { Engine } from '../engine';
import { buildIconsDemo } from './icons';
import { buildPatternDemo } from './pattern';
import { buildPosterDemo } from './poster';
import type { Tool } from './kit';

export type DemoId = 'poster' | 'icons' | 'pattern';

const BUILDS: Record<DemoId, (t: Tool) => Promise<void>> = { poster: buildPosterDemo, icons: buildIconsDemo, pattern: buildPatternDemo };

export const isDemo = (id: string): id is DemoId => Object.prototype.hasOwnProperty.call(BUILDS, id);

export async function buildDemo(id: DemoId, e: Engine, run: (name: string, a: Record<string, unknown>) => Promise<McpResult>, made: Set<string>): Promise<void> {
  let mine: string | null = null;
  const tool: Tool = async (name, a = {}) => {
    if (mine && e.current?.id !== mine) {
      if (!e.projects.some((p) => p.id === mine)) throw new Error('the demo document was closed while it was being built');
      e.switchTo(mine);
    }
    const before = new Set(e.projects.map((p) => p.id));
    const r = await run(name, a);
    for (const p of e.projects) if (!before.has(p.id)) { made.add(p.id); mine = p.id; }
    if (r.isError) throw new Error(`${name}: ${r.content.map((c) => (c.type === 'text' ? c.text : '')).join(' ')}`);
    return r.structuredContent ?? {};
  };
  await BUILDS[id](tool);
  if (mine && e.current?.id === mine) { e.deselect(); e.setActiveArtboard(0); e.fitAll(); }
}
