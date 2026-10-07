---
name: engine-core
description: The formpth document engine in frontend/src/engine. Use for node kinds, paths and anchors, compound paths, groups and clipping, appearance stacks of fills, strokes and effects, gradients, patterns, symbols, blends, meshes, live shapes, history and undo, selection, hit testing, bounds, Canvas 2D rendering, the paper.js kernel, Pathfinder and path operations.
---

# engine-core

The engine owns the document and every change to it. It has no DOM, so the canvas, agents, the assistant and plugins all drive the same code.

## Model (`types.ts`, `doc.ts`)

- Nodes are immutable plain objects. Change one by building a new one (`updateNodes`, `updateNode`, `removeNodes`, `insertInto`, `cloneNode` in `doc.ts`) inside `Engine.edit`.
- Paths: `d` is a list of subpaths, each `{ anchors, closed }`; an anchor is `{ x, y, ix, iy, ox, oy, smooth? }` in absolute document points (y down). Anchor indices are flat across subpaths (`flatIndex`, `unflatIndex`).
- Text, images and symbol instances carry an affine `xf`; groups carry none. A clipping group's clip path is its last child.
- Every node has `ap` (an appearance: `items` of fills and strokes, `effects`), `opacity`, `blend` and an optional `mask`.
- Coordinates are points; `UNIT_PT` converts the document's units.

## Editing (`index.ts`)

- `edit(name, fn, { keepAnchors, merge })` runs `fn(doc, project)`, returns a new doc (or `{ doc, select }`), pushes one history state and emits `doc`.
- Inside `beginGesture()` and `endGesture()`, edits after the first merge into one step: sliders and typing use this.
- Drags preview without history: `beginDrag`, `dragTo`, `commitDrag`, `cancelDrag`.
- Events (`EngineEvents` in `types.ts`): `projects`, `doc`, `selection`, `active`, `viewport`, `tool`, `options`, `history`, `colors`, `render`, `overlay`, `busy`, `notice`.

## Geometry and kernel

- `geometry.ts`: Bezier evaluation and splitting, bounds, affines (`rotateAbout`, `scaleAbout`, `reflectAbout`, `shearAbout`, `translate`, `mul`).
- `kernel.ts` adapts paper.js: booleans, intersections, offset, simplify. Pathfinder must return curves, never polygons.
- `ops/paths.ts` (`pathOperation`), `ops/objects.ts` (align, arrange, transform), `ops/expand.ts` (expand appearance and live objects), `ops/recolor.ts` (colour maps).

## Rendering (`render.ts`)

Canvas 2D with a `Path2D` cached per node in a `WeakMap`: an unchanged node is free. Raster effects render through offscreen canvases. Never mutate a node, or the cache serves a stale path.

## Adding an operation

1. Write it as a pure function of the document in `ops/` or `doc.ts`.
2. Expose it as one `Engine` method that calls `edit` once, so it is one undo step.
3. If agents should reach it, add it to the bridge (`agent-harness`); if people should, add a command (`ui-shell`).
4. Log the decision in `frontend/HASHOUT_LOG.md`.
