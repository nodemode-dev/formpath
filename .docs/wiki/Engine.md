# Engine

`frontend/src/engine/` is the document engine. It never touches the DOM, so the same engine serves the canvas, the agent bridge, the assistant and plugins.

## Document model

- A document has artboards, layers (with sublayers), swatches, symbols, graphic styles, brushes, patterns, character and paragraph styles, guides, a grid and embedded images.
- Nodes are immutable plain objects: `path`, `compound`, `group` (with an optional clip), `text`, `image`, `symbol` instances, `blend`, `mesh`, and live objects (shapes, repeats, envelopes). Paths store absolute anchors in document points with in and out handles; text, images and symbol instances carry an affine.
- Every node has an appearance: a stack of fills and strokes and live effects, plus opacity, blend mode and an optional opacity mask.
- Coordinates are points, x to the right and y down, origin at the first artboard's top-left corner.

## History

`history.ts` keeps whole document snapshots. Structural sharing makes a snapshot cost only the edited ancestors. Consecutive edits with the same name merge into one step inside a gesture (`beginGesture` and `endGesture`), which is how sliders and typing stay one undo step.

## Rendering

`render.ts` draws with Canvas 2D and caches a `Path2D` per node in a `WeakMap`, so unchanged nodes cost nothing to redraw. Raster effects (shadows, glows, blur, feather) render through offscreen canvases.

## Geometry

`geometry.ts` carries Bezier math, bounds and affines. `kernel.ts` adapts paper.js for booleans, intersections, offset and simplify, so Pathfinder returns curves, not polygons. `ops/` holds object, path, expand and recolor operations.
