---
name: engine-core
description: The formpath document engine in frontend/src/engine. Use for node kinds, paths and anchors, compound paths, groups and clipping, appearance stacks of fills, strokes and effects, gradients, patterns, symbols, blends, meshes, live shapes, history and undo, selection, hit testing, bounds, Canvas 2D rendering, the paper.js kernel, Pathfinder and path operations.
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
- `ops/paths.ts` (`pathOperation`), `ops/objects.ts` (align, arrange, transform), `ops/expand.ts` (expand appearance and live objects), `ops/recolor.ts` (colour maps), `ops/text-styles.ts` (character and paragraph styles, fonts in use).

## Type layout and reflow (`text.ts`, `flow.ts`)

- Layout is cached per text node by identity and never reads the document. Anything that depends on other nodes is derived data written into the node by `reflow` in `flow.ts`: `wrapShape` (outlines of wrap objects above the type in its layer, plus its own `framePath`) and each threaded frame's `spans`.
- `Engine.edit`, `dragTo`, `restore` and `addProject` run `reflow`; it returns the same doc when nothing changed. A new feature that makes type depend on other objects belongs in `reflow`, not in `layoutText`.
- A story spans a thread (`next` links); deleting or releasing a frame goes through `detachFrames` so its text flows back.
- OpenType features go through the `Shaping` interface (`setShaping`), installed by `io/fonts.ts`; the engine never imports opentype.js.

## Derived live objects (`livepaint.ts`, `symbolism.ts`, `pattern.ts`)

- A Live Paint group (`GroupNode.livePaint`) stores only edges (its children) and paint seeds (a point and a paint). Faces are derived by `liveFaces`, a planar walk over the flattened edges, cached per children array; `liveFaceNodes` turns painted faces into path nodes that render, hit test, SVG and PDF draw under the edges. Never store faces in the document.
- A tracing object (`GroupNode.trace`) keeps its source image; its children are the result. Views other than the result are drawn on screen only (`rc.printing` shows the result).
- A symbol instance with `tint` is drawn from `instanceArt`, the symbol art with every paint mixed toward the tint; Break Link and Expand use `bakedInstance`.
- Pattern tiles (`patternLattice`, `latticeCopies`) are shared by the renderer, the SVG writer and pattern editing mode; the editing session lives on the `Project`, not in the document, and squashes into one history step on Done.

## Rendering (`render.ts`)

Canvas 2D with a `Path2D` cached per node in a `WeakMap`: an unchanged node is free. Raster effects render through offscreen canvases. The Effect Gallery and Rasterize effects are kernels in `filters.ts` (`RUNS`, keyed by effect id; their definitions and parameters live in `effects.ts` with `family: 'photoshop'` for the gallery); `rasterEffects` turns them into `kind: 'filter'` entries and `withLayer` caches a filtered layer per node, invalidated by `invalidateLayers` when an image decodes. A new kernel takes `FilterFrame` sizes in points times `scale` and must stay linear in pixels. 3D (`threed.ts`): `scene3d(solids, effect)` returns shaded faces; `threeDFaces(doc, n)` in `effects.ts` gathers the solids (paths, compound paths, `textOutline` of type, a group's descendants) and returns them as nodes cached per node, font epoch, symbols and swatches. `scene3dWith` also returns the projection and centre and marks the front cap, which Map Art uses to carry a symbol's art onto the front face (a clip group between the cap's paint and its shading overlay); the shadow is a blurred Multiply group of the faces placed first. A tilted Inflate is ray-cast through `rotator` in its kernel and moves alpha, so it is in `MOVES_ALPHA`. `drawBody`, `visualBounds`, the SVG and PDF writers and `expandAppearance` check `has3d(n)` first and use those faces; `Engine.set3d` is the one edit path for the panel and the `three_d` tool. Never mutate a node, or the cache serves a stale path. Group renders branch on `trace` and `livePaint` before the ordinary children loop.

Vector effects (warp, distort, path, round corners, scribble, convert to shape) on a group, a layer or live type go through `fxNode(doc, n)` in `groupfx.ts`: a cached shadow node whose children are the effected art (type becomes a group of run paths). `renderNode`, `visualBounds`, `deepHit`, the SVG, PDF, EPS and DXF writers and `expandFx` swap a node for its shadow in one line; never evaluate `effectPath` on a container yourself.

## Adding an operation

1. Write it as a pure function of the document in `ops/` or `doc.ts`.
2. Expose it as one `Engine` method that calls `edit` once, so it is one undo step.
3. If agents should reach it, add it to the bridge (`agent-harness`); if people should, add a command (`ui-shell`).
4. Log the decision in `frontend/HASHOUT_LOG.md`.
