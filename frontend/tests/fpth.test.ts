import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { ellipsePath, rectPath } from '../src/engine/geometry';
import { basicAppearance, rgb, solid } from '../src/engine/paint';
import { Project } from '../src/engine/project';
import type { GroupNode, PathNode } from '../src/engine/types';
import { docFromManifest, FORMAT, FORMAT_VERSION, serialize } from '../src/io/project-io';

function built(): Project {
  const e = new Engine();
  const p = e.newDocument(500, 400, { title: 'Round trip', artboards: 2 });
  const path = (id: string, d: PathNode['d'], r: number): PathNode => ({ id, kind: 'path', d, rule: 'nonzero', opacity: 0.8, blend: 'multiply', ap: basicAppearance(solid(rgb(r, 40, 90)), solid(rgb(0, 0, 0)), 1.5) });
  const group: GroupNode = { id: 'g', kind: 'group', clip: false, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, children: [path('g1', ellipsePath(300, 50, 60.25, 60.5), 10)] };
  e.addNodes('Art', [path('p1', rectPath(10.125, 20.5, 100, 50, [4, 4, 4, 4]), 200), group]);
  return p;
}

const reopen = (manifest: Record<string, unknown>): Project => {
  const wire = JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>;
  return new Project('again', docFromManifest(wire), 'again');
};

describe('.fpth manifest round trip', () => {
  it('save, load, save gives the same manifest', () => {
    const first = serialize(built()).manifest;
    const second = serialize(reopen(first)).manifest;
    expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
  });

  it('the loaded document equals the saved one', () => {
    const original = built();
    const loaded = reopen(serialize(original).manifest);
    expect(JSON.parse(JSON.stringify(loaded.doc.layers))).toEqual(JSON.parse(JSON.stringify(original.doc.layers)));
    expect(loaded.doc.artboards.map((a) => [a.x, a.y, a.w, a.h])).toEqual(original.doc.artboards.map((a) => [a.x, a.y, a.w, a.h]));
    expect(loaded.doc.title).toBe('Round trip');
  });

  it('names the format and version that the engine service checks', () => {
    const m = serialize(built()).manifest;
    expect(m.format).toBe(FORMAT);
    expect(m.version).toBe(FORMAT_VERSION);
    expect(Array.isArray((m.document as { artboards: unknown[] }).artboards)).toBe(true);
  });

  it('refuses a foreign or newer project instead of opening it wrongly', () => {
    const m = serialize(built()).manifest;
    expect(() => docFromManifest({ ...m, format: 'com.example.other' })).toThrow(/not a formpath project/);
    expect(() => docFromManifest({ ...m, version: FORMAT_VERSION + 1 })).toThrow(/newer formpath/);
    expect(() => docFromManifest({ ...m, document: null })).toThrow();
  });
});
