export type Tool = (name: string, a?: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface Board { x: number; y: number; w: number; h: number }

export function idOf(r: Record<string, unknown>): string {
  const many = (r.selection ?? r.ids) as unknown;
  const id = typeof r.id === 'string' ? r.id : Array.isArray(many) && typeof many[0] === 'string' ? many[0] : '';
  if (!id) throw new Error('a demo step made nothing');
  return id;
}

export function idsOf(r: Record<string, unknown>): string[] {
  const many = (r.selection ?? r.ids) as unknown;
  return Array.isArray(many) ? many.filter((x): x is string => typeof x === 'string') : [idOf(r)];
}

export async function boards(t: Tool): Promise<Board[]> {
  const r = await t('artboard', { action: 'list' });
  return ((r.artboards ?? []) as Array<{ x: number; y: number; width: number; height: number }>).map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height }));
}

export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export const linear = (angle: number, ...stops: Array<[number, string, number?]>): Record<string, unknown> =>
  ({ type: 'linear', angle, stops: stops.map(([offset, color, opacity]) => ({ offset, color, opacity: opacity ?? 1 })) });

export const radial = (...stops: Array<[number, string, number?]>): Record<string, unknown> =>
  ({ type: 'radial', stops: stops.map(([offset, color, opacity]) => ({ offset, color, opacity: opacity ?? 1 })) });
