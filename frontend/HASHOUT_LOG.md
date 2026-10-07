# HASHOUT_LOG · frontend

Living context log for `frontend/`. In-code comments are near zero; the explanations, rationale, removed code and todos that would have been comments live here, anchored to the file and symbol. Read this before editing.

## Org-navi-map

```text
frontend/
├── index.html                  shell document, pre-paint theme boot, stylesheet order
├── package.json                dependencies, scripts (build = tsc + vite build)
├── vite.config.ts              port 5230, host false, strict, /api proxy to 8230
├── tsconfig.json               strict, bundler resolution, src only
├── boot_frontend(.bat)         dev server launcher
├── oc_install(.bat)            npm install
├── public/
│   ├── favicon.svg, favicon.ico, apple-touch-icon.png   app icon renders
│   └── splash.html             desktop splash window
└── src/
    ├── main.ts                 entry, calls startApp
    ├── app.ts                  composition root: panels, dock, stage, files, commands, menus, keys
    ├── version.ts              VERSION constant
    ├── automation/
    │   └── agent-bridge.ts     runs every MCP tool against the engine
    ├── engine/                 document engine, no DOM
    │   ├── types.ts            node, paint, appearance, doc and event types
    │   ├── doc.ts              node tree helpers, newDoc, ids
    │   ├── index.ts            Engine: edit, history, selection, every operation
    │   ├── history.ts          snapshot history with merge
    │   ├── project.ts          Project: doc, assets, viewport, selection, history
    │   ├── viewport.ts         zoom, pan, fit, inset for the props column
    │   ├── events.ts           typed Emitter
    │   ├── geometry.ts         Bezier math, bounds, affines
    │   ├── bounds.ts           geometric and visual bounds, cache
    │   ├── hit.ts              hit testing
    │   ├── render.ts           Canvas 2D renderer with Path2D cache
    │   ├── paint.ts            colours, paints, gradients, appearance items, parsing
    │   ├── effects.ts          effect catalogue and evaluation
    │   ├── live.ts             live shapes, blends, repeats, envelopes
    │   ├── mesh.ts             gradient mesh
    │   ├── brushes.ts          calligraphic, scatter, art, pattern brushes
    │   ├── text.ts             type layout, styles, caret and index math
    │   ├── flow.ts             reflow: text wrap shapes and threaded stories
    │   ├── harmony.ts          colour harmony rules and variations
    │   ├── symbolism.ts        instance tint, instance art and the symbolism operations
    │   ├── pattern.ts          tile lattices and the pattern editing session
    │   ├── transform.ts        node transforms
    │   ├── snap.ts             point, grid and smart guide snapping
    │   ├── kernel.ts           paper.js adapter: booleans, offset, simplify
    │   └── ops/
    │       ├── paths.ts        pathfinder and path commands
    │       ├── objects.ts      align, arrange, transform
    │       ├── expand.ts       expand appearance and live objects
    │       ├── text-styles.ts  character and paragraph styles: apply, redefine, delete
    │       ├── live-shapes.ts  editing live shapes after drawing
    │       └── recolor.ts      colour maps for Recolor and Edit Colors
    ├── extensions/
    │   └── registry.ts         Tool, ToolContext, OptionSpec, registerTool, toolHost
    ├── tools/
    │   ├── index.ts            imports every tool module
    │   ├── util.ts             shared overlay and geometry helpers
    │   ├── select.ts           Selection, Direct, Group Selection, Magic Wand, Lasso
    │   ├── pen.ts              Pen, Add, Delete, Anchor Point, Curvature
    │   ├── draw.ts             shape tools and grids
    │   ├── freehand.ts         Pencil, Smooth, Path Eraser, Join, brushes, Eraser, Scissors, Knife
    │   ├── transform.ts        Rotate, Reflect, Scale, Shear, Free Transform, Reshape, Width, liquify
    │   ├── paint.ts            Eyedropper, Gradient, Mesh, Live Paint, Shape Builder, Blend, Sprayer, Measure
    │   ├── symbolism.ts        Symbol Shifter, Scruncher, Sizer, Spinner, Stainer, Screener, Styler
    │   ├── type.ts             type tools and their options
    │   └── view.ts             Hand, Rotate View, Zoom, Artboard
    ├── io/
    │   ├── api.ts              engine service client
    │   ├── project-io.ts       .fpth manifest in and out
    │   ├── svg.ts              SVG export and import
    │   ├── pdf.ts              PDF writer and native reader
    │   ├── raster.ts           region rendering, PNG, JPEG, WebP, screens zip
    │   ├── trace.ts            image trace
    │   ├── fonts.ts            bundled and installed fonts, outlines
    │   ├── recovery.ts         crash recovery store
    │   └── zip.ts              zip read and write
    ├── plugins/
    │   └── host.ts             plugin sandbox runtime
    ├── help/
    │   └── markdown.ts         manual sections, search, rendering
    ├── types/
    │   └── opentype.d.ts       opentype.js typings
    ├── ui/                     shell modules (see TOC)
    │   └── panels/             panel modules (see TOC)
    └── styles/                 tokens, shell, panels, dialogs, formpth, light mode, fonts, scrollbars
```

## Table of contents

Scripts with entries, in folder order. Every other script is in the map above with its role and has no entries yet.

- index.html
- vite.config.ts
- src/app.ts
- src/automation/agent-bridge.ts
- src/engine/index.ts
- src/engine/history.ts
- src/engine/viewport.ts
- src/engine/render.ts
- src/engine/effects.ts
- src/engine/live.ts
- src/engine/snap.ts
- src/engine/kernel.ts
- src/engine/ops/recolor.ts
- src/engine/text.ts
- src/engine/flow.ts
- src/engine/symbolism.ts
- src/engine/pattern.ts
- src/extensions/registry.ts
- src/tools/select.ts
- src/tools/pen.ts
- src/tools/draw.ts
- src/tools/freehand.ts
- src/tools/transform.ts
- src/tools/paint.ts
- src/tools/symbolism.ts
- src/tools/type.ts
- src/tools/view.ts
- src/io/project-io.ts
- src/io/svg.ts
- src/io/pdf.ts
- src/io/raster.ts
- src/io/fonts.ts
- src/io/trace.ts
- src/plugins/host.ts
- src/ui/stage.ts
- src/ui/text-editor.ts
- src/ui/properties.ts
- src/ui/layers.ts
- src/ui/rail.ts
- src/ui/dock.ts
- src/ui/titlebar-tools.ts
- src/ui/panels/kit.ts
- src/ui/panels/color.ts
- src/ui/panels/color-guide.ts
- src/ui/panels/color-picker.ts
- src/ui/panels/navigator.ts
- src/ui/panels/type.ts
- src/ui/panels/text-styles.ts
- src/ui/panels/image-trace.ts
- src/ui/panels/pattern-options.ts
- src/ui/panels/preview-edit.ts
- src/ui/form-dialog.ts
- src/ui/palette.ts
- src/styles/tokens.css
- src/styles/formpth.css
- Inherited from formvis

## index.html

### index.html · theme boot script
- refers-to: index.html :: inline script in head
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Runs before any stylesheet so the saved theme profile and accent are on the root element before first paint (no theme flash on hard reload). Keep its PROFILES table in step with `src/ui/themes.ts` (same 15 ids, surface variables only; themes.ts re-applies everything after the bundle loads). Light profiles get `theme-light` on body through a MutationObserver the moment body exists. The comments formvis carried here were moved to this entry.

## vite.config.ts

### vite.config.ts · server
- refers-to: vite.config.ts :: defineConfig server and preview
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Ports 5230 (dev) and 5231 (preview) and 8230 (engine) so formpth runs beside formvis (5190, 8190). `host: false` keeps the dev server on localhost only; `strictPort` fails loudly instead of drifting.

## src/app.ts

### src/app.ts · send-nodemode command
- refers-to: src/app.ts :: commands, id send-nodemode
- kind: rationale
- logged: v0.9.0 · 2026-10-07

`api.sendToNodeMode(target, title, items, parts)` takes the NodeMode address, a title, one item per image (`{name, kind: 'image', width, height}`) and the PNG parts. The first draft passed the blob as the target; fixed at typecheck. The toast reports whether NodeMode placed the image or only uploaded it.

### src/app.ts · placeFile when no document is open
- refers-to: src/app.ts :: placeFile
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

`engine.current` is read again after `await openFiles` through a cast, because TypeScript narrows the earlier `const p = engine.current` falsy check onto the getter and would call it `never`.

### src/app.ts · path operation dialogs
- refers-to: src/app.ts :: offsetPathDialog, simplifyDialog, splitGridDialog
- kind: removed-code
- logged: v0.9.0 · 2026-10-07

Replaced by a static import of `pathOperation`; the module is already in the main chunk, so the dynamic import only produced a build warning.

```ts
const { pathOperation } = await import('./engine/ops/paths');
```

### src/app.ts · outline command label
- refers-to: src/app.ts :: commands, id outline
- kind: rationale
- logged: v0.9.0 · 2026-10-07

The label toggles between Outline and Preview, as Illustrator's View menu does. formvis's GPU Preview wording does not apply: formpth has no GPU renderer.

## src/automation/agent-bridge.ts

### src/automation/agent-bridge.ts · add_text default colour
- refers-to: src/automation/agent-bridge.ts :: run, case add_text
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Type an agent adds is black unless `color` is passed, matching the Type tool. Before, it took the current fill, which after `select all` was often a background gradient, so titles came out painted like the background.

### src/automation/agent-bridge.ts · file tools
- refers-to: src/automation/agent-bridge.ts :: run, cases __open, __place, __project, __export
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The engine service reads and writes the absolute paths agents give; the window only hands it bytes (base64 in `structuredContent.data`) or receives them. The window never touches the file system.

### src/automation/agent-bridge.ts · rotation sign
- refers-to: src/automation/agent-bridge.ts :: run, case transform
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

`rotateAbout(-deg)`: document space is y-down, so a positive matrix angle turns clockwise on screen. Agents and the Rotate dialog use Illustrator's sign, positive counter-clockwise.

### src/automation/agent-bridge.ts · one step per call
- refers-to: src/automation/agent-bridge.ts :: run; src/engine/index.ts :: Engine.beginStep, endStep; src/engine/history.ts :: History.mark, squash
- kind: rationale
- logged: v0.11.0 · 2026-10-07

The consent prompt promises that each change is one undoable step, but a call such as `set_paint` with a fill and a stroke made two steps, and gestures only merge steps of the same name. `run` now marks the history before a call and squashes everything the call pushed into one step named after its first edit. `undo` and `redo` are left out so they move through history normally.

## src/engine/index.ts

### src/engine/index.ts · beginGesture and endGesture
- refers-to: src/engine/index.ts :: Engine.beginGesture, Engine.endGesture, edit
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Sliders and typing call `edit` many times per gesture. Inside a gesture, every edit after the first merges into the first history state, so one drag of the Opacity slider or one burst of typing is one undo step.

### src/engine/index.ts · viewSize
- refers-to: src/engine/index.ts :: Engine.viewSize, setViewSize, addProject
- kind: rationale
- logged: v0.9.0 · 2026-10-07

A new project is fitted to the last stage size the stage reported. Before, the first document of a session copied the size from `this.current`, which was null, so it fitted an 800 by 600 default and sat off-centre until the window resized.

## src/engine/history.ts

### src/engine/history.ts · push merge
- refers-to: src/engine/history.ts :: History.push
- kind: explainer
- logged: v0.9.0 · 2026-10-07

`merge` replaces the last state's document when the names match and the cursor is at the end; otherwise it pushes as usual. Redo states beyond the cursor are dropped on any push.

## src/engine/viewport.ts

### src/engine/viewport.ts · insetRight
- refers-to: src/engine/viewport.ts :: Viewport.insetRight
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The Properties column overlays the right of the stage (284 px wide in a 46 px grid track), so fitting and zoom centring use the width minus 238 px while it is open.

## src/engine/render.ts

### src/engine/render.ts · Path2D cache
- refers-to: src/engine/render.ts :: path cache WeakMap
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

Keyed by node identity. Never mutate a node in place: the cache would keep drawing the old geometry.

## src/engine/effects.ts

### src/engine/effects.ts · Distort and Transform
- refers-to: src/engine/effects.ts :: applyOne distort cases, quadMap, polyToSmooth
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Pucker and Bloat pulls each anchor toward the box centre by 0.4 of the amount and pushes each segment's midpoint the other way by 0.9, then rebuilds the segment as the quadratic through that apex raised to a cubic, so the points bloat while the anchors stay put. Roughen and Zig Zag resample by arc length (Roughen at `detail` points per inch, Zig Zag at `ridges + 1` per segment, rounded to an even count on closed paths so the teeth meet), offset along the normal (Roughen also slides a third of that along the tangent) and pass through `polyToSmooth`, whose handles run parallel to the neighbour chord at 0.3 of each neighbouring segment. Twist turns by the angle times the square of `1 - (r/R)^2`, R being the farthest anchor from the centre, so the middle turns most and the rim not at all. Transform builds one step matrix about the centre and multiplies it once per copy (500 at most). Tweak hashes subpath, anchor, channel and seed into a stable jitter, so the same seed always gives the same shape. Free Distort maps the unit square onto the four dragged corners with a projective `quadMap` (affine when the corners form a parallelogram).

## src/engine/live.ts

### src/engine/live.ts · warp styles
- refers-to: src/engine/live.ts :: warpPoint
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Every style works in a unit box (u and v from -1 to 1, swapped for vertical orientation) and adds a displacement. Arc bends the box onto concentric arcs that keep the chord length, scaled by the box's aspect so a wide box and a tall box bend alike; the lower and upper arcs, arch, bulge and shells weight a cosine bell across u by how far down or up the point sits; flag and rise are cubic and smoothstep profiles along u; wave is a sine sheared by v; fisheye swells inside a circle reaching the corners; inflate and squeeze scale out or in by the bell of the other axis; twist turns by an angle that eases to zero at 1.5 radii. Horizontal and vertical distortion are applied together after the style, each an exponential perspective scale of one axis by the other.

### src/engine/live.ts · blend correspondence
- refers-to: src/engine/live.ts :: stops, withStops, corresponding, alignStart, pairPaths, smoothSteps
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Each subpath's anchors are placed by their fraction of its length; each side is cut at the other side's fractions, so both end up with the same anchors at the same fractions. Straight segments are cut as straight lines with retracted handles, so a blend between polygons stays straight. Closed shapes are turned to the same winding and the second is rotated so its first anchor sits at the same angle from its centroid as the first's. Smooth Color picks the step count from the CIE76 difference between the two solid fills (one step per 1.15, between 1 and 220), and 24 when either fill is not a solid colour.

## src/engine/snap.ts

### src/engine/snap.ts · targets and matching
- refers-to: src/engine/snap.ts :: collectTargets, nearestRule, nearestSpot, snapPoint, fitAxis, snapRect
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Built once per drag. Every visible object adds its box as three columns and three rows (sides and centre) and a centre spot; the anchors of the first 6000 objects are added as spots; artboards add their rules and four corner spots; guides add rules that span the pasteboard. Columns and rows are kept sorted and searched by bisection. Spots sit in a spatial hash of 64-unit cells; when the search window covers more cells than the hash holds, it scans every spot instead. A point takes the best spot first, scored by distance plus a rank penalty (anchor, then artboard corner, then centre) so an anchor wins a close call, and otherwise the nearest column and row. `hit` tells the stage which happened, so the angle guide only runs when no spot won. A moving box tries its sides and centre on each axis and prefers like-for-like matches (centre to centre, side to side) by a quarter of the tolerance.

## src/engine/kernel.ts

### src/engine/kernel.ts · paper.js
- refers-to: src/engine/kernel.ts :: module
- kind: rationale
- logged: v0.9.0 · 2026-10-07

paper.js (MIT) does booleans, intersections, offset and simplify on real curves. It runs headless on a detached project; the document model stays formpth's and nothing else imports paper.

## src/engine/ops/recolor.ts

### src/engine/ops/recolor.ts · RECOLOR
- refers-to: src/engine/ops/recolor.ts :: RECOLOR, mapFn, nearestFn
- kind: explainer
- logged: v0.9.0 · 2026-10-07

One `ColorFn` per Edit Colors action (invert, grayscale, cmyk, rgb, saturate, hue, brightness). `mapFn` maps by hex for Recolor Artwork; `nearestFn` fits to a palette by nearest RGB distance. `recolorDoc` walks fills, strokes, gradient stops, mesh points and type spans.

## src/engine/text.ts

### src/engine/text.ts · layout
- refers-to: src/engine/text.ts :: layoutText, caretAt, indexAt
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Point type lays out lines from the baseline at the node's origin; area type wraps in its frame with columns and rows; path type places glyphs along the path. Caret math works in the node's local space; callers invert `xf` first.

### src/engine/text.ts · line slots
- refers-to: src/engine/text.ts :: layoutLines, bandRange, cutBand, keepBand
- kind: rationale
- logged: v0.10.0 · 2026-10-07

Line breaking and line placement used to run in two passes, breaking every paragraph at the column width before any line had a y. Text wrap makes the width depend on y, so `layoutLines` now places a line first, asks `slots` which horizontal runs of the column are free in that line's band (ascent to descent), and breaks into each run in turn, so type can sit on both sides of a wrap object. A band with no run wide enough (one and a half times the type size) moves the line down by its leading. The break rules are unchanged: break after a space, tab or hyphen, keep a trailing space on the line, split a word only when it alone is wider than the run. A wrap shape with `invert` keeps only the run inside the shape, measured at both edges of the band so a line never pokes out of a curve; area type in a non-rectangular shape uses that for its own `framePath`.

## src/engine/flow.ts

### src/engine/flow.ts · reflow
- refers-to: src/engine/flow.ts :: reflow, threadChains, detachFrames; src/engine/index.ts :: edit, dragTo, restore, addProject, reflowAll
- kind: rationale
- logged: v0.10.0 · 2026-10-07

Layout is cached per node by identity and never reads the document, so anything that depends on other nodes is written into the text node as derived data by one pass, `reflow`, which `Engine.edit`, `dragTo`, `restore` and `addProject` run on every new document. `wrapShape` holds the outlines of the wrap objects above the type in its layer, in the type's local space, plus its own `framePath`; threaded frames hold their share of one story. The story is the concatenation of every frame's spans in chain order, so typing into any frame works without knowing about threads, and the pass deals the story back out frame by frame using each frame's overflow index. `reflow` returns the same document when nothing changed and costs one walk when there are no wraps, threads or shaped frames. Links that point at a missing, duplicated or non-area frame are dropped by the pass, which is how a duplicated threaded frame comes out unthreaded. `detachFrames` runs before a delete and for Release Selection so the text of a removed frame flows back into the rest of the thread instead of being lost. `reflowAll` reruns the pass without a history step when fonts finish loading, because the distribution depends on glyph widths.

## src/engine/symbolism.ts

### src/engine/symbolism.ts · instance tint and the symbolism operations
- refers-to: src/engine/symbolism.ts :: instanceArt, bakedInstance, applySymbolism; src/engine/types.ts :: SymbolNode.tint; src/engine/index.ts :: Engine.symbolism, breakSymbolLink, expandNode
- kind: rationale
- logged: v0.12.0 · 2026-10-07

A stained instance carries `tint` (a colour and an amount) and every reader draws `instanceArt`, the symbol's art with each paint mixed toward the tint by the amount, cached per art object and tint so a set of a hundred stained instances builds a handful of recoloured copies. Mixing the paints instead of compositing a coloured layer over the instance keeps the result identical in the canvas, SVG (one def per distinct tint) and PDF, and Break Link and Expand bake it with `bakedInstance`, which also carries the instance's opacity, blend and effects onto the art so screened and styled instances look the same after breaking. Every operation weights an instance by where its centre sits in the brush, one minus the square of the distance over the radius, so the edge of the brush barely moves anything; with no point (the agent tool) every instance in the set gets full weight. Intensity scales each step. Average pulls a value toward the mean of the instances under the brush, Random perturbs it, User Defined pushes it one way. The Styler copies a graphic style's effects, opacity and blend onto instances because fills and strokes have no geometry of their own on an instance to paint; Alt clears them.

## src/engine/pattern.ts

### src/engine/pattern.ts · lattices
- refers-to: src/engine/pattern.ts :: patternLattice, latticeCopies, tileOutline; src/engine/render.ts :: patternStyle; src/io/svg.ts :: Writer.paint
- kind: rationale
- logged: v0.12.0 · 2026-10-07

Every tile type is a rectangular repeat unit holding one or two copies of the art: grid is one copy per tile; brick by row is two rows with the second shifted by the brick offset; brick by column the same on columns; hex by column puts columns three quarters of a tile apart with every other one half a tile down, and hex by row the transpose. Because the unit is a rectangle, the canvas pattern, the SVG `<pattern>` and the pattern editing preview all repeat the same unit. The tile canvas draws the copies of the unit and its eight neighbours so art that spills over the tile edge wraps; the draw order follows the overlap setting, last drawn in front. The canvas tile is cached per pattern object, not per id, so an edited pattern always redraws (the old key, the JSON length, missed edits that kept the length). SVG pattern content is measured from the tile's corner, not the document origin, so the art is placed with the tile's position subtracted; before this the art of any pattern not made at the origin fell outside its own tile and exported empty.

### src/engine/pattern.ts · pattern editing sessions
- refers-to: src/engine/pattern.ts :: PatternSession, sessionGeometry; src/engine/index.ts :: enterPatternEdit, setPatternSession, exitPatternEdit, setPatternOptions, isolate, pruneSelection; src/engine/history.ts :: rewind
- kind: rationale
- logged: v0.12.0 · 2026-10-07

Pattern editing mode is isolation mode on a temporary group named Pattern Tile holding copies of the selection (Make) or of the pattern's art (Edit), so every tool, panel and agent call works on the tile unchanged. The session lives on the project, outside the document, so its preview settings (copies, dim, tile edge) never become history steps; only the art does. Size Tile to Art takes the tile from the art's bounds on every read, so moving or growing the art moves the tile; with it off, the width and height are centred on the art and spacing does not apply. Done removes the group, writes the pattern and its swatch, and squashes every step since entering into one Make Pattern or Edit Pattern step. Cancel rewinds history to the mark taken on entering, dropping those steps, so redo cannot bring the temporary group back. Undoing past the entry removes the group, and `pruneSelection` ends the session when its group is gone. Escape and Exit Isolation Mode mean Done.

## src/extensions/registry.ts

### src/extensions/registry.ts · snapRect
- refers-to: src/extensions/registry.ts :: ToolContext.snapRect
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Moving a selection snaps its box (edges and centre) to other objects and the grid, returning the correction; the stage draws the smart guide lines it found.

## src/tools/select.ts

### src/tools/select.ts · handles
- refers-to: src/tools/select.ts :: handleAt, beginTransform, dragTransform
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Handles 0 to 7 scale (Alt from centre, Shift proportional); 100 plus a corner index means the rotate zone just outside that corner (Shift snaps to 45 degrees). Moves use `snapRect`; Alt-drag copies on release.

### src/tools/select.ts · Direct Selection segment drag
- refers-to: src/tools/select.ts :: direct tool, segment drag
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Dragging a segment reshapes the curve by the minimum-norm change to both handles that moves the grabbed point to the cursor, so the curve bends where it was grabbed, as Illustrator does.

### src/tools/select.ts · Magic Wand
- refers-to: src/tools/select.ts :: magicWand, wand; src/engine/index.ts :: Engine.selectSimilar
- kind: rationale
- logged: v0.11.0 · 2026-10-07 (was a todo at v0.9.0: exact match only)

The options bar carries Illustrator's Magic Wand panel: Fill Color, Stroke Color, Stroke Weight, Opacity and Blending Mode, each checked or not, the first four with a tolerance (0 to 255 per RGB channel for colours, points for weight, percent for opacity). Every checked attribute must be within tolerance. Gradients match when their kinds and stop (or freeform point) counts agree and every colour is within tolerance; patterns match exactly. Shift adds and Alt subtracts. Unchecking everything falls back to fill colour, so a click always selects something.

### src/tools/select.ts · select behind
- refers-to: src/tools/select.ts :: BH; src/engine/index.ts :: Engine.selectBehind, hit; src/engine/hit.ts :: HitOpts.exclude
- kind: explainer
- logged: v0.11.0 · 2026-10-07

Ctrl-click (Cmd-click on macOS) hits again with the current selection excluded, so each click at the same spot steps one object further back; past the bottom it starts over from the top. Clicks more than 4 screen pixels apart start a new cycle. The newly selected object can be dragged straight away.

### src/engine/snap.ts · equal spacing
- refers-to: src/engine/snap.ts :: spacing, snapRect, SnapTargets.frames
- kind: rationale
- logged: v0.11.0 · 2026-10-07

Smart guides now also snap a moved object to equal gaps along each axis, among top-level objects that overlap it across that axis: centred between its two neighbours, or one gap past a neighbour that matches the gap between that neighbour and the next one. The nearer of the alignment snap and the spacing snap wins; when both land on the same spot both are drawn. Each matched gap is drawn as a measuring line with end ticks at the middle of the shared band.

### src/ui/stage.ts · Snap to Pixel
- refers-to: src/ui/stage.ts :: snap, snapRaw, snapBox, snapBoxRaw; src/engine/index.ts :: ViewFlags.snapPixel
- kind: explainer
- logged: v0.11.0 · 2026-10-07

View > Snap to Pixel rounds the result of every other snap: points land on whole document points (one point is one CSS pixel at 100 percent) and moved objects put their top-left corner on one. It works with smart guides and the grid off, since the rounding runs after them, so pixel art and icons stay crisp.

### src/tools/select.ts · loaded text
- refers-to: src/tools/select.ts :: L, outPortAt, placeLoaded
- kind: explainer
- logged: v0.10.0 · 2026-10-07

Clicking the out port of selected area type loads its text, as in Illustrator: the cursor turns into the loaded-text cursor, a click on a closed path or another text frame threads into it, a click on empty canvas makes a frame the size of the source, and a drag makes one the size of the drag. The new frame and the link are one gesture, so one undo removes both. Escape or another tool drops the loaded text. The port sits on the right edge 10 px above the corner, the same place `Stage.drawTextPorts` draws it.

## src/tools/pen.ts

### src/tools/pen.ts · shortcuts
- refers-to: src/tools/pen.ts :: curvature
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Curvature is `Shift+~` (Illustrator's key). The first draft used Shift plus backquote, which the shortcut parser does not produce.

## src/tools/draw.ts

### src/tools/draw.ts · click without drag
- refers-to: src/tools/draw.ts :: pendingShape, up handler
- kind: explainer
- logged: v0.9.0 · 2026-10-07

A click under a few screen pixels stores the point in `pendingShape` and runs the `shape-dialog` command, which asks exact sizes and draws at that point.

### src/engine/ops/live-shapes.ts · editing live shapes
- refers-to: src/engine/ops/live-shapes.ts :: normalizeLive, patchLive, liveShapePath, liveParams; src/ui/shape-fields.ts :: ShapeFields; src/tools/select.ts :: cornerWidgets, dragWidget
- kind: rationale
- logged: v0.11.0 · 2026-10-07

A live shape keeps its parameters in its own space plus the transforms applied since it was drawn (`xf`). Before any edit, `normalizeLive` folds the scale of `xf` into the parameters and keeps only rotation and translation in `xf`, so a rectangle stretched to twice its width reports and edits its real width, and its corner radius stays round instead of stretching. The rectangle keeps its top-left corner when W or H change; a polygon and a star keep their centre. Ellipse pie angles are counter-clockwise from three o'clock, as in Illustrator, and are flipped into the y-down `piePath`. The Shape section of the Properties panel builds every group of fields once and shows the one for the selected shape's kind. Corner widgets sit at the centre of each corner's arc (at least 14 screen pixels in), and dragging one projects the pointer on the corner's diagonal (the bisector for a polygon) so the radius follows the pointer exactly; Alt changes one rectangle corner. Widgets hide on shapes smaller than about 40 screen pixels so they never cover the bounding box handles.

## src/tools/freehand.ts

### src/tools/freehand.ts · Blob Brush
- refers-to: src/tools/freehand.ts :: blob
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The stroke outline unites with every overlapping shape of the same fill (`uniteAll`), as Illustrator's Blob Brush merges.

## src/tools/transform.ts

### src/tools/transform.ts · free distort
- refers-to: src/tools/transform.ts :: freeTransform
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Ctrl or Command on a corner switches to free distort: anchors are mapped bilinearly from the original box to the dragged quadrilateral.

## src/tools/paint.ts

### src/tools/paint.ts · Gradient tool
- refers-to: src/tools/paint.ts :: gradient
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Dragging sets the gradient's geometry (`geom`) on the selection's active paint; the annotator overlay shows the bar and its stops.

### src/tools/paint.ts · freeform gradients
- refers-to: src/tools/paint.ts :: FF, freeformTarget, freeformDown, freeformOverlay; src/engine/paint.ts :: freeformSampler, freeformPixels, freeformGradient; src/engine/index.ts :: Engine.setFreeform
- kind: rationale
- logged: v0.11.0 · 2026-10-07

Freeform points live in document coordinates inside the gradient, so each object owns its own points: `setFreeform` lays out four points (three in Lines mode) over each selected object's bounds instead of copying one gradient to every object, and the Gradient panel edits only the first selected object with a freeform fill. Colours come from the current gradient, or an analogous set around a saturated solid fill, or a fixed bright set for neutral fills. The field is inverse-distance weighting with the cube of the distance over each point's spread; Lines mode weights the nearest point on each segment and blends the two end colours along it. The renderer caches the field per gradient object and bounds, so a static freeform costs one image draw. A click inside the object adds a point in the colour already showing there, so adding a point never changes the picture until it is moved or recoloured. `FF.sel` is shared with the Gradient panel, which shows that point's colour and spread. `xfGradient` ignored the points of a gradient without `geom`, so moved freeform fills left their colours behind; points and spreads now transform. SVG has no freeform paint, so export writes the field as a 256 px image clipped to the shape.

## src/tools/symbolism.ts

### src/tools/symbolism.ts · Shifter, Scruncher, Sizer, Spinner, Stainer, Screener, Styler
- refers-to: src/tools/symbolism.ts :: S, step, stop, targets
- kind: explainer
- logged: v0.12.0 · 2026-10-07

One stroke is one drag preview (`beginDrag`, `dragTo` per step, `commitDrag` on release) so a whole stroke is one undo step and nothing reaches history while the mouse is down. Scruncher, Sizer, Stainer, Screener and Styler keep working while the pointer is held still, on a 90 ms timer at the last point, as the originals do; Shifter and Spinner need movement and use the drag vector. With no symbol set selected, a press on an instance selects its set. Diameter is shared with the Symbol Sprayer and the liquify tools; `[` and `]` change it.

## src/tools/type.ts

### src/tools/type.ts · activate
- refers-to: src/tools/type.ts :: typeTool, activate
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Choosing a type tool with nothing selected sets the fill to black and the stroke to none, as Illustrator does. Without it, type set after drawing shapes took their white fill and vanished on a white artboard.

## src/tools/view.ts

### src/tools/view.ts · Artboard tool
- refers-to: src/tools/view.ts :: artboard
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Drag on the pasteboard draws a new artboard; drag inside one moves it with its art (Alt duplicates it); its handles resize; Delete removes the active one.

## src/io/project-io.ts

### src/io/project-io.ts · artboard rect
- refers-to: src/io/project-io.ts :: serialize, docFromManifest
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Artboards carry `rect: [x, y, w, h]` beside `x, y, w, h` so other tools can read the manifest without knowing the engine's field names. Readers prefer `rect`. The cast in `docFromManifest` exists because the manifest type does not declare `rect`.

## src/io/svg.ts

### src/io/svg.ts · gradient href chains
- refers-to: src/io/svg.ts :: importSvg, gradPaint
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Follows `href` and `xlink:href` from gradient to gradient, guarding against cycles, and reads each attribute from the first gradient in the chain that has it, as browsers do.

### src/io/svg.ts · native round trip
- refers-to: src/io/svg.ts :: exportSvg preserve
- kind: explainer
- logged: v0.9.0 · 2026-10-07

With `preserve`, the base64 manifest goes in a metadata element with id `formpth-data` and images carry `data-formpth-src`; `importSvg` returns `native: true` and the exact document.

## src/io/pdf.ts

### src/io/pdf.ts · patterns inside form XObjects
- refers-to: src/io/pdf.ts :: Painter.pattern
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

A shading pattern's Matrix is relative to the default space of the content stream it is used in. On the page that is the flipped page matrix; inside a transparency group form XObject it is the identity.

### src/io/pdf.ts · readPdfNative
- refers-to: src/io/pdf.ts :: readPdfNative
- kind: removed-code
- logged: v0.9.0 · 2026-10-07

Decoding the embedded file by fetching a data URL depended on `fetch` accepting data URLs, which a stricter content security policy forbids; replaced by a manual base64 decode.

```ts
const bytes = new Uint8Array(await (await fetch(`data:application/octet-stream;base64,${b64}`)).arrayBuffer());
```

### src/io/pdf.ts · Blob parts
- refers-to: src/io/pdf.ts :: deflate, PdfFile.build
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

TypeScript 7 types `Uint8Array` as possibly backed by a SharedArrayBuffer, which `Blob` does not accept; the casts to `Uint8Array<ArrayBuffer>` are safe because every array here is created locally.

## src/io/raster.ts

### src/io/raster.ts · exportForScreens
- refers-to: src/io/raster.ts :: exportForScreens
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Each artboard and each scale and format becomes one file named after the artboard plus the suffix; SVG and PDF items call back into the writers; everything lands in one zip.

## src/io/fonts.ts

### src/io/fonts.ts · bundled faces
- refers-to: src/io/fonts.ts :: bundledLoader, import.meta.glob
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Inter and JetBrains Mono `.woff` files come from @fontsource through a lazy glob, so each face is fetched only when type uses it. Installed fonts are found and served by the engine's fonts service. A missing face draws with Inter.

### src/io/fonts.ts · OpenType shaping
- refers-to: src/io/fonts.ts :: installShaping, fontNow, subsOf, ligate, single, fractions, OT_ORDER; src/engine/text.ts :: Shaping, setShaping, items, drawText
- kind: rationale
- logged: v0.10.0 · 2026-10-07

Canvas 2D has no `font-feature-settings`, so a span that asks for OpenType features is shaped here from the parsed font: GSUB single and alternate substitutions, ligatures (longest first), Fractions as numerators, the fraction slash and denominators around a slash between digits, and Ordinals only on letters that follow digits. The result is glyph ids with advances (with GPOS kerning unless kerning is None), and the renderer fills each glyph's own outline, cached per font and glyph, so the canvas, Create Outlines and PDF draw the same glyphs. Spans without features keep drawing with `fillText`. The engine reaches this only through the `Shaping` interface, so it stays free of opentype.js. `fontNow` answers synchronously: a font that is not parsed yet starts loading, the span draws unshaped, and the load fires `fontsChanged` and the fonts callback so layout and threads redo. The bundled Inter latin subset carries only `frac`, `numr`, `dnom`, `tnum`, `pnum`, `calt`, `ccmp` and `locl`; installed fonts carry their full sets, and the Character panel disables what the current font lacks. Small Caps uses the font's `smcp` when it has one and otherwise draws capitals at 72 percent of the size. SVG export writes each shaped glyph in its own `tspan` with `font-feature-settings`, since per-character `x` positions would break a ligature.

## src/io/trace.ts

### src/io/trace.ts · pipeline
- refers-to: src/io/trace.ts :: traceImage
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Quantize (k-means, or a threshold for black and white), collect each colour's boundary as maximal horizontal and vertical runs between pixels inside and outside it, link the runs end to end into loops (inside on the left; where two boundaries meet at one vertex, take the sharpest right turn, so pixels of one colour that touch only at a corner join into one loop), simplify with RDP, smooth, and group each colour as an even-odd compound path.

### src/io/trace.ts · smoothing and the closed-loop fix
- refers-to: src/io/trace.ts :: smoothLoop; src/engine/geometry.ts :: simplifyPolyline
- kind: rationale
- logged: v0.12.0 · 2026-10-07

Every trace since 0.7.0 came out as slivers: RDP was handed each closed outline with its first point repeated at the end, measured every point against the zero-length chord between those two equal points, found no distance, and kept two points. `simplifyPolyline` now measures against the point itself when the chord has no length, which matters to the Pencil's closed loops too. The least-squares curve fit that followed overshot badly on the few points a rectangle simplifies to (handles reaching past the image), so outlines are now smoothed per vertex: a turn sharper than 50 degrees stays a corner, any other vertex gets handles along the line from its previous to its next point, a third of each neighbouring segment long. That keeps corners square and curves inside the hull of the outline.

### src/io/trace.ts · live tracing objects
- refers-to: src/io/trace.ts :: traceOptions, TRACE_VIEWS; src/engine/types.ts :: TraceInfo; src/app.ts :: trace, makeTrace; src/engine/index.ts :: setTraceView, expandTrace, releaseTrace, traceTargets; src/engine/render.ts :: drawTraceView; src/engine/transform.ts :: transformNode
- kind: rationale
- logged: v0.12.0 · 2026-10-07

A tracing object is a group carrying `trace`: the source image node, the options it was traced with, and the view. Its children are the result, so bounds, hit testing, selection, export and every path operation see ordinary paths, and transforming the group transforms the source image with it so tracing again lands in the same place. Views other than Tracing Result are drawn on screen only; exports and raster renders (`printing`) always show the result. Tracing again replaces the children and keeps the group's id, name, opacity and appearance; option changes from the panel merge into one undo step, and a run that finishes after a newer one started is dropped. Expand removes `trace`; Release puts the source image back (with a fresh id if a pasted copy already released the same image). `traceOptions` is shared by the panel, the menu commands and the agent tool so a preset name, explicit numbers and a mode combine the same way everywhere.

## src/plugins/host.ts

### src/plugins/host.ts · blocked tools
- refers-to: src/plugins/host.ts :: call
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Plugins reach every agent tool except `open_file`, `save_project`, `export_file` and `place_image`, so a plugin can never read or write the person's files.

## src/ui/stage.ts

### src/ui/stage.ts · two canvases
- refers-to: src/ui/stage.ts :: Stage
- kind: explainer
- logged: v0.9.0 · 2026-10-07

The scene canvas draws the pasteboard, artboards, the grid when it is in back, the art and the isolation veil; the overlay canvas draws rulers, guides, artboard names, selection marks in the layer colour, the bounding box, smart guides and the tool overlay. A tool drag only redraws the overlay unless the document changed.

### src/ui/stage.ts · fixes at typecheck
- refers-to: src/ui/stage.ts :: drawAnchors collect, mesh edges
- kind: removed-code
- logged: v0.9.0 · 2026-10-07

Mesh edges came from `n.outline`, which mesh nodes do not have; they now use the mesh's geometric bounds. An `else if` bound to the inner `for` loop's `if` in the anchor collector; braces fixed the binding.

### src/ui/stage.ts · text ports
- refers-to: src/ui/stage.ts :: drawTextPorts, traceEdges (text)
- kind: rationale
- logged: v0.10.0 · 2026-10-07

Selected area type shows an in port at its top left and an out port at its bottom right, and so does every other frame of its thread. A filled triangle marks a port that is threaded; a red plus on the out port marks overflow, in the `--danger` token through `StagePaint.danger`. Thread lines join an out port to the next in port when View > Show Text Threads is on (`ViewFlags.threads`). The overflow mark used to live in the text editor's overlay, so it showed only while typing; it moved here. The frame outline now goes through the node's `xf`, which it ignored before, so a moved or rotated text box outlined its original place; a frame with a `framePath` outlines that shape.

## src/ui/text-editor.ts

### src/ui/text-editor.ts · hidden textarea
- refers-to: src/ui/text-editor.ts :: TextEditor
- kind: explainer
- logged: v0.9.0 · 2026-10-07

A transparent textarea follows the caret so IME, clipboard and accessibility work, while the caret and selection are drawn on the overlay. The type node is created on the first input, so a stray click makes no empty object.

### src/ui/text-editor.ts · lineStep
- refers-to: src/ui/text-editor.ts :: lineStep
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Renamed from `vertical`, which collided with the public `vertical` flag for vertical type.

## src/ui/properties.ts

### src/ui/properties.ts · transform precision
- refers-to: src/ui/properties.ts :: TransformFields.sync
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Two decimals, so values fit the narrow fields in the Properties column; typed values keep full precision.

### src/ui/properties.ts · quick actions
- refers-to: src/ui/properties.ts :: PropertiesPanel quick actions
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Buttons run command ids from `app.ts` (for example `pf-unite`, `make-clip`, `create-outlines`), chosen by the selection's kinds, and are rebuilt only when that set changes (`quickKey`).

## src/ui/layers.ts

### src/ui/layers.ts · rows
- refers-to: src/ui/layers.ts :: LayersPanel.sync, fill
- kind: explainer
- logged: v0.9.0 · 2026-10-07

One `patchList` over the flattened tree; `create` fills the row immediately so a new row never shows empty. `--depth` indents and `--lc` carries the layer colour for the stripe and the selection square.

## src/ui/rail.ts

### src/ui/rail.ts · paintCss
- refers-to: src/ui/rail.ts :: paintCss
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

Returns a value for the `background` shorthand (the pattern case includes a size), so CSS must use `background: var(--paint)`, never `background-image`.

## src/ui/dock.ts

### src/ui/dock.ts · DEFAULT
- refers-to: src/ui/dock.ts :: DEFAULT
- kind: rationale
- logged: v0.9.0 · 2026-10-07

The default dock matches the Essentials workspace: Color, Layers, Appearance shown; Stroke, Symbols and Navigator groups hidden (Window shows them). With every group shown, Layers fell below the fold.

## src/ui/titlebar-tools.ts

### src/ui/titlebar-tools.ts · WORKSPACES
- refers-to: src/ui/titlebar-tools.ts :: WORKSPACES essentials
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Essentials follows Illustrator's: Properties beside the stage, Layers high in the dock.

## src/ui/panels/kit.ts

### src/ui/panels/kit.ts · evalNumber
- refers-to: src/ui/panels/kit.ts :: evalNumber
- kind: rationale
- logged: v0.9.0 · 2026-10-07

A small recursive-descent parser for `+ - * /` and parentheses, so fields accept arithmetic without `Function`, which the content security policy forbids.

### src/ui/panels/kit.ts · slider
- refers-to: src/ui/panels/kit.ts :: slider
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Wraps a drag in `beginGesture` and `endGesture` so the whole drag is one undo step.

## src/ui/panels/color.ts

### src/ui/panels/color.ts · gradient stop placement
- refers-to: src/ui/panels/color.ts :: GradientPanel.sync, place
- kind: rationale
- logged: v0.9.0 · 2026-10-07

`patchList` does not call `update` for new nodes, so stops and midpoints are placed by one `place` function used for both; before, a new stop appeared at the left edge for a frame.

### src/ui/panels/color.ts · swatch tiles
- refers-to: src/ui/panels/color.ts :: SwatchesPanel.fill
- kind: removed-code
- logged: v0.9.0 · 2026-10-07

Replaced by a guarded `--paint` variable, so an unchanged swatch is never rewritten.

```ts
setStyleVar(b, 'background', '');
b.style.background = s.name === '[Registration]' ? 'repeating-linear-gradient(45deg, #000 0 2px, #fff 2px 4px)' : paintCss(s.paint, this.engine);
```

## src/ui/panels/color-guide.ts

### src/ui/panels/color-guide.ts · Color Guide
- refers-to: src/ui/panels/color-guide.ts :: ColorGuidePanel; src/engine/harmony.ts :: harmonyColors, variations, HARMONY_RULES
- kind: rationale
- logged: v0.11.0 · 2026-10-07

The base colour follows the active fill or stroke colour, except when that colour came from the guide itself (its hex is in `shown`), so picking a harmony swatch does not move the harmony under the pointer. Twelve rules rotate and adjust the base in HSB; each gives five colours, and each colour gets seven variations (tints and shades, warm and cool, vivid and muted) in a fixed 5 by 7 grid. The cells are made once and only their `--sw` variable changes, so switching rules repaints without touching the DOM structure. The plus saves the five harmony colours as a swatch group in one undo step.

## src/ui/panels/color-picker.ts

### src/ui/panels/color-picker.ts · HSB scale
- refers-to: src/ui/panels/color-picker.ts :: ColorPicker.color, setColor
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

The picker keeps saturation and brightness in 0..1; `hsbToRgb` takes 0..100. Multiply on the way out, divide on the way in.

## src/ui/panels/navigator.ts

### src/ui/panels/navigator.ts · ActionsPanel rows
- refers-to: src/ui/panels/navigator.ts :: ActionsPanel.fill
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

Rows store their action in `dataset.action`. `dataset.key` belongs to `patchList`; writing it broke row identity.

## src/ui/panels/stroke.ts

### src/ui/panels/stroke.ts · new brushes and previews
- refers-to: src/ui/panels/stroke.ts :: BrushesPanel.create, options, ask, preview; src/engine/index.ts :: Engine.newBrush, editBrush, deleteBrush
- kind: rationale
- logged: v0.12.0 · 2026-10-07

New Brush asks the type and name, then the type's options, the same dialog Brush Options uses. Scatter, art and pattern brushes take the selected artwork: groups are flattened and every stroke is expanded into filled shapes first, because the brush engine draws filled pieces only, then the art moves to the origin. New brushes keep the art's own colours (colorization None), as Illustrator does. Deleting a brush that is in use leaves those strokes as plain strokes. The panel draws each brush along the same S-curve through the real brush geometry instead of a sketch of its type, at a stroke weight that fits its art in the row; a row redraws only when its brush's definition changes (`data-sig`).

## src/ui/errors.ts

### src/ui/errors.ts · ResizeObserver loop
- refers-to: src/ui/errors.ts :: ErrorLog.install
- kind: rationale
- logged: v0.12.0 · 2026-10-07

Browsers report "ResizeObserver loop completed with undelivered notifications" as a window error when a layout settles over two frames, for example when a hidden panel group is shown. Nothing failed, so the log ignores it instead of showing the error toast.

## src/ui/panels/type.ts

### src/ui/panels/type.ts · findReplaceDialog
- refers-to: src/ui/panels/type.ts :: findReplaceDialog
- kind: removed-code
- logged: v0.9.0 · 2026-10-07

The dynamic import of `engine/doc` became a static import; the module is in the main chunk.

```ts
for (const t of (await import('../../engine/doc')).allNodes(doc)) {
```

## src/ui/panels/text-styles.ts

### src/ui/panels/text-styles.ts · character and paragraph styles
- refers-to: src/ui/panels/text-styles.ts :: TextStylesPanel; src/engine/ops/text-styles.ts :: applyCharStyle, applyParaStyle, redefineTextStyle, charOverridden, paraOverridden
- kind: rationale
- logged: v0.10.0 · 2026-10-07

One panel class serves both style panels. A span links to its character style through `CharStyle.cs` and a text object to its paragraph style through `ParaStyle.ps`; applying copies the style's attributes into the span or the paragraph and keeps the link, so rendering never looks styles up. A paragraph style also carries character attributes (`ParaStyleDef.char`) that it applies under any span's own character style. Redefine copies the selected type's attributes into the style and reapplies it to everything linked, which is how a style is edited. The plus after the active style's name means the type differs from the style on some attribute; clicking the style again clears those overrides. The Normal rows reset the typographic attributes and unlink, but keep fill and stroke. The style id rides on `data-style` because `patchList` owns `data-key`.

### src/ui/panels/find-font.ts · Find Font
- refers-to: src/ui/panels/find-font.ts :: FindFontDialog; src/engine/ops/text-styles.ts :: fontsUsed, replaceFont
- kind: explainer
- logged: v0.10.0 · 2026-10-07

Lists every family and style the document's type uses with the number of objects using it. Find selects those objects; Change All replaces the family and style in every run that uses it in one undo step and starts loading the new face. The replacement lists come from the same `families` and `stylesOf` as the Character panel, so installed fonts appear once the engine has listed them.

## src/ui/panels/image-trace.ts

### src/ui/panels/image-trace.ts · Image Trace
- refers-to: src/ui/panels/image-trace.ts :: ImageTracePanel
- kind: explainer
- logged: v0.12.0 · 2026-10-07

The panel keeps its own options and loads them from a tracing object whenever the selection or that object's options change. With Preview on, an option change on a tracing object traces again after 280 ms of quiet; on a plain image nothing happens until Trace, because tracing a photo takes long enough that it should be asked for. Colours and Threshold share one slot and swap with the mode. The form and the hint are built once and swapped with `hidden`.

## src/ui/panels/pattern-options.ts

### src/ui/panels/pattern-options.ts · Pattern Options
- refers-to: src/ui/panels/pattern-options.ts :: PatternOptionsPanel; src/ui/stage.ts :: renderScene; src/app.ts :: syncChrome, make-pattern, edit-pattern, pattern-done, pattern-copy, pattern-cancel
- kind: explainer
- logged: v0.12.0 · 2026-10-07

Both states of the panel (the hint with Make Pattern, and the options form) are built once and swapped with `hidden`; every field writes the engine's session, which emits `render` and `options`, and the panel reads back on the next frame. Width and height show the tile the engine will save, so with Size Tile to Art on they follow the art as it is edited, and typing a size turns fitting off. The stage draws the copies at the dim opacity under the tile and the dashed tile outline in screen pixels, from the same lattice the pattern fill uses. The isolation bar swaps its exit button for Done, Save a Copy and Cancel while a session is open.

## src/ui/panels/preview-edit.ts

### src/ui/panels/preview-edit.ts · previewEdit
- refers-to: src/ui/panels/preview-edit.ts :: previewEdit, effectDialog
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Dialog previews run through the engine's drag preview (`beginDrag`, `dragTo`), so Cancel restores the document exactly and OK commits one history step.

## src/ui/form-dialog.ts

### src/ui/form-dialog.ts · askForm
- refers-to: src/ui/form-dialog.ts :: FormDialog.ask
- kind: explainer
- logged: v0.9.0 · 2026-10-07

One reusable dialog for every exact-values dialog: number, select, check, text, colour and note fields, an optional Preview box and an optional extra button (Copy in the transform dialogs).

## src/ui/palette.ts

### src/ui/palette.ts · stage paint tokens
- refers-to: src/ui/palette.ts :: paint
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Reads the stage colours from CSS custom properties once and caches them; `invalidatePaint` on theme change. The fallbacks only apply if a token is missing from `tokens.css`.

## src/styles/tokens.css

### src/styles/tokens.css · stage tokens
- refers-to: src/styles/tokens.css :: --cv-layer-color, --cv-smart, --cv-pasteboard, --cv-artboard, --cv-artboard-edge, --cv-guide, --cv-chip
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Added for the vector stage and the paint chips; `src/ui/palette.ts` reads them.

## src/styles/formpth.css

### src/styles/formpth.css · scope
- refers-to: src/styles/formpth.css :: whole file
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Every class the vector modules introduced: the fill and stroke widget, the Layers tree rows, the panel kit, Properties, Color, Swatches, Gradient, Stroke, Appearance, Symbols, Artboards, Links, Actions, type panels, the picker, status bar, home presets, New Document, dialogs. `.cv-stage-col` gets its own stacking context so the rulers stay under the Properties column that overlays the stage.

## Inherited from formvis

### src/styles/shell.css, panels.css, dialogs.css · unused rules
- refers-to: shell.css (.cv-vtl timeline block), panels.css (brushes, channels, frames, paths, kind, lock rows), dialogs.css (.cv-nd new document grid, liquify, curves)
- kind: todo
- logged: v0.9.0 · 2026-10-07

About 215 class rules came over with the formvis shell and are not used by formpth. They cost nothing at runtime; remove them block by block when those files are next edited.

### src/ui/panels/controls.ts · removed module
- refers-to: src/ui/panels/controls.ts :: whole file
- kind: removed-code
- logged: v0.9.0 · 2026-10-07

formvis's row controls (57 lines), superseded by `src/ui/panels/kit.ts` and imported by nothing; not shipped.
