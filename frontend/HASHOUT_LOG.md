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
    │   ├── style-libraries.ts  built-in graphic style libraries
    │   ├── stroke-gradient.ts  gradients along and across strokes as clipped pieces, stroke regions
    │   ├── livepaint.ts        Live Paint faces, gap closing and face paint
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
- src/engine/effects.ts
- src/engine/live.ts
- src/engine/snap.ts
- src/engine/render.ts
- src/engine/filters.ts
- src/engine/geometry.ts
- src/engine/kernel.ts
- src/engine/ops/recolor.ts
- src/engine/text.ts
- src/engine/flow.ts
- src/engine/symbolism.ts
- src/engine/livepaint.ts
- src/engine/threed.ts
- src/engine/pattern.ts
- src/engine/bounds.ts
- src/engine/ops/objects.ts
- src/engine/ops/expand.ts
- src/engine/style-libraries.ts
- src/engine/stroke-gradient.ts
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
- src/io/api.ts
- src/io/project-io.ts
- src/io/svg.ts
- src/io/pdf.ts
- src/io/pdf-read.ts
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
- src/ui/panels/stroke.ts
- src/ui/panels/type.ts
- src/ui/panels/text-styles.ts
- src/ui/panels/asset-export.ts
- src/ui/panels/image-trace.ts
- src/ui/panels/pattern-options.ts
- src/ui/panels/preview-edit.ts
- src/ui/panels/effect-gallery.ts
- src/ui/panels/three-d.ts
- src/ui/panels/appearance.ts
- src/ui/panels/attributes.ts
- src/ui/form-dialog.ts
- src/ui/palette.ts
- src/ui/icons.ts
- src/styles/tokens.css
- src/styles/formpth.css
- Inherited from formvis

## index.html

### index.html · theme boot script
- refers-to: index.html :: inline script in head
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Runs before any stylesheet so the saved theme profile and accent are on the root element before first paint (no theme flash on hard reload). Keep its PROFILES table in step with `src/ui/themes.ts` (same 15 ids, surface variables only; themes.ts re-applies everything after the bundle loads). Light profiles get `theme-light` on body through a MutationObserver the moment body exists. The comments formvis carried here were moved to this entry.

### index.html · content security policy
- refers-to: index.html :: meta http-equiv Content-Security-Policy; src/plugins/host.ts :: CSP
- kind: rationale
- logged: v0.17.0 · 2026-10-08

`frame-src 'none'; object-src 'none'` and nothing more. A frame's own policy cannot stop the frame navigating itself, so a plugin could have sent the document out as `location.href = 'https://host/?' + svg`; the parent's `frame-src` is what governs navigations inside its frames, and `'none'` refuses every one while `srcdoc` plugin frames still load (checked in Chromium: the navigation is refused, the frame runs). formpth has no other frames or plugins, so nothing else is affected. A fuller app policy (script, style, connect) was left out: Vite's dev client, inline styles set from code and the theme boot script would each need allowances, and the threat it would guard against is already covered by the plugin frames' own policy. The Tauri `security.csp` stays `null` for the reason in backend/HASHOUT_LOG.md (tauri origins left out of the bridge).

## vite.config.ts

### vite.config.ts · server
- refers-to: vite.config.ts :: defineConfig server and preview
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Ports 5230 (dev) and 5231 (preview) and 8230 (engine) so formpth runs beside formvis (5190, 8190). `host: false` keeps the dev server on localhost only; `strictPort` fails loudly instead of drifting.

## src/app.ts

### src/app.ts · opacity mask commands
- refers-to: src/app.ts :: commands disable-opacity-mask, unlink-opacity-mask, new-mask-clip, new-mask-invert, Object > Opacity Mask; src/ui/prefs.ts :: Prefs.newMaskClip, newMaskInvert, applyPrefs
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Disable and Unlink toggle (their labels read Enable and Link when the selection's mask is already off or unlinked). New Opacity Masks Are Clipping and Inverted are checked commands stored in preferences, so they survive a restart; `applyPrefs` copies them to `Engine.maskDefaults`. There is no Transparency panel menu (panel groups share one menu button across their tabs), so they live in Object > Opacity Mask.

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

### src/app.ts · Attributes, effect targets and style libraries
- refers-to: src/app.ts :: TAB_HOMES attributes, commands fx-*, effect-gallery, gs-lib-*, menus Window
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Attributes joins the Stroke group (Window > Attributes comes from `TAB_HOMES`). The `fx-*` commands and Effect Gallery pass the Appearance panel's `effectSlot()` and are enabled when it has one, so an effect lands on the targeted fill, stroke or layer. Window > Graphic Style Libraries lists one `gs-lib-<id>` command per library, which shows the Graphic Styles panel on that library. The Window menu is taller than a 1000 px window and scrolls, as it did before; hovering a submenu at the bottom needs the menu scrolled to it first.

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

### src/automation/agent-bridge.ts · live object tools
- refers-to: src/automation/agent-bridge.ts :: image_trace, live_paint, symbolism, gradient_mesh, edit_pattern, livePaintSummary, edit_anchors insert
- kind: explainer
- logged: v0.12.0 · 2026-10-07

Each tool calls the same engine methods as the menus and tools, so an agent's Live Paint group, tracing object, stained symbol set or edited pattern is the same object a person gets. `image_trace` with only `view` changes the view without tracing again. `edit_anchors` insert takes `t` as a fraction along a straight segment, converted to the curve parameter (the inverse of 3t squared minus 2t cubed) because a straight segment is stored as a cubic with its handles on its ends.

### src/automation/agent-bridge.ts · bridge session
- refers-to: src/automation/agent-bridge.ts :: AgentBridge.loop, refocused, setEnabled, secret; src/io/api.ts :: mcpSession, mcpNext, mcpResult, mcpStop
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The loop claims a secret from the engine before its first poll and sends it with every bridge call through `io/api.ts` (it used to `fetch` the bridge directly with a GET). 403 means the engine no longer knows the secret (it restarted), so the loop claims a new one after a second; 205 means another window took the bridge over, so the loop drops its secret and waits for this window to gain focus before claiming again, which hands the bridge back to whichever window the person is using without two windows taking it from each other in turn. The `allowed` flag now travels in the POST body (a missing flag means not allowed); turning agents off posts `stop` with the secret. The editor's own switch still decides whether a call runs (`this.on`).

### src/automation/agent-bridge.ts · attributes, item effects and style libraries
- refers-to: src/automation/agent-bridge.ts :: run cases attributes, apply_effect, graphic_style
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`attributes` checks that the objects have a fill rule at all before setting one (text and images have none), reverses through `pathOp('reverse')` so it is the same command as the menu, and answers with each object's rule from `fillRuleOf`. `apply_effect` with `item` checks every target has that item and refuses 3D effects (`isItemEffect`) with a message that says to drop `item`; the engine's `addEffect` does the work. `graphic_style` resolves libraries by id or name through `styleLibrary`; `apply` with `library` goes through `useLibraryStyle`, which adds the style and applies it in one history step.

### src/automation/agent-bridge.ts · gradient stroke mode, knockout and opacity masks
- refers-to: src/automation/agent-bridge.ts :: run cases set_stroke gradient_mode, set_object isolate knockout knockout_shape, opacity_mask; backend/app/routers/mcp.py :: TOOLS
- kind: explainer
- logged: v0.17.0 · 2026-10-08

New optional parameters only: `set_stroke` `gradient_mode` (within, along, across) fails with advice when no target has a linear or radial gradient stroke; `set_object` takes `isolate`, `knockout` (on, off, inherit, mapped to true, false, 'inherit') and `knockout_shape`, and says when none of the targets is a group or layer, since knockout only acts there. The new `opacity_mask` tool makes (topmost object in document order is the mask, whatever order the ids come in), releases, or sets clip, invert, disabled and linked, answering with each mask's settings; make also applies any of those settings it is given in the same step.

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

### src/engine/index.ts · fill rules, layer targets and graphic style links
- refers-to: src/engine/index.ts :: fillRuleOf, setFillRule, targetLayer, appearanceTarget, select, addEffect item, addGraphicStyle, graphicStyleOf, redefineGraphicStyle, breakGraphicStyleLink, loadStyleLibrary, useLibraryStyle, styleLinked, withStyle; src/engine/project.ts :: Project.layerTarget
- kind: rationale
- logged: v0.17.0 · 2026-10-08

`setFillRule` is one edit that leaves the selection alone (going through `run` would have selected the paths inside a selected group) and does nothing when every target already has the rule. A targeted layer is `Project.layerTarget`: `targetLayer` selects the layer's objects, as the Layers target always did, and then marks the layer so `appearanceTarget` returns it; any other `select` clears the mark, and panels pass the layer's id to the edits so the change lands on the layer, not its objects. A graphic style link is the `style` id on a node, but it only counts while the node still looks like the style (`styleLinked` compares the appearance, and opacity and blend for non-type objects), so editing an object by hand ends the link without every appearance edit having to clear it. Redefine updates the style and every object still linked, makes the source object linked, and unlinks objects that had drifted, all in one step. New Graphic Style now links its source object, as in Illustrator. `useLibraryStyle` adds a library style unless the document already has one of that name, and applies it, in one edit. `Project.layerTarget` is session state and is never saved.

### src/engine/index.ts · gradient stroke mode and new mask defaults
- refers-to: src/engine/index.ts :: setStrokeGradientMode, maskDefaults, makeOpacityMask, setObjectProps; src/engine/paint.ts :: resolvePaint, describePaint, hex
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`setStrokeGradientMode` changes only the mode of first strokes that already hold a linear or radial gradient (through groups and type, like the other paint edits) in one step, also updates the stroke paint new art gets, and returns false when no target has such a stroke, which the agent tool turns into advice. A global gradient swatch now keeps the stroke's own mode, like its angle. `maskDefaults` is what Make Mask starts with; the app loads it from preferences. `hex` now rounds and clamps: a colour mixed by `gradientAt` has fractional channels, and the SVG writer wrote them as invalid hex (`#ff.8...`), which browsers paint black; this already broke midpoint stops in exported gradients.

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

## src/engine/render.ts

### src/engine/render.ts · Path2D cache
- refers-to: src/engine/render.ts :: path cache WeakMap
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

Keyed by node identity. Never mutate a node in place: the cache would keep drawing the old geometry.

### src/engine/render.ts · filtered layer cache
- refers-to: src/engine/render.ts :: withLayer, layerCache, invalidateLayers
- kind: warning-context
- logged: v0.14.0 · 2026-10-07

A layer with an Effect Gallery filter is rendered whole, not clipped to the canvas (up to six million pixels), with its translation rounded to whole device pixels, and kept per node. Panning then redraws the cached canvas instead of running the filter again; it is rebuilt when the node, the document, the skip set, the zoom, the font epoch or the layer epoch changes. The stage bumps the layer epoch when a placed image finishes decoding, since the node and the document stay the same while its pixels arrive. Other raster effects stay clipped and uncached because they are cheap.

### src/engine/render.ts · effects on one fill or stroke
- refers-to: src/engine/render.ts :: drawShapeItems, drawItem, itemKey, strokeWith solo, drawBody layer; src/engine/effects.ts :: rasterEffectsOf, isItemEffect
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Vector effects on an item already changed its geometry (`itemGeometry`). Raster effects on an item (drop shadow, glows, feather, Gaussian Blur, the Effect Gallery) now draw that item alone into a `withLayer` sized to its geometry plus its stroke reach, run the effects there, and composite the result with the item's own opacity and blend mode; inside the layer the item is drawn `solo` (full opacity, normal blend) so those are applied once. Gallery filters on an item are cached like a node's, keyed by a token per geometry and item (`itemKey`), because one item object is shared by every object a graphic style was applied to. `rasterEffectsOf(effects)` is the list form `rasterEffects(n)` now calls. Layers draw their own fills and strokes over their children, as groups did.

### src/engine/render.ts · knockout groups
- refers-to: src/engine/render.ts :: knocksOut, knockoutShape, drawKnockout, drawKids, needsLayer, RenderContext.knockout; src/engine/types.ts :: NodeBase.knockout, knockoutShape
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`knockout` is now true, false or 'inherit' (old files hold true or nothing, which still read as on and off); 'inherit' takes the enclosing group's effective setting, carried down in `RenderContext.knockout`. A group or layer that knocks out always gets its own layer, and its children are composited one by one: each is drawn into a scratch canvas the size of its visual bounds, its coverage is erased from the group's buffer (destination-out) and then it is drawn over (source-over). Coverage is the child drawn at opacity 1 and without its opacity mask (a memoised variant node so the child's caches still hit), which gives the PDF knockout result for an isolated group: earlier siblings vanish under a later one and the later one keeps its own opacity. With Opacity and Mask Define Knockout Shape (`knockoutShape`) the child as drawn is its own coverage, so it knocks out in proportion to its opacity, which in a normal-mode group equals ordinary compositing. Knockout groups are isolated: a child with a blend mode blends with the group's own pixels, not the art under the group.

### src/engine/render.ts · gradient strokes
- refers-to: src/engine/render.ts :: strokeWith, strokeShape, gradientStroke
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`strokeShape` is the stroke geometry part of `strokeWith`, split out so a gradient stroke can draw its pieces into a layer and keep only what the same native stroke would cover (destination-in with the stroke drawn on a second canvas: drawing it straight onto the layer under an inside or outside clip would leave pixels outside the clip). The layer carries the stroke's opacity and blend mode; arrowheads are drawn after it like before.

## src/engine/filters.ts

### src/engine/filters.ts · model
- refers-to: src/engine/filters.ts :: runFilter, FilterFrame, RUNS
- kind: explainer
- logged: v0.14.0 · 2026-10-07

Each Effect Gallery effect is a function from unpremultiplied float planes to planes, run on the object's layer after it is drawn. Sizes in the parameters are points multiplied by the frame's scale, and noise, textures and cells are generated in the object's own space from the frame origin, so the look does not change with zoom or move while panning. Output alpha is the object's alpha except for the effects that move pixels (Radial Blur, Spatter, Sprayed Strokes, Glass, Ocean Ripple, Crystallize). Partly transparent edge pixels take the colour of their most opaque neighbour first, and fully transparent pixels stay black, which is why edge-finding effects outline the object's silhouette. The Sketch effects map tones between a foreground and a background colour, black and white by default, where Photoshop uses its current colours.

### src/engine/filters.ts · speed
- refers-to: src/engine/filters.ts :: boxPass, boxRows, streak, kuwahara
- kind: rationale
- logged: v0.14.0 · 2026-10-07

Every kernel is linear in the pixel count whatever its size. Blurs are three box passes, the vertical ones accumulated row by row for cache locality. Directional strokes are sliding windows along lines at 0, 45, 90 and 135 degrees rather than per-pixel sampling, which took seconds on a million pixels. The Kuwahara filter (Dry Brush, Fresco, Paint Daubs, Palette Knife, Sponge, Watercolor, Cutout) uses summed-area tables weighted by alpha, so quadrants outside the object never win. Cutout reduces colours with a few rounds of k-means on a sample instead of per-channel posterisation, which gave false colours on hue gradients.

### src/engine/filters.ts · Inflate
- refers-to: src/engine/filters.ts :: RUNS 3d.inflate
- kind: explainer
- logged: v0.15.0 · 2026-10-07

Inflate takes a chamfer distance transform of the object's silhouette, turns it into a quarter-circle height profile that reaches full height at the depth in from the edge (scaled by volume), smooths it in proportion to the depth so the ridges of the medial axis round off, and shades each pixel's own colour with the same lighting as the vector 3D effects. Face-on it is a per-pixel shade of the height field.

### src/engine/filters.ts · Inflate tilt
- refers-to: src/engine/filters.ts :: RUNS 3d.inflate; src/engine/threed.ts :: rotator
- kind: rationale
- logged: v0.16.0 · 2026-10-07

A tilted Inflate is ray-cast: each output pixel sends a ray through the inverse rotation into object space, where the solid is the silhouette between the flat base and the height field. The ray is clipped to the silhouette's bounding box (a first version marched a fixed span around the dome and cut off whatever the rotation moved further than the dome height), stepped at three quarters of a pixel (scaled with zoom so 4x stays under a second), and refined by bisection. A hit on the dome takes its normal from the height gradient, a hit on the wall from the alpha gradient, a hit on the base faces straight back; a ray that lands between pixel heights away from the edge counts as the dome, which removed a row of dark speckles along grazing ridges. Pixels whose neighbours disagree on hit or miss are re-cast four times for a soft edge. The output moves alpha, so `3d.inflate` is in `MOVES_ALPHA`; face-on keeps the original alpha unchanged.

### src/engine/filters.ts · Rasterize
- refers-to: src/engine/filters.ts :: RUNS rasterize.raster
- kind: explainer
- logged: v0.14.0 · 2026-10-07

The live Rasterize effect averages the object's pixels in cells of 72 divided by its resolution points, aligned to the object, so it shows the pixels it would have at that resolution at any zoom. A white background fills the object's bounds plus Add Around Object and makes them opaque. It sits in the Illustrator half of the Effect menu, not the gallery.

## src/engine/geometry.ts

### src/engine/geometry.ts · straight segments
- refers-to: src/engine/geometry.ts :: nearestOnSeg, splitSegmentAt
- kind: rationale
- logged: v0.12.0 · 2026-10-07

A straight segment is a cubic whose handles sit on its ends, so its points are not spread evenly along the curve parameter: a point a fraction u along the line is at parameter 0.5 minus sin(asin(1 minus 2u) / 3). `nearestOnSeg` projected the point onto the line, used the fraction as the parameter and so reported a point near the nearer end, up to a fifth of the length off. Hit tests on edges, the Add Anchor Point tool, the Scissors and the Live Paint edge bucket all missed or cut in the wrong place on straight lines. It now converts the fraction to the parameter, and `splitSegmentAt` keeps the two halves of a straight segment straight, with no handles, instead of giving them handles along the line.

## src/engine/kernel.ts

### src/engine/kernel.ts · paper.js
- refers-to: src/engine/kernel.ts :: module
- kind: rationale
- logged: v0.9.0 · 2026-10-07

paper.js (MIT) does booleans, intersections, offset and simplify on real curves. It runs headless on a detached project; the document model stays formpth's and nothing else imports paper.

### src/engine/kernel.ts · stroke outlines keep their corners
- refers-to: src/engine/kernel.ts :: strokeToPath, simplifyKeepingCorners
- kind: rationale
- logged: v0.17.0 · 2026-10-08

The outline of a curved stroke is built from flattened offsets and then fitted back to curves. paper's `simplify` fitted straight across corners, so a butt end came out as a bulge about a tenth of the width deep and miter tips were rounded, visibly in Expand Appearance, Outline Stroke and now the clip of gradient strokes in SVG and PDF. The outline is now cut at every vertex that turns more than 0.45 radians (butt ends, square caps, miter tips, inner join points) and each run between corners is simplified on its own, so corners stay sharp and the curves between them stay curves. A closed outline with no such corner is simplified whole as before.

## src/engine/ops/recolor.ts

### src/engine/ops/recolor.ts · RECOLOR
- refers-to: src/engine/ops/recolor.ts :: RECOLOR, mapFn, nearestFn
- kind: explainer
- logged: v0.9.0 · 2026-10-07

One `ColorFn` per Edit Colors action (invert, grayscale, cmyk, rgb, saturate, hue, brightness). `mapFn` maps by hex for Recolor Artwork; `nearestFn` fits to a palette by nearest RGB distance. `recolorDoc` walks fills, strokes, gradient stops, mesh points and type spans.

## src/engine/text.ts

### src/engine/text.ts · textOutline
- refers-to: src/engine/text.ts :: textOutline
- kind: warning-context
- logged: v0.15.0 · 2026-10-07

Builds type outlines synchronously from the shaping layer's loaded fonts, glyph by glyph in the layout's positions, and returns null until every face is loaded (the loader bumps the font epoch, so callers that cache on it retry). Glyph contours from the font arrive without close commands, so every subpath is marked closed; 3D needs closed contours for its caps.

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

## src/engine/threed.ts

### src/engine/threed.ts · scene
- refers-to: src/engine/threed.ts :: scene3d, Solid, Face; src/engine/effects.ts :: threeDFaces
- kind: explainer
- logged: v0.15.0 · 2026-10-07

Extrude & Bevel, Revolve and Rotate turn the object into solids (each path, compound path or outlined type with its fill and stroke colour), flatten them, build quads for the sides (and the bevel rings, inset along vertex normals), caps for the ends, and project them through a rotation about the solids' centre with optional perspective. The result is a list of plain painted faces, so the canvas, SVG, PDF, hit testing and Expand Appearance all consume the same geometry; `threeDFaces` caches it per node and font epoch and `effectPath` returns the faces' outlines for bounds and hit tests. Inflate is a raster effect instead (`filters.ts`), because a puffed surface has no clean polygon form.

### src/engine/threed.ts · ordering and shading
- refers-to: src/engine/threed.ts :: scene3d, shadeRgb, lightFactors
- kind: rationale
- logged: v0.15.0 · 2026-10-07

Sorting all faces by mean depth let side quads near the front edge of a wide cap (type, especially) paint over the cap, whose mean depth is its centre. Each solid is now drawn as a block: the cap facing away, its sides from far to near, then the cap facing the viewer; blocks are ordered by mean depth. Shading is two-sided (a normal is flipped to face the viewer) so face winding never matters. Sides take a flat shaded colour; a cap keeps the object's own paint (gradients and patterns included) with the shading laid over it as a shading-colour fill at one minus the light factor and a white fill at the highlight, which reproduces the flat shading exactly for plastic and matte. Thin strokes of each side's own colour hide antialiasing seams between neighbouring faces.

### src/engine/threed.ts · Map Art
- refers-to: src/engine/effects.ts :: threeDFaces, mapped, artBounds, reid; src/engine/threed.ts :: scene3dWith, Scene
- kind: explainer
- logged: v0.16.0 · 2026-10-07

`scene3dWith` returns the faces with the projection and the solids' centre, and marks each solid's front cap and whether it faces the viewer. Map Art places the symbol's art centred on the object (scaled and offset in points), carries it onto the front plane by the affine map estimated from projecting the centre and two points 50 pt along x and y, and clips it to the front cap. The cap is drawn as base paint, then the clipped art, then the shading overlay, so the art darkens and catches highlights with the surface; with Shade Artwork off the shading goes under the art. The art is re-identified per face so ids never collide with the document. An affine map is exact without perspective and close with it; Revolve has no flat front face, so Map Art is offered on Extrude and Plane only. The faces cache also keys on the document's symbols and swatches, since editing a symbol must redraw every face it is mapped onto.

### src/engine/threed.ts · shadows
- refers-to: src/engine/effects.ts :: threeDFaces
- kind: rationale
- logged: v0.16.0 · 2026-10-07

The shadow is the projected faces filled black in a group at the shadow opacity with Multiply and a Gaussian Blur effect at the softness, placed first so it sits under the object. Behind shifts it along the light direction by the distance. Below flattens it to 28 percent height against the lowest projected point and shears it away from the light, so taller parts fall further from the light as a ground shadow does (the first version sheared toward the light). Building it from the same faces keeps the canvas, SVG, PDF and Expand in step, and bounds come from the faces and the blur reach without a special case.

## src/engine/livepaint.ts

### src/engine/livepaint.ts · faces
- refers-to: src/engine/livepaint.ts :: planarFaces, cutSegments, computeFaces, liveFaces, gapClosers
- kind: rationale
- logged: v0.12.0 · 2026-10-07

A Live Paint group is a group carrying `livePaint`: its children are the edges and the faces are derived. Every edge is flattened to a polyline (0.1 pt), every segment is cut where it meets another (a sweep over x keeps that near linear), the pieces become an undirected graph with points snapped to a thousandth of a point, and dangling edges are peeled off because a dead end bounds nothing. Walking each half-edge and turning to the next neighbour clockwise traces every face: positive area is a bounded face, negative is the outside of a connected piece, and that outside becomes a hole in the smallest face that contains it, so a circle drawn inside a square makes a square with a hole plus the circle. Faces are straight polygons; the edges are drawn over them with their own curves. The first version subtracted thin stroked strips from a box with paper.js and took three seconds for a grid and a circle; this takes milliseconds. Faces are cached per children array, and a group that has only moved reuses the last faces translated, so dragging stays cheap. Gap detection joins the end of an open path to the nearest point of another edge, or to its own other end, when it is within the gap.

### src/engine/livepaint.ts · painting
- refers-to: src/engine/livepaint.ts :: liveFaceNodes, faceContains, interiorOf; src/engine/index.ts :: makeLivePaint, livePaintFill, livePaintEdge, setLivePaintGap, expandLivePaint, releaseLivePaint, syncPaintFromSelection
- kind: rationale
- logged: v0.12.0 · 2026-10-07

A face's paint is stored as a seed: a point and a paint. The face that contains a seed takes its paint, the last seed winning, so editing the edges re-flows colour the way Illustrator does: a face split in two keeps the colour in the half that holds the seed. Painting a face replaces the seeds already inside it. Make seeds every face from the fill of the topmost original shape that covered it, measured at a point inside the face (the middle of the widest run across a few scanlines), then strips the fills from the children so they are only edges. Edge painting (v0.13.0) splits the nearest child path where other edges cross it, through paper.js intersections, and styles only the piece under the click; the pieces become sibling paths with the original appearance, so the faces do not change and a later edge paint on a piece finds no crossings inside it. The Live Paint Selection tool keeps its faces as seed points and its edges as points on the edge in `Engine.livePaintSelection`; while that tool is active `setFill`, `setStroke` and `deleteSelection` act on them instead of on the group, and a whole Live Paint group selected with the Selection tool takes a new fill on every face rather than on its edge paths. Face nodes are synthesised with ids derived from the group's id and cached per faces and seeds, and the renderer, hit test, SVG and PDF writers all draw them under the edges. Selecting a Live Paint group or a tracing object no longer resets the Fill and Stroke widget to none, which made the bucket paint black after the first click.

### src/engine/ops/paths.ts · removed live paint helpers
- refers-to: src/engine/ops/paths.ts :: shapeRegions, livePaintFill, openAsRegion, interior
- kind: removed-code
- logged: v0.12.0 · 2026-10-07

The old bucket cut the selected shapes into a static group of filled faces and edges with `livePaintFill`, using `shapeRegions` for the hover preview and `openAsRegion` to turn open paths into thin regions. Both are replaced by the live faces in `src/engine/livepaint.ts`; the four functions (about 40 lines) were deleted.

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

## src/engine/bounds.ts

### src/engine/bounds.ts · item reach
- refers-to: src/engine/bounds.ts :: visualBounds, itemsReach, effectsReach, effectReach
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Visual bounds add, per visible item, its stroke reach plus the reach of its own effects (an offset outline, a shadow on a stroke), and groups and layers with their own fills and strokes add the same over their children. Without it a shadow on one stroke was clipped by the item layer and the dirty rectangle.

## src/engine/ops/objects.ts

### src/engine/ops/objects.ts · makeCompound fill rule and direction
- refers-to: src/engine/ops/objects.ts :: makeCompound, subArea
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Make Compound Path takes the bottom object's rule when it is a path or a compound path and Non-Zero Winding otherwise, Illustrator's documented default (it used to make even-odd unless the bottom was a compound). So that the result still has the holes people expect, the bottom object's subpaths keep their direction and every closed subpath from the objects above is turned to run opposite to the bottom's first closed subpath (`reversePath` where the signed area has the same sign): where a front path overlaps the bottom one the winding sums to zero. Even-odd ignores direction, so the reorientation never changes an even-odd result, and a compound switched to even-odd later looks the same for the usual nested and overlapping shapes. Paths dropped `live` already; reversed paths keep their anchors and handles.

### src/engine/ops/objects.ts · fillRuleTargets
- refers-to: src/engine/ops/objects.ts :: fillRuleTargets, setFillRule
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Paths and compound paths are targets; a path whose parent is a compound path (picked with Direct Selection) stands for that compound, since a subpath's own rule is never read; groups and other containers pass the rule to the paths inside. `PathNode.rule` already existed with `nonzero` for new paths, so no file format change was needed.

## src/engine/ops/expand.ts

### src/engine/ops/expand.ts · item raster effects
- refers-to: src/engine/ops/expand.ts :: expandAppearance
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Expand Appearance bakes an item's vector effects into the piece it makes, as before, and now keeps its raster effects live on that piece (on the shape itself, or on a group of the stroke's pieces), where they used to be dropped.

### src/engine/ops/expand.ts · shared stroke region and gradient strokes
- refers-to: src/engine/ops/expand.ts :: strokeParts; src/engine/ops/paths.ts :: pathOperation outline_stroke; src/engine/stroke-gradient.ts :: strokeRegion, dashPath, gradientStrokeNodes
- kind: removed-code
- logged: v0.17.0 · 2026-10-08

The stroke outline code (profile, dashes, alignment) moved to `strokeRegion` in `stroke-gradient.ts` so the exporters share it, and `dashPath` moved with it unchanged. A stroke with an Along or Across gradient expands to a clipping group of gradient-filled pieces (with an opacity mask for translucent stops) and its arrowheads, under a group with the stroke's opacity and blend mode. Outline Stroke now uses `strokeRegion` too: it used to ignore dashes and width profiles and gave inside and outside strokes half their width, because it intersected a stroke of the full width centred on the path instead of twice the width.

```ts
let outline: PathData;
if (s.profile && s.profile.length) outline = strokeOutline(d, s);
else {
  const dashed = s.dash.length ? dashPath(d, s.dash, s.dashOffset) : d;
  outline = strokeToPath(dashed, s.width * (s.align === 'center' ? 1 : 2), s.cap, s.join, s.miter);
  if (s.align !== 'center' && d.every((sp) => sp.closed)) outline = s.align === 'inside' ? boolean(outline, d, 'intersect', 'nonzero', rule) : boolean(outline, d, 'subtract', 'nonzero', rule);
}
// Outline Stroke, ops/paths.ts:
let d = strokeToPath(g.d, s.width, s.cap, s.join, s.miter);
if (s.align !== 'center' && g.d.every((sp) => sp.closed)) d = s.align === 'inside' ? boolean(d, g.d, 'intersect', 'nonzero', g.rule) : boolean(d, g.d, 'subtract', 'nonzero', g.rule);
```

## src/engine/style-libraries.ts

### src/engine/style-libraries.ts · STYLE_LIBRARIES
- refers-to: src/engine/style-libraries.ts :: STYLE_LIBRARIES, styleLibrary
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Five libraries generated in code, every style built only from things formpth renders and exports: Shadows and Glows (drop shadows, a long shadow made with a Transform effect of 40 copies on the lower fill only, glows, a neon stroke blurred under sharp ones, feather), Buttons (gradients, round corners, a gloss fill inset with Offset Path, inner glows), Outlines (sticker strokes, offset and inset strokes, stitched dashes, roughened ink, zig zag), Textures (Effect Gallery grain, watercolor, halftone, mosaic, stained glass and texturizer on the fill only, so strokes stay crisp) and Scribbles (scribble fills and crosshatch, pencil-sketch strokes). Many use effects on one fill or stroke, which is what makes them more than a fill and a stroke. Effects are built from their defaults (`effectDefaults`) with a few overrides, so a parameter added later gets its default. `styleLibrary` matches an id or a name, with spaces, dashes and underscores alike.

## src/engine/stroke-gradient.ts

### src/engine/stroke-gradient.ts · Along and Across as clipped pieces
- refers-to: src/engine/stroke-gradient.ts :: strokeGradient, gradientStrokeArt, buildArt, wedge, subStops, strokeRegion, gradientStrokeNodes
- kind: explainer
- logged: v0.17.0 · 2026-10-08

A gradient stroke whose `strokeMode` is along or across becomes art made of filled pieces, built once per stroke item and subpath list and reused while neither changes. Each subpath is flattened (tolerance a thirtieth of the half width, 0.05 to 0.35 pt); every flat segment gets a rectangle along its own normal from the stroke's band (half width each side, the profile's left and right width at that point, or the full width on the inside or outside for an aligned stroke, the side found by testing a point just off the first segment against the fill rule) plus a margin, and every corner gets a wedge on its outer side: a kite to the miter tip when the join is a miter within the limit, otherwise a fan of circumscribed arc points. Along paints each rectangle with a linear gradient from its start to its end holding the stops of that stretch of the length (stops with a midpoint are sampled in eighths) and each wedge with the colour at that corner; Across paints each rectangle with the gradient from one edge of its band to the other at its middle, and each wedge with a radial gradient from the corner sampled in sixteen steps. Rectangles overlap the next piece by up to a quarter of the half width and are drawn in path order, so every join is covered by the later piece and no background shows through anti-aliased edges. A closed subpath in Along mode puts the seam between end and start colour on the bisector of its first corner and splits that wedge in two. The pieces are clipped to the true stroke: on canvas by the native stroke (dashes, caps, joins and alignment exactly as Within), and in SVG, PDF, Expand Appearance and Outline Stroke by `strokeRegion`, the outlined stroke the expand code already made, now shared. Arrowheads are filled separately with the first and last piece's gradient.

### src/engine/stroke-gradient.ts · translucent stops
- refers-to: src/engine/stroke-gradient.ts :: GradientStrokeArt.alpha, opaqueStops, alphaStops; src/engine/render.ts :: gradientStroke; src/io/svg.ts :: Writer.gradientStroke; src/io/pdf.ts :: Painter.needsRaster
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Overlapping pieces would double a translucent stop where they overlap. When any stop is translucent the pieces carry the colours fully opaque and a second set of the same pieces carries the opacity as grey, and the grey set becomes a luminance mask: `withLayer`'s mask on canvas, a `<mask>` in SVG, an opacity mask on the expanded group. PDF has no cheap equivalent in the vector writer, so an object with such a stroke is rasterised there, as objects with opacity masks already are.

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

### src/tools/paint.ts · gradient mesh editing
- refers-to: src/tools/paint.ts :: M, meshSel, meshHandleAt, setMeshPoint, mesh tool; src/engine/mesh.ts :: removeMeshLines
- kind: rationale
- logged: v0.12.0 · 2026-10-07

Mesh handles are offsets from their point, so moving a point leaves them as they are; the old drag added the move to the offsets too and bent every line through a moved point twice as far. Clicking a point selects it for the tool (kept in `M.sel`, not in the document selection, which stays the mesh object); its four handles show as knobs and drag on their own, and the options bar gains Point colour and Opacity for it, which merge into one undo step while a slider moves. Lines are drawn as the real Bezier edges. A click inside adds lines in the fill colour and selects the new point; Shift keeps the colour already there. Alt-click removes the row and column lines through a point (an edge point loses only the line across the mesh), and the neighbouring handles are reset to a third of the new span so the patch stays smooth.

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

## src/io/api.ts

### src/io/api.ts · bridge calls
- refers-to: src/io/api.ts :: mcpSession, mcpNext, mcpResult, mcpStop, BRIDGE_HEADER, BridgeItem
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The window's side of the agent bridge goes through here now, as every other engine call does. `mcpSession` POSTs for a secret (null when the engine refuses or is down); `mcpNext` POSTs `{allowed}` with the secret in `X-Formpth-Bridge` and returns the status with the item, because the loop acts on 204, 205 and 403 differently; `mcpResult` and `mcpStop` carry the secret too. The unused GET-based `mcpNext` they replace took no secret.

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

### src/io/svg.ts · baked gallery effects
- refers-to: src/io/svg.ts :: Writer.baked
- kind: rationale
- logged: v0.14.0 · 2026-10-07

SVG filter primitives cannot express the Effect Gallery effects, so an object carrying one is drawn whole (with its other effects) at the document's raster resolution, capped at sixteen million pixels, and written as an image at its visual bounds with its opacity and blend mode. With `preserve` the editing data still holds the live effect, so formpth reopens it editable.

### src/io/svg.ts · item filters and layer appearance
- refers-to: src/io/svg.ts :: Writer.shape, Writer.item, Writer.baked, Writer.node layer
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`shape` writes each item through `item` and, when the item has raster effects, wraps just that item's elements in a `<g filter>` built by the same `filter` as objects use, so a shadow on a stroke stays on the stroke. An Effect Gallery filter on any item bakes the whole object to an image, as one on the object does. Layers now write their own fills and strokes over their children, and their blend mode and raster effects on the layer `<g>`; a layer with a gallery effect is baked inside its `<g id>` so it still opens as a layer. The outside-stroke mask now honours even-odd.

### src/io/svg.ts · knockout groups and gradient strokes
- refers-to: src/io/svg.ts :: Writer.kids, Writer.knockout, Writer.gradientStroke, Writer.ko
- kind: explainer
- logged: v0.17.0 · 2026-10-08

SVG has no knockout, so a knockout group's children are each masked by the inverse of what comes later: a chain of `<g id="kosN">` in defs holds each later child at opacity 1 without its mask plus a `<use>` of the next link, and child i gets a luminance mask of a white rect with the chain from i + 1 drawn through a filter that turns every colour black and keeps alpha. One chain per group keeps the file linear in the number of children. Children with Opacity and Mask Define Knockout Shape are left out of the chain because in an isolated normal-mode group their knockout equals ordinary compositing. The mask and filter regions are the group's visual bounds. A gradient stroke is a `<g>` with the stroke's opacity and blend mode holding the pieces under a clip path of `strokeRegion`, plus the arrowheads; translucent stops add a mask of the grey pieces.

## src/io/pdf.ts

### src/io/pdf.ts · group and layer items
- refers-to: src/io/pdf.ts :: Writer.needsRaster, Writer.body
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Groups and layers draw their own fills and strokes over their children; the PDF writer skipped them, so a group stroke was on screen and in SVG but not in PDF. An object whose items carry raster effects is rasterised at the document's resolution, like one with raster effects of its own.

### src/io/pdf.ts · knockout groups
- refers-to: src/io/pdf.ts :: Painter.node, group, kids, rasterize, extGState ais, invert
- kind: rationale
- logged: v0.17.0 · 2026-10-08

A knockout group is always a transparency group form XObject with `/K true`, and each child with more than one painting operation is its own form so it knocks out as one object, as on canvas. `/K` alone was not enough: poppler's Splash renderer (pdftoppm) and PDFium (Chrome's viewer) ignore it and drew the group as an ordinary one; only poppler's Cairo backend honoured it. So the writer also builds the knockout out of soft masks, which every viewer tested supports: each child but the last is drawn under an `/S /Alpha` soft mask whose group is a chain of forms holding the later children at opacity 1, with a transfer function 1 minus x, so it shows only where nothing later covers it. With `/K` honoured the result is the same, since the masked areas are already empty. Children with Opacity and Mask Define Knockout Shape are left out of the masks and drawn with `/AIS true`; because Cairo ignores `/AIS` and then knocked them out fully, `/K` is only written when no child sets that option (without `/K`, the masks give the right picture). The mask forms all take the whole group's box: Splash leaves a soft mask at zero outside its group's BBox instead of applying the transfer function, which hid parts of children. A rasterised child in a knockout group is drawn with `/AIS true` so its image's soft mask counts as shape; its opacity then also counts as shape, a small difference from canvas for semi-transparent rasterised children.

### src/io/pdf.ts · gradient strokes
- refers-to: src/io/pdf.ts :: Painter.gradientStroke, Painter.shape, node multi
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Along and Across strokes are the pieces filled with shading patterns inside a clip of `strokeRegion`; with stroke opacity or a blend mode they go in an uncompressed form XObject drawn with that ExtGState so overlapping pieces do not darken, and arrowheads are filled after it. An object with such a stroke (or a brush stroke) counts as several painting operations, so node opacity on it also makes a form. Translucent stops rasterise the object (see stroke-gradient.ts).

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

## src/io/pdf-read.ts

### src/io/pdf-read.ts · object discovery
- refers-to: src/io/pdf-read.ts :: PdfFile.init
- kind: explainer
- logged: v0.13.0 · 2026-10-07

Objects are found by scanning for `n g obj` rather than trusting the cross-reference table, so files with broken offsets, incremental updates and linearization open the same way; later definitions win, which is what an incremental update means. Compressed object streams are unpacked after the scan and never override an object defined in the clear, and a cross-reference stream only supplies the trailer's Root when no classic trailer exists.

### src/io/pdf-read.ts · page placement
- refers-to: src/io/pdf-read.ts :: readPdfVector
- kind: explainer
- logged: v0.13.0 · 2026-10-07

Each page becomes an artboard laid out left to right with a 40 pt gap, and its art a group named after it. The page matrix flips PDF's y-up space to formpth's y-down space at the crop box (the media box when there is none) and applies the page's Rotate, so rotated pages arrive upright the way a viewer shows them. Pages past 200 are left out to keep a single document workable.

### src/io/pdf-read.ts · clipping
- refers-to: src/io/pdf-read.ts :: Painter.finish
- kind: warning-context
- logged: v0.13.0 · 2026-10-07

A clip set with `W n` applies to everything painted until the graphics state that set it is restored, so each clip opens a clip group that collects the following art and closes at the matching `Q`; the clip path is the group's first child as formpth's clip groups expect. Clip groups that end up empty are pruned, which removes the many page-sized clips that producers emit.

### src/io/pdf-read.ts · type
- refers-to: src/io/pdf-read.ts :: Painter.show, FontNames, fitRun
- kind: explainer
- logged: v0.13.0 · 2026-10-07

Each text-showing operator becomes one point type object with the text decoded through ToUnicode, the encoding's Differences or WinAnsi. TJ gaps wider than 0.18 em become spaces, each in its own span tracked so the space is exactly as wide as the gap, and the whole run is then tracked to the width the PDF gave it, so substituted fonts never overlap the next run. A font resolves first by PostScript name against the installed fonts, then by family name with Latin Modern's `LM` prefix and optical size digits handled, and otherwise falls back to Courier New, Times New Roman or Helvetica by its class; the fallbacks are reported. Fonts without widths (the standard 14) are measured with the resolved family, whose metric-compatible faces keep runs in place. Type 3 fonts are drawn as paths by running their glyph procedures.

### src/io/pdf-read.ts · colour and shading
- refers-to: src/io/pdf-read.ts :: Painter.color, Painter.shading
- kind: explainer
- logged: v0.13.0 · 2026-10-07

DeviceGray, DeviceRGB and DeviceCMYK map to formpth's gray, rgb and cmyk colours so a CMYK document stays CMYK. ICCBased spaces use their alternate by component count, Indexed looks up its palette, and Separation and DeviceN evaluate their tint transform. Axial and radial shadings become linear and radial gradients sampled from their function; mesh shadings and tiling patterns are reported and filled grey, because formpth has no faithful equivalent to translate them to.

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

### src/io/fonts.ts · contextual substitution and glyph alternates
- refers-to: src/io/fonts.ts :: gsubFeature, applyLookup, contextMatch, covIndex, classOf, glyphAlternates; src/engine/types.ts :: CharStyle.alt; src/ui/panels/type.ts :: GlyphsPanel.syncAlts, caretMoved
- kind: rationale
- logged: v0.13.0 · 2026-10-07

opentype.js reads GSUB but applies only single, alternate and ligature lookups, so `calt`, `clig` and `rlig` run through a small GSUB interpreter over the parsed tables: single (both formats), alternate (first choice), ligature, and contextual and chaining contextual lookups in all three formats (glyph sequences, class sequences, coverage sequences), whose records call nested lookups at positions inside the match. Lookups run in lookup list order, one pass each, as the specification orders them; lookup flags (skip marks) are not honoured, which Latin text seldom needs. With it, JetBrains Mono's code ligatures and Inter's arrows and case-aware hyphens appear. A per-character glyph alternate is `CharStyle.alt`, a glyph id applied when its span shapes to a single glyph; the Glyphs panel lists the base glyph and every glyph that `aalt`, `salt`, `swsh`, the stylistic sets, character variants, small caps and similar features map it to, drawn from the font's outlines because most alternates have no code point. Picking one styles just the selected character. SVG text cannot name a glyph id, so an alternate shows in SVG only when type is outlined; the canvas, Create Outlines and PDF draw it. The panel learns about caret moves through the editor's redraw hook and compares a key before doing any work, so the caret blink costs one string comparison.

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

### src/plugins/host.ts · network isolation
- refers-to: src/plugins/host.ts :: CSP, RUNTIME, PluginHost.load; index.html :: Content-Security-Policy meta
- kind: rationale
- logged: v0.17.0 · 2026-10-08

A plugin can call `get_svg` and `get_document`, so its frame must not be able to send anything out. Each frame's `srcdoc` starts with a policy meta before any script: `default-src 'none'`, inline scripts and `eval` only (eval reaches no network, and plugins may use it), inline styles, `data:` and `blob:` images, `data:` fonts, and `connect-src`, `frame-src`, `child-src`, `worker-src`, `object-src`, `form-action` and `base-uri` all `'none'`, plus `x-dns-prefetch-control: off` and `referrerpolicy="no-referrer"`. Navigating the frame away is refused by the app's own `frame-src 'none'` (see index.html), which a frame's policy cannot do. CSP has no control over WebRTC (Chromium does not implement the `webrtc` directive; a test frame sent STUN packets under `connect-src 'none'`), so the runtime makes the RTC constructors `undefined` and non-configurable before the plugin's code runs; a fresh constructor cannot be taken from a nested frame, because without `allow-same-origin` every nested document gets its own opaque origin (tested: reading it throws a SecurityError). Checked in the app with a plugin that read the SVG and tried `fetch`, an image and `RTCPeerConnection`: the tool call worked and all three were blocked. Plugins keep the DOM; running them in a Worker would close more doors but break plugins that parse SVG with `DOMParser`.

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

### src/ui/layers.ts · layer target circle
- refers-to: src/ui/layers.ts :: LayersPanel.bind, fill; src/engine/index.ts :: Engine.targetLayer
- kind: explainer
- logged: v0.17.0 · 2026-10-08

A layer's target circle targets the layer itself (`targetLayer`): its objects are selected as before and the Appearance panel shows the layer. With Shift, Ctrl or Cmd it still adds the layer's objects to the selection. The circle gets a ring while its layer is targeted (`is-targeted`) and fills when the layer has an appearance of its own (fills, strokes, effects or a blend mode; layer opacity is the Dim Images setting, so it does not count).

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

### src/ui/panels/stroke.ts · Transparency panel knockout and mask controls
- refers-to: src/ui/panels/stroke.ts :: TransparencyPanel, triCheck; src/styles/formpth.css :: .cv-transp-mask
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Knockout Group is a native checkbox cycled off, on, inherit (shown as the indeterminate dash, with a title saying which) and back to off, as Illustrator's three-state box; every state change is one Knockout step. Opacity and Mask Define Knockout Shape sits under it. The mask row gained Disable and Link beside Clip and Invert Mask and wraps onto a second line; it is still built once and only hidden. All values are patched with the guarded setters, including `indeterminate`.

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

## src/ui/panels/asset-export.ts

### src/ui/panels/asset-export.ts · Asset Export
- refers-to: src/ui/panels/asset-export.ts :: AssetExportPanel; src/io/raster.ts :: exportAssetsZip; src/engine/index.ts :: addExportAssets, renameExportAsset, removeExportAssets; src/engine/types.ts :: Doc.exportAssets
- kind: rationale
- logged: v0.13.0 · 2026-10-07

Assets are stored in the document as names and object ids, not copies, so an asset always exports the art as it is now, and an asset whose art was deleted shows dimmed and is skipped. `exportAssets` is optional on `Doc` so older files need no migration. Each asset exports cropped to its visible bounds: raster formats render only its objects (`only`), SVG uses the writer's `ids`, and PDF writes a one-page document through a view of the project whose `doc` has a single artboard over the asset and a single layer holding its objects (`Object.create(p)` keeps the project's images). Names that repeat in one export get a number. Thumbnails redraw only when one of the asset's node objects changes identity. The format rows are built once and added or removed one at a time.

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

### src/ui/panels/preview-edit.ts · effect slots
- refers-to: src/ui/panels/preview-edit.ts :: effectDialog, EffectSlot
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`effectDialog` takes an `EffectSlot`: the node, the effect's index (-1 to add a new one) and optionally an item. With an item it edits or appends that fill's or stroke's effects; without one, the object's. A slot naming a node (a targeted layer) applies there instead of to the selection. A 3D effect asked for on an item goes to the object, with a notice, because it turns the whole object.

## src/ui/panels/three-d.ts

### src/ui/panels/three-d.ts · ThreeDPanel
- refers-to: src/ui/panels/three-d.ts :: ThreeDPanel; src/engine/index.ts :: Engine.set3d
- kind: explainer
- logged: v0.15.0 · 2026-10-07

The panel edits the first 3D effect on the selection through `set3d`: a kind button adds one or switches it while keeping the parameters the new kind shares (rotation, material, lighting), a select value the new kind does not offer falls back to its default, and sliders run inside a gesture so a drag is one history step. All controls are built once; the parts for each kind are only hidden and shown.

### src/ui/panels/three-d.ts · Map Art and Shadow
- refers-to: src/ui/panels/three-d.ts :: ThreeDPanel
- kind: explainer
- logged: v0.16.0 · 2026-10-07

Map Art shows for Extrude and Plane, Shadow for every kind but Inflate, and Inflate now shares the Rotation part with Perspective hidden. The symbol select lists the document's symbols by id with None first; its options are rebuilt only when that list changes, because it syncs on every document change. The panel stores the symbol id and the agent tool resolves a name to the id, so renaming a symbol keeps the mapping.

## src/ui/panels/effect-gallery.ts

### src/ui/panels/effect-gallery.ts · EffectGallery
- refers-to: src/ui/panels/effect-gallery.ts :: EffectGallery
- kind: explainer
- logged: v0.14.0 · 2026-10-07

The dialog is built once on first use. Thumbnails and the preview have fixed canvas sizes and are drawn from the selected objects with each effect appended, the thumbnails a few at a time per frame (about ten milliseconds) so opening never stalls, the preview on the next frame after any change. Each effect's options page is created the first time it is picked and then only hidden and shown, so switching effects never rebuilds a page. The preview stays in the dialog and the document is untouched until OK, which adds the effect as one history step through `addEffect`; a double-click on a thumbnail picks it and applies it.

### src/ui/panels/effect-gallery.ts · item slot
- refers-to: src/ui/panels/effect-gallery.ts :: EffectGallery.run, draw, finish, item
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`run` takes the Appearance panel's slot: the thumbnails and the preview then show the effect on the targeted fill or stroke only, and OK adds it there (or to the targeted layer).

## src/ui/panels/appearance.ts

### src/ui/panels/appearance.ts · targeted items
- refers-to: src/ui/panels/appearance.ts :: AppearancePanel.rows, effectSlot, pick, duplicate, remove, shift, toggle, sync, fill; src/app.ts :: fx commands, effect-gallery
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Rows are keyed `i<n>` for items, `i<n>e<k>` for an item's effects (listed under it, indented), `c` for Contents on groups and layers, `e<k>` for the object's effects and `o` for opacity, so adding or moving an effect patches rows in place. Clicking a fill or stroke row targets it; `effectSlot` hands that target to every Effect menu command and to the Effect Gallery, which is how Illustrator applies an effect to the targeted item, and is also how a targeted layer receives effects. The target clears when the panel's object changes, so a stale pick never redirects a later effect. A stroke's name opens the weight dialog only once the stroke is targeted, so the first click can target it. Contents shows where a group's or layer's own fills and strokes draw (over the contents) and cannot be hidden or moved, like the Opacity row. The panel's object is `appearanceTarget`, and every edit passes the layer's id when a layer is targeted.

### src/ui/panels/appearance.ts · GraphicStylesPanel
- refers-to: src/ui/panels/appearance.ts :: GraphicStylesPanel.showLibrary, redefine, sync, fill; src/engine/style-libraries.ts :: STYLE_LIBRARIES
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The Library select switches the grid between the document's styles and a built-in library (tiles keyed `<library>:<index>`); clicking a library tile adds the style to the document and applies it, and Redefine and Delete are disabled while a library shows. The style the target is linked to gets `is-linked`; the clicked one gets `is-picked`, and Redefine uses the picked style, else the linked one. Break Link now calls the engine method the agent tool uses.

## src/ui/panels/attributes.ts

### src/ui/panels/attributes.ts · AttributesPanel
- refers-to: src/ui/panels/attributes.ts :: AttributesPanel; src/engine/index.ts :: fillRuleOf, setFillRule, pathOp reverse, setObjectProps note
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Fill Rule buttons (Non-Zero Winding, Even-Odd) with the current rule named beside them (Mixed when the targets differ), Reverse Path Direction, and the object Note. Show Center and Overprint are left out: formpth draws no centre point and has no separations or overprint preview, so either control would store a value nothing reads. `NodeBase.note` existed with no way to set or read it; the panel and the `attributes` tool now do, `get_object` returns it, and `.fpth` keeps it. The note is written on change (blur) and never overwritten while the field has focus. Built once; every value is patched with the guarded setters.

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

## src/ui/icons.ts

### src/ui/icons.ts · third-party icons
- refers-to: src/ui/icons.ts :: link, unlink, pilcrow, moveSel, maximize, smartObject (Lucide); paintbrush, hand (Remix Icon); quickSelect, bucket, dodge, burn, sponge (Phosphor)
- kind: warning-context
- logged: v0.16.1 · 2026-10-08

Most of this file is the NodeMode icon subset and icons drawn for formvis and formpth, but some entries come from outside sets and carry a license obligation recorded in `NOTICE.md`: six from Lucide (ISC, with its license text in NOTICE), two from Remix Icon (Apache-2.0) and five from Phosphor (MIT). Replacing one of these with an icon drawn here is fine; when the last icon from a set is gone, remove that set's row (and for Lucide the license section) from NOTICE. Adding an icon from any outside set needs its row in NOTICE in the same commit.

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
