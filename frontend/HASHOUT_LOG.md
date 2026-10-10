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
    │   ├── envelope.ts         envelope meshes, homographies, adaptive curve mapping
    │   ├── mesh.ts             gradient mesh
    │   ├── brushes.ts          calligraphic, scatter, art, bristle, pattern brushes
    │   ├── text.ts             type layout, styles, caret and index math
    │   ├── flow.ts             reflow: text wrap shapes and threaded stories
    │   ├── hyphen.ts           English hyphenation points, hyphenation and justification defaults
    │   ├── harmony.ts          colour harmony rules and variations
    │   ├── symbolism.ts        instance tint, instance art and the symbolism operations
    │   ├── pattern.ts          tile lattices and the pattern editing session
    │   ├── style-libraries.ts  built-in graphic style libraries
    │   ├── swatch-libraries.ts built-in swatch libraries, library from a document
    │   ├── brush-libraries.ts  built-in brush libraries
    │   ├── stroke-gradient.ts  gradients along and across strokes as clipped pieces, stroke regions
    │   ├── livepaint.ts        Live Paint faces, gap closing and face paint
    │   ├── puppet.ts           Puppet Warp mesh and as-rigid-as-possible solve
    │   ├── dimension.ts        live dimension groups and their labels
    │   ├── graph.ts            live graph groups: data table, nine graph types, designs, part styles
    │   ├── variables.ts        variables, data sets and applying a data set to the document
    │   ├── intertwine.ts       intertwine objects: member areas, overlap faces, zones
    │   ├── shaper.ts           Shaper gesture recognition, Shaper Group faces and scribbles
    │   ├── perspective.ts      perspective grid camera, plane homographies, attached art and re-projection
    │   ├── transform.ts        node transforms
    │   ├── snap.ts             point, grid and smart guide snapping
    │   ├── kernel.ts           paper.js adapter: booleans, offset, simplify
    │   └── ops/
    │       ├── paths.ts        pathfinder and path commands
    │       ├── objects.ts      align, arrange, transform
    │       ├── expand.ts       expand appearance and live objects
    │       ├── text-styles.ts  character and paragraph styles: apply, redefine, delete
    │       ├── live-shapes.ts  editing live shapes after drawing
    │       ├── distort.ts      Free Distort and Perspective Distort of nodes
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
    │   ├── puppet.ts           Puppet Warp
    │   ├── dimension.ts        Dimension
    │   ├── graph.ts            the nine graph tools
    │   ├── shaper.ts           Shaper, Intertwine
    │   ├── perspective.ts      Perspective Grid, Perspective Selection
    │   ├── symbolism.ts        Symbol Shifter, Scruncher, Sizer, Spinner, Stainer, Screener, Styler
    │   ├── type.ts             type tools and their options
    │   └── view.ts             Hand, Rotate View, Zoom, Artboard
    ├── io/
    │   ├── api.ts              engine service client
    │   ├── ase.ts              Adobe Swatch Exchange read and write
    │   ├── data-merge.ts       data set images, variation projects and the variations export
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
- src/engine/envelope.ts
- src/engine/transform.ts
- src/engine/snap.ts
- src/engine/render.ts
- src/engine/filters.ts
- src/engine/geometry.ts
- src/engine/kernel.ts
- src/engine/ops/recolor.ts
- src/engine/text.ts
- src/engine/hyphen.ts
- src/engine/flow.ts
- src/engine/symbolism.ts
- src/engine/livepaint.ts
- src/engine/threed.ts
- src/engine/pattern.ts
- src/engine/bounds.ts
- src/engine/ops/objects.ts
- src/engine/ops/expand.ts
- src/engine/ops/distort.ts
- src/engine/puppet.ts
- src/engine/dimension.ts
- src/engine/graph.ts
- src/engine/variables.ts
- src/engine/intertwine.ts
- src/engine/shaper.ts
- src/engine/perspective.ts
- src/engine/style-libraries.ts
- src/engine/swatch-libraries.ts
- src/engine/brush-libraries.ts
- src/engine/brushes.ts
- src/engine/stroke-gradient.ts
- src/extensions/registry.ts
- src/tools/select.ts
- src/tools/pen.ts
- src/tools/draw.ts
- src/tools/freehand.ts
- src/tools/transform.ts
- src/tools/paint.ts
- src/tools/puppet.ts
- src/tools/dimension.ts
- src/tools/graph.ts
- src/tools/shaper.ts
- src/tools/perspective.ts
- src/tools/symbolism.ts
- src/tools/type.ts
- src/tools/view.ts
- src/io/api.ts
- src/io/ase.ts
- src/io/data-merge.ts
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
- src/ui/panels/recolor.ts
- src/ui/panels/libraries.ts
- src/ui/panels/navigator.ts
- src/ui/panels/actions.ts
- src/ui/panels/variables.ts
- src/ui/panels/graph-data.ts
- src/ui/panels/graph-dialogs.ts
- src/ui/panels/perspective-grid.ts
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
- src/ui/commands.ts
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

### src/app.ts · graphs, variables, actions and history wiring
- refers-to: src/app.ts :: graph-type, graph-data, graph-design, graph-column, graph-marker, graph-size, action-batch, history-new-document, history-options, historyOptions, TAB_HOMES.variables
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Object > Graph holds Type, Data (Alt+Shift+Ctrl+G), Design, Column and Marker; graph-size is the click-to-size dialog of the graph tools. File > Automate holds Play Action, Batch, New Document from History State and History Options. The Variables panel sits in the Navigator group (Window > Variables). The Actions panel gets openFiles, deliver and toast from here, and agents.actions points the bridge at it.

### src/app.ts · perspective commands
- refers-to: src/app.ts :: persp-show, persp-lock, persp-snap, persp-define, persp-1p, persp-2p, persp-3p, persp-presets, persp-save-preset, persp-plane-left, persp-plane-floor, persp-plane-right, persp-plane-none, persp-attach, persp-release, persp-match-plane, persp-edit-text
- kind: explainer
- logged: v0.21.0 · 2026-10-10

View > Perspective Grid holds Show or Hide Grid (Shift+Ctrl+I), Lock Grid, Snap to Grid, Define Grid, One, Two and Three Point Perspective (each with its normal view preset as a submenu, as in Illustrator), Grid Presets, Save Grid as Preset and the four active plane commands. The plane commands carry the bare keys 1 to 4 and are enabled only while the grid shows; no other command or tool uses bare digits, and the dispatcher ignores keys typed into fields and the type editor. Object > Perspective holds Attach to Active Plane, Release with Perspective, Move Plane to Match Object and Edit Text, which switches to the Type tool and opens the editor on the flat type inside the perspective envelope.

### src/app.ts · library menus and panel tabs
- refers-to: src/app.ts :: swatchLibItems, brushLibItems, openLibraryFile, saveSwatchLibrary, saveBrushLibrary, libraryProject, recolorDialog, TAB_HOMES
- kind: warning-context
- logged: v0.22.0 · 2026-10-08

The library tabs are `swatch-library` and `brush-library`: TAB_HOMES keys become Window commands labelled from the id, and `swatch-libraries` produced a "Swatch Libraries" panel command that shadowed the Swatch Libraries submenu of the same label. The Window menu is built by a function so the User Defined submenus list libraries saved during the session; their commands (`sw-user-0` to `sw-user-11`, `br-user-0` to `br-user-11`) take their labels from storage, as the recent-file commands do. Save Swatch Library as formpth and Save Brushes write a .fpth made from a blank document carrying only the swatches and patterns, or the brushes; any .fpth opens as a library through Other Library or Open Brush Library, and File > Open routes .ase files to the Swatch Library panel. The old Recolor Artwork form (a picker per colour plus hue, saturation and brightness shifts) is replaced by the RecolorDialog.

## src/automation/agent-bridge.ts

### src/automation/agent-bridge.ts · set_text type options
- refers-to: src/automation/agent-bridge.ts :: add_text (orientation), set_text (orientation, upright_latin, path_*, area_*, first_baseline*)
- kind: explainer
- logged: v0.17.0 · 2026-10-08

New optional parameters only. `set_text` validates the enumerations and refuses path options on type that is not on a path and area options on type that is not area type before changing anything, then writes every node-level option (orientation, path and area options) in one `setTextNode` edit, so each call adds one history step for them. `upright_latin` is a character attribute and honours `start` and `end`.

### src/automation/agent-bridge.ts · set_text type depth
- refers-to: src/automation/agent-bridge.ts :: set_text (kerning, axes, rotation, touch, hyphenate, hyphenation, justification, tabs, list); backend/app/routers/mcp.py :: set_text
- kind: explainer
- logged: v0.18.0 · 2026-10-08

New optional parameters, beside the old ones. `kerning`, `axes` and `rotation` join the one character edit (so they honour `start` and `end`); `axes` are read against the font's fvar through `variationOf`, clamped to each axis's range, and axes the font lacks are dropped with a note in the result (a static font keeps them, which does nothing, and the result says so). The paragraph options (`align`, `hyphenate`, `hyphenation`, `justification`, `tabs`, `list`) are gathered into one `setParaStyle`, so they are one history step; `hyphenation` alone turns hyphenation on. `touch` is its own `setCharTouch` step on one character and merges given fields into the character's current transform; `reset` clears it. `align` gained justify_center, justify_right and justify_all.

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

### src/automation/agent-bridge.ts · envelope editing and distort
- refers-to: src/automation/agent-bridge.ts :: envelopeAction, transform case; backend/app/routers/mcp.py :: envelope, transform
- kind: explainer
- logged: v0.17.0 · 2026-10-08

New optional parameters and enum values only. `envelope` gains info (points row-major with their handle ends, kind, options, editing mode), move_point (point or row and column; x, y or dx, dy; handle right, left, down or up moves that handle's end; mirror), add_mesh_line, delete_mesh_point, reset_mesh (maintain_shape), reset_warp, options (fidelity, distort_appearance, distort_gradients, distort_patterns, anti_alias), edit_contents and edit_envelope; the envelope is found from ids or the selection, including a child selected in Edit Contents. For a warp or top-object envelope, info shows the 4 by 4 mesh it turns into, so point indices from info stay valid for move_point. `transform` gains corners (Free Distort onto four points), perspective (pull the top corners in by that many points) and reset_bounding_box; when combined with another transform the reset is squashed into the same step.

### src/automation/agent-bridge.ts · puppet_warp and add_dimension
- refers-to: src/automation/agent-bridge.ts :: puppet_warp case, add_dimension case; backend/app/routers/mcp.py :: puppet_warp, add_dimension; src/engine/index.ts :: Engine.puppetWarp, Engine.addDimension, Engine.setDimension
- kind: explainer
- logged: v0.19.0 · 2026-10-10

Two new tools. puppet_warp takes pins as x, y with optional to_x, to_y (a pin left out holds its place) and rotate in degrees counter-clockwise, the harness convention, which Engine.puppetWarp negates because the solver works in the y-down page; the warp is one Engine.edit, so one undo step. A pin given rotate turns its neighbourhood by that much from rest. add_dimension builds a spec from the parameters and adds it in one edit; radial takes circle (the id of a live ellipse or a single closed circular path, with the first point if any giving the rim direction) or three_points (circumcentre), and with ids and no points it patches existing dimensions instead, so agents can restyle without a separate tool.

### src/automation/agent-bridge.ts · intertwine and shaper
- refers-to: src/automation/agent-bridge.ts :: intertwine case, shaper case; backend/app/routers/mcp.py :: intertwine, shaper; setup/agents.py :: GROUPS
- kind: explainer
- logged: v0.19.0 · 2026-10-10

intertwine takes action make (ids or the selection), flip (x, y inside an overlap), area (a loop of points), release and expand; id defaults to the selected intertwine object and get_document reports its zones (top member id and bounds). shaper takes action draw (the gesture as points, answered with the recognised kind and the live shape's id), scribble (punch, merge or delete by the same rules as the tool), fill (x, y and color for one face) and expand. Each call is one engine edit, so one undo step.

### src/automation/agent-bridge.ts · graph, variables and actions
- refers-to: src/automation/agent-bridge.ts :: graphTool, graphPatch, variablesTool, actionsTool, AgentBridge.actions
- kind: explainer
- logged: v0.20.0 · 2026-10-10

graph creates (default without id), updates (default with id or any part's id), gets or makes a design; data comes as {series, categories, values} or spreadsheet text, and the answer lists every series group id so set_paint can restyle a series. Setting min, max or divisions turns calculated ticks off; auto true turns them back on. variables runs the Variables panel's operations and export writes into an absolute folder through the engine. actions lists, plays (stops that allow continue are passed, others end the run and are reported) and batches; it runs before the open-document check so list and batch work with no document. Each call is still one history step through beginStep and endStep.

### src/automation/agent-bridge.ts · perspective
- refers-to: src/automation/agent-bridge.ts :: AgentBridge.perspectiveTool; src/engine/index.ts :: Engine.setPerspGrid, setPerspView, placeOnPlane, attachToPlane, perspMove, perspScale, releasePerspective, movePlaneToObject
- kind: explainer
- logged: v0.21.0 · 2026-10-10

Each action is one engine call and so one undo step, except grid, which applies the grid values (one step, skipped when nothing changed) and then the view flags (no step); a grid call shows the grid unless show is false. draw builds the shape with the same shapePath and gridGroup as the tools, in plane coordinates, attaches it with an identity m and adds it, so it matches drawing with a tool. place defaults the centre to the plane point under the art's current centre, or the plane's middle when that point is behind the eye. get lists every attached leaf with its plane, offset and plane space bounds, the vanishing points and the planes' extents, which is what an agent needs to choose x and y.

### src/automation/agent-bridge.ts · libraries, groups, brushes and recolor rows
- refers-to: src/automation/agent-bridge.ts :: add_swatch, swatch_library, swatch_group, apply_brush, new_brush, brush_library, recolor
- kind: explainer
- logged: v0.22.0 · 2026-10-08

New tools sit beside the old ones; no name or parameter changed. add_swatch gained tint_of and tint, so color is no longer required (it is still checked when tint_of is absent), and spot implies global. swatch_library and brush_library read the built-in libraries plus the person's User Defined ones through `AgentDeps.userLibraries`, since the bridge cannot import the UI. swatch_group make with colors adds the swatches in one gesture. new_brush maps paint_opacity and flip_along onto the brush fields and checks that pattern tiles name pattern swatches before building. recolor's reduce, group and harmony actions build rows with the same functions as the dialog and apply them in one Recolor Artwork step; preserve_tints defaults on except for a plain harmony.

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

### src/engine/index.ts · bounding box frame, envelope editing and distort
- refers-to: src/engine/index.ts :: selectionFrame, resetBoundingBox, envelopeOf, selectedEnvelopes, setEnvelopeOptions, envelopeContents, envelopeMesh, resetEnvelope, editEnvelopeMesh, moveEnvelopePoint, addEnvelopeMeshLine, removeEnvelopeMeshLines, distortTargets, distort, selectInRect, releaseLive; src/engine/doc.ts :: topSelectable; src/engine/hit.ts :: deepHit
- kind: explainer
- logged: v0.17.0 · 2026-10-08

selectionFrame is the bounding box the stage draws and the tools drag: when every top selected object shares one bbox angle it is the union of their bounds measured in the turned frame (cached per node), with its corners turned back to the page; otherwise the plain selection bounds. Reset Bounding Box only drops bbox, one step. Edit Contents is stored on the envelope (editContents) rather than in the project, like Illustrator, so it survives save and undo: hit testing and marquee selection then go into the raw children, topSelectable stops below the envelope, and the selection becomes the children; Edit Envelope clears it and selects the envelope. Every envelope point edit goes through editEnvelopeMesh, which turns a warp or top-object envelope into a 4 by 4 mesh sampled from its current shape the first time, and pins the stored frame to the current contents box. Release now gives back the envelope's real outline (the mesh boundary, the warped box or the top shape) instead of the unwarped box.

### src/engine/index.ts · graph, variable and recorder methods
- refers-to: src/engine/index.ts :: Engine.addGraph, Engine.graphOf, Engine.graphTargets, Engine.graphSeriesSelected, Engine.setGraph, Engine.setGraphData, Engine.setGraphSeries, Engine.addGraphDesign, Engine.deleteGraphDesign, Engine.pasteGraphDesign, Engine.makeVariable, Engine.bindVariable, Engine.captureDataSet, Engine.applyDataSet, Engine.recorder, Engine.recordMute, Engine.noteDragTransform, Engine.playOp, Engine.newDocumentFromState, Engine.setHistoryLimit
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Every graph and variable change is one edit. graphTargets maps any selected part to its graph, so commands work after Group Selection. Deleting a design also removes it from every graph that used it. The recorder is a single optional callback; methods call rec only for selection-wide changes (no ids passed), so agent and panel calls aimed at specific objects are not recorded as actions. noteDragTransform keeps the latest matrix of a tool drag and the centre of the dragged selection, which commitDrag records (and makes Transform Again repeat the drag). playOp replays those operations against the current selection; added nodes are cloned with new ids.

## src/engine/history.ts

### src/engine/history.ts · push merge
- refers-to: src/engine/history.ts :: History.push
- kind: explainer
- logged: v0.9.0 · 2026-10-07

`merge` replaces the last state's document when the names match and the cursor is at the end; otherwise it pushes as usual. Redo states beyond the cursor are dropped on any push.

### src/engine/history.ts · trim and stateAt
- refers-to: src/engine/history.ts :: History.trim, History.stateAt, History.limit
- kind: explainer
- logged: v0.20.0 · 2026-10-10

History.limit is still one static value (the Preferences undo steps); Engine.setHistoryLimit sets it and calls trim on every project, which drops the oldest states beyond the limit but never the current one or anything after it. stateAt returns a state for New Document from State.

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

### src/engine/effects.ts · brushGeometry cache
- refers-to: src/engine/effects.ts :: brushGeometry, brushCache
- kind: rationale
- logged: v0.22.0 · 2026-10-08

Brush outlines were rebuilt on every frame; a bristle stroke makes dozens of pieces, so the result is now cached per path data and stroke item (both immutable) and checked against the brush definition object, which changes whenever the brush is edited.

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

### src/engine/live.ts · envelope content
- refers-to: src/engine/live.ts :: liveChildren, envelopeFrame, envelopeMapper, envelopeContent, warpNode, envelopeOutline, envelopeGrid
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The envelope maps the bounding box of its contents as they are now (envelopeFrame), not the stored frame, so editing the type in Edit Contents re-fits it the way Illustrator does; the stored frame is the fallback for empty or flat contents. warpNode turns the contents into derived nodes: paths go through mapPathAdaptive at the fidelity's tolerance; type becomes one filled path per run of the same fill and stroke from textOutlineRuns (the type node itself stays in children, so it stays editable); an image gets a derived warp grid of its corners mapped through the envelope, 6 to 32 cells across by fidelity; symbols bake to their art; nested blends, repeats and envelopes map their own derived output. Distort Appearance expands strokes and effects first so they bend; without it the paths bend and the appearance is applied after. Distort Linear Gradients maps the gradient's end points through the envelope; Distort Pattern Fills multiplies the pattern by the envelope's local affine at the art's centre. Both are first-order approximations because a canvas gradient or pattern cannot follow a curved map. Envelope output is cached per node with the font epoch and the symbols array, since type outlines depend on loaded fonts.

### src/engine/live.ts · bilinear mesh
- refers-to: src/engine/live.ts :: bilinear (removed)
- kind: removed-code
- logged: v0.17.0 · 2026-10-08

The mesh envelope used to map through straight bilinear cells:

    function bilinear(pts, rows, cols, u, v) { cell (cu, cv) from u * cols and v * rows; mix the four corners by (fu, fv) }

It is replaced by meshMapper in envelope.ts, Coons patches with handles and knots, which equals the bilinear map while no handle has moved.

## src/engine/envelope.ts

### src/engine/envelope.ts · mesh model
- refers-to: src/engine/envelope.ts :: meshHandles, meshKnots, meshSampler, meshMapper, meshFromMapper, mapMeshSpec, meshAddLine, meshRemoveLines; src/engine/types.ts :: EnvelopeSpec, EnvelopeOptions
- kind: explainer
- logged: v0.17.0 · 2026-10-08

A mesh envelope is rows by columns of points in document space, row-major, with optional handles h (four relative vectors per point: toward the next column, the previous column, the next row, the previous row, the same order as a gradient mesh point) and optional knots u and v (where each column and row sits in the contents' unit box). Without h every handle is a third of the way to its neighbour, so a fresh mesh is the old bilinear grid; without knots the lines are evenly spaced. Each cell is a Coons patch of its four cubic edges. Knots exist so that adding a line with the Mesh tool does not move the art: the new line is inserted at the clicked parameter and every new point is sampled from the old surface, with handles from its derivative times a third of the knot step; handles toward unchanged neighbours are kept exactly. meshFromMapper samples any map (a warp, a top-object shape, a homography) into a mesh the same way, which is how a warp or top-object envelope becomes editable and how Reset with Mesh keeps the shape. Old files have no h, u or v and open unchanged.

### src/engine/envelope.ts · homography and adaptive mapping
- refers-to: src/engine/envelope.ts :: homography, applyH, isAffineH, mapPathAdaptive, localAffine, segsToSub
- kind: explainer
- logged: v0.17.0 · 2026-10-08

homography builds the 3 by 3 projective map from one quadrilateral to another as square-to-quad of the target times the adjugate of square-to-quad of the source (Heckbert's closed form; the affine case when both second differences vanish). mapPathAdaptive maps each cubic by its end points and by first-order handles (the map's directional derivative along each handle, from a forward difference of 1e-4 of the handle), checks the mapped curve against the true image at t = 0.5, 0.25 and 0.75 and halves the segment until the error is under the tolerance or seven levels deep. Derivative handles keep joins smooth where an anchor was smooth, which mapping the control points directly does not. With keepLines (projective maps) straight segments stay straight, which is exact; otherwise a straight segment is mapped as a cubic with thirds handles so it can bend, and a mapped piece whose handles still lie on the chord at thirds is written back as a line. fidelityTol turns Envelope Options fidelity 0 to 100 into a tolerance from 1.28 to 0.04 points (50 gives about 0.23).

## src/engine/transform.ts

### src/engine/transform.ts · bounding box angle and envelopes
- refers-to: src/engine/transform.ts :: boxAngle, transformNode; src/engine/types.ts :: NodeBase.bbox
- kind: explainer
- logged: v0.17.0 · 2026-10-08

bbox is the angle in degrees (y down, so positive turns clockwise on screen) of an object's bounding box. transformNode maps the box's x axis through the matrix and keeps the result folded into minus 45 to 45, since a box turned 90 degrees is the same box; under 0.01 degrees the field is dropped, so moves and plain scales never add it and old files open unchanged. A scale along a turned box is R S R^-1, which maps the axis onto itself, so the angle survives it. An envelope moved or scaled along the page axes moves its contents, frame and mesh together as before. Under any other matrix (rotation, reflection, shear) its contents and frame stay put and only the envelope shape is mapped (a warp or top-object envelope first becomes a 6 by 6 mesh), because the contents are mapped through their own axis-aligned box; Coons patches are affine invariant, so the result is exact. This makes transform.ts import live.ts, which imports transform.ts: the cycle is only used inside functions, never at module load.

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

### src/engine/render.ts · warped images
- refers-to: src/engine/render.ts :: drawWarpedImage, triangleMat; src/engine/types.ts :: ImageWarp; src/engine/bounds.ts :: computeGeom; src/engine/hit.ts :: leafHit; src/engine/transform.ts :: transformNode
- kind: explainer
- logged: v0.17.0 · 2026-10-08

An image with warp (derived inside an envelope, or kept after Expand) is drawn cell by cell: each cell is two triangles, each clipped to its destination grown by 0.7 device pixels from its centroid so neighbours overlap without seams, with the affine that takes the source triangle to it, drawing only the cell's slice of the bitmap plus one source pixel. Anti-Alias off turns image smoothing off. Bounds are the grid's points, hit testing is point in any cell, and transforms move the grid with the image. Outline view draws the grid's boundary.

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

### src/engine/ops/recolor.ts · rows, OKLab clustering and preserved tints
- refers-to: src/engine/ops/recolor.ts :: oklab, fromOklab, clusterLab, reduceRows, rowReference, rowsFn, fitRowsToPalette, samplePalette
- kind: rationale
- logged: v0.22.0 · 2026-10-08

Recolor Artwork works on rows: each row holds current colours and one new colour. Reducing to N colours clusters the artwork's colours with k-means in OKLab (Björn Ottosson's published matrices), seeded by the most chromatic colour and then farthest-point picks, so the result does not depend on colour order and stays stable between runs. A row's reference is its most chromatic, darker colour. Preserve Tints and Shades moves every other colour in the row by its lightness difference from the reference and scales the new colour's chroma by its chroma ratio, so a light pink in a red row becomes a light version of the new colour and a gray stays gray; Exact maps every colour of the row to the new colour. Applying a palette (a swatch group, a library, a harmony, a picked theme) first merges rows down to the palette's size, then pairs rows and palette colours by lightness. `samplePalette` clusters an image's pixels (at most about 4000 samples) for the Color Theme Picker and orders the colours by how much of the image they cover.

## src/engine/text.ts

### src/engine/text.ts · vertical layout
- refers-to: src/engine/text.ts :: layoutLines, place, absRect, absPt, toAbs, lineRect, lineBaseline, caretAt, indexAt, stepLine, selectionQuads
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Vertical type reuses the horizontal line breaker by running it in an abstract frame: the inline axis u is the node's local y and the block axis v is minus its local x, so lines become columns that advance right to left. Frames, cells and wrap outlines are mapped into that frame on the way in; `place` maps each glyph back out, and `Line` keeps abstract numbers while `lineRect`, `lineBaseline`, `selectionQuads`, caret and hit testing map them to local space through the layout's `vertical` flag. Every glyph carries `iu` and `ia`, its inline start and advance, so caret, hit testing and arrow keys never need to know the orientation. A column is one em wide (ascent and descent half the size each) and the column pitch is the leading. Upright glyphs sit in an em cell whose top is the inline position, with the baseline `vorg` below it (the font's vertical origin, 0.88 em without one) and an inline advance from vmtx or one em; turned glyphs use the 90 degree matrix `m` and are centred on the column. Point vertical type starts at its origin, which is the top of the first column's centre line.

### src/engine/text.ts · vertical orientation
- refers-to: src/engine/text.ts :: verticalClass, orient, UPRIGHT, TURNED, cjkBreakAfter
- kind: explainer
- logged: v0.17.0 · 2026-10-08

`verticalClass` is a compact reading of Unicode's Vertical_Orientation property (UAX 50): Han, kana, Hangul, full-width forms, CJK symbols and a few signs are upright; brackets, the long vowel mark, wave dash and full-width dashes are "turned", which means upright with the font's `vert` form when it has one and turned 90 degrees clockwise when it does not; everything else (Latin, digits, half-width forms) turns clockwise unless `CharStyle.upright` is set. `orient` asks the shaping layer for each character's vertical shape and keeps a glyph id only when `vert` replaced it, so ordinary characters still draw with `fillText` and the browser's font fallback (Inter plus Japanese keeps working). Line breaking also allows a break after any upright CJK character, except before small kana and closing punctuation and after opening brackets, so CJK paragraphs no longer split a following Latin word.

### src/engine/text.ts · glyph matrix
- refers-to: src/engine/text.ts :: Glyph.m, Glyph.box, glyphMat, glyphBox, glyphCorners, glyphCenter
- kind: rationale
- logged: v0.17.0 · 2026-10-08

A glyph used to be a position and a rotation. Skew, 3D Ribbon and turned vertical glyphs need a shear, so a glyph may carry `m`, the linear part of its transform (glyph x axis, then glyph y axis, y down); `glyphMat` falls back to the rotation by `angle` when it is absent, so horizontal type is unchanged. `box` is the glyph's cell in that frame, used by selection, caret, hit testing and bounds. The canvas, `textOutline`, `outlineText`, SVG and PDF all build the glyph from `glyphMat` times the horizontal and vertical scale, which is why the four renderings match.

### src/engine/text.ts · type on a path
- refers-to: src/engine/text.ts :: pathSpan, spanPoint, pathParamAt, layoutOnPath, pathBrackets
- kind: rationale
- logged: v0.17.0 · 2026-10-08

`pathStart` and `pathEnd` are fractions of the path's length; on a closed path an end before the start wraps through the path's first point. Flip lays the type out on the reversed path (a closed path is reversed about its own first point so the fractions keep their places), which puts it on the other side and reverses its direction; `pathBrackets` reports the start and end brackets in the original direction. Effects, per glyph at the midpoint of its advance with tangent t and normal n: Rainbow uses t and n; Skew keeps the glyph's vertical axis vertical (its sign follows n, so nothing is mirrored) and shears along t; 3D Ribbon keeps horizontal edges horizontal, with the x axis the horizontal part of t, and turns the vertical edges to n, so glyphs narrow where the path is steep like a ribbon seen edge on; Stair Step keeps glyphs upright with the left end of each baseline on the path; Gravity puts the centre of each baseline on the path and points each glyph's vertical axis at the path's centre point (the centre of its bounds, which for a circle or an arc is the centre of curvature), as Illustrator defines it. Align to Path moves the baseline along the glyph's vertical axis by the ascent, the descent or half their difference. Spacing removes up to its value between two glyphs where the path turns toward the glyphs' feet, which is where their tops fan apart, in proportion to half the type size times the turn angle. Vertical type on a path treats the path as the column's centre line: upright glyphs take the tangent as their down direction, turned glyphs read along it.

### src/engine/text.ts · first baseline and rows
- refers-to: src/engine/text.ts :: firstBase, areaCells, layoutLines
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Area type is laid out in cells: the frame less its inset is split into rows by `rowGutter` (the column gutter when unset) and into columns by `gutter`, and text flows by rows (across then down) or by columns, reading right to left across columns in vertical type. The first line of each cell sits `firstBase` below the cell's top: Ascent keeps the old 0.8 em so documents made before are unchanged; Cap Height and x Height use the font's OS/2 values (0.7 and 0.5 em until the font has loaded); Leading uses the line's leading; Em Box Height uses the ideographic em box top, 0.88 em; Fixed is the Min value itself; Legacy uses the font's own hhea ascender. Min is a floor for all of them. Vertical type centres its first column half an em inside the right edge (or Fixed or Min).

### src/engine/text.ts · textOutline
- refers-to: src/engine/text.ts :: textOutline
- kind: warning-context
- logged: v0.15.0 · 2026-10-07

Builds type outlines synchronously from the shaping layer's loaded fonts, glyph by glyph in the layout's positions, and returns null until every face is loaded (the loader bumps the font epoch, so callers that cache on it retry). Glyph contours from the font arrive without close commands, so every subpath is marked closed; 3D needs closed contours for its caps.

### src/engine/text.ts · textOutlineRuns
- refers-to: src/engine/text.ts :: textOutlineRuns; src/engine/live.ts :: warpNode
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The same glyph outlines as textOutline, grouped into runs of consecutive glyphs with the same fill, stroke and stroke weight, so type inside an envelope keeps its colours when it is drawn as distorted paths. Null until the fonts are loaded; the envelope then draws the type undistorted and retries on the next font epoch.

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

### src/engine/text.ts · hyphenation, justification, tabs and lists in the line breaker
- refers-to: src/engine/text.ts :: layoutLines (measure, tabAt, cum, cumS, hy, extra, gx), listMarker, plainSt, isLetter, spaceW, DEFAULT_TAB; src/engine/types.ts :: ParaStyle.hyph, ParaStyle.tabs, ParaStyle.just, ParaStyle.list, Glyph.syn
- kind: rationale
- logged: v0.18.0 · 2026-10-08

`ParaStyle.hyphenate` used to be a stored flag nothing read. The breaker now keeps the width (`cum`) and the shrinkable width (`cumS`) before every item of the line; when a letter overflows, the word around it is handed to `allowedBreaks` and the latest break whose prefix plus a hyphen fits is taken, subject to the hyphen limit (consecutive hyphenated lines in the paragraph) and, for unjustified type, the hyphenation zone (no break when the line already ends within the zone of the margin). It runs only in area type, as in Illustrator, and the hyphen is a synthetic glyph (`syn`) placed after the line, so the text never changes; selection skips synthetic glyphs and the caret math still works because they carry the index of the following character.
Justification: without `ParaStyle.just` the old rule holds (justified lines spread the slack over spaces), so documents made before are unchanged. With it, the desired word spacing, letter spacing (a percent of the space width, as InDesign and Illustrator define it) and glyph scaling apply to every line of every alignment; a justified line counts as fitting when its width less the room down to the minimums fits, and the slack is taken from or given to word spaces first, then letter gaps, then glyph scaling (one factor per line, drawn through the glyph's `t`), with any slack left after the maximums going to the word spaces. A justified line with no spaces follows Single Word Justification.
Tabs: a tab's advance now depends on where it starts: to the next stop after that point (positions from the frame's left edge, the cell's for columns, the origin for point type), with right, centre and decimal stops pulling the following text back by its width, half of it or its width up to the decimal character (right-aligned when there is none). Past the last stop, or with no stops, tabs advance to the next multiple of 36 points, Illustrator's default; before this a tab was as wide as the canvas measured the tab character, so older documents with tabs now line up on that grid. Leaders are synthetic glyphs repeated across the gap, aligned to its end.
Bullets and numbering: every non-empty paragraph of a text object with `ParaStyle.list` gets a marker of synthetic glyphs at the first-line indent, and its first line starts at the larger of the left indent and the marker's end plus half an em, so a negative first-line indent makes a hanging list. Numbers count the object's non-empty paragraphs from `start` in decimal, zero-padded, letters or roman numerals. Markers and leaders use the paragraph's first style with no Touch Type, rotation or position (`plainSt`).

### src/engine/text.ts · optical kerning
- refers-to: src/engine/text.ts :: opticalKern, profileOf, meanGap, refGaps, profiles, advance; src/io/fonts.ts :: installShaping (shape)
- kind: rationale
- logged: v0.18.0 · 2026-10-08

Optical kerning used to be metric kerning under another name. Each glyph's outline is cut by 24 horizontal bands from the cap height to the baseline; a band's left and right ink edges form the glyph's side profiles, and a band without ink takes the nearest edge within three bands, so a crossbar or a bowl's top still counts against the neighbour. For a pair, the gap in every band where both glyphs have an edge is measured, each gap is capped at the narrowest gap plus 0.18 em (a deep open counter does not count for more than that), and the mean is compared with the same mean for "nn" in that face: the kern is 55 percent of the difference, never closing the narrowest gap below 30 percent of the "nn" gap, and kept between -0.2 and +0.1 em. Profiles are cached per face (family, style and variable axes) and character and cleared with the font epoch. Until the font is parsed the pair falls back to metric kerning. Shaped spans no longer add GPOS kerning under Optical; only Auto does.

### src/engine/text.ts · character rotation and Touch Type
- refers-to: src/engine/text.ts :: charTransform, withT, glyphMat, glyphBaseMat, touchMap, caretAt, indexAt, selectionQuads, insertText, cleanTouch, touchSpans, charStyleAt, glyphShape; src/engine/types.ts :: CharStyle.rotate, CharStyle.touch, CharTouch, Glyph.t
- kind: rationale
- logged: v0.18.0 · 2026-10-08

A glyph may carry `t`, a local transform applied after its base matrix (`glyphBaseMat`), so `glyphMat` and therefore the canvas, `textOutline`, `outlineText`, SVG, PDF, bounds and hit tests all draw the same moved glyph without each knowing why. `charTransform` builds it from the style: scale (Touch Type's percentages times the line's glyph scaling) about the glyph origin, rotation (character rotation plus Touch Type's, counter-clockwise positive) about the scaled cell's centre, then Touch Type's offset in the glyph's own frame. Advances are not changed, so moving one character never reflows the rest, which is how Illustrator's Touch Type behaves on screen. Touch Type lives on the character's style, so it rides with the character through every edit; `insertText` drops it from the style of newly typed characters so they do not inherit a neighbour's move. The caret and selection map through `touchMap` (the glyph's transform relative to its untouched place), and `indexAt` hits touched glyphs first.

## src/engine/hyphen.ts

### src/engine/hyphen.ts · rule-based English hyphenation
- refers-to: src/engine/hyphen.ts :: hyphenPoints, allowedBreaks, syllableBreaks, units, silentTail, PREFIXES, SUFFIXES, ONSETS, DEFAULT_HYPH, DEFAULT_JUST
- kind: explainer
- logged: v0.18.0 · 2026-10-08

Not Liang's patterns: the TeX US English pattern list could not be added as data with a clear licence here, so this is a compact syllable splitter written for formpth. A word is read as units (consonant digraphs such as ch, th, ck and qu, vowel teams such as ea, ou, oy), a final silent e and a silent -ed or -es stop counting as vowels (but a consonant plus -le does), and between two vowel nuclei the consonants split: one consonant goes with the next syllable (except x and ck), doubled letters split between them, otherwise the longest tail that is an allowed onset (a consonant plus l or r, tw, dw) starts the next syllable and the rest stays, and a final consonant plus -le keeps the consonant. Adjacent vowels split unless one is a team or a glide (i after t, c, s, g or x as in -tion; u after g or q). Common prefixes (un, dis, mis, non, over, under, inter, trans, super, anti) and suffixes (-tion, -sion, -ment, -ness, -less, -ful, -ship, -ing, -able, -ible and a few more) force a break and the suffix is never split. It gets most everyday words to acceptable breaks (hy-phe-na-tion, in-for-ma-tion, chil-dren, lit-tle, jump-ing, run-ning) and errs on words whose syllables depend on pronunciation; a dictionary would fix that. `allowedBreaks` applies Words Longer Than, After First, Before Last and Hyphenate Capitalized Words.

## src/engine/flow.ts

### src/engine/flow.ts · reflow
- refers-to: src/engine/flow.ts :: reflow, threadChains, detachFrames; src/engine/index.ts :: edit, dragTo, restore, addProject, reflowAll
- kind: rationale
- logged: v0.10.0 · 2026-10-07

Layout is cached per node by identity and never reads the document, so anything that depends on other nodes is written into the text node as derived data by one pass, `reflow`, which `Engine.edit`, `dragTo`, `restore` and `addProject` run on every new document. `wrapShape` holds the outlines of the wrap objects above the type in its layer, in the type's local space, plus its own `framePath`; threaded frames hold their share of one story. The story is the concatenation of every frame's spans in chain order, so typing into any frame works without knowing about threads, and the pass deals the story back out frame by frame using each frame's overflow index. `reflow` returns the same document when nothing changed and costs one walk when there are no wraps, threads or shaped frames. Links that point at a missing, duplicated or non-area frame are dropped by the pass, which is how a duplicated threaded frame comes out unthreaded. `detachFrames` runs before a delete and for Release Selection so the text of a removed frame flows back into the rest of the thread instead of being lost. `reflowAll` reruns the pass without a history step when fonts finish loading, because the distribution depends on glyph widths.

### src/engine/flow.ts · perspective sync
- refers-to: src/engine/flow.ts :: reflow; src/engine/perspective.ts :: perspSync
- kind: explainer
- logged: v0.21.0 · 2026-10-10

reflow runs perspSync after the dimension and graph refresh, so every edit, drag preview, undo and file open sees attached art whose source matches what is drawn, and the grid is written into the document in the same step that first attaches art. It returns the same document when nothing attached changed.

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

## src/engine/ops/distort.ts

### src/engine/ops/distort.ts · Free Distort and Perspective Distort
- refers-to: src/engine/ops/distort.ts :: distortNode, quadDistort; src/engine/index.ts :: Engine.distortTargets, Engine.distort
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Both distortions are the homography from the bounding box's four corners (turned with the box) to the dragged quadrilateral. Paths, compound paths, blend keys and spines map through mapPathAdaptive with straight lines kept straight (exact under a projective map) and curves split until they follow it within about 2e-4 of the box size; gradient end points that are set map too. Gradient meshes map their points and handles. An envelope maps its mesh (a warp or top-object envelope becomes a 6 by 6 mesh first). Type, images and symbols cannot carry a projective map in an affine xf, so each goes into a new envelope whose mesh samples the homography: 1 by 1 when the map is affine (exact), 4 by 4 otherwise (within a fraction of a point at ordinary sizes). The envelope ids for a drag are made once and reused on every move, so the preview does not churn ids and the selection follows the new envelopes on commit.
- Free Transform's distortions used to be bilinear on anchors only, with type and images fitted by an affine; see the removed-code entry under src/tools/transform.ts.

### src/engine/ops/distort.ts · bend and grid for non-projective maps
- refers-to: src/engine/ops/distort.ts :: DistortOpts.bend, DistortOpts.grid, distortNode
- kind: explainer
- logged: v0.19.0 · 2026-10-10

distortNode takes any Mapper, so Puppet Warp reuses it. bend true stops mapPathAdaptive from keeping straight segments straight (only a projective map keeps lines straight; a puppet mesh bends them), and grid sets the envelope mesh that type, images and symbols are poured into (8 by 8 for Puppet Warp, 4 by 4 for Free Distort as before). A group carrying a dimension maps its measured points too, so a distorted dimension keeps measuring the distorted art.

## src/engine/puppet.ts

### src/engine/puppet.ts · mesh, solver and mapping
- refers-to: src/engine/puppet.ts :: puppetMesh, PuppetSolver, Band, locate, puppetMapper, unmapPoint, localAngle, defaultPins, puppetApply; src/engine/index.ts :: Engine.puppetWarp
- kind: explainer
- logged: v0.19.0 · 2026-10-10

The mesh is a grid of square cells over the art's bounds, about 32 across the longer side and never more than about 2400 cells. A cell is in the mesh when its centre is inside a filled area (a scanline crossing count with the path's fill rule), or within the stroke's half width plus three quarters of a cell of any flattened outline, so open and stroke-only paths get a band along them; type, images, symbols, meshes and envelopes count as their bounding box. Expand dilates that set by whole cells (round kernel) and the grid is padded by it. Each cell splits into two triangles with the diagonal alternating like a checkerboard so the mesh has no preferred direction. Vertices are numbered along the grid's shorter side first, which keeps the half bandwidth near the short side's vertex count. Every grid cell also stores its nearest mesh cell (a breadth-first fill), so locate is constant time and a point off the mesh (a handle sticking out) maps through the nearest triangle's affine extension.

The deformation is the two-step as-rigid-as-possible solve of Igarashi, Moscovich and Hughes (2005). Step one minimises, for each triangle and each of its three vertices, the error of that vertex expressed in the frame of the opposite edge (the similarity energy): rotations are free, so the mesh turns around pins instead of shearing. Step two fits a rotation to each triangle from step one's result (2D Procrustes: atan2 of the summed cross and dot products of rest and current edges) and solves the edge Laplacian with those rotated rest edges as targets, separately in x and y, four times local then global, which removes the scaling step one allows. Pins are soft constraints with weight 1e4 on the barycentric combination of the triangle they fall in, so a pin can sit anywhere, not only on a vertex. A weight 1e-6 pull toward rest keeps the system positive definite when a piece has one pin or none, which also makes a single pin translate its piece rigidly. A pin that has been twisted gets two satellite constraints two cells away along x and y, aimed by the pin's angle, so twisting is a rotation of the neighbourhood rather than of a single point. Both matrices depend only on the mesh and the pin set, so they are Cholesky-factored once (banded, in place) when pins are added, removed or start twisting, and each drag move is two back substitutions plus four times two smaller ones.

The art maps through the deformed triangles with barycentric coordinates, and distortNode subdivides curves until they follow the piecewise affine map within a hundredth of a cell, so the result is ordinary path geometry with more anchors where it bends. puppetApply always maps from the rest art of the session, never from the previous result, so repeated drags do not accumulate resampling.

## src/engine/dimension.ts

### src/engine/dimension.ts · live dimension groups
- refers-to: src/engine/dimension.ts :: dimensionChildren, refreshDimensions, dimensionNode, dimValue, dimLabel, dimOffsetFor, dimHandles, circleFrom, circumcentre; src/engine/types.ts :: DimensionSpec, GroupNode.dim; src/engine/flow.ts :: reflow; src/engine/transform.ts :: xfDim
- kind: rationale
- logged: v0.19.0 · 2026-10-10

A dimension is a group with dim set: the spec stores the measured points (linear a and b; angular vertex and two arm points; radial centre and rim point), the offset and the style. The children are derived, like Live Paint faces: refreshDimensions, run first in reflow, regenerates them whenever the spec object, the group id or the document's units change, from a cache keyed by the spec's identity, so an unchanged dimension costs one walk and an edit, drag, undo or file open always shows children that match the spec. Because the children are ordinary paths and point type, render, hit testing, SVG and PDF need nothing new, and expand only drops dim. Children ids are the group id plus -dl (lines), -dh (filled arrowheads and dots) and -dt (label), so regenerating keeps them stable. transformNode maps the points and re-derives the offset from where the dimension line's handle lands, which keeps the line on the correct side under reflection; distortNode maps the points. Linear offsets are measured from the measured point farthest along the normal (the nearer one when negative), so a horizontal dimension of points at different heights clears both. The label turns with the line but never reads upside down (its direction is flipped into the right half plane), and above or below stay on the side of the line away from or toward the art after that flip. Centre text cuts a gap in the dimension line the width of the laid out label plus padding. Editing a child directly (Direct Selection, a paint swatch) is overwritten on the next reflow; the dimension's colour, weight and type come from its settings.

## src/engine/graph.ts

### src/engine/graph.ts · live graph groups and their parts
- refers-to: src/engine/graph.ts :: buildGraph, graphChildren, graphNode, refreshGraphs, graphKey, merge, family, xfGraph, restyleText, cleanData, parseTable, parseGrid, transposeData, swapXY, dataToText; src/engine/types.ts :: GraphSpec, GraphData, GraphDesign, GroupNode.graph, GroupNode.graphKey, NodeBase.part; src/engine/flow.ts :: reflow; src/engine/transform.ts :: transformNode
- kind: rationale
- logged: v0.20.0 · 2026-10-10

A graph is a group with graph set: the spec holds the type, the body size (w, h), a placement matrix xf, the data table (series labels, category labels, values[row][column] with null for empty cells) and every option of the Graph Type dialog. Its children are ordinary paths and point type generated in the body's own frame and then mapped by xf, so render, hit testing, SVG, PDF, outlines and Ungroup need nothing new. Every generated node carries part, a role key: grid, axes, shadow, labels, legend, a series group s{i} holding its columns, markers or wedges s{i}:c{row}, its line s{i}:line, its area s{i}:area and its legend key s{i}:key, and texts vl{k}, cl{k}, lt{i}, wl{row}:{i}. Group Selection therefore climbs column, then series group with its key, then the graph, as in Illustrator.

refreshGraphs runs in reflow and regenerates only when graphKey (the spec without xf, as JSON, memoised per spec object, plus the JSON of any design the graph uses) differs from the key stored on the group, so a direct edit of a part (moving a column with Direct Selection, retyping a label) stays until the data or an option changes, and undo, drags and file open cost a walk. Regeneration matches old parts by part, not by id, so copies and pasted graphs keep their styles: an existing part keeps its id, appearance, opacity, blend, graphic style, name, lock and hide; a new part takes the style of its family (a new column from the series' legend key, then a sibling column; a new label from another label of its kind). Type keeps the existing first span's character style; changing the graph's font or size in Graph Type restyles the type parts first (restyleText) so the new defaults show.

transformNode maps xf: a translation or a positive axis-aligned scale is folded into w and h with xf back to a translation, which changes the key so the graph redraws at the new size with unscaled labels and the user's stroke weights; rotation, shear and reflection stay in xf and the children are transformed with it. distortNode drops graph so a distorted graph becomes plain art. Expand drops graph and graphKey. The value axis uses a 1, 2, 2.5, 5 nice step for about five divisions including zero unless the dialog overrides min, max and divisions; labels take the decimals the step needs. Columns of column series cluster per category (cluster width and column width are percents) with stacked series sharing one slot, areas stack cumulatively from the first area series and use edge-to-edge positions, lines use category centres unless edge-to-edge, scatter reads Y then X column pairs with a nice X axis, pies are drawn clockwise from twelve o'clock with ratio, even or concentric stacked sizing and none, all or first sort, radar draws rings of the value divisions on spokes from twelve o'clock. Filled lines are a mitred outline polygon of the polyline. Column designs map a design's bounds onto the column (vertically scaled), scale it to the column height (uniformly scaled) or repeat copies each worth per units with the last one chopped by a clip group or scaled; marker designs fit into twice the marker size.

### src/engine/graph.ts · graph features left out
- refers-to: src/engine/graph.ts :: cartesian, pie, radar; src/ui/panels/graph-dialogs.ts :: graphTypeDialog
- kind: todo
- logged: v0.20.0 · 2026-10-10

Not built: sliding column designs (they need a horizontal slide line inside the design and a way to draw it), a second value axis for one series of a combined graph (combined series share the left or right axis), Illustrator's First Row in Front and First Column in Front stacking options, the separate category axis tick count and Draw Tick Marks Between Labels option, and rotating designs in bar graphs (designs are scaled into the bar without turning). Labels are measured with the shaped fonts when they are loaded; a top legend measured before a font loads keeps its spacing until the graph next regenerates.

## src/engine/variables.ts

### src/engine/variables.ts · variables and data sets
- refers-to: src/engine/variables.ts :: kindFits, currentValue, captureValues, applyDataSetDoc, fitImage, asGraph, asBool, parseDataFile, variablesFromRows, fileStem; src/engine/types.ts :: Variable, DataSet, Doc.variables, Doc.dataSets, Doc.dataSet; src/engine/index.ts :: Engine.makeVariable, Engine.bindVariable, Engine.captureDataSet, Engine.updateDataSet, Engine.applyDataSet, Engine.addDataSets
- kind: rationale
- logged: v0.20.0 · 2026-10-10

Variables live in the document (Doc.variables), each with a kind (text, image, visibility, graph) and the id of the one object it binds (or null); binding a second variable of the same kind to an object unbinds the first, as an object holds one variable per kind in Illustrator. Data sets (Doc.dataSets) map variable ids to values: a string for text and image, a boolean for visibility, GraphData for graphs; Doc.dataSet is the shown one. All three are optional fields, so older .fpth files open unchanged and the .fpth writer keeps them because it serialises the whole document. applyDataSetDoc is pure and synchronous: text replaces the plain text keeping the first span's style, visibility sets hidden, graph data replaces graph.data (a string value is spreadsheet text with rows split by | or newlines, or JSON), and an image swaps src for an asset the caller already resolved, fitted inside the old placement's width and height and centred, so a set never moves the layout. Image values are asset:key for pictures already in the document, absolute paths the engine service reads, or URLs; resolving them is async and lives in io/data-merge.ts. CSV import treats the header row as variable names (a leading @ forces an image variable; otherwise a column of image file names is an image variable, true and false a visibility variable), a column called Data Set names the sets, and unknown names become unbound variables.

## src/engine/intertwine.ts

### src/engine/intertwine.ts · zones over a base order
- refers-to: src/engine/intertwine.ts :: memberArea, overlapAt, intertwineTopAt, intertwineFlip, intertwineLasso, withZone, intertwineOverlays, intertwineHit, expandedIntertwine; src/engine/types.ts :: IntertwineSpec, GroupNode.intertwine; src/engine/index.ts :: Engine.makeIntertwine, Engine.intertwineFlip, Engine.intertwineZone, Engine.releaseIntertwine
- kind: rationale
- logged: v0.19.0 · 2026-10-10

An intertwine object is a group with intertwine set: its children are the members in their base stacking order and the spec holds zones, each a region in page coordinates and the id of the member drawn on top inside it. Render, SVG and PDF draw the members in base order and then, per zone, a derived clipping group (the member re-id'd with a ~z suffix plus the zone as its clip path), so the existing clip code in all three writers does the work and SVG gets real clip paths with unique ids. Zones are not moved when a member moves (only when the whole group is transformed or distorted), matching Illustrator, so dragging a ring keeps the crossing where it was.

A member's area is what you see of it: its fill region (open paths closed) united with the outline of each visible stroke (strokeToPath; an outside stroke at twice the width, an inside stroke skipped when there is a fill), type outlines when fonts are shaped, the union of a group's children (a clip group's clip path), and the bounding box for anything else. The overlap under the pointer is the face of the arrangement that contains it: the intersection of every member containing the point minus every member that does not, split into connected parts; faces are cached per children array and membership set so hovering is cheap. A click finds the member currently on top there (the last zone containing the point whose member also contains it, else the highest member) and brings the one below it to the top, wrapping to the base top, so three or more members cycle. The new zone is subtracted from older zones first, so zones never stack up, and no zone is stored when the result equals the base order. A lasso intersects the loop with every pairwise overlap inside it, picks the next member below at an interior point of that region and stores the region clipped to that member. Release replaces the group by its children; Expand keeps the children and adds clone copies of the overlay clip groups with fresh ids. Hit testing checks zones first so clicking inside a flipped overlap selects the member that is drawn there.

## src/engine/shaper.ts

### src/engine/shaper.ts · Shaper Groups
- refers-to: src/engine/shaper.ts :: shaperCells, shaperRegions, shaperRegionAt, shaperScribble, shaperFill, expandedShaper, mapShaper, derivedArt; src/engine/types.ts :: ShaperSpec, GroupNode.shaper; src/engine/index.ts :: Engine.shaperScribble, Engine.shaperFill, Engine.expandShaper, Engine.shaperSelection
- kind: rationale
- logged: v0.19.0 · 2026-10-10

A Shaper Group keeps its source shapes as children (still live shapes, editable with Direct Selection, Properties and the Shaper tool's Shapes mode) and stores only seeds, like Live Paint: cuts (a point inside each punched region), merges (points inside the merged regions and the id of the shape whose look the merged face takes) and fills (a point and a paint). The faces are derived. shaperCells runs the Pathfinder arrangement (ops/paths.ts) over the children's fill geometry, cached per children array, and records for each cell an interior point (paper.js interiorPoint) and which shapes contain it. shaperRegions drops cells that contain a cut seed, unions cells reached by the same merge seeds (union-find, so merges that share a cell join), groups the remaining cells by their top shape and splits those into connected parts; each region is a path node drawn with its owner's appearance, its first fill replaced by the latest fill seed inside it. Because the seeds are points, moving or reshaping a source recomputes the faces and the cuts, merges and fills stay where they were drawn. The children are never drawn themselves (except in Outline view), so the region list is what render, SVG, PDF, hit testing and Expand use. Strokes follow each region's outline, so where shapes overlap the lower shape's stroke runs along the upper shape's edge under it; Illustrator draws a Shaper Group the same way after a merge.

Scribble rules: the scribble is sampled every two points; if every sample that lands in a live cell lands in the same cell, that cell is punched out when two or more shapes cover it, and when only one shape covers it that shape is deleted from the group (a group left with one shape dissolves into it). A scribble crossing two or more cells merges them, takes the look of the region where it started and clears cuts it passes over. On plain art (no Shaper Group under the scribble) the visible, unlocked paths and compound paths the scribble touches are collected; one alone is deleted, two or more become a new Shaper Group at the topmost one's place and the scribble applies to it, all in one history step.

### src/engine/shaper.ts · gesture recognition
- refers-to: src/engine/shaper.ts :: recognizeShape, isScribble, resample, closedRdp, meanDist, reversals, hull, affineFrom, polygonTemplate; src/engine/index.ts :: Engine.addShaperShape
- kind: explainer
- logged: v0.19.0 · 2026-10-10

A stroke whose ends are farther apart than 30 percent of its bounding diagonal (and 14 points) is open: it becomes a line when no sample strays more than 8 percent of the chord (4 points minimum) from it, snapped to 45 degree steps within 6 degrees, and is ignored otherwise. A closed stroke is resampled to 96 points by arc length. Candidates: a circle (centroid, mean radius); an ellipse from the principal axes of the samples (second moments; for points spread evenly along an ellipse the variance along an axis is half its squared radius, so the radii are the square roots of twice the eigenvalues), snapped to the axes within 8 degrees; and the corners found by a closed Ramer-Douglas-Peucker pass at 7 percent of the diagonal from the farthest pair, merging vertices that turn less than 28 degrees. Three corners give a triangle as a live polygon whose xf is the affine map from the regular triangle to the drawn one (any triangle is an affine image of an equilateral one, orientation matched first). Four give a rectangle whose angle is the length-weighted mean edge direction modulo 90 degrees (averaged as 4 theta), snapped to the axes within 8 degrees, with extents from the 3rd and 97th percentiles of the samples in that frame, made square when the sides differ by under 12 percent. Five to eight give a regular polygon with the drawn rotation. Each candidate is scored by the mean distance of the samples to its outline over the shape's radius plus a small penalty that grows with complexity, and the best wins if it scores under 0.16. A scribble is told apart first: at least two direction reversals sharper than 135 degrees over a five-sample window with the path at least 1.3 times its convex hull's perimeter, or four or more reversals.

## src/engine/perspective.ts

### src/engine/perspective.ts · the grid as a camera
- refers-to: src/engine/perspective.ts :: PerspGrid, camera, tiltOf, planeFrame, planeH, invH, projectPt, toPlane, vanishing, presetGrid, sanitizeGrid, dragGrid; src/engine/types.ts :: PerspGrid, PerspView, Doc.persp
- kind: explainer
- logged: v0.21.0 · 2026-10-10

The grid is stored as the Define Grid values, not as widget positions: type, the ground level origin (where the planes meet, in document points), the horizon height above it, the station offset (the centre of vision's x from the origin), viewing angle and distance, the third vanishing point's distance below the horizon, the cell size, extents, plane offsets, colours and opacity. Everything else is derived from a pinhole camera: the eye at the origin looking along z, the picture plane at the viewing distance D, screen x = cx + D x/z and y = cy - D y/z. The corner of the planes is the point on the ray through the ground origin at depth D, so one plane unit is one point at the corner. The right plane runs along r = (sin a, 0, cos a) and the left along l = (-cos a, 0, sin a) with a the viewing angle, so the vanishing points sit at cx + D tan a and cx - D cot a on the horizon; one point is a = 0, where the left plane faces the viewer and the right plane and the floor run toward the single vanishing point. Three point tilts the camera by p with sin 2p = 2D / vp3, which puts the third vanishing point vp3 below the horizon (the principal point moves to the horizon plus D tan p so the horizon stays where it was set), which is why vp3 is kept at least 2D. Each plane is a frame (origin, x axis, y axis pointing down the picture, normal): left x = -l, right x = r, floor x = -l and y = -r, so type reads naturally on all three. Projecting a plane frame through the camera is linear in plane x and y, which gives the 3 by 3 homography planeH directly (normalised by the origin's depth); its third row is the depth, so a point is in front of the eye when it is positive, toPlane refuses points behind the eye (the floor above the horizon), and projectPt clamps the depth at 2% of the origin's so nothing explodes near the eye. The grid drawing clips plane rectangles and gridlines at 5% of that depth before projecting. Dragging a two point vanishing point solves the angle and distance from both vanishing points (tan a squared is the ratio of their distances from cx, D their geometric mean), iterated against the tilt for three point grids. The default when a document has no grid is the two point preset on its first artboard; it is written into the document the first time art is attached.

### src/engine/perspective.ts · attached art
- refers-to: src/engine/perspective.ts :: PerspAttach, attachPlace, attachKeep, projectLeaf, wrap, normalized, meshed, perspSync, syncLeaf, fitAffine, reprojectDoc, moveLeaf, scaleLeaf, releaseNode, sigPaths; src/engine/types.ts :: NodeBase.persp; src/engine/flow.ts :: reflow
- kind: rationale
- logged: v0.21.0 · 2026-10-10

Attachment lives on leaves only: paths, compound paths and envelopes carry persp (plane, the plane offset it sits on, and m, an affine from the art's own coordinates to plane coordinates); groups pass attachment down to their children so a group can span planes. Paths keep their geometry in persp.src and their d is the projection, mapped with mapPathAdaptive (lines stay lines, curves are split until within 0.05 pt of the true projective image), so render, hit testing, Direct Selection, SVG and PDF see ordinary paths. Type, images, symbols, meshes and the special groups cannot be projected in place, so they are wrapped in an envelope whose children stay flat and whose 6 by 6 mesh is fitted to the homography; that keeps type editable (Edit Text selects the child and opens the type editor, with no Edit Contents step) and reuses the envelope's renderers and exporters. normalized translates the envelope's child to sit where its projection is (compensating m) whenever art is placed, moved or the grid changes, so the flat type the editor works on is next to what is drawn.

Changes made outside the perspective code are absorbed in perspSync, run by reflow: each attached path stores sig, a weighted sum over its anchors that survives a JSON round trip exactly; when d no longer matches (a Direct Selection edit, a transform, a nudge) the source is re-derived by mapping every anchor and handle back through the inverse homography, so the art stays where the person put it and later grid edits move it from there. An envelope whose mesh changed (a 2D move or scale) gets a new m fitted to three mesh corners mapped back onto the plane and is re-meshed, which snaps it to a true perspective rendering; one whose child's bounds changed (typing) is re-meshed over the new bounds with the same m. Verified nodes are remembered per grid object in a WeakMap, so an unchanged document costs one walk. reprojectDoc rebuilds every attached leaf from its source with the new grid and maps gradient geometry through the old inverse and the new forward mapping. Moves are world space vectors: a delta on one plane is converted into each leaf's own plane axes and normal, so a group whose parts sit on several planes moves as one solid, and the perpendicular move changes off. Attach keeps the look: paths get the inverse-mapped source and keep d, other art gets m from the local inverse affine at its centre. Release only drops persp, so paths keep their projected anchors and envelopes stay envelopes.

## src/engine/style-libraries.ts

### src/engine/style-libraries.ts · STYLE_LIBRARIES
- refers-to: src/engine/style-libraries.ts :: STYLE_LIBRARIES, styleLibrary
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Five libraries generated in code, every style built only from things formpth renders and exports: Shadows and Glows (drop shadows, a long shadow made with a Transform effect of 40 copies on the lower fill only, glows, a neon stroke blurred under sharp ones, feather), Buttons (gradients, round corners, a gloss fill inset with Offset Path, inner glows), Outlines (sticker strokes, offset and inset strokes, stitched dashes, roughened ink, zig zag), Textures (Effect Gallery grain, watercolor, halftone, mosaic, stained glass and texturizer on the fill only, so strokes stay crisp) and Scribbles (scribble fills and crosshatch, pencil-sketch strokes). Many use effects on one fill or stroke, which is what makes them more than a fill and a stroke. Effects are built from their defaults (`effectDefaults`) with a few overrides, so a parameter added later gets its default. `styleLibrary` matches an id or a name, with spaces, dashes and underscores alike.

## src/engine/swatch-libraries.ts

### src/engine/swatch-libraries.ts · SWATCH_LIBRARIES
- refers-to: src/engine/swatch-libraries.ts :: SWATCH_LIBRARIES, swatchLibrary, libraryFromDoc, libraryColors; src/engine/index.ts :: Engine.addLibrarySwatches
- kind: explainer
- logged: v0.22.0 · 2026-10-08

Fifteen libraries authored for formpth, each a list of colour groups: Brights, Pastels and Retro (Color Themes), Skin Tones, Earth Tones, Metals (flat colours and multi-stop gradients), Web (the 216 web-safe colours, generated), Grayscale (0 to 100 percent in fives, as gray colours), Spectrums, Sky and Water and Fades (gradients, Fades using stop opacity), Basic Lines and Dots and Grids (pattern swatches whose tile and art are authored here and become pattern definitions when loaded), Seasons and Spot Inks (spot swatches with CMYK values chosen by eye; no trademarked colour book). A library swatch is data, not a document swatch: `addLibrarySwatches` adds what is used in one undo step, keeps the group names, reuses an existing swatch of the same name and paint, and clones pattern art so ids stay unique. `folder` only sorts the libraries into the Window > Swatch Libraries submenus. `libraryFromDoc` turns a document's swatches back into a library for saving; a tint swatch is written as its parent's colour with the tint baked in.

## src/engine/brush-libraries.ts

### src/engine/brush-libraries.ts · BRUSH_LIBRARIES
- refers-to: src/engine/brush-libraries.ts :: BRUSH_LIBRARIES, brushLibrary; src/engine/index.ts :: Engine.addLibraryBrushes
- kind: explainer
- logged: v0.22.0 · 2026-10-08

Five libraries drawn in code: Arrows (art brushes whose guides keep the head and tail from stretching, and a pattern brush with start and end tiles), Borders (pattern brushes with outer and inner corner tiles), Decorative Scatter, Artistic Ink (art brushes and two calligraphic nibs) and Bristle Brushes (one per tip shape). `addLibraryBrushes` copies the definition through JSON so the document never shares objects with the library, and reuses a brush of the same name and type.

## src/engine/brushes.ts

### src/engine/brushes.ts · bristle brushes
- refers-to: src/engine/brushes.ts :: bristleStrokes, bristleKind, rng, profileWidth
- kind: rationale
- logged: v0.22.0 · 2026-10-08

A bristle stroke is many thin closed outlines, one per bristle, each a piece with its own opacity (`BrushPiece.opacity`), so render, SVG (fill-opacity), PDF (an ExtGState per piece) and Expand Appearance (the fill item's opacity) all show the same layered paint. Bristle count follows density (6 to 76), the across-tip offset follows the shape (a disc for round tips, a line for flat ones, an even spread for the fan), and the tip shape sets how much shorter the outer bristles are, which shapes the ends: point tips converge, curve tips round, angle tips slant, blunt tips stay square. Low stiffness adds a slow sine wobble per bristle. The random numbers come from a seeded generator keyed on the path length and the brush, so a stroke looks the same in every render and export. Pressure arrives as the stroke's width profile, written by the Paintbrush from pen pressure; calligraphic brushes read it too. Outline Stroke (`pathOperation` outline_stroke in ops/paths.ts) now outlines a brushed stroke as its brush pieces, as Expand Appearance does, instead of the plain stroke under the brush.

### src/engine/brushes.ts · pattern brush tiles and art brush scaling
- refers-to: src/engine/brushes.ts :: patternBrush, corners, artBrush, bend, artGuides, TILE_KEYS
- kind: rationale
- logged: v0.22.0 · 2026-10-08

Corners are anchors where the tangent turns more than 25 degrees. A right-hand turn on screen (positive cross product with y down) uses the outer corner tile, as on a rectangle drawn clockwise; a left-hand turn uses the inner one. Corner tiles are drawn unbent, centred on the anchor and turned to the incoming side, at the brush scale; start and end tiles take their own width along the path. Side tiles fill the runs between them: Stretch fits a whole number of tiles by stretching them, Add Space keeps their size and spreads the gaps, Approximate scales them uniformly. Tiles are chosen from pattern swatches, as in Illustrator, and copied into the brush so deleting the swatch keeps the brush. The art brush's Stretch option now matters: off is Scale Proportionately (the art spans the path and its width scales with its length), guides stretch only the art between them while the ends keep the brush scale, falling back to a plain stretch when the path is shorter than the two ends. `bend` extends past either end of the path along the end tangent, so proportionate art longer than the path is not folded back on itself.

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

### src/tools/select.ts · path type brackets
- refers-to: src/tools/select.ts :: bracketAt, bracketDown, bracketMove, bracketUp; src/ui/stage.ts :: drawPathBrackets
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Selected type on a path shows three brackets drawn by the stage: start and end, sixteen pixels long on the type's side of the path, and the centre bracket crossing the path. The Selection and Direct Selection tools test them before anything else. Dragging start or end projects the pointer on the path (`pathParamAt`) and sets `pathStart` or `pathEnd`, kept one percent apart on an open path. Dragging the centre bracket moves both by the change in path position (wrapping on a closed path) and flips the type when the pointer is more than four pixels on the side of the path opposite the type. Each drag previews with `dragTo` and commits once, so it is one undo step.

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

### src/tools/select.ts · turned bounding box and envelope points
- refers-to: src/tools/select.ts :: frameHandles, handleAt, beginTransform, dragTransform, EP, envelopePointHit, envelopeDown, envelopeMove, envelopeUp, envelopeOverlay
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Handles come from Engine.selectionFrame's corners, so after a rotation they sit on the turned box and the rotate zone is outside its polygon. A scale handle works in the box's own frame: the pointer and the box go into that frame, the old axis scale is computed there, and the matrix applied is turn back times scale times turn, so a turned rectangle stretches along its sides and keeps its angle. With an envelope selected (and not in Edit Contents), the Direct Selection tool and the Mesh tool share EP: its mesh points draw as squares, the clicked point shows its handles, a point drags with snapping (Shift constrains to 45 degrees), a handle drags its end (Shift turns the opposite handle with it). Each drag is one undo step; a warp envelope becomes a mesh on the first one.

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

### src/tools/draw.ts · drawing on a perspective plane
- refers-to: src/tools/draw.ts :: buildOn, planePt, State.plane; src/engine/index.ts :: Engine.perspActive; src/engine/perspective.ts :: planeAt, snapPlane, attachPlace
- kind: explainer
- logged: v0.21.0 · 2026-10-10

When the perspective grid shows and a plane is active (captured at pointer down), both drag points are mapped onto the plane, snapped to the gridlines within 6 screen pixels when Snap to Grid is on (the ordinary snap is skipped, it works in the picture), and the same build function makes the shape in plane coordinates; attachPlace with an identity m projects it. Shift, Alt and the arrow keys behave as on the flat page because they act in plane space. A point behind the eye (the floor above the horizon) draws nothing. The click-for-exact-size dialog still draws flat.

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

### src/tools/freehand.ts · Paintbrush pressure
- refers-to: src/tools/freehand.ts :: collect, begin, pressureProfile, paintbrush up
- kind: explainer
- logged: v0.22.0 · 2026-10-08

The pointer's pressure (1 for a mouse) is collected with each point. When the current brush is bristle or calligraphic and some pressure was below 0.99, up to 16 width points along the stroke become its width profile (pressure times 1.4, at least 0.1), which those brushes read; a mouse stroke gets no profile.

## src/tools/transform.ts

### src/tools/transform.ts · free distort
- refers-to: src/tools/transform.ts :: freeTransform
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Ctrl or Command on a corner switches to free distort: anchors are mapped bilinearly from the original box to the dragged quadrilateral.
- Superseded in v0.17.0 by the entries below: the map is now a homography and curves are subdivided.

### src/tools/transform.ts · Free Transform modes
- refers-to: src/tools/transform.ts :: FT, ftMode, distortQuad, shearDrag, freeTransform; src/engine/index.ts :: ToolOptions.ftMode, ToolOptions.ftConstrain
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The mode and Constrain live in the tool options (ftMode, ftConstrain, both optional so saved preferences need nothing new), so the on-canvas widget in the stage, the options bar and the tool read one value. In Free Transform mode the handles scale and rotate, Ctrl or Command on a side handle shears along the box's side, Ctrl on a corner free distorts and Ctrl+Alt+Shift on a corner perspective distorts. In the two distort modes only corners respond. Perspective works in the box's frame: the drag's larger component, along the box's width or its height, picks the edge; the dragged corner moves along that edge by that amount and its partner on the edge (corner index xor 1 across, 3 minus index down) moves the opposite way. Free Distort moves the corner freely and snaps it; with Constrain or Shift the corner keeps to the box axis it moves along most. Each drag previews with dragTo from the drag origin and commits once.

### src/tools/transform.ts · bilinear free distort
- refers-to: src/tools/transform.ts :: bilinear (removed)
- kind: removed-code
- logged: v0.17.0 · 2026-10-08

    function bilinear(r, q) { u, v from p in r; top = lerp(q0, q1, u), bottom = lerp(q3, q2, u); return lerp(top, bottom, v) }

It mapped only anchors and handles, so long curves and straight sides did not follow the quadrilateral, and type and images were fitted with an affine through three corners. Free Transform now calls Engine.distortTargets (ops/distort.ts).

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

### src/tools/paint.ts · Mesh tool on envelopes
- refers-to: src/tools/paint.ts :: mesh tool down; src/tools/select.ts :: envelopeDown; src/engine/envelope.ts :: meshAddLine, meshRemoveLines
- kind: explainer
- logged: v0.17.0 · 2026-10-08

On a selected envelope the Mesh tool drags its points and handles like Direct Selection, a click anywhere inside the envelope's outline (not only on art) adds a row and column through that place without moving the art, and Alt-click on a point removes its lines. A click on an unselected envelope selects it first, so a stray click does not add lines.

### src/tools/paint.ts · Measure area and perimeter
- refers-to: src/tools/paint.ts :: measure, areaLines, closedShapes
- kind: explainer
- logged: v0.19.0 · 2026-10-10

A click without a drag reports the area (kernel area, so compound holes subtract) and perimeter of the closed subpaths of the object under the pointer, or of the selection when the click misses; a drag adds the same lines for the selection to its distance readout. Open subpaths are ignored and dimension groups are skipped. The readout is drawn by the tool's overlay because the stage clears engine.overlay after every pointer up, which is also why the old setOverlay label on up never showed.

## src/tools/puppet.ts

### src/tools/puppet.ts · pins and the session
- refers-to: src/tools/puppet.ts :: Session, session, build, rebase, solve, preview, puppetWarp tool; src/engine/index.ts :: ToolOptions.puppetExpand, ToolOptions.puppetMesh
- kind: rationale
- logged: v0.19.0 · 2026-10-10

Pins live in the tool, not the document, as in Illustrator, where they disappear when the tool is left. A session holds the rest art (the selected nodes when it began), the mesh, the pins (rest position, current target, optional angle) and the last solution, and stays valid while the document is the one the session last committed and the selection is the rest art or what it became (type turns into an envelope whose id is remembered in envIds). Anything else, an undo, another edit or a new selection, starts a new session without pins, so the art a session maps from is always what is on the page. The first click of a session places three pins by farthest point sampling over mesh vertices that sit inside the art, nudged a little toward its centre. A click elsewhere on the mesh adds a pin at the rest point that maps to the click (found by searching the deformed triangles) and can be dragged at once. Delete and a new Expand value rebase: the current art becomes the rest art and the pins stay where they are, so neither changes the art or adds a history step. Alt-drag picks the selected pin nearest the pointer within the dotted ring (or the only selected pin); the first twist starts from the local rotation the mesh already has there so the art does not jump. Every drag previews with dragTo from the drag origin and commits once.

## src/tools/dimension.ts

### src/tools/dimension.ts · creating and editing dimensions
- refers-to: src/tools/dimension.ts :: dimension tool, previewSpec, handleAt, setOpt, options; src/engine/index.ts :: Engine.addDimension, Engine.setDimension, Engine.dimensionIds, ToolOptions.dim, ToolOptions.dimPick
- kind: explainer
- logged: v0.19.0 · 2026-10-10

Points are taken by drag or by clicks (a press that does not move waits for the next click), snapped through ctx.snap so anchors, centres and smart guides catch them, with Shift holding 45 degree steps from the previous point. Once the type has its points the pointer sets the offset and the next click (or Enter) adds the dimension as one history step. Radial in Centre mode first tries the object under the pointer as a circle (a live ellipse, or a single closed path whose anchors are all on one circle) and takes its centre and radius, placing the rim point toward the click. The preview draws the generated children in the accent colour, so it matches the result. The options bar shows the first selected dimension's settings, or the defaults when none is selected; changing one sets the default and patches every selected dimension in one edit. Type changes only the default, because the points of one type do not fit another. Square handles on a selected dimension move its measured points (snapping, excluding the dimension itself) and the round handle its offset; each drag is one Edit Dimension step.

## src/tools/graph.ts

### src/tools/graph.ts · the graph tools
- refers-to: src/tools/graph.ts :: graphTool, options, pendingGraph; src/app.ts :: graph-size, graph-data
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Nine tools share the graph slot; Column Graph has Shift+G (J, Illustrator's old key, is Puppet Warp in formpth, and Shift+G was free). A drag sets the body rectangle (Shift square, Alt from the centre) and opens the Graph Data window; a click runs graph-size, which asks for width and height at the clicked point. The options bar shows Graph Data (with a graph selected), Graph Type, Legend, Ticks, Label Size and Drop Shadow; these write the selected graph or, with none, the defaults for new graphs in Engine.options.graph. The cursor is a crosshair with a column badge (CURSORS.graph).

## src/tools/shaper.ts

### src/tools/shaper.ts · Shaper and Intertwine tools
- refers-to: src/tools/shaper.ts :: shaper tool, intertwine tool, click, shaperAt, sourceAt, intertwineFor; src/ui/cursors.ts :: CURSORS.shaper, CURSORS.intertwine; src/ui/icons-vector.ts :: vShaper, vIntertwine; src/app.ts :: intertwine-make, intertwine-release, intertwine-edit, shaper-expand
- kind: explainer
- logged: v0.19.0 · 2026-10-10

Shaper (Shift+N) sits in the Pencil flyout after Pencil so N keeps its default; Intertwine (Shift+J, a key Illustrator leaves free) sits with Shape Builder and Live Paint. A Shaper drag shorter than five screen pixels is a click: in Faces mode it selects the face under it (Engine.shaperSelection, honoured by setFill while the Shaper tool is active, so the Color and Swatches panels paint the face) and in Shapes mode it selects the source shape inside the group; in Shapes mode a drag that starts on the selected source moves it as one Move Shape step. Longer strokes go to isScribble, then to recognition. The Intertwine tool is the editing mode of Object > Intertwine: it works on the selected intertwine object or the one under the pointer, highlights the overlap face under the pointer, flips on click, takes any drag (Alt or not) as a lasso, and returns to the Selection tool on Escape, Enter or Done.

## src/tools/perspective.ts

### src/tools/perspective.ts · Perspective Grid and Perspective Selection
- refers-to: src/tools/perspective.ts :: perspectiveGrid tool, perspectiveSelect tool, handleAt, planeBox, boxHandleAt, dragDoc, leafOfHit; src/engine/perspective.ts :: gridHandles, dragGrid; src/engine/index.ts :: Engine.perspMoveDoc, Engine.perspScaleDoc
- kind: explainer
- logged: v0.21.0 · 2026-10-10

Both tools share the perspective rail slot after Shape Builder, with Shift+P and Shift+V as in Illustrator, and both show the grid when picked. The grid tool hit tests the widget positions from gridHandles within 7 screen pixels and previews each drag with dragTo(reprojectDoc(origin, dragGrid(grid at press, handle, pointer))), so attached art follows live and the drag commits as one step named after the widget; it does nothing while the grid is locked. Round handles are vanishing points, diamonds the plane controls, squares the rest. The selection tool decides at press: a box handle of the selection's plane space bounds scales (opposite handle fixed, Shift proportional, Alt about the centre); art that has an attached leaf under the pointer, or a press inside the plane box, moves along that leaf's plane by the difference of the press and pointer mapped onto the plane; unattached art is placed on the active plane with its centre under the pointer's offset; empty space marquee selects. Alt at press duplicates inside the preview, so a cancel leaves nothing behind. There is no keyup in the tool contract, so 5 toggles the perpendicular move for the rest of the drag instead of only while held; the perpendicular distance is the vertical pointer travel divided by the plane's local scale at the press. A double-click on type in perspective runs Edit Text.

## src/tools/symbolism.ts

### src/tools/symbolism.ts · Shifter, Scruncher, Sizer, Spinner, Stainer, Screener, Styler
- refers-to: src/tools/symbolism.ts :: S, step, stop, targets
- kind: explainer
- logged: v0.12.0 · 2026-10-07

One stroke is one drag preview (`beginDrag`, `dragTo` per step, `commitDrag` on release) so a whole stroke is one undo step and nothing reaches history while the mouse is down. Scruncher, Sizer, Stainer, Screener and Styler keep working while the pointer is held still, on a 90 ms timer at the last point, as the originals do; Shifter and Spinner need movement and use the drag vector. With no symbol set selected, a press on an instance selects its set. Diameter is shared with the Symbol Sprayer and the liquify tools; `[` and `]` change it.

## src/tools/type.ts

### src/tools/type.ts · vertical tools
- refers-to: src/tools/type.ts :: typeTool, up; src/ui/text-editor.ts :: Pending.vertical; src/engine/index.ts :: addText (vertical)
- kind: rationale
- logged: v0.17.0 · 2026-10-08

The Vertical Type tool used to set a flag after the type was made, as a second history step, and nothing read it. Every type tool now passes `vertical` with its request, the editor keeps it on the pending type, and `addText` creates the node vertical in the same step. Vertical Area Type and Vertical Type on a Path are the same tools as their horizontal siblings with the flag set; they share the type flyout. Making type from a path (area type in a shape, type on a path) adds the type and removes the source path inside `beginStep` and `endStep`, so it is one Type step instead of Type followed by Clear.

### src/tools/type.ts · activate
- refers-to: src/tools/type.ts :: typeTool, activate
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Choosing a type tool with nothing selected sets the fill to black and the stroke to none, as Illustrator does. Without it, type set after drawing shapes took their white fill and vanished on a white artboard.

### src/tools/type.ts · Touch Type
- refers-to: src/tools/type.ts :: touchType, TT, touchGlyph, touchHandles, touchPick, glyphUnder, touchFrom, touchOptions; src/engine/index.ts :: setCharTouch; src/engine/text.ts :: touchSpans, cleanTouch
- kind: rationale
- logged: v0.18.0 · 2026-10-08

Shift+T, in the type flyout. A click finds the nearest non-space glyph of the type under the pointer (or of selected type) within three screen pixels of its cell and starts a move at once, as Illustrator does. The box is the glyph's cell through its full matrix; handles are the four corners (proportional), the top and bottom middles (vertical), the side middles (horizontal) and a dot 14 px above the top (rotate). Gestures work in the glyph's untouched frame (`B`, the text matrix times `glyphBaseMat`): scaling is the ratio of the pointer's distance from the cell's centre (along the turned axis for one direction), and the offset is corrected so the centre stays put, since `charTransform` scales about the glyph origin; rotation is the change of angle about the centre. Drags preview with `beginDrag` and `dragTo` and commit as one Touch Type step; arrow keys nudge one or ten points in document space (converted into the glyph's frame) as a step each; Escape drops the picked character. The options bar shows the picked character and its X, Y, H, V and rotation, all editable, and Reset. Leaving the tool keeps the transforms; the type tools still edit the text.

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

### src/io/api.ts · actions library and folder files
- refers-to: src/io/api.ts :: actionSets, saveActionSet, deleteActionSet, listFolder, readFile, writeFile
- kind: explainer
- logged: v0.20.0 · 2026-10-10

These call backend/app/routers/batch.py, which answers only formpth's own window (the agent bridge's origin check) because they read and write arbitrary folders. All are POST; readFile returns the bytes, writeFile posts a form with the folder, the file name and the blob and returns the written path.

## src/io/ase.ts

### src/io/ase.ts · Adobe Swatch Exchange
- refers-to: src/io/ase.ts :: readAse, writeAse, labToColor
- kind: explainer
- logged: v0.22.0 · 2026-10-08

Written from the public description of the format: the signature ASEF, version 1.0, a block count, then blocks of a 16-bit type and a 32-bit length, all big-endian. 0xC001 opens a group (its name), 0xC002 closes it, 0x0001 is a colour: a name as a UTF-16 length counting the terminating zero, the UTF-16 text and the zero, a four-letter model (CMYK, RGB, LAB, Gray), 32-bit floats, and a type (0 global, 1 spot, 2 process). Gradients and patterns cannot be expressed and are counted as skipped. LAB is read as L 0..1 with a and b in their usual range and converted through XYZ (D50, Bradford-adapted to sRGB).

### src/io/ase.ts · Gray direction
- refers-to: src/io/ase.ts :: readAse, writeAse
- kind: warning-context
- logged: v0.22.0 · 2026-10-08

The public notes do not say which way the single Gray value runs. formpth writes and reads it as a gray level (1 white, 0 black), the opposite of its own ink percentage, so files round-trip in formpth; if a file from elsewhere shows gray swatches inverted, this is the line to flip.

## src/io/data-merge.ts

### src/io/data-merge.ts · images and variations
- refers-to: src/io/data-merge.ts :: resolveImages, showDataSet, variationProject, renderAs, projectBlob, exportDataSets
- kind: rationale
- logged: v0.20.0 · 2026-10-10

resolveImages turns a data set's image values into assets before the synchronous engine edit: asset:key reuses a picture already in the document, a URL (http, https, data or blob) is fetched in the window, anything else is an absolute path read by the engine service. Each value is fetched once per project (cached by value) and stored in the project's assets under a fresh image key, so .fpth saves carry the pictures. Exports never touch the open document's history: each variation is a temporary Project built from applyDataSetDoc and reflow (so graphs regenerate) sharing the asset blobs, rendered by the same SVG, PDF and raster writers as File > Export. A folder destination writes each file through the engine and, when anything failed, formpth-data-merge-errors.txt; otherwise everything goes into one zip.

## src/io/project-io.ts

### src/io/project-io.ts · artboard rect
- refers-to: src/io/project-io.ts :: serialize, docFromManifest
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Artboards carry `rect: [x, y, w, h]` beside `x, y, w, h` so other tools can read the manifest without knowing the engine's field names. Readers prefer `rect`. The cast in `docFromManifest` exists because the manifest type does not declare `rect`.

### src/io/project-io.ts · perspective grid view state
- refers-to: src/io/project-io.ts :: serialize; src/engine/project.ts :: Project.persp; src/engine/perspective.ts :: perspViewOf
- kind: rationale
- logged: v0.21.0 · 2026-10-10

Show, Lock, Snap to Grid and the active plane are view state, not document edits: they live on the Project so toggling them is never an undo step and an undo never hides the grid. serialize writes them into the document as perspView and the Project constructor reads them back, so a saved file reopens with the grid as it was without the opening code (which does not read the manifest's view block) changing. The grid itself is doc.persp and round trips with the rest of the document; attachments are node fields. Both are optional, so older files open unchanged.

## src/io/svg.ts

### src/io/svg.ts · per-glyph type
- refers-to: src/io/svg.ts :: Writer.text
- kind: rationale
- logged: v0.17.0 · 2026-10-08

Vertical type and type on a path are written one glyph per element, each with the matrix the canvas uses (glyph matrix times the horizontal and vertical scale), inside a group carrying the node's transform. `writing-mode` and `textPath` were rejected: Chromium places vertical glyphs, punctuation and path glyphs by its own rules, so neither matched the canvas, and textPath cannot express Skew, 3D Ribbon, Stair Step, Gravity, flip or spacing. A glyph the canvas draws from a glyph id (a `vert` form or an OpenType substitution) is written as its outline path so the browser cannot pick a different form; the rest stay live text. Upright glyphs draw underline and strike-through as rules along the column like the canvas.

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

### src/io/svg.ts · warped images
- refers-to: src/io/svg.ts :: SvgWriter.baked
- kind: rationale
- logged: v0.17.0 · 2026-10-08

SVG cannot draw an image through a curved map, and a triangle-per-cell clip tree leaves hairline seams in every renderer, so an image with a warp grid is baked to a PNG at the document's raster resolution, like Effect Gallery effects. Type and paths inside envelopes stay vector because the envelope's derived output is already paths.

### src/io/svg.ts · variable axes, touched glyphs and synthetic glyphs
- refers-to: src/io/svg.ts :: Writer.text (css, face, outlineOnly, one, glyphRuns, loose)
- kind: rationale
- logged: v0.18.0 · 2026-10-08

Live type keeps its axes as `font-variation-settings`, and because Chromium ignores that property for installed fonts while honouring the matching font properties, `wght` is also written as `font-weight`, `wdth` as `font-stretch` and `slnt` as an oblique `font-style`; a run with any other axis (optical size or a custom axis), which no font property can carry, is written as outlines of the glyphs the canvas drew. A glyph with a transform (`t`: Touch Type, character rotation or justification glyph scaling) cannot sit in a `tspan`, so it is written on its own after the line's runs: its outline when the font is loaded, otherwise a `text` element with its full matrix, inside a `g` with the type's transform (the surrounding `text` is closed and reopened around it). Hyphens, list markers and tab leaders are glyphs of the layout, so they export as characters in the runs.

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

### src/io/pdf.ts · warped images
- refers-to: src/io/pdf.ts :: PdfWriter.needsRaster
- kind: rationale
- logged: v0.17.0 · 2026-10-08

An image with a warp grid is rasterised at the export ppi through the same renderer as the canvas, for the reason given under src/io/svg.ts; the rest of an envelope stays vector.

### src/io/pdf.ts · spot colours as Separation colour spaces
- refers-to: src/io/pdf.ts :: Painter.separation, Painter.spaces, pdfName, exportPdf
- kind: explainer
- logged: v0.22.0 · 2026-10-08

A paint linked to a spot swatch (directly or as a tint) is written as `/CSn cs t scn` against `[/Separation /Name /DeviceCMYK f]`, where f is a Type 2 function from no ink to the swatch's CMYK values, so viewers draw the alternate and separation tools show the plate under the swatch's name. Spaces are kept once per swatch name in the shared resource dictionary, which every page and form uses. Names are PDF name objects: bytes outside the regular range and delimiters are written as #xx. Gradients that use spot colours still go out as process colours. [Registration] (now linked from the Swatches panel like a global swatch) is written as `/Separation /All` with a full CMYK alternate, so it prints on every plate. Brush pieces with their own opacity (bristles) each get an ExtGState.

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

### src/io/fonts.ts · vertical metrics
- refers-to: src/io/fonts.ts :: vmetricsOf, verticalMetrics, featureGlyphs, installShaping (vertical, metrics), subsOf, CJK_SCRIPTS
- kind: explainer
- logged: v0.17.0 · 2026-10-08

opentype.js does not read vhea, vmtx or VORG, so `fontFor` keeps each font's raw bytes and `vmetricsOf` reads those tables from the sfnt table directory itself (WOFF faces, which are compressed, fall back to one em). The vertical advance is vmtx's advanceHeight; the vertical origin is VORG's value for the glyph or its default, otherwise the glyph's yMax plus its top side bearing, otherwise 0.88 em. The `vertical` shaping call applies the style's features and then `vert` looked up under the DFLT, hani, kana, hang and latn scripts (Noto Sans CJK lists it under all of them; the Latin-only list missed fonts that list it only under CJK scripts), and reports for each glyph whether `vert` replaced it. `metrics` returns cap height, x height and the hhea ascender for the area type first baseline options.

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

### src/io/fonts.ts · variable fonts
- refers-to: src/io/fonts.ts :: variedGlyph, infoOf, variationOf, isVariableFamily, instanceStyles, stylesOf, fontFor (byFile), outlineText, installShaping (shape, outline); src/engine/text.ts :: hasAxes, axesKey, items; src/engine/types.ts :: CharStyle.axes; backend/app/services/fonts.py :: _has_table, find
- kind: rationale
- logged: v0.18.0 · 2026-10-08

Canvas 2D cannot set font variations (`ctx.font` has no font-variation-settings and the browser ignores them for local fonts), so a span with `CharStyle.axes` goes through the shaping path like a span with OpenType features and draws each glyph's own outline. opentype.js 2.0 applies gvar and CFF2 blends through `font.variation.getTransform(gid, coords)`, which returns the varied glyph in font units with y up (hence the flip and 1/unitsPerEm) and its HVAR advance; it also writes the varied advance back onto the shared default glyph, so `variedGlyph` restores `advanceWidth` and `leftSideBearing` from the `_` copies opentype keeps. Varied outlines and advances are cached per font, glyph and `axesKey`, the same PathData the canvas, `textOutline`, `outlineText` (Create Outlines, PDF) and SVG outlines use, so all of them match. A font without HVAR keeps its default advances (gvar phantom points are not read). Glyph positioning (GPOS kerning) is not varied. `variationOf` reads fvar: axes with their ranges and names (registered tags by their English names, custom axes as name and tag) and named instances, whose names join `stylesOf` for the family once its file is parsed; a picked instance sets its coordinates as the span's axes. The fonts service marks variable files (an fvar table), the Character panel labels and filters them, and `fontFor` shares one parse per font file because every instance style of a variable family resolves to the same file. No variable face ships with formpth (the @fontsource packages here are static builds); installed variable fonts come through the fonts service.

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

### src/ui/stage.ts · Free Transform widget, turned box and envelope outlines
- refers-to: src/ui/stage.ts :: ftWidget, ftButtons, syncFtWidget, drawSelection, drawFrame, traceEdges; src/styles/formpth.css :: .cv-ft-widget
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The widget is built once in the constructor (Constrain, then Free Transform, Perspective Distort and Free Distort, icons from icons-vector) and synced on every overlay frame: shown only with the Free Transform tool and a selection, placed beside the selection's top-left through CSS variables in a transform (so moving it is no layout shift), clamped inside the stage and below the rulers, with a fixed 34 px width so placing it never measures the DOM. Its buttons stop pointerdown from reaching the canvas. The selection box is drawn from Engine.selectionFrame, as a turned polygon with eight handles when the box has an angle. An envelope's selection outline is its mesh lines (or the warped box grid, or the top shape), cached per node; in Edit Contents it is a dashed contents box with the raw contents' edges.

### src/ui/stage.ts · perspective grid and plane widget
- refers-to: src/ui/stage.ts :: perspWidget, perspFaces, syncPerspWidget, drawPerspective; src/styles/formpth.css :: .cv-persp-widget, .cv-persp-face, .cv-persp-none; src/styles/tokens.css :: --cv-persp-left, --cv-persp-right, --cv-persp-floor
- kind: explainer
- logged: v0.21.0 · 2026-10-10

The grid is drawn on the overlay canvas (it is a guide: never in the scene, never exported) after the guides and before the selection: the floor, then the left and right planes, each a translucent fill at the grid's opacity and its gridlines, the active plane stronger, then the horizon across the stage, the ground level dashed and a dot at each vanishing point. The widgets themselves belong to the Perspective Grid tool's overlay. The plane widget is built once in the constructor like the Free Transform widget: an inline cube whose three faces are radio items (left, horizontal, right) and a None button, all with data-plane; one delegated click sets the active plane. syncPerspWidget runs with each overlay frame and only patches its position variables, the faces' is-active class and aria-checked, and its hidden flag; its size is fixed in CSS so showing it moves nothing. Face colours are tokens, not the document's grid colours, so the widget reads the same in every document.

## src/ui/text-editor.ts

### src/ui/text-editor.ts · vertical editing
- refers-to: src/ui/text-editor.ts :: arrow, lineStep, overlay; src/engine/text.ts :: stepLine, selectionQuads, caretAt
- kind: explainer
- logged: v0.17.0 · 2026-10-08

In vertical type Up and Down move through the characters and Left and Right move to the next and previous column (columns advance leftward), as in Illustrator; `stepLine` keeps the inline position. The caret is a rule across the column and the selection is drawn from `selectionQuads`, so both follow vertical type, path effects and the node's transform without the editor knowing which. The hidden textarea still sits at the caret, so an input method opens its window there.

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

### src/ui/panels/color.ts · colour groups, tints and spot linking
- refers-to: src/ui/panels/color.ts :: SwatchesPanel.sync, head, fill, bindDrag, newGroup, renameGroup, newSwatch, edit, swatchPaint; src/engine/index.ts :: groupSwatches, moveSwatches, renameSwatchGroup, ungroupSwatches, deleteSwatches, addTintSwatch; src/engine/paint.ts :: resolvePaint
- kind: rationale
- logged: v0.22.0 · 2026-10-08

Groups stay a name on each swatch (`Swatch.group`, already in the format), so old files open unchanged and a group exists while it has a swatch. The grid is one keyed list: ungrouped swatches first, then a full-width folder row keyed `group:<name>` before each group's swatches, so moving a swatch is a move of its node, never a rebuild. Selection is a set (Shift or Mod click adds), a folder click picks the group and its swatches, and native drag and drop moves the dragged swatches (or the whole picked set) onto a folder, before a swatch (taking that swatch's group), or onto empty grid space (out of every group); each is one `moveSwatches` edit. Spot swatches are always linked like global ones: `swatchPaint` links both, `resolvePaint` resolves both, and editing either recolours its uses and its tint swatches. A tint swatch is a colour paint that points at its parent with a tint (`{ swatch, tint }`), the same shape an object's fill has after the Tint slider, so it resolves, exports (as a separation tint for spot parents) and survives deleting nothing else; deleting the parent bakes the tint into a plain colour. The Swatch Options and New Swatch dialogs offer Process, Global Process and Spot as one choice, as Illustrator's Color Type.

## src/ui/panels/color-guide.ts

### src/ui/panels/color-guide.ts · Color Guide
- refers-to: src/ui/panels/color-guide.ts :: ColorGuidePanel; src/engine/harmony.ts :: harmonyColors, variations, HARMONY_RULES
- kind: rationale
- logged: v0.11.0 · 2026-10-07

The base colour follows the active fill or stroke colour, except when that colour came from the guide itself (its hex is in `shown`), so picking a harmony swatch does not move the harmony under the pointer. Twelve rules rotate and adjust the base in HSB; each gives five colours, and each colour gets seven variations (tints and shades, warm and cool, vivid and muted) in a fixed 5 by 7 grid. The cells are made once and only their `--sw` variable changes, so switching rules repaints without touching the DOM structure. The plus saves the five harmony colours as a swatch group in one undo step.

### src/ui/panels/color-guide.ts · Limit to library
- refers-to: src/ui/panels/color-guide.ts :: ColorGuidePanel.fit, limitCtl
- kind: explainer
- logged: v0.22.0 · 2026-10-08

As Illustrator's Color Guide limit, a chosen swatch library snaps every harmony colour and variation to its nearest library colour (by RGB distance, `nearestFn`); the cells keep their fixed grid and only their colours change.

## src/ui/panels/color-picker.ts

### src/ui/panels/color-picker.ts · HSB scale
- refers-to: src/ui/panels/color-picker.ts :: ColorPicker.color, setColor
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

The picker keeps saturation and brightness in 0..1; `hsbToRgb` takes 0..100. Multiply on the way out, divide on the way in.

## src/ui/panels/recolor.ts

### src/ui/panels/recolor.ts · RecolorDialog
- refers-to: src/ui/panels/recolor.ts :: RecolorDialog.run, preview, bindWheel, drawWheel, applyPreset, applyLibrary, startPick, onPick, themeFrom, finish
- kind: rationale
- logged: v0.22.0 · 2026-10-08

The dialog replaces the old list of pickers. It opens a drag on the engine (`beginDrag`), previews every change with `dragTo` once per animation frame, and OK commits the drag, so the whole session is one Recolor Artwork step and Cancel or Escape leaves no trace. The scrim lets the canvas through and the dialog sits at the bottom right so the art stays visible. The wheel puts hue on the angle (0 at the right, counter-clockwise) and saturation on the radius, drawn at the active row's brightness; the smooth wheel is cached as image data per brightness and the segmented one is 12 hues by 4 rings. With the link on, dragging a marker rotates every marker by the same hue and scales their saturation by the same ratio, measured from where the drag began so markers do not drift; unlinked, only that row moves. The Color Theme Picker turns the scrim click-through, catches the next pointer down outside the dialog in the capture phase (so the stage never sees it), hit tests the point on the original document, and samples an image's pixels or an object's colours. Rows carry their own ids for keyed patching; the current-colour strip inside each row is a small keyed list too. Generative Recolor (a text prompt to colours) is not built: it needs a language model, which the dialog does not call.

## src/ui/panels/libraries.ts

### src/ui/panels/libraries.ts · library panels and User Defined
- refers-to: src/ui/panels/libraries.ts :: SwatchLibraryPanel, BrushLibraryPanel, userSwatchLibraries, keepUserSwatchLibrary, userBrushLibraries, keepUserBrushLibrary
- kind: rationale
- logged: v0.22.0 · 2026-10-08

Illustrator opens each library as its own floating panel; here every opened library lives in one Swatch Library (and one Brush Library) tab, with a dropdown of the libraries opened this session, so the dock keeps its layout. Rows are keyed by library and position, so switching libraries swaps whole sets of keys (removals and additions, never a same-key rebuild) and an unchanged library is never touched. User Defined libraries are kept in this browser's local storage when they are saved (as well as written to a file), the place Illustrator keeps its user folder; they are personal conveniences, the file is the durable copy. Brush previews draw against a blank document when none is open.

## src/ui/panels/navigator.ts

### src/ui/panels/navigator.ts · ActionsPanel rows
- refers-to: src/ui/panels/navigator.ts :: ActionsPanel.fill
- kind: warning-context
- logged: v0.9.0 · 2026-10-07

Rows store their action in `dataset.action`. `dataset.key` belongs to `patchList`; writing it broke row identity.

### src/ui/panels/navigator.ts · ActionsPanel moved out
- refers-to: src/ui/panels/navigator.ts :: ActionsPanel, Action, ACTIONS_KEY; src/ui/panels/actions.ts :: ActionsPanel
- kind: removed-code
- logged: v0.20.0 · 2026-10-10

The old ActionsPanel kept a flat list of actions in localStorage under formpth.actions, each step only a command id and label, recorded through commands.onRun and played by running the ids in a row. It is replaced by src/ui/panels/actions.ts (sets in the engine's library, parameters, modal steps, stops, batch). The new panel imports any formpth.actions found once into a set called My Actions in the library and removes the key. The note above about dataset.key still holds for the new rows (they use the patchList key only).

### src/ui/panels/navigator.ts · History footer
- refers-to: src/ui/panels/navigator.ts :: HistoryPanel; src/engine/index.ts :: Engine.newDocumentFromState, Engine.setHistoryLimit; src/app.ts :: historyOptions
- kind: explainer
- logged: v0.20.0 · 2026-10-10

The History panel's footer has New Document (opens the shown history state as a new document with the same assets, marked unsaved) and History Options (the undo step limit, the same Preferences value historyStates). Changing the limit trims every open document's history from the oldest end, never past the current state.

## src/ui/panels/actions.ts

### src/ui/panels/actions.ts · recording parameters
- refers-to: src/ui/panels/actions.ts :: ActionsPanel.onCommand, formHooks.onResult, engine.recorder, opLabel, stepLabel; src/ui/form-dialog.ts :: formHooks; src/ui/commands.ts :: Commands.onBefore, Commands.onAfter; src/engine/index.ts :: RecordedOp, Engine.recorder, Engine.noteDragTransform, Engine.playOp
- kind: rationale
- logged: v0.20.0 · 2026-10-10

A step is a command (id, label, the values its dialog returned, the dialog title, a modal flag), an engine operation (RecordedOp) or a stop (message, allow continue); each has an on flag. Every dialog in formpth goes through askForm (previewEdit and effectDialog too), so FormDialog reports what it returned through formHooks.onResult; a command recorded while a dialog is open waits for that result and stores the values. Engine operations reach the panel through Engine.recorder from a few methods: transform (Move by arrows, Transform Again, agents), commitDrag after a tool called noteDragTransform (Selection move, scale and rotate; Rotate, Reflect, Scale and Shear tools), addNodes (drawn shapes, kept as their nodes), setFill, setStroke, setObjectProps (opacity, blend) and applyGraphicStyle. To keep a dialog command from also recording the engine edit it performs, Commands.onBefore and onAfter raise Engine.recordMute around every command, and operations are ignored while a dialog is open or while a dialog result is settling (inflight, cleared on the next macrotask after onResult, after the command's then-callbacks ran).

Playback sets formHooks.supply before running a command: askForm then resolves at once with the recorded values over the field defaults, or opens prefilled when the step is modal, and the player waits between steps until no dialog is open and the engine is not busy. A transform operation is stored with the centre of the selection it moved; it plays as the same linear part about the centre of the current selection plus the recorded displacement of that centre, so a recorded move or rotation applies to whatever is selected. Commands that are views, panels, files, recent items, tools or the Graph Data window are not recorded (SKIP).

### src/ui/panels/actions.ts · library, files and batch
- refers-to: src/ui/panels/actions.ts :: ActionsPanel.load, ActionsPanel.save, ActionsPanel.fileOf, ActionsPanel.batch, predefined; src/io/api.ts :: actionSets, saveActionSet, deleteActionSet, listFolder, readFile, writeFile; backend/app/routers/batch.py
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Each set is one .fpaction file ({format: com.nodemode.formpth.actions, version 1, name, actions}) in the Actions folder of the engine's data folder, read at start and written 250 ms after any change; Save writes the same JSON for download and Load reads one. With the engine offline the sets live in memory and the status line says so. A Default Actions set is created when the library is empty. Batch over a folder lists the .fpth, SVG and PDF files through the engine, opens each as a document, plays the action without stops (a stop that does not allow continue fails the file), saves the result through the engine (or into a zip) as the source format or the chosen one, closes the document and returns to the one that was active; batch over data sets builds each variation as a temporary document. formpth-batch-log.txt lists each file as ok or error and is written even when nothing failed. The batch does not run inside engine.task: the player waits for the engine to be idle between steps, so an outer task would make it wait forever.

## src/ui/panels/variables.ts

### src/ui/panels/variables.ts · Variables panel
- refers-to: src/ui/panels/variables.ts :: VariablesPanel; src/io/data-merge.ts :: showDataSet, exportDataSets
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Built once: a data set select (options patched by key), previous, next, capture, update and delete, a count line with reserved height, the variable list (rows keyed by variable id) and two button rows. Picking a bound object on the artboard picks its variable. Showing a data set resolves its images first (engine.task) and then applies it as one undo step. Export Variations defaults to a folder in the desktop app and a zip download in the browser.

## src/ui/panels/graph-data.ts

### src/ui/panels/graph-data.ts · Graph Data window
- refers-to: src/ui/panels/graph-data.ts :: GraphDataWindow
- kind: explainer
- logged: v0.20.0 · 2026-10-10

A non-modal floating window (z-companion) built once; the grid is rows of text inputs patched by key and grown by whole rows and columns, always two spare of each, so typing at the edge adds room without rebuilding. The draft is a string grid with the corner, legend labels in row 0 and category labels in column 0; Apply parses numbers (thousands separators, a currency sign and a trailing % are accepted) and trims empty trailing rows and columns. While the draft has unapplied edits the window does not follow a different selected graph. Keys typed in the window stop propagating so tool shortcuts do not fire.

## src/ui/panels/graph-dialogs.ts

### src/ui/panels/graph-dialogs.ts · Graph Type, Column, Marker and Design
- refers-to: src/ui/panels/graph-dialogs.ts :: graphTypeDialog, graphColumnDialog, graphMarkerDialog, GraphDesignDialog, graphSizeDialog
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Graph Type is an askForm (so actions record it) that only writes the options that changed, as one step with the series type change; with no graph selected it sets the defaults for new graphs (Engine.options.graph). The series a dialog acts on are those whose parts the Group or Direct Selection tool selected, or all series when the whole graph is selected.

## src/ui/panels/perspective-grid.ts

### src/ui/panels/perspective-grid.ts · Define Grid and presets
- refers-to: src/ui/panels/perspective-grid.ts :: defineGrid, gridFrom, fieldsFor, saveGridPreset, savedPresets, presetById, presetChoices; src/app.ts :: persp-define, persp-presets, persp-save-preset
- kind: rationale
- logged: v0.21.0 · 2026-10-10

Define Grid is a previewEdit form, so every change previews by re-projecting the drag origin and OK commits one step. The form cannot rewrite its own fields when the Preset select changes, so the preset is the base and only the fields the person changed from their opening values override it; picking a preset and pressing OK applies the preset as saved. Saved presets are app wide, as in Illustrator, in localStorage under formpth.perspectivePresets (name and the whole grid); they are offered in Define Grid and in View > Perspective Grid > Grid Presets, because the menu tables are static and cannot list them. Applying a built-in preset from the menu keeps the document's grid colours and opacity.

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

### src/ui/panels/type.ts · variable axes, paragraph options and the Tabs panel
- refers-to: src/ui/panels/type.ts :: CharacterPanel (rotate, varOnly, axesBox, axesList, axisCtl, varInfo, varKey), ParagraphPanel (listKind, bullet, numFmt, numStart), hyphenationDialog, justificationDialog, TabsPanel, BULLETS, NUMBER_FORMATS, TAB_ICONS; src/app.ts :: tabs (TAB_HOMES, type-group), hyphenation-options, justification-options
- kind: rationale
- logged: v0.18.0 · 2026-10-08

The Character panel's Variable Font section sits at the foot of the panel so that showing it never moves the controls above; its sliders are keyed rows (`patchList`) per axis tag and range, created with their value and updated in place, and each drag is one gesture (one undo step). The panel asks `variationOf` once per family and style key and requeues when it answers. Picking a style that is a named instance also sets that instance's coordinates; any other style clears the axes. Variable fonts only filters the family list but always keeps the current family so the select never shows a blank. Rotation sits beside Baseline. The Paragraph panel adds the three missing justify icons (icons-vector `vJustify*`), Hyphenation and Justification buttons that open `previewEdit` dialogs (live preview, one undo step, also Type > Hyphenation and Type > Justification), and Bullets and Numbering, whose bullet, format and start controls are always present and only enabled for the kind in use, so nothing appears or disappears. The Tabs panel (Window > Tabs, Type > Tabs) is a ruler as wide as the area type frame (288 points for point type) with a tick every 36 points; stops are keyed buttons positioned by a CSS variable. A click on empty ruler adds a stop of the chosen alignment as one Paragraph step; dragging a stop previews with `beginDrag` and commits once, and dropping it more than 24 px below the ruler removes it. Stops keep their stored order (layout sorts them) so a dragged stop keeps its key.

### src/ui/panels/type.ts · type option dialogs
- refers-to: src/ui/panels/type.ts :: areaTypeOptionsDialog, pathTypeOptionsDialog, CharacterPanel.upright; src/app.ts :: area-type-options, type-on-path-options, type-path-*, type-orientation-*
- kind: explainer
- logged: v0.17.0 · 2026-10-08

Area Type Options used to open the Paragraph panel, which had no rows or first baseline. It is now a dialog through `previewEdit` (live preview, one undo step) with width and height for rectangular frames, rows and row gutter, columns and column gutter, inset, first baseline with Min, and text flow; width and height are shown rounded and applied only when changed, so opening and confirming never nudges a frame. Type on a Path Options is the same kind of dialog with effect, flip, align to path, spacing, start and end, and Type > Type on a Path also lists the five effects as checked commands. The Character panel's Upright Latin check is enabled only when vertical type is selected or being edited.

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

### src/ui/form-dialog.ts · hooks for actions
- refers-to: src/ui/form-dialog.ts :: formHooks, withValues, FormDialog.ask, FormDialog.finish
- kind: explainer
- logged: v0.20.0 · 2026-10-10

formHooks.onResult receives every dialog's title and returned values (null when cancelled), which is how the Actions panel records dialog values. formHooks.supply is consumed by the next ask: its values replace the fields' starting values, and unless modal the promise resolves at once with them and no dialog opens. Values that do not fit a field (a select choice that no longer exists, a non-number for a number) keep the field's own value.

## src/ui/commands.ts

### src/ui/commands.ts · onBefore and onAfter
- refers-to: src/ui/commands.ts :: Commands.run, Commands.onBefore, Commands.onAfter, Commands.onRun
- kind: explainer
- logged: v0.20.0 · 2026-10-10

run calls onBefore, the command, onAfter (in a finally) and then onRun. The Actions panel uses the first two to mute engine operation recording while a command runs, so a command is recorded once, as a command.

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

### src/styles/formpth.css · number fields in form dialogs
- refers-to: src/styles/formpth.css :: .cv-dialog .cv-field > .cv-num; src/ui/form-dialog.ts :: FormDialog.ask
- kind: rationale
- logged: v0.21.0 · 2026-10-10

Form dialog number fields used the panel width (a 34 px input beside the spinner), which cut off values of three or more digits such as Define Grid's distances and extents. Inside a dialog field row the box is now 110 px with the input filling it; the row's grid column already has the room, so no dialog grows.

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
