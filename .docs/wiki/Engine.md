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

## Type layout and reflow

`text.ts` lays type out per node and caches the layout by node identity. Area type places each line first and breaks into the free runs of its band, so it can flow inside a shape and on both sides of a wrap object. Anything that depends on other nodes, the outlines of wrap objects and each threaded frame's share of the story, is written into the text nodes by `flow.ts` (`reflow`), which every edit, drag, undo and open runs. OpenType features reach the layout through the `Shaping` interface that `io/fonts.ts` installs, so the engine stays free of opentype.js.

Some live objects keep only their inputs in the document and derive the rest. A Fill Regions group stores its paths and paint seeds; `livepaint.ts` finds the faces by walking the planar graph of the flattened paths and caches them per children array; painting an edge splits its path at the neighbouring crossings so only that stretch takes the stroke. A tracing object keeps its source image beside the traced paths. A stained symbol instance is drawn from its symbol's art with the paints mixed toward the tint (`symbolism.ts`). Pattern tiles come from one lattice (`pattern.ts`) shared by the renderer, the SVG writer and pattern editing mode, whose session lives on the project rather than in the document.

Raster effects run on an offscreen layer per object. The Effect Gallery and Rasterize effects are pixel kernels in `filters.ts`, linear in the pixel count, with sizes in points times the current scale and noise and textures generated in the object's own space, so a look holds at any zoom and does not crawl while panning. A layer with one of them is rendered whole and cached per node, so panning reuses it; PDF and SVG export draw the same layer at the document's raster resolution.

3D Extrude & Bevel, Revolve and Plane are vector: `threed.ts` turns the object's paths, compound paths and outlined type into solids, builds side quads, bevel rings and caps, rotates and projects them, and returns shaded faces drawn back cap, sides, front cap per solid. Caps keep the object's own paint with the shading laid over it. The faces are ordinary path nodes, so the canvas, SVG, PDF, hit testing and Expand Appearance share them. Map Art carries a symbol onto the front face by the scene's projection and clips it to the cap between the paint and the shading; shadows are a blurred Multiply group of the same faces placed underneath. Inflate is a raster kernel shaded with the same lights, ray-cast when it is tilted.

## Geometry

`geometry.ts` carries Bezier math, bounds and affines. `kernel.ts` adapts paper.js for booleans, intersections, offset and simplify, so Pathfinder returns curves, not polygons. `ops/` holds object, path, expand and recolor operations.
