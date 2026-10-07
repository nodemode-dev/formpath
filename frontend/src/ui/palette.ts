import type { Paint } from '../extensions/registry';

export interface StagePaint extends Paint { checkerA: string; checkerB: string; grid: string; edge: string; rulerBg: string; rulerText: string; rulerLine: string; pasteboard: string; artboard: string; artboardEdge: string; guide: string; danger: string }

let cache: StagePaint | null = null;

export function paint(): StagePaint {
  if (cache) return cache;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string): string => cs.getPropertyValue(name).trim();
  const p: StagePaint = {
    accent: v('--accent-color'), handle: v('--cv-handle-fill'), antsA: v('--cv-ants-a'), antsB: v('--cv-ants-b'),
    checkerA: v('--cv-checker-a'), checkerB: v('--cv-checker-b'), grid: v('--cv-pixel-grid'), edge: v('--cv-doc-edge'),
    rulerBg: v('--bg-secondary'), rulerText: v('--text-muted'), rulerLine: v('--border-color'),
    layer: v('--cv-layer-color') || v('--accent-color'), smart: v('--cv-smart') || '#e64ce0',
    pasteboard: v('--cv-pasteboard') || v('--canvas-bg'), artboard: v('--cv-artboard') || '#ffffff', artboardEdge: v('--cv-artboard-edge') || '#000000', guide: v('--cv-guide') || '#4fdfff', danger: v('--danger') || '#e5484d',
  };
  cache = p;
  return p;
}

export function invalidatePaint(): void { cache = null; }
