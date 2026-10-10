import type { Engine, Pt, Rect, RGB, ToolId } from '../engine';
import type { SnapLine } from '../engine/snap';

export interface ToolPointer { doc: Pt; raw: Pt; screen: Pt; button: number; shift: boolean; alt: boolean; mod: boolean; clicks: number; pressure: number }
export interface ViewInfo { zoom: number; dpr: number; width: number; height: number; toScreen(p: Pt): Pt; toDoc(p: Pt): Pt }
export interface Paint { accent: string; handle: string; antsA: string; antsB: string; layer: string; smart: string }
export interface SnapAt { p: Pt; lines: SnapLine[]; label: string | null }
export interface ToolContext {
  engine: Engine;
  view(): ViewInfo;
  paint(): Paint;
  antsPhase(): number;
  snap(p: Pt, exclude?: Set<string>, opts?: { from?: Pt }): SnapAt;
  snapRect(r: Rect, exclude: Set<string>): { dx: number; dy: number };
  invalidateTargets(): void;
  redraw(): void;
  typeAt(detail: { id?: string; x?: number; y?: number; box?: { w: number; h: number }; path?: string; caret?: number; vertical?: boolean }): void;
}

export type OptionSpec = (
  | { kind: 'title'; text: string }
  | { kind: 'segment'; label?: string; choices: ReadonlyArray<{ id: string; label: string; icon?: string }>; get: () => string; set: (id: string) => void }
  | { kind: 'range'; label: string; min: number; max: number; step?: number; unit?: string; get: () => number; set: (v: number) => void }
  | { kind: 'toggle'; label: string; get: () => boolean; set: (v: boolean) => void }
  | { kind: 'select'; label: string; choices: ReadonlyArray<{ id: string; label: string }>; get: () => string; set: (id: string) => void; live?: () => ReadonlyArray<{ id: string; label: string }> }
  | { kind: 'readout'; label: string; get: () => string }
  | { kind: 'color'; label: string; get: () => RGB; set: (c: RGB) => void }
  | { kind: 'number'; label: string; min?: number; max?: number; step?: number; unit?: string; get: () => number | null; set: (v: number) => void }
  | { kind: 'button'; label: string; icon?: string; run: () => void; compact?: boolean }
) & { when?: () => boolean };

export interface ToolVariant { id: string; label: string; icon: string; active(): boolean; pick(): void }

export interface Tool {
  id: ToolId;
  label: string;
  group: string;
  order: number;
  shortcut?: string;
  variants?(engine: Engine): readonly ToolVariant[];
  icon(engine: Engine): string;
  hint(engine: Engine): string;
  cursor?(ctx: ToolContext, p: ToolPointer | null): string;
  down?(ctx: ToolContext, p: ToolPointer): void;
  move?(ctx: ToolContext, p: ToolPointer): void;
  up?(ctx: ToolContext, p: ToolPointer): void;
  hover?(ctx: ToolContext, p: ToolPointer | null): void;
  dblclick?(ctx: ToolContext, p: ToolPointer): void;
  keydown?(ctx: ToolContext, e: KeyboardEvent): boolean;
  cancel?(ctx: ToolContext): void;
  activate?(ctx: ToolContext): void;
  deactivate?(ctx: ToolContext): void;
  overlay?(ctx: ToolContext, g: CanvasRenderingContext2D): void;
  options?(engine: Engine): OptionSpec[];
}

const tools = new Map<ToolId, Tool>();

export function registerTool(tool: Tool): void {
  if (tools.has(tool.id)) throw new Error(`duplicate tool: ${tool.id}`);
  tools.set(tool.id, tool);
}
export const toolList = (): Tool[] => [...tools.values()].sort((a, b) => a.order - b.order);
export const getTool = (id: ToolId): Tool | undefined => tools.get(id);
export const toolForShortcut = (combo: string): Tool | undefined => toolList().find((t) => t.shortcut === combo);

export function digitOf(e: KeyboardEvent): number | null {
  return e.code.startsWith('Digit') ? Number(e.code.slice(5)) : null;
}

export function dashed(ctx: ToolContext, g: CanvasRenderingContext2D, trace: () => void): void {
  const pal = ctx.paint(), phase = ctx.antsPhase();
  g.save();
  g.lineWidth = 1;
  g.setLineDash([4, 4]);
  g.beginPath();
  trace();
  g.strokeStyle = pal.antsB;
  g.lineDashOffset = -phase;
  g.stroke();
  g.strokeStyle = pal.antsA;
  g.lineDashOffset = -phase + 4;
  g.stroke();
  g.restore();
}

export const toolHost = { run: (id: string): void => { void id; } };
