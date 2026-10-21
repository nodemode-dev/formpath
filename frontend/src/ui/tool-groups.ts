import type { Engine, ToolId } from '../engine';
import { toolList, type Tool } from '../extensions/registry';

export interface ToolGroup { key: string; tools: Tool[] }
const STORE = 'formpath.toolGroups.last';

export function toolGroups(): ToolGroup[] {
  const out: ToolGroup[] = [];
  for (const t of toolList()) {
    const k = t.group, g = out.find((x) => x.key === k);
    if (g) g.tools.push(t); else out.push({ key: k, tools: [t] });
  }
  return out;
}

const last = new Map<string, ToolId>();
try {
  const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') last.set(k, v as ToolId);
} catch { }

export function slotTool(g: ToolGroup, active: ToolId): Tool {
  return g.tools.find((t) => t.id === active) ?? g.tools.find((t) => t.id === last.get(g.key)) ?? g.tools[0];
}

export function rememberTool(engine: Engine): void {
  const t = toolList().find((x) => x.id === engine.tool);
  if (!t || last.get(t.group) === t.id) return;
  last.set(t.group, t.id);
  try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(last))); } catch { }
}
