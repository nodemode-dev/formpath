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
│   ├── favicon.png, favicon.ico, apple-touch-icon.png   app icon renders
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
    │   ├── groupfx.ts          vector effects on groups, layers and live type: the effected shadow node
    │   ├── live.ts             live shapes, blends, repeats, envelopes
    │   ├── envelope.ts         envelope meshes, homographies, adaptive curve mapping
    │   ├── mesh.ts             gradient mesh
    │   ├── brushes.ts          calligraphic, scatter, art, bristle, pattern brushes
    │   ├── text.ts             type layout, styles, caret and index math
    │   ├── flow.ts             reflow: text wrap shapes and threaded stories
    │   ├── hyphen.ts           English hyphenation points, hyphenation and justification defaults
    │   ├── harmony.ts          colour harmony rules and variations
    │   ├── symbolism.ts        instance tint, instance art and the symbolism operations
    │   ├── symbols.ts          dynamic parts, 9-slice warp, registration, symbol editing session
    │   ├── symbol-libraries.ts built-in symbol libraries, library from a document
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
    │   ├── svg-refs.ts         SVG import: patterns, masks, clip paths and markers
    │   ├── svg-filter.ts       SVG import: filter chains to live effects
    │   ├── svg-text.ts         SVG import: text, tspans and text on a path to live type
    │   ├── pdf.ts              PDF writer and native reader
    │   ├── raster.ts           region rendering, PNG, JPEG, WebP, screens zip
    │   ├── trace.ts            image trace: options, presets, worker run, nodes
    │   ├── trace-core.ts       image trace pixels to paths, centreline strokes (no DOM)
    │   ├── trace.worker.ts     runs trace-core off the main thread
    │   ├── links.ts            linked image states, file handles, re-reading files
    │   ├── dxf.ts              DXF reader (R12 to 2018) and writer (R12, 2000), ACI colours
    │   ├── eps.ts              EPS writer (Level 3 PostScript) and the embedded formpath document
    │   ├── ps-read.ts          a small PostScript interpreter that reads foreign EPS into nodes
    │   ├── ps-filters.ts       PostScript data filters (ASCIIHex, ASCII85, RunLength, Flate, DCT) and image sample unpacking
    │   ├── generative.ts       Generative Shape Fill and Text to Pattern on the Assistant's model, SVG sanitising
    │   ├── retype.ts           Retype: letter masks, font ranking by shape overlap, live text in place
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
    └── styles/                 tokens, shell, panels, dialogs, formpath, light mode, fonts, scrollbars
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
- src/engine/symbols.ts
- src/engine/symbol-libraries.ts
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
- src/io/svg-refs.ts
- src/io/svg-filter.ts
- src/io/svg-text.ts
- src/io/pdf.ts
- src/io/pdf-read.ts
- src/io/pdf-crypt.ts
- src/io/pdf-mesh.ts
- src/io/raster.ts
- src/io/fonts.ts
- src/io/trace.ts
- src/io/trace-core.ts
- src/io/links.ts
- src/io/dxf.ts
- src/io/eps.ts
- src/io/ps-read.ts
- src/io/ps-filters.ts
- src/io/generative.ts
- src/io/retype.ts
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
- src/ui/panels/generative.ts
- src/ui/file-dialog.ts
- src/ui/panels/pattern-options.ts
- src/ui/panels/preview-edit.ts
- src/ui/panels/effect-gallery.ts
- src/ui/panels/three-d.ts
- src/ui/panels/appearance.ts
- src/ui/panels/attributes.ts
- src/ui/form-dialog.ts
- src/ui/app-dialogs.ts
- src/ui/commands.ts
- src/ui/palette.ts
- src/ui/icons.ts
- src/styles/tokens.css
- src/styles/formpath.css
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

`frame-src 'none'; object-src 'none'` and nothing more. A frame's own policy cannot stop the frame navigating itself, so a plugin could have sent the document out as `location.href = 'https://host/?' + svg`; the parent's `frame-src` is what governs navigations inside its frames, and `'none'` refuses every one while `srcdoc` plugin frames still load (checked in Chromium: the navigation is refused, the frame runs). formpath has no other frames or plugins, so nothing else is affected. A fuller app policy (script, style, connect) was left out: Vite's dev client, inline styles set from code and the theme boot script would each need allowances, and the threat it would guard against is already covered by the plugin frames' own policy. The Tauri `security.csp` stays `null` for the reason in backend/HASHOUT_LOG.md (tauri origins left out of the bridge).

## vite.config.ts

### vite.config.ts · server
- refers-to: vite.config.ts :: defineConfig server and preview
- kind: rationale
- logged: v0.9.0 · 2026-10-07

Ports 5230 (dev) and 5231 (preview) and 8230 (engine) so formpath runs beside formvis (5190, 8190). `host: false` keeps the dev server on localhost only; `strictPort` fails loudly instead of drifting.

## src/app.ts

### src/app.ts · formpath's own names for seven more features
- refers-to: src/app.ts :: the Symbols panel group tabs, recolor, generate-patterns, text-to-vector, generative-recolor, retype, intertwine-*, the Object > Interlace menu; src/engine/index.ts :: setCharTouch, makeIntertwine, setIntertwine, releaseIntertwine, addPatternSwatches, replaceWithText; src/engine/intertwine.ts; src/io/generative.ts, src/io/retype.ts; src/tools/shaper.ts, src/tools/type.ts; src/ui/panels/generative.ts, src/ui/panels/recolor.ts, src/ui/properties.ts; src/automation/agent-bridge.ts, src/automation/command-meta.ts; backend/app/routers/mcp.py; src/i18n/keys.json and every locale
- kind: rationale
- logged: v0.51.3 · 2026-10-23
- The owner's decision of 2026-10-23 (use the recommended names): AI Shape Fill (was Generative Shape Fill), AI Vector from Text (Text to Vector Graphic), AI Patterns (Generate Patterns), AI Recolor (Generative Recolor), Glyph Touch (Touch Type), Interlace (Intertwine), Recolor Art (Recolor Artwork) and Font Match (Retype). Only words changed: command, tool, panel and MCP tool ids (`generate-patterns`, `intertwine-make`, `touchType`, `retype`, `generative_shape_fill`), document fields (`intertwine`) and icons keep their names. New groups are named Interlace, AI Shape Fill and AI Vector from Text; expanding an interlace saved under the old name still gives Interlace (expanded).
- 27 English keys renamed in place in `keys.json`; new translations for all 25 languages written through `./formpath i18n import` (one CSV per language), the old rows removed with `prune` (27 per table), and `./formpath i18n check` reports 4032 of 4032 in every table. The new words avoid the other vendor's localized names (for example German Verschlingung rather than Verflechten). The Generative menu and the Shape Fill... item keep their generic names.

### src/app.ts · formpath's own names for four features
- refers-to: src/app.ts :: commands image-trace, image-trace-expand, trace-expand, trace-release, live-paint-*, the Object > Trace Image and Fill Regions menus, the image-trace panel tab; src/engine/index.ts :: shapeBuild, setTraceView, expandTrace, releaseTrace, makeLivePaint, livePaintFill, the edge, expand and release edits, makeIntertwine, the pin warp edit; src/tools/paint.ts, src/tools/puppet.ts, src/ui/properties.ts, src/io/trace.ts, src/automation/agent-bridge.ts, src/automation/command-meta.ts; src/i18n/keys.json and every locale
- kind: rationale
- logged: v0.51.2 · 2026-10-23
- The labels were another vendor's feature names. They are now Trace Image (was Image Trace), Fill Regions (Live Paint), Shape Crafter (Shape Builder) and Pin Warp (Puppet Warp), as the family IP plan approved on 2026-10-23 set them. Only words changed: command ids (`image-trace`, `live-paint-make`), tool ids (`livePaint`, `shapeBuilder`, `puppetWarp`), MCP tool names (`live_paint`, `shape_builder`, `puppet_warp`), document fields (`livePaint`, `trace`) and icons keep their names, so documents, shortcuts and agent calls are unchanged. A new traced group is named Trace Image and a new fill group Fill Regions; groups already in documents keep the names they were saved with.
- The 26 English keys were renamed in place in `keys.json` and the translations were written new for each of the 25 languages (CSV per language through `./formpath i18n import`, then `prune`), because the old ones used the other vendor's localized names for these features. `./formpath i18n check` passes. `keys.json` was not re-extracted: `extract` also adds about 60 strings no locale has yet, which is separate work.
- `.claude/skills/formpath-harness/references/commands.md` still shows the old labels: `agents sync` writes it from a stored command catalogue, and none is stored on this build machine.

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

The label toggles between Outline and Preview, as Illustrator's View menu does. formvis's GPU Preview wording does not apply: formpath has no GPU renderer.

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

The library tabs are `swatch-library` and `brush-library`: TAB_HOMES keys become Window commands labelled from the id, and `swatch-libraries` produced a "Swatch Libraries" panel command that shadowed the Swatch Libraries submenu of the same label. The Window menu is built by a function so the User Defined submenus list libraries saved during the session; their commands (`sw-user-0` to `sw-user-11`, `br-user-0` to `br-user-11`) take their labels from storage, as the recent-file commands do. Save Swatch Library as formpath and Save Brushes write a .fpth made from a blank document carrying only the swatches and patterns, or the brushes; any .fpth opens as a library through Other Library or Open Brush Library, and File > Open routes .ase files to the Swatch Library panel. The old Recolor Artwork form (a picker per colour plus hue, saturation and brightness shifts) is replaced by the RecolorDialog.

### src/app.ts · EPS, DXF and DWG, generative panels
- refers-to: src/app.ts :: dxfOptions, readForeign, openFiles, placeFile, exportBlob, exportAs, export-eps, export-dxf, generate-patterns, generative-shape-fill, retype, TAB_HOMES
- kind: explainer
- logged: v0.23.0 · 2026-10-10

`readForeign` is the one door for .dxf, .eps, .epsf, .ps and .dwg, used by Open, Place, drop and the agent bridge: DWG is read by the native reader first and only a version it does not read goes to the converter route (see src/io/dwg.ts); DXF shows DXF Import Options (askForm, so it shows the drawing's version and layer count and offers its layouts) unless options are passed; EPS tries the embedded document first, then the interpreter, and the toast lists what was left out. Place takes the result as one group, like SVG. EPS export of All artboards is a ZIP, so `exportAs` names it .zip. The three generative panels live as dock tabs (Generative Shape Fill and Generate Patterns in the Symbols group, Retype in the Type group), and the new commands only show those tabs; no shortcut was added, since the free keys were taken by recent tools. Window lists them through TAB_HOMES.

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

### src/automation/agent-bridge.ts · EPS, DXF and the generative tools
- refers-to: src/automation/agent-bridge.ts :: dxfArgs, __open, __place, __export, shapeFillTool, patternsTool, retypeTool; backend/app/routers/mcp.py :: open_file, export_file, place_image, generative_shape_fill, generate_patterns, retype
- kind: explainer
- logged: v0.23.0 · 2026-10-10

open_file and place_image gained optional DXF parameters (units, drawing_scale, layout, merge_layers, fit_artboard); `dxfArgs` passes them as a partial options object, which skips the import dialog, so an agent never waits on a modal. Opening merges nothing by default; placing merges into one group. export_file's new parameters (color for EPS; dxf_version, units, drawing_scale, scale_lineweights for DXF, and the existing outline_text) map onto the same ExportChoice the dialog builds. The generative tools check `modelState` first and fail with its sentence when no model is set, so an agent tells the person instead of retrying. generative_shape_fill applies one variation (pick, else the first that worked) and lists the others' errors; generate_patterns saves every usable tile; retype lists the ten matches unless apply is true, and for an image without a model that reads images it asks for text.

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

### src/engine/index.ts · generated patterns, shape fill and retype edits
- refers-to: src/engine/index.ts :: Engine.addPatternSwatches, Engine.replaceWithClip, Engine.replaceWithText
- kind: explainer
- logged: v0.23.0 · 2026-10-10

The engine never calls the model; the io layer brings back finished nodes and these three methods make each result one undo step. `addPatternSwatches` adds grid PatternDefs with their tiles and a pattern swatch for each, and optionally fills objects with the first, in one edit, so generated patterns are ordinary patterns (Edit Pattern, edit_pattern, SVG and PDF all treat them alike). `replaceWithClip` puts the generated art and the original shape into a clipping group in the shape's place, the shape last so it is the clipping path and keeps its stroke. `replaceWithText` inserts Retype's live type above the last source object and removes the sources unless asked to keep them (an image under the type).

### src/engine/index.ts · copy collects brushes and swatches from the whole tree
- refers-to: src/engine/index.ts :: Engine.copy, Engine.paste
- kind: fix
- logged: v0.53.1 · 2026-11-10

Brushes and global swatches went onto the clipboard only when a top-level copied node used them, so a brushed or swatch-filled path inside a copied group pasted into another document without its BrushDef or swatch (plain stroke, lost link), and type span colours were never looked at. Their ids are now collected in the same `walk` as patterns, with every span's fill and stroke, and the clipboard filters the document's brushes and swatches by those sets. Checked with tsc only.

### src/engine/index.ts · Place is one step
- refers-to: src/engine/index.ts :: Engine.addImage, beginStep, endStep
- kind: fix
- logged: v0.53.1 · 2026-11-10

addImage registered the image in one edit and added the node in another, so Undo after Place left an invisible second Place step. The pair is now wrapped in beginStep/endStep like addModel, but only when no step is open: the io placers and the agent bridge already open one around it, and `step` holds a single mark, so a nested beginStep would move it. Checked with tsc only.

### src/engine/index.ts · deleteArtboard keeps the active artboard
- refers-to: src/engine/index.ts :: Engine.deleteArtboard
- kind: fix
- logged: v0.53.1 · 2026-11-10

Deleting an artboard before the active one shifted the later artboards down while `activeArtboard` stayed, so the next artboard became active and Fit Artboard, Select All on Artboard and active-artboard export used it. The index now drops by one when the deleted artboard came before it and is clamped as before otherwise. Checked with tsc only.

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

### src/engine/history.ts · marks survive dropped states
- refers-to: src/engine/history.ts :: History.mark, History.rewind, History.squash, History.push, History.trim; src/engine/index.ts :: newDocumentFromState
- kind: fix
- logged: v0.53.1 · 2026-11-10

`mark` returned the array index of the current state, and once the history was full every push spliced the oldest state off the front, so a saved mark slid onto a later state: cancelling Edit Pattern or Edit Symbol after 200 edits rewound into the session and left the tile or symbol group behind, saving squashed the wrong range, and beginStep/endStep stopped merging; trim did the same. History now counts dropped states (`dropped`), `mark` adds the count and `rewind` and `squash` subtract it, so a mark whose state is gone gives null or false. `stateAt` and `jump` keep plain indices, so newDocumentFromState takes `steps().current` instead of `mark()`. Checked with tsc and a node check on a copy of the class (rewind and squash after 250 edits, after a trim, and with a dropped mark).

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

### src/engine/live.ts · top-object envelope and winding
- refers-to: src/engine/live.ts :: coonsFromShape
- kind: fix
- logged: v0.53.1 · 2026-11-10

For a counter-clockwise top shape `coonsFromShape` reordered the corners to [0, 3, 2, 1] but still walked the outline forward, so top became the left edge, right the bottom edge, and the art was mirrored across the diagonal (a 100 by 50 rectangle sent the frame's top-right corner to (0, 50)). The flattened outline is now reversed for that winding and the corners keep their natural order, as mesh.ts `sides` does. Checked with tsc and the reviewer's node repro with the fix copied in: both windings map (1, 0) to (100, 0).

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

### src/engine/transform.ts · mirror repeat axis follows the transform
- refers-to: src/engine/transform.ts :: transformNode (repeat); src/engine/live.ts :: repeat placement (mirror)
- kind: fix
- logged: v0.53.1 · 2026-11-10

A mirror repeat's centre was mapped through the transform but its angle was copied, so after Rotate or Reflect the copy was still mirrored across the old axis and the pair lost its symmetry. The axis direction `(-sin a, cos a)` is now mapped through the linear part of the matrix and the angle read back with `atan2(-vx, vy)`. Under rotation, reflection and uniform scale the new mirror equals the old one conjugated by the transform (node check, error below 1e-12); a non-uniform scale has no exact mirror and keeps the mapped axis.

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

paper.js (MIT) does booleans, intersections, offset and simplify on real curves. It runs headless on a detached project; the document model stays formpath's and nothing else imports paper.

### src/engine/kernel.ts · stroke outlines keep their corners
- refers-to: src/engine/kernel.ts :: strokeToPath, simplifyKeepingCorners
- kind: rationale
- logged: v0.17.0 · 2026-10-08

The outline of a curved stroke is built from flattened offsets and then fitted back to curves. paper's `simplify` fitted straight across corners, so a butt end came out as a bulge about a tenth of the width deep and miter tips were rounded, visibly in Expand Appearance, Outline Stroke and now the clip of gradient strokes in SVG and PDF. The outline is now cut at every vertex that turns more than 0.45 radians (butt ends, square caps, miter tips, inner join points) and each run between corners is simplified on its own, so corners stay sharp and the curves between them stay curves. A closed outline with no such corner is simplified whole as before.

### src/engine/kernel.ts, src/engine/pathfinder.ts · holes in nested contours
- refers-to: src/engine/kernel.ts :: regionParts; src/engine/pathfinder.ts :: splitContours
- kind: fix
- logged: v0.53.1 · 2026-11-10

Both functions gave a hole to every outer contour containing the hole's interior point. In a bullseye (ring, hole, island, hole) the inner hole went to the outer ring as well as the island, and since paper.js takes a disc's centre as its interior point, the middle hole also went to the island inside it, so Divide, Merge, the Eraser, Shaper regions and Interlace filled the centre and the gap and emptied the island. A hole now goes only to the smallest outer that is larger than the hole and contains its interior point; boolean results never cross, so that is its direct parent. Checked with tsc and a node check with the installed paper.js on a four-ring bullseye.

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

Not Liang's patterns: the TeX US English pattern list could not be added as data with a clear licence here, so this is a compact syllable splitter written for formpath. A word is read as units (consonant digraphs such as ch, th, ck and qu, vowel teams such as ea, ou, oy), a final silent e and a silent -ed or -es stop counting as vowels (but a consonant plus -le does), and between two vowel nuclei the consonants split: one consonant goes with the next syllable (except x and ck), doubled letters split between them, otherwise the longest tail that is an allowed onset (a consonant plus l or r, tw, dw) starts the next syllable and the rest stays, and a final consonant plus -le keeps the consonant. Adjacent vowels split unless one is a team or a glide (i after t, c, s, g or x as in -tion; u after g or q). Common prefixes (un, dis, mis, non, over, under, inter, trans, super, anti) and suffixes (-tion, -sion, -ment, -ness, -less, -ful, -ship, -ing, -able, -ible and a few more) force a break and the suffix is never split. It gets most everyday words to acceptable breaks (hy-phe-na-tion, in-for-ma-tion, chil-dren, lit-tle, jump-ing, run-ning) and errs on words whose syllables depend on pronunciation; a dictionary would fix that. `allowedBreaks` applies Words Longer Than, After First, Before Last and Hyphenate Capitalized Words.

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

### src/engine/flow.ts · wrap around a clip group uses the clipping path
- refers-to: src/engine/flow.ts :: outlines
- kind: fix
- logged: v0.53.1 · 2026-11-10

The wrap outline of a clip group came from `children[0]`, the bottom clipped art, while render, bounds, hit testing and the rest of the engine take the last child as the clipping path, so area type was pushed away by invisible art. It now uses the last child. Checked with tsc only.

## src/engine/symbolism.ts

### src/engine/symbolism.ts · instance tint and the symbolism operations
- refers-to: src/engine/symbolism.ts :: instanceArt, bakedInstance, applySymbolism; src/engine/types.ts :: SymbolNode.tint; src/engine/index.ts :: Engine.symbolism, breakSymbolLink, expandNode
- kind: rationale
- logged: v0.12.0 · 2026-10-07

A stained instance carries `tint` (a colour and an amount) and every reader draws `instanceArt`, the symbol's art with each paint mixed toward the tint by the amount, cached per art object and tint so a set of a hundred stained instances builds a handful of recoloured copies. Mixing the paints instead of compositing a coloured layer over the instance keeps the result identical in the canvas, SVG (one def per distinct tint) and PDF, and Break Link and Expand bake it with `bakedInstance`, which also carries the instance's opacity, blend and effects onto the art so screened and styled instances look the same after breaking. Every operation weights an instance by where its centre sits in the brush, one minus the square of the distance over the radius, so the edge of the brush barely moves anything; with no point (the agent tool) every instance in the set gets full weight. Intensity scales each step. Average pulls a value toward the mean of the instances under the brush, Random perturbs it, User Defined pushes it one way. The Styler copies a graphic style's effects, opacity and blend onto instances because fills and strokes have no geometry of their own on an instance to paint; Alt clears them.

### src/engine/symbolism.ts · instance art in three cached stages
- refers-to: src/engine/symbolism.ts :: partArt, instanceArt, withPartEdit; src/engine/symbols.ts :: partsApplied, slicedArt; src/engine/bounds.ts :: computeGeom; src/engine/hit.ts :: symbolPartHit
- kind: rationale
- logged: v0.22.0 · 2026-10-10

`instanceArt` is the one function every reader (canvas, hit testing, bounds, SVG, PDF, live envelopes, Break Link) calls, so dynamic overrides and 9-slice scaling went into it rather than into each writer. It builds the art in three stages, each cached on the object it starts from: the dynamic parts (cached per instance `parts` object and checked against the symbol's art so a redefined symbol rebuilds), the tint (per art object and tint), then the 9-slice warp (per art, guides and the instance's two axis scales to four places). An unscaled instance or one with no guides skips the warp, so an ordinary symbol costs what it did. The 9-slice warp is applied in the symbol's own space and divided by the instance scale, so the renderers still apply `xf` unchanged and the corners come out at their own size. Bounds now measure `instanceArt` (not the symbol's art) so a stretched 9-slice instance has the right box.

## src/engine/symbols.ts

### src/engine/symbols.ts · symbol editing mode as a squashed session
- refers-to: src/engine/symbols.ts :: SymbolSession, sessionStart, sessionArt; src/engine/index.ts :: enterSymbolEdit, exitSymbolEdit, syncSymbolEdit, pruneSelection, isolate; src/engine/project.ts :: Project.symbolEdit; src/ui/stage.ts :: drawScene isolation block
- kind: rationale
- logged: v0.22.0 · 2026-10-10

Editing a symbol follows pattern editing: the art goes into the document as an isolated group (at the instance's registration point, unscaled, as Illustrator shows it), the instance it came from is hidden, and Exit squashes every step since the history mark into one "Edit Symbol" step. Cancel rewinds to the mark. Every edit and drag preview inside the session runs `syncSymbolEdit`, which writes the group's art back into the symbol definition in the same document state, so all other instances follow live and undo inside the session stays consistent. The copies in the group get fresh ids (`sessionStart` keeps a map) because the project validator rejects an id that appears both in a layer and in a symbol's art; `sessionArt` maps them back so a dynamic instance's per-part overrides, keyed by art ids, survive editing. A plain wrapper group is unwrapped on entry and restored on exit so the Layers panel shows the parts. Undoing past the entry removes the group and `pruneSelection` ends the session. The registration point is the origin of the symbol's art space: New Symbol chooses one of nine points of the art's bounds, and the crosshair drawn in editing mode is that origin.

### src/engine/symbols.ts · 9-slice warp
- refers-to: src/engine/symbols.ts :: slicedArt, axis, warp, defaultSlice
- kind: explainer
- logged: v0.22.0 · 2026-10-10

Each axis maps piecewise linearly: outside the guides a point keeps its distance from the art's edge, between them it stretches to fill the scaled width; when the instance is smaller than the two corners together, the corners shrink in proportion and the middle collapses. Paths are mapped through `mapPathAdaptive`, which subdivides a curve that crosses a guide; type, images and nested instances move with their origin and keep their size. Strokes still scale with the instance transform, as on any instance.

## src/engine/symbol-libraries.ts

### src/engine/symbol-libraries.ts · SYMBOL_LIBRARIES
- refers-to: src/engine/symbol-libraries.ts :: SYMBOL_LIBRARIES, symbolLibrary, symbolLibraryFromDoc; src/engine/index.ts :: addLibrarySymbols; src/ui/panels/symbols.ts :: SymbolLibraryPanel; src/ui/panels/libraries.ts :: userSymbolLibraries
- kind: explainer
- logged: v0.22.0 · 2026-10-10

Five libraries drawn in code (Arrows, Web Icons, Nature, Shapes, Flowchart), every symbol centred on its registration point and dynamic. Web Icons' Button, Shapes' Rounded Square and Flowchart's Process and Terminator carry 9-slice guides so they stretch without distorting their corners. `addLibrarySymbols` clones the art (fresh ids) and reuses a symbol of the same name. Saved libraries are .fpth projects holding only symbols, and are kept under User Defined in local storage like the brush and swatch libraries.

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

### src/engine/index.ts · Make Fill Regions removes only what it absorbs
- refers-to: src/engine/index.ts :: makeLivePaint
- kind: fix
- logged: v0.53.1 · 2026-11-10

Make Fill Regions absorbs only paths, compound paths and groups with edges (`adds`, plus an existing Fill Regions host), but it removed every selected top object, so a selected text object, image, symbol instance or mesh vanished, or was overwritten by the new group when it was the topmost. The removal and placement order is now built from the host and `adds`, and other selected objects stay. Checked with tsc only; not run in the app.

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

### src/engine/graph.ts · tiny pie wedges are skipped
- refers-to: src/engine/graph.ts :: pie; src/engine/geometry.ts :: piePath
- kind: fix
- logged: v0.53.1 · 2026-11-10

piePath turns a sweep under 1e-6 degrees into a whole ellipse, so the second wedge of a row like [1000000000, 1] (3.6e-7 degrees) was drawn as a full disc over the chart. pie() now skips wedges under 1e-4 degrees and still advances the angle, as it skips zero and negative values. Checked with tsc only.

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

Five libraries generated in code, every style built only from things formpath renders and exports: Shadows and Glows (drop shadows, a long shadow made with a Transform effect of 40 copies on the lower fill only, glows, a neon stroke blurred under sharp ones, feather), Buttons (gradients, round corners, a gloss fill inset with Offset Path, inner glows), Outlines (sticker strokes, offset and inset strokes, stitched dashes, roughened ink, zig zag), Textures (Effect Gallery grain, watercolor, halftone, mosaic, stained glass and texturizer on the fill only, so strokes stay crisp) and Scribbles (scribble fills and crosshatch, pencil-sketch strokes). Many use effects on one fill or stroke, which is what makes them more than a fill and a stroke. Effects are built from their defaults (`effectDefaults`) with a few overrides, so a parameter added later gets its default. `styleLibrary` matches an id or a name, with spaces, dashes and underscores alike.

## src/engine/swatch-libraries.ts

### src/engine/swatch-libraries.ts · SWATCH_LIBRARIES
- refers-to: src/engine/swatch-libraries.ts :: SWATCH_LIBRARIES, swatchLibrary, libraryFromDoc, libraryColors; src/engine/index.ts :: Engine.addLibrarySwatches
- kind: explainer
- logged: v0.22.0 · 2026-10-08

Fifteen libraries authored for formpath, each a list of colour groups: Brights, Pastels and Retro (Color Themes), Skin Tones, Earth Tones, Metals (flat colours and multi-stop gradients), Web (the 216 web-safe colours, generated), Grayscale (0 to 100 percent in fives, as gray colours), Spectrums, Sky and Water and Fades (gradients, Fades using stop opacity), Basic Lines and Dots and Grids (pattern swatches whose tile and art are authored here and become pattern definitions when loaded), Seasons and Spot Inks (spot swatches with CMYK values chosen by eye; no trademarked colour book). A library swatch is data, not a document swatch: `addLibrarySwatches` adds what is used in one undo step, keeps the group names, reuses an existing swatch of the same name and paint, and clones pattern art so ids stay unique. `folder` only sorts the libraries into the Window > Swatch Libraries submenus. `libraryFromDoc` turns a document's swatches back into a library for saving; a tint swatch is written as its parent's colour with the tint baked in.

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

### src/tools/select.ts · symbols: editing mode, 9-slice guides, dynamic parts
- refers-to: src/tools/select.ts :: SG, sliceGuideAt, dragSlice, selection dblclick, directDown, directOverlay; src/engine/index.ts :: pickSymbolPart, activeSymbolPart, applyToSelection
- kind: explainer
- logged: v0.22.0 · 2026-10-10

Double-clicking an instance with the Selection tool enters symbol editing mode for it. In that mode the Selection tool grabs a 9-slice guide within 4 screen pixels before anything else and drags it as a drag preview, committed as one step. The Direct Selection tool, clicking an instance of a dynamic symbol, records the part under the pointer (`symbolPart`); while that instance alone is selected, `applyToSelection` sends every appearance change (fill, stroke, opacity, effects from the panels) to that part through `withPartEdit`, which stores the result as the instance's override for the part. Any new selection clears it. The part is outlined in the accent colour.

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

Nine tools share the graph slot; Column Graph has Shift+G (J, Illustrator's old key, is Puppet Warp in formpath, and Shift+G was free). A drag sets the body rectangle (Shift square, Alt from the centre) and opens the Graph Data window; a click runs graph-size, which asks for width and height at the clicked point. The options bar shows Graph Data (with a graph selected), Graph Type, Legend, Ticks, Label Size and Drop Shadow; these write the selected graph or, with none, the defaults for new graphs in Engine.options.graph. The cursor is a crosshair with a column badge (CURSORS.graph).

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

The window's side of the agent bridge goes through here now, as every other engine call does. `mcpSession` POSTs for a secret (null when the engine refuses or is down); `mcpNext` POSTs `{allowed}` with the secret in `X-Formpath-Bridge` and returns the status with the item, because the loop acts on 204, 205 and 403 differently; `mcpResult` and `mcpStop` carry the secret too. The unused GET-based `mcpNext` they replace took no secret.

### src/io/api.ts · actions library and folder files
- refers-to: src/io/api.ts :: actionSets, saveActionSet, deleteActionSet, listFolder, readFile, writeFile
- kind: explainer
- logged: v0.20.0 · 2026-10-10

These call backend/app/routers/batch.py, which answers only formpath's own window (the agent bridge's origin check) because they read and write arbitrary folders. All are POST; readFile returns the bytes, writeFile posts a form with the folder, the file name and the blob and returns the written path.

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

The public notes do not say which way the single Gray value runs. formpath writes and reads it as a gray level (1 white, 0 black), the opposite of its own ink percentage, so files round-trip in formpath; if a file from elsewhere shows gray swatches inverted, this is the line to flip.

## src/io/data-merge.ts

### src/io/data-merge.ts · images and variations
- refers-to: src/io/data-merge.ts :: resolveImages, showDataSet, variationProject, renderAs, projectBlob, exportDataSets
- kind: rationale
- logged: v0.20.0 · 2026-10-10

resolveImages turns a data set's image values into assets before the synchronous engine edit: asset:key reuses a picture already in the document, a URL (http, https, data or blob) is fetched in the window, anything else is an absolute path read by the engine service. Each value is fetched once per project (cached by value) and stored in the project's assets under a fresh image key, so .fpth saves carry the pictures. Exports never touch the open document's history: each variation is a temporary Project built from applyDataSetDoc and reflow (so graphs regenerate) sharing the asset blobs, rendered by the same SVG, PDF and raster writers as File > Export. A folder destination writes each file through the engine and, when anything failed, formpath-data-merge-errors.txt; otherwise everything goes into one zip.

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

### src/io/project-io.ts · linked images and cached previews
- refers-to: src/io/project-io.ts :: serialize; src/engine/project.ts :: Project.previews; backend/app/services/project_format.py :: _walk
- kind: rationale
- logged: v0.22.0 · 2026-10-10

A key used only by linked images is written as its cached preview (at most 1024 px, made by `LinkManager.preview` when the image is linked or read), not the full file, so a .fpth stays small and a missing file still shows something. With `linkPreviews` false (the Links panel menu) nothing is written for it and the backend validator accepts the missing asset because the node carries `linked`. Exports read `Project.assets`, which always holds the full pixels once the file has been read.

## src/io/svg.ts

### src/io/svg-refs.ts · patterns, masks, clip paths and markers on import
- refers-to: src/io/svg-refs.ts :: patternPaint, maskOf, clipOf, markers, fitViewBox, userBox; src/io/svg.ts :: importSvg paintOf
- kind: rationale
- logged: v0.37.0 · 2026-10-16

Before this the importer dropped pattern fills, masks and markers. A pattern becomes a PatternDef plus a swatch: the href chain is followed for tile attributes and children, patternUnits and patternContentUnits resolve against the user bounding box of the painted element, a viewBox is fitted with preserveAspectRatio, and the paint's xf is the content matrix times patternTransform, which is what the renderer expects (art coordinates straight to document coordinates). The tile is a clip group only when the art's visual bounds (strokes included) spill outside it. A mask becomes the node's OpacityMask: maskUnits clips the region, maskContentUnits sets the content box, and mask-type alpha whitens every paint so the luminance path of the renderer sees only alpha. clipPath resolves clipPathUnits, the clipPath's own transform, use children and clip-rule evenodd; text inside a clipPath is reported, not clipped. A marker is expanded per vertex (start, mid, end; orient auto bisects the corner angle, auto-start-reverse flips the start; markerUnits strokeWidth scales; viewBox, refX and refY, overflow clip). When the marker art is a recognised arrowhead (its anchors and handles match an ARROWHEADS shape within 7 percent, tip at the reference point, start match only with auto-start-reverse, end match only with auto) the stroke gets startArrow and endArrow with arrowAlign tip, which round-trips the exporter's own markers; anything else stays as a group named Marker so the picture is right even when it is not an arrowhead.

### src/io/svg.ts · one wrapper for clip, mask and filter, native hints, layer rule
- refers-to: src/io/svg.ts :: importSvg walk, Writer.text, leftOut; src/io/svg-filter.ts :: filterChain, filterEffects, filterPrimitives, cssFilterEffects; src/io/svg-text.ts :: importText, textFromHint
- kind: rationale
- logged: v0.37.0 · 2026-10-16

The old walk is now walkNode and a thin walk around it applies clip-path, mask and filter to whatever the element produced, collapsing a single child so that a clipped path does not gain a group. Filters become live effects where they map (blur.gaussian with radius equal to stdDeviation, stylize.drop_shadow, outer glow for a zero offset shadow, offset plus blur plus merge, the CSS drop-shadow and blur functions); the rest (feColorMatrix, feBlend, feMorphology, feTurbulence and so on) is named in SvgImport.leftOut, which the open toast prints, so nothing is dropped silently. Three unconditional data attributes carry what the SVG vocabulary cannot: data-formpath-pattern (tile type, offsets, spacing and brick, with data-formpath-art for the art) so a pattern swatch survives the strip of the native copy, data-arrows (start, end, scale, align) so an arrowhead is not read back as marker art, and data-formpath-textpath (a JSON of the path, offsets, flip, alignment, spacing and the styled runs) because text on a path is exported as per-glyph outlines and could not be recovered otherwise. A single named top-level group with no clip, opacity, blend, mask or effects is unwrapped into a layer, which is how Inkscape and Illustrator layers arrive; groups with any of those stay groups. Known gaps: gradient fills on text on a path fall back to a solid colour in the hint, side=right on textPath is noted, and pattern tiles used at several scales are re-rendered per scale.

### src/engine/geometry.ts · parseSvgD, implicit repeats and compact arc flags
- refers-to: src/engine/geometry.ts :: parseSvgD
- kind: rationale
- logged: v0.37.0 · 2026-10-16

Two real bugs found by importing 267 npm icons and comparing renders: repeated relative commands (m, l, c with more than one set of numbers) reused the first offset instead of the running current point, and arc flags written without separators ("a1 1 0 011 1") were read as one number. The icon sets went from a mean difference of about 17 and 11 to 0.02 and 0.08.

### src/engine/paint.ts · all CSS colour names and alpha in colour strings
- refers-to: src/engine/paint.ts :: parseColor; src/io/svg.ts :: alphaOf
- kind: rationale
- logged: v0.37.0 · 2026-10-16

parseColor knows the whole CSS named list, 3, 4, 6 and 8 digit hex, and hsl and hsla with comma or space separators. The importer reads the alpha of #rgba, #rrggbbaa, rgba() and hsla() on fill, stroke and gradient stops into the item's opacity, because the engine colour has no alpha.

### src/engine/render.ts · pattern tile scale includes the paint's own scale
- refers-to: src/engine/render.ts :: patternStyle
- kind: rationale
- logged: v0.37.0 · 2026-10-16

A pattern paint whose xf scales the art (every imported SVG pattern with patternContentUnits or a viewBox) was rendered into a tile canvas at the unscaled size and then stretched, which blurred it. The tile scale now multiplies in the square root of the determinant of xf.

### src/engine/render.ts · pattern period is the lattice
- refers-to: src/engine/render.ts :: patternStyle, patternTiles
- kind: fix
- logged: v0.53.1 · 2026-11-10

The tile canvas is `ceil(lattice * scale)` pixels (at most 4096) but the pattern was mapped back with `1 / scale`, so it repeated every `ceil(l.w * scale) / scale` units: a 37.3 pt tile at 100% repeated every 38 pt (seams and drift), and a lattice over 512 pt at scale 8 was cut off. The tile now keeps `sx` and `sy`, canvas size over lattice size, for both drawing the tile and the pattern matrix, so the period is exactly the lattice. Checked with tsc and a node check of the period; not looked at on screen.

### src/io/svg.ts · symbols as symbol and use
- refers-to: src/io/svg.ts :: Writer.node case symbol, symbolArts
- kind: rationale
- logged: v0.22.0 · 2026-10-10

Symbol definitions are written as `<symbol overflow="visible">` (visible because a symbol without a viewBox would clip art left of or above its registration point) and each instance as `<use>` with its matrix. Definitions are keyed by the art object `instanceArt` returns, so plain instances share one symbol while a tinted, overridden or 9-slice-stretched instance gets its own; the importer already reads `use` of `symbol`.

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

With `preserve`, the base64 manifest goes in a metadata element with id `formpath-data` and images carry `data-formpath-src`; `importSvg` returns `native: true` and the exact document.

### src/io/svg.ts · baked gallery effects
- refers-to: src/io/svg.ts :: Writer.baked
- kind: rationale
- logged: v0.14.0 · 2026-10-07

SVG filter primitives cannot express the Effect Gallery effects, so an object carrying one is drawn whole (with its other effects) at the document's raster resolution, capped at sixteen million pixels, and written as an image at its visual bounds with its opacity and blend mode. With `preserve` the editing data still holds the live effect, so formpath reopens it editable.

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

### src/io/svg.ts, src/io/svg-refs.ts · use and marker cycles, element budget
- refers-to: src/io/svg.ts :: importSvg walkNode (use branch, visited); src/io/svg-refs.ts :: markers
- kind: fix
- logged: v0.53.1 · 2026-11-10

`use` and marker contents were followed with only the depth limit of 64, so `<g id="a"><use href="#a"/><use href="#a"/></g>`, a marker whose content uses the same marker, or a chain of groups each using the previous one ten times froze the tab on Open, Place or paste. A `use` now skips a target that contains it or is already on the reference stack (`patStack`, shared with patterns and masks through RefCtx.stack), a marker on that stack is not drawn inside itself, and walkNode stops after 200,000 elements; skips leave a left-out note. Checked: tsc clean, tests/svg.test.ts passes, and a scratch check outside the repo imports the self loop in 6 ms, the self-marker in 4 ms and a 20-level chain of ten uses in about 1.2 s.

### src/io/svg.ts · preserve-editing keeps every image's bytes
- refers-to: src/io/svg.ts :: Writer.emitted, Writer.node (case 'image'), exportSvg (preserve branch)
- kind: fix
- logged: v0.53.1 · 2026-11-10

Reopening takes image bytes only from elements with `data-formpath-src`. Hidden images, images in hidden layers, warped images (baked to a PNG without the key) and images only in unplaced symbols got none, while the old leftover list counted every image node in the layers as written and added only pattern textures, so they reopened blank. Writer now records each key it writes with `data-formpath-src` in `emitted`, and the hidden leftover `<g display="none">` holds every exported image not in it (also images outside a selection export). Checked: tsc clean, tests/svg.test.ts passes, and a scratch check outside the repo round-trips a visible and a hidden image with both assets back.

### src/io/svg.ts · root size in percent, non-plain layer groups, bounding-box gradients, bad data URLs
- refers-to: src/io/svg.ts :: importSvg (dim, bare), gradPaint (ub, fr, unit), dataUrlToBlob
- kind: fix
- logged: v0.53.1 · 2026-11-10

Four import faults. `width="100%"` with a viewBox read as 100 pt (`len` has no `%` case); the root size (`dim`) now ignores percent, em and ex and falls back to the viewBox. With two or more named top-level groups, each layer took only its group's children, dropping opacity, blend, clip, mask and filter; a group that is not `bare` now stays whole inside its layer. objectBoundingBox gradients were placed on the page-space box of the already transformed shape, so rotation and skew were ignored; they now map the unit square through the untransformed box (`ubox`, pathBounds of the shape's own data) and then the element matrix, per the SVG spec, and fall back to the old box when there is none (type). A data: URL that fails to decode now gives null (that image is skipped) instead of aborting the import. Checked: tsc clean, tests/svg.test.ts passes, and a scratch check outside the repo: 800 x 600 artboard, both layer groups kept, the rotate(45) gradient runs along the rect, a plain radial is unchanged, and the bad data URL no longer stops the import.

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

### src/io/pdf.ts · JPEG passthrough only for plain upright JPEGs
- refers-to: src/io/pdf.ts :: jpegHead, Painter.image
- kind: fix
- logged: v0.53.1 · 2026-11-10

Every placed JPEG was written through unchanged as DCTDecode tagged DeviceRGB, sized from the decoded bitmap, so a grayscale or CMYK JPEG did not match its colour space (garbage or a refused image in viewers) and a photo with an EXIF orientation came out unrotated with width and height swapped. `jpegHead` reads the markers up to the first frame header: passthrough now needs an 8-bit SOF0, SOF1 or SOF2 frame with one or three components, EXIF orientation absent or 1, and a frame size equal to the bitmap; one component is tagged DeviceGray. Anything else is re-encoded from the decoded, upright bitmap. Checked: tsc clean; jpegHead in node on Pillow-made RGB, progressive, gray, CMYK and EXIF 1, 6 and 8 files (both byte orders). Not opened in a PDF viewer.

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

Each page becomes an artboard laid out left to right with a 40 pt gap, and its art a group named after it. The page matrix flips PDF's y-up space to formpath's y-down space at the crop box (the media box when there is none) and applies the page's Rotate, so rotated pages arrive upright the way a viewer shows them. Pages past 200 are left out to keep a single document workable.

### src/io/pdf-read.ts · clipping
- refers-to: src/io/pdf-read.ts :: Painter.finish
- kind: warning-context
- logged: v0.13.0 · 2026-10-07

A clip set with `W n` applies to everything painted until the graphics state that set it is restored, so each clip opens a clip group that collects the following art and closes at the matching `Q`; the clip path is the group's first child as formpath's clip groups expect. Clip groups that end up empty are pruned, which removes the many page-sized clips that producers emit.

### src/io/pdf-read.ts · type
- refers-to: src/io/pdf-read.ts :: Painter.show, FontNames, fitRun
- kind: explainer
- logged: v0.13.0 · 2026-10-07

Each text-showing operator becomes one point type object with the text decoded through ToUnicode, the encoding's Differences or WinAnsi. TJ gaps wider than 0.18 em become spaces, each in its own span tracked so the space is exactly as wide as the gap, and the whole run is then tracked to the width the PDF gave it, so substituted fonts never overlap the next run. A font resolves first by PostScript name against the installed fonts, then by family name with Latin Modern's `LM` prefix and optical size digits handled, and otherwise falls back to Courier New, Times New Roman or Helvetica by its class; the fallbacks are reported. Fonts without widths (the standard 14) are measured with the resolved family, whose metric-compatible faces keep runs in place. Type 3 fonts are drawn as paths by running their glyph procedures.

### src/io/pdf-read.ts · colour and shading
- refers-to: src/io/pdf-read.ts :: Painter.color, Painter.shading
- kind: explainer
- logged: v0.13.0 · 2026-10-07

DeviceGray, DeviceRGB and DeviceCMYK map to formpath's gray, rgb and cmyk colours so a CMYK document stays CMYK. ICCBased spaces use their alternate by component count, Indexed looks up its palette, and Separation and DeviceN evaluate their tint transform. Axial and radial shadings become linear and radial gradients sampled from their function. Mesh shadings and tiling patterns were once reported and filled grey; since v0.34.0 they import (see the three entries below), and function-based shadings (type 1) are still reported.

### src/io/pdf-read.ts · soft masks
- refers-to: src/io/pdf-read.ts :: Painter.softMask, whiten, Painter.raster
- kind: rationale
- logged: v0.34.0 · 2026-10-15

An ExtGState `/SMask` opens a group that collects everything painted until the mask is reset with `/None` or the graphics state is restored; the group carries formpath's opacity mask, so many objects share one mask. The mask art is the `/G` form run with the CTM in force when `gs` ran, clipped to the form's BBox. formpath's mask value is art alpha times luminosity, which is exactly a luminosity mask over the default black backdrop, so `/Luminosity` needs nothing more; a `/BC` that is not black adds a backdrop rectangle of that colour under the art, `/TR` is read only as invert (a function that falls from above half to below half) and any other curve is reported, and `/Alpha` masks paint the art in white so luminosity is 1 and only alpha is left (images inside an alpha mask keep their colours). Image `/SMask` and stencil `/Mask` streams of any size, depth and `/Decode` become the image's alpha; when the mask is larger than the image the picture is upscaled to the mask so no mask detail is lost.

### src/io/pdf-read.ts · tiling patterns
- refers-to: src/io/pdf-read.ts :: Painter.pattern, Painter.tiling; src/engine/pattern.ts :: patternLattice
- kind: rationale
- logged: v0.34.0 · 2026-10-15

A PatternType 1 pattern becomes a pattern definition: the tile is the BBox, the lattice gaps are XStep minus the BBox width and YStep minus its height (negative when tiles overlap), and the art is the pattern stream run in pattern space and clipped to the BBox. The paint's matrix is the pattern Matrix times the matrix of the stream that selected it (the page, or the form), and carries the page flip, so the art stays in PDF's y-up pattern space. Uncoloured patterns (PaintType 2) are painted with the colour from the `scn` operands, one definition per pattern and colour; colour operators inside them are not forbidden here but the current colour is what they start with. A pattern used inside its own art is cut with a grey fill and reported; nested patterns work because the tile art is run through the same painter. Tile art is built before the page's clip groups are closed and relies on that happening by reference, so definitions are never cloned. The canvas renders tiles at a whole number of pixels and drifts by up to a pixel per tile at non-integer scales (known, see pdf.ts · patterns); at 144 ppi, where a 25 pt step is exactly 50 px, the imported render matches pdftoppm to the pixel.

### src/io/pdf-mesh.ts · mesh shadings
- refers-to: src/io/pdf-mesh.ts :: readTriangles, readLattice, readPatches, gridMesh, latticeMesh, rasterTriangles; src/io/pdf-read.ts :: Painter.meshShading
- kind: rationale
- logged: v0.34.0 · 2026-10-15

Types 4 to 7 are decoded with their own bit width for flag, coordinate and component, padding at the byte boundary after each vertex (types 4 and 5) or patch (types 6 and 7), the Decode ranges, edge flags 1 to 3 (shared first edge and its two colours taken from the previous patch) and `/Function` colours (one parametric value per vertex). Type 6 and 7 patches that form a rectangular grid, found by walking shared edges and trying the eight rotations and reflections of each neighbour, with matching corner colours and no gaps, become one formpath gradient mesh; the 12 boundary points give the point handles and a type 7 patch's four inner points are dropped (formpath meshes are Coons patches, so only a patch with interior points off the Coons position changes). A type 5 lattice becomes a mesh with straight cells (handles a third of the way along each edge), which equals the Gouraud result for parallelogram cells. Everything else (free-form triangles, patches that are not a grid, discontinuous corner colours, any mesh with a Function) is rasterised in document space to a PNG of exactly the mesh region (at most 2048 px on the long side, up to 6 px per point) by Gouraud triangles, patches subdivided from their tensor surface, and placed as one image; with a Function the parametric value is interpolated and looked up in a 257 entry table, which is exact. `sh` paints the nodes; a shading pattern clips copies of them (fresh ids, shared image asset) to the filled shape. Strokes with a mesh pattern get grey.

### src/io/pdf-crypt.ts · Standard security handler
- refers-to: src/io/pdf-crypt.ts :: openCrypt, PdfCrypt, md5, rc4; src/io/pdf-read.ts :: PdfFile.unlock, PdfFile.shield, PdfFile.decode, PdfPasswordError; src/ui/dialogs.ts :: askPassword
- kind: rationale
- logged: v0.34.0 · 2026-10-15

Revisions 2 to 4 derive the key by the MD5 algorithm (RC4 40 and 128, crypt filters V2 and AESV2), revisions 5 and 6 validate and unwrap the 256 bit key from U/UE or O/OE (R6 uses the iterated hash with SHA-256/384/512 and AES-128-CBC, R5 plain SHA-256); the empty user password is tried first and an owner password also opens the file. MD5 and RC4 are written out because WebCrypto has neither; AES and SHA use WebCrypto, and unpadded AES-CBC decrypt (key unwrap) appends one encrypted padding block so WebCrypto's padding check passes. After the trailer is known every object parsed in the clear has its strings decrypted once, the Encrypt dictionary excepted; streams are decrypted in `decode` by object and generation number, XRef streams, streams with a Crypt filter and unencrypted metadata are left alone, and the strings inside object streams are not decrypted again because the stream already was. A password that is needed and absent or wrong throws PdfPasswordError; the open flow asks for it in a small dialog and asks again on a wrong one, and the MCP open_file tool's `password` parameter is tried once and, if wrong, fails without a dialog. Public-key (Adobe.PubSec) handlers still throw.

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

### src/io/fonts.ts · GSUB extension lookups
- refers-to: src/io/fonts.ts :: applyLookup, Sub (lookupType, extension)
- kind: fix
- logged: v0.53.1 · 2026-11-10

opentype.js keeps an Extension lookup (type 7) as type 7 with each real subtable under `extension` and its own `lookupType` (read in its parser). applyLookup had no case for 7, so contextual features in fonts that wrap lookups in extensions (Noto, Source and other large families) did nothing. It now unwraps such a lookup into the inner type and subtables first; the spec requires one type per extension lookup, so the first subtable's type is taken. Checked: tsc clean; a scratch copy of applyLookup in node substitutes through an extension-wrapped single lookup, a chain context calling it, and an extension-wrapped chain context. Not compared with hb-shape on a real font.

### src/io/fonts.ts, src/io/api.ts · a failed font lookup is retried
- refers-to: src/io/api.ts :: api.findFont; src/io/fonts.ts :: fontFor, fontNow
- kind: fix
- logged: v0.53.1 · 2026-11-10

findFont turned every error into null and fontFor and fontNow cached it for the session, so a font first asked for while the engine was down (desktop window before the sidecar, an engine restart) kept fallback metrics, could not be outlined, was rasterised in EPS and dropped from .ai private data until reload. findFont now returns null only for the engine's 404 (not installed) and rethrows the rest; fontFor deletes its cached promise when the load throws; fontNow, seeing that, lets the key be asked for again 5 s later instead of on every render (a browser without the engine would otherwise send a request per frame). Checked: tsc clean. Not run with the engine stopped and then started.

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

Canvas 2D cannot set font variations (`ctx.font` has no font-variation-settings and the browser ignores them for local fonts), so a span with `CharStyle.axes` goes through the shaping path like a span with OpenType features and draws each glyph's own outline. opentype.js 2.0 applies gvar and CFF2 blends through `font.variation.getTransform(gid, coords)`, which returns the varied glyph in font units with y up (hence the flip and 1/unitsPerEm) and its HVAR advance; it also writes the varied advance back onto the shared default glyph, so `variedGlyph` restores `advanceWidth` and `leftSideBearing` from the `_` copies opentype keeps. Varied outlines and advances are cached per font, glyph and `axesKey`, the same PathData the canvas, `textOutline`, `outlineText` (Create Outlines, PDF) and SVG outlines use, so all of them match. A font without HVAR keeps its default advances (gvar phantom points are not read). Glyph positioning (GPOS kerning) is not varied. `variationOf` reads fvar: axes with their ranges and names (registered tags by their English names, custom axes as name and tag) and named instances, whose names join `stylesOf` for the family once its file is parsed; a picked instance sets its coordinates as the span's axes. The fonts service marks variable files (an fvar table), the Character panel labels and filters them, and `fontFor` shares one parse per font file because every instance style of a variable family resolves to the same file. No variable face ships with formpath (the @fontsource packages here are static builds); installed variable fonts come through the fonts service.

### src/io/fonts.ts · glyph contours are closed
- refers-to: src/io/fonts.ts :: commandsToPath, variedGlyph, outlineText
- kind: fix
- logged: v0.52.5 · 2026-10-26 · FB-060

opentype.js 2.0 `Glyph.getPath` copies a `Z` command only when the glyph path has a stroke and a stroke width, so a fill-only glyph arrives as `M L L ...` with no `Z`, the last point repeating the first. `commandsToPath` closed a contour only on `Z`, so every outlined letter (Create Outlines, SVG and PDF outlines, `textOutline`) came out as open subpaths with a doubled end point: strokes showed a gap at the seam, a join was missing there and the path reported itself as open. Glyph contours are always closed, so a contour now closes at the next `M` and at the end of the commands as well as at `Z`, which also drops the repeated end point.

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

### src/io/trace.ts · full resolution in a worker
- refers-to: src/io/trace.ts :: traceImage, inWorker, TRACE_CAP, traceOptions; src/io/trace.worker.ts; src/io/trace-core.ts :: traceCore; src/app.ts :: trace, traceRuns
- kind: rationale
- logged: v0.22.0 · 2026-10-10

Images were downsampled to 420 px (600 for two presets) before tracing so the window would not freeze. Tracing now runs at the image's own size up to 2000 px on the longest side (the cap keeps a 4000 px photo to four million pixels of work, about a second) in a module worker: the decoded `ImageBitmap` is transferred, drawn into an `OffscreenCanvas` there, and only path data comes back. A newer run for the same object aborts the older one (`AbortController` terminates its worker), so dragging a slider never queues traces. Where workers or OffscreenCanvas are missing it runs on the main thread. Older tracing objects stored `maxSide: 420` in their options; `traceOptions` always replaces it with the cap. Noise and stroke width are given in pixels of the source image and scaled to the traced size.

### src/app.ts · trace placeholder keeps the panels still
- refers-to: src/app.ts :: trace
- kind: rationale
- logged: v0.22.0 · 2026-10-10

A first trace used to swap the image for the tracing group only when the worker finished, seconds after the click, so the Appearance panel (a group gains its Contents row) and the Properties quick actions reflowed with no recent input: a 0.0042 layout shift under throttling. The image is now replaced at once by the tracing group holding a copy of the image as its only child (it looks the same while tracing), and the result later replaces only the children, merged into the same "Image Trace" step. A trace that finds nothing or fails puts the image back in that step; a run superseded by a newer one leaves the group to the newer run.

### src/io/trace.ts · removed quantize, loops and smoothLoop
- refers-to: src/io/trace.ts :: quantize, loops, smoothLoop (removed)
- kind: removed-code
- logged: v0.22.0 · 2026-10-10

The k-means, the run-linking loop builder and the per-vertex handle smoothing moved into `trace-core.ts` (the loop builder unchanged, now over a mask so overlapping layers can use it). The per-vertex smoothing was replaced by the corner split and least-squares fit described there, because it could not keep a long arc smooth across many RDP vertices.

## src/io/trace-core.ts

### src/io/trace-core.ts · palette, noise, method and curve fitting
- refers-to: src/io/trace-core.ts :: classify, kmeans, autoCount, despeckle, fillPaths, fitRun, relax, snapLines
- kind: explainer
- logged: v0.22.0 · 2026-10-10

Automatic counts the 12-bit colour bins holding at least 0.4 percent of a pixel sample (2 to 30 colours); Limited uses the slider; Full Tone uses 48 colours (32 grays); Document Library maps every pixel to the nearest document swatch. Pixels are assigned through a 15-bit lookup table so a large image costs one palette search per distinct colour. Noise relabels every 4-connected region smaller than the threshold to the colour it shares the most edge with, so small specks disappear without leaving holes. Abutting traces each colour's own pixels; Overlapping stacks the colours by area, each mask holding its colour and every smaller one above it, so neighbouring shapes overlap instead of meeting at a seam. Outlines are the pixel-edge loops, densified to edge midpoints and relaxed once or twice, simplified with RDP to find corners (the Corners control sets the turning angle, 135 down to 15 degrees), then each run between corners is fitted with Schneider's least-squares cubic fit at the Paths tolerance. Snap Curves to Lines straightens segments whose handles lie within the tolerance of their chord and levels lines within 3 degrees of horizontal or vertical.

### src/io/trace-core.ts · centreline strokes
- refers-to: src/io/trace-core.ts :: chamfer, thin, skeletonLines, traceCore
- kind: explainer
- logged: v0.22.0 · 2026-10-10

Create Strokes (black and white mode) measures each 8-connected black region with a 3-4 chamfer distance transform; a region no thicker than the Stroke width (or every region when Fills is off) is thinned to a one-pixel skeleton with Zhang and Suen's two-pass algorithm. The skeleton is walked as a graph whose neighbours are the four edge neighbours plus a diagonal only when neither adjacent edge pixel is set (so staircase pixels do not read as junctions): every walk starts at an end or junction and stops at the next one, leftover pixels are closed loops. Each polyline gets the mean thickness along it as its stroke width and goes through the same corner split and curve fit as outlines. Thicker regions stay fills with the stroked pixels cut out of them.

## src/io/links.ts

### src/io/links.ts · real links
- refers-to: src/io/links.ts :: LinkManager, linkKey, pickLinkedFile, pickLinkFolder, saveLinkedFile, typed; src/engine/types.ts :: ImageLink, ImageNode.linked, Doc.linkPreviews; src/engine/index.ts :: setImageSource, addImage; src/app.ts :: chooseLinkFile, linkFileTo, placeLinked, relinkFolder, updateLinks, embedLinks, unembed, linkInfo, linkTool
- kind: rationale
- logged: v0.22.0 · 2026-10-10

`ImageNode.link` stays the plain file name (older files carry it); a real link is `linked`: the absolute path when the engine service is there (desktop or `./formpath boot`), or the id of a File System Access handle kept in IndexedDB in a Chromium browser without the engine, plus the size and modified time read with the pixels. The state is never stored: `LinkManager` stats every linked path in one `/api/files/stat` call (or asks each handle for its file) when the window regains focus, when it becomes visible, every four seconds and shortly after a document change, and compares size and time with what was read (Modified) or finds nothing (Missing). A handle whose permission lapsed after a reload reads as Linked until Update asks the browser again. Opening a project re-reads every unchanged linked file into the asset map and leaves a changed one on its cached preview until Update; a Missing file that comes back is re-read the same way. Relink, Update, Relink Missing and Unembed give the image a new asset key and go through `setImageSource`, which keeps the placed size when the pixel size changes, so each is one undo step (several files are squashed with `beginStep`). Without either path or handle, Place Linked and Relink fall back to embedding and say so.

## src/io/dxf.ts

### src/io/dxf.ts · reading DXF
- refers-to: src/io/dxf.ts :: parseDxf, dxfToDoc, bspline, bulgeArc, polyPath, aciRgb, mtextPlain
- kind: explainer
- logged: v0.23.0 · 2026-10-10

Written from Autodesk's DXF reference. `parseDxf` reads ASCII group-code pairs (binary DXF is refused with a message), the header's `$ACADVER`, `$INSUNITS` and `$MEASUREMENT`, the LAYER table (colour, true colour, lineweight, off or frozen) and STYLE table (font file), BLOCKS and ENTITIES; paper space entities (code 67) are grouped by their layout name (410) so the import dialog can pick one. Geometry is built in drawing units with y up and mapped once at the end (`toDoc`, units times scale, or fit to Letter). Bulges become arcs (`bulgeArc`: angle 4 atan b, centre on the chord's left normal for a positive bulge); arcs, ellipses (an affine of the unit circle) and hatch edges use `arcSegmentPath`. Splines of degree 3 or less without varying weights are converted exactly: every knot inside the domain is inserted (Boehm) up to multiplicity p, then each span's p+1 control points are a Bezier (quadratics raised to cubics); rational or higher-degree splines are sampled with de Boor and fitted with `fitCurve`; fit-point-only splines get Catmull-Rom tangents. Colour 256 is BYLAYER, 0 is BYBLOCK (the INSERT's colour), 7 prints black; the ACI table 10 to 249 is generated from the published hue, value and saturation layout instead of a copied table. Lineweight is hundredths of a millimetre with -1, -2 and -3 for layer, block and the 0.25 mm default. Entities with an extrusion of z -1 are mirrored in x (the OCS case that matters in 2D). TEXT and MTEXT become point type in a font named after the style's font file (SHX fonts fall to Arial); the cap height (code 40) divided by 0.7 gives the size. Not read: 3D meshes and polyface polylines, images, points, rays and xlines; the message counts what was left out.

### src/io/dxf.ts · writing DXF
- refers-to: src/io/dxf.ts :: exportDxf, DxfWriter, arcOf, nearestAci, STD_LW
- kind: rationale
- logged: v0.23.0 · 2026-10-10

AutoCAD 2000 output carries the structure AutoCAD expects of an AC1015 file: handles and owners on every table record and entity, the VPORT, LTYPE, LAYER, STYLE, VIEW, UCS, APPID, DIMSTYLE and BLOCK_RECORD tables, the model and paper space blocks, an OBJECTS section with the root dictionary, and `$HANDSEED` spliced in after the last handle is known. Each subpath goes out as an LWPOLYLINE when every segment is a line or a circular arc (`arcOf` fits a circle through the ends and midpoint and checks four more points to 0.1 percent of the radius, so formpath's own circles and rounded corners keep exact bulges), else as a degree 3 SPLINE whose control points are the Bezier handles with every joint knot tripled, which is exact. Filled closed paths add a solid HATCH with polyline loops flagged external; nonzero fill maps to the outer style and even-odd to normal. R12 has no lightweight polylines, splines or hatches, so it writes POLYLINE and VERTEX with bulges, flattens other curves to 0.05 pt and leaves fills as outlines. Colours are the nearest ACI plus the 420 true colour in 2000; lineweights snap to AutoCAD's standard list and scale with the drawing only when asked. Gradients write their middle colour; images, effects and transparency are not written, since DXF has no equivalent that CAD programs read reliably.

### src/io/dxf.ts · HATCH boundary counts are bounded
- refers-to: src/io/dxf.ts :: dxfToDoc case 'HATCH'
- kind: fix
- logged: v0.53.1 · 2026-11-10

The HATCH counts (93 vertices or edges, 95 knots, 96 control points, 97 fit points) drove their loops unchecked, and `next()` returns 0 without moving once the pairs run out, so `93` set to 1e9 pushed a billion vertices and hung the window. Each count is now limited to the pairs left in the entity; a damaged hatch reads what is there and is skipped as a hatch without boundaries when nothing is. Checked: tsc clean; a scratch check outside the repo imports hatches with 93, 95 and 96 at 1e9 in under 5 ms each and a normal square hatch unchanged.

### src/io/dxf.ts · only OCS entities are mirrored by a negative extrusion
- refers-to: src/io/dxf.ts :: dxfToDoc (wcs, ocs, case 'ELLIPSE')
- kind: fix
- logged: v0.53.1 · 2026-11-10

The reading explainer above says entities with extrusion z -1 are mirrored in x; that is right only for OCS entities (circle, arc, 2D polylines, solid, trace, text, insert, hatch). LINE, SPLINE, ELLIPSE, 3DFACE, LEADER and MTEXT are in world coordinates, so a mirrored ellipse (MIRROR leaves 230 = -1) came in at -x with its arc reversed; DWG ELLIPSE records always carry 230. `ocs` now returns the identity for those six types, and an ELLIPSE with a negative extrusion takes its minor axis as normal x major, `(ay, -ax) * ratio`, so its parameter runs clockwise as seen from +z. Checked: tsc clean; a scratch check outside the repo puts full and half ellipses with 230 = -1 at x = 5 (the half on the mirrored side), a LINE with 230 = -1 unmoved, and a CIRCLE with 230 = -1 still mirrored.

### src/io/dxf.ts · non-ASCII goes out as \U+XXXX
- refers-to: src/io/dxf.ts :: exportDxf (the Blob), parseDxf (pair reader)
- kind: fix
- logged: v0.53.1 · 2026-11-10

The file declares `$DWGCODEPAGE ANSI_1252` (R12 has that default too) but the Blob was UTF-8, so CAD programs showed "Straße" as "StraÃŸe" and CJK as byte soup. Every character above 0x7E is now written as `\U+XXXX`, the pre-2007 escape for characters outside the code page, so the file is ASCII in any code page; characters outside the BMP go out as two escapes (one per UTF-16 unit), which formpath reads back exactly and a CAD program shows as two unknown characters. parseDxf decodes `\U+XXXX` in every pair as it reads, so layer and block names come back too, and Export DWG (which re-parses this text) gets the same strings as before. Checked: tsc clean; a scratch check outside the repo round-trips the layer "Straße Ø" and the text "Ø25 °C 日本" through DXF 2000 (ASCII file) and through DWG. Not opened in a CAD program.

### src/io/dxf.ts · Aligned and Fit TEXT
- refers-to: src/io/dxf.ts :: dxfToDoc case 'TEXT', INSERT attributes
- kind: fix
- logged: v0.53.1 · 2026-11-10

With justification 72 = 3 (Aligned) or 5 (Fit), point 10 is the baseline start and point 11 its end; the reader took point 11 and fell through to left alignment, so the text started where it should end. Those two now place at point 10, left aligned (the stretch between the points is not applied). Checked: tsc clean; a scratch check outside the repo places 72 = 3 and 5 at x = 0 and 72 = 2 still right-aligned at x = 50.

## src/io/eps.ts

### src/io/eps.ts · EPS writer
- refers-to: src/io/eps.ts :: exportEps, PsPainter, ascii85, trimAfter, readEpsNative
- kind: rationale
- logged: v0.23.0 · 2026-10-10

Follows the EPSF 3.0 conventions (one page, `%%BoundingBox` in whole points with `%%HiResBoundingBox`, `%%LanguageLevel: 3`, no preview, save and restore around the page) and the PLRM for operators. The page flips once (`[1 0 0 -1 ...] concat`) so paths are written in document points. Gradients are Level 3 `shfill` with type 2 or 3 shadings and the same stitching functions as the PDF writer, painted inside a clip of the path; gradient strokes use `strokepath clip`. PostScript has no transparency, so any object with opacity, a blend mode, a mask, a pattern, a freeform gradient, a transparent gradient stop or a raster effect is flattened the way a print flattener does it: `trimAfter` builds the document up to and including that object, it is rendered opaque over the artboard, and drawn as an ImageType 3 image whose mask (InterleaveType 1, one byte per sample, 0 paints) is the object's own coverage, so the result matches the screen over whatever lies below. Placed images use the same masked image when they have alpha. Image data is Flate inside ASCII85 (`currentfile /ASCII85Decode filter /FlateDecode filter`), which keeps the file 7-bit clean. The editable document rides at the end as `%FPTH:` comment lines between `%FormpathDocument-Begin` and `-End`, which interpreters skip; `readEpsNative` finds them. All artboards export as a ZIP of one EPS per artboard, since an EPS holds one page.

## src/io/ps-read.ts

### src/io/ps-read.ts · images, image masks and file filters in EPS
- refers-to: src/io/ps-read.ts :: paintImage, Puller, imageOp, imageSpace, readEpsVector, epsSource; src/io/ps-filters.ts :: filterStream, inflate, readJpeg, toRgba; src/app.ts :: readForeign
- kind: rationale
- logged: v0.37.0 · 2026-10-16

image, colorimage and imagemask used to pop their operands and skip the data. They now build image nodes. Operands come in both forms (w h bps matrix source, and the Level 2 dictionary with DataSource, Decode, ImageMatrix, BitsPerComponent), and colorimage takes one source or one per component (read row by row, so procedures that share currentfile interleave correctly). A data source is a string, a procedure called until the bytes are in (the Pillow and Photoshop pattern, currentfile buf readhexstring pop), or a file: currentfile plus a chain of filters. The file objects are real now: currentfile reads the program text at the interpreter's position, readhexstring, readstring and readline consume it (they were stubs that returned empty), and filter builds ASCIIHexDecode, ASCII85Decode, RunLengthDecode, FlateDecode, DCTDecode and SubFileDecode stages. All of it is synchronous so the interpreter stays synchronous: Flate uses a small inflate in ps-filters.ts, and a DCT stream is read to its EOI marker and handed to the browser as the image asset itself (Decode is ignored for JPEG, the browser already undoes Adobe's inverted CMYK). Samples are 1, 2, 4, 8, 12 or 16 bits per component, gray, RGB or CMYK (naive conversion, like toRgb without a profile), with Decode arrays and Indexed colour spaces whose lookup is a string; a CMYK image is converted to RGB because the engine image node is RGB. The image matrix gives xf = flip x ctm x inverse(matrix), so rotation, flips and shear carry over, and the node goes through emit, so a clip in force wraps it in the usual clip group. imagemask paints the current colour where the sample is 0 (Decode [0 1], polarity false) or 1 (polarity true) and leaves the rest transparent, as an image node named Image mask; that is a bitmap, not a vector fill, so it does not stay sharp at any size. Raw images are encoded to PNG after interpretation, which is why readEpsVector is now async and returns the assets map that readForeign hands to the project. epsSource decodes true latin1 now: TextDecoder's latin1 label is windows-1252 and corrupted bytes 0x80 to 0x9f of binary data. Left out still: LZWDecode, CCITTFax, ImageType 3 and 4 (masked images), image dictionaries whose DataSource is a procedure reading a stream held in a variable name, and the colour space is not restored by grestore.

### src/io/ps-read.ts · reading foreign EPS
- refers-to: src/io/ps-read.ts :: Interp, Lexer, OPS, readEpsVector, epsSource, shadingPaint, showText
- kind: explainer
- logged: v0.23.0 · 2026-10-10

A small PostScript interpreter written from the PLRM: a lexer for numbers, radix numbers, names, literal names, strings with escapes, hex and ASCII85 strings, procedures, arrays and dictionaries; an operand stack and a dictionary stack (systemdict of the operators below, userdict); and a graphics state with the CTM, the current path in device space, colour (gray, RGB, CMYK, a Separation over CMYK as black), line settings, dash, clip and font. Paths are transformed as they are built, so `concat`, `scale` and `rotate` inside procedures work; painting turns the path into a node in document points using the bounding box. Clipping wraps following nodes in a clip group per clip path. `shfill` with axial or radial shadings and type 2 or 3 functions becomes a gradient fill of the clip path. `show` and its relatives become point type at the current point with the CTM, the PostScript font name mapped to an installed family. Control flow (if, ifelse, for, repeat, loop, forall, exit, stop, stopped), arithmetic, stack, array, dictionary and matrix operators are there; unknown names are skipped and reported. Images (`image`, `colorimage`, `imagemask`) are skipped, with the inline data passed over when it is ASCII85 or hex. DOS EPS files with a binary header are unwrapped first. A step limit stops runaway programs.

## src/io/generative.ts

### src/io/generative.ts · generative features on the person's model
- refers-to: src/io/generative.ts :: modelState, shapeFillVariations, patternVariations, sanitizeSvg, extractSvg, clipToShape, PATTERN_PRESETS; backend/app/services/llm.py :: generate
- kind: rationale
- logged: v0.23.0 · 2026-10-10

Generative Shape Fill and Text to Pattern ask the model the person set for the Assistant, through the engine's `/api/llm/generate`; nothing else is called, and `modelState` turns a missing model or engine into one sentence the panels and tools show. The model is asked for SVG because formpath already imports SVG into editable nodes. Its answer is untrusted: `extractSvg` takes the outermost svg element out of any prose or code fence, `sanitizeSvg` keeps only shape, group, gradient and clip elements with presentation attributes and same-document references (no script, image, foreignObject, event handlers or external URLs) and caps size and element count, and `importSvg` (which never renders) builds the nodes. Shape Fill sends the outline normalised to a 1000 unit viewBox so the coordinates are short; Shape Strength goes into the prompt in three bands and, at the top band, the art's bounds are stretched onto the shape's. Variations run in parallel at rising temperatures. Text to Pattern asks for a 200 unit tile and says that motifs may cross the edges, because the pattern renderer draws the neighbouring copies (`latticeCopies` reach 1) and so wraps them; every colour is then snapped to the chosen palette with `nearestFn`, so a preset or custom palette is kept even when the model strays. The colour presets are formpath's own small palettes.

## src/io/retype.ts

### src/io/retype.ts · finding a font by shape
- refers-to: src/io/retype.ts :: sourceFromOutlines, sourceFromImage, group, finish, rankFonts, readGlyphs, wordScore, plainPath, retypeNode, recognize, candidateFaces
- kind: explainer
- logged: v0.23.0 · 2026-10-10

The source becomes letter shapes either way: outlined type by its subpaths, an image by Otsu thresholding (ink polarity from the border) and 4-connected components. `group` sorts the pieces into lines by vertical overlap and into letters by horizontal overlap (so the dot of an i joins its stem). Each letter is a 32 by 32 mask fitted with its aspect kept, plus its height and top relative to the cap-height estimate (the 75th percentile letter height); the longest line is also kept as one 48 pixel high mask. Without known words, `readGlyphs` compares every letter with A to Z, a to z, digits and some punctuation of each installed face (mask overlap minus penalties for relative height, top and aspect), and the seven best faces vote on each letter. With the words (typed, or read by a model that reads images), `wordScore` sets the line in each face with `plainPath` (glyph by glyph with kerning; opentype.js's own layout throws on some GSUB lookups), stretches it onto the source line's mask and scores a blurred overlap times an aspect penalty; with letter reads the two scores mix 65 to 35, and the model's typeface description nudges weight, slant and width. CJK, emoji, symbol and math faces are skipped and at most 220 faces load, so a run takes seconds. `retypeNode` sizes the type so the line's ink height matches, aligns its ink box to the source and sets tracking to match the width.

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
- refers-to: src/ui/stage.ts :: ftWidget, ftButtons, syncFtWidget, drawSelection, drawFrame, traceEdges; src/styles/formpath.css :: .cv-ft-widget
- kind: explainer
- logged: v0.17.0 · 2026-10-08

The widget is built once in the constructor (Constrain, then Free Transform, Perspective Distort and Free Distort, icons from icons-vector) and synced on every overlay frame: shown only with the Free Transform tool and a selection, placed beside the selection's top-left through CSS variables in a transform (so moving it is no layout shift), clamped inside the stage and below the rulers, with a fixed 34 px width so placing it never measures the DOM. Its buttons stop pointerdown from reaching the canvas. The selection box is drawn from Engine.selectionFrame, as a turned polygon with eight handles when the box has an angle. An envelope's selection outline is its mesh lines (or the warped box grid, or the top shape), cached per node; in Edit Contents it is a dashed contents box with the raw contents' edges.

### src/ui/stage.ts · perspective grid and plane widget
- refers-to: src/ui/stage.ts :: perspWidget, perspFaces, syncPerspWidget, drawPerspective; src/styles/formpath.css :: .cv-persp-widget, .cv-persp-face, .cv-persp-none; src/styles/tokens.css :: --cv-persp-left, --cv-persp-right, --cv-persp-floor
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

The old ActionsPanel kept a flat list of actions in localStorage under formpath.actions, each step only a command id and label, recorded through commands.onRun and played by running the ids in a row. It is replaced by src/ui/panels/actions.ts (sets in the engine's library, parameters, modal steps, stops, batch). The new panel imports any formpath.actions found once into a set called My Actions in the library and removes the key. The note above about dataset.key still holds for the new rows (they use the patchList key only).

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

A step is a command (id, label, the values its dialog returned, the dialog title, a modal flag), an engine operation (RecordedOp) or a stop (message, allow continue); each has an on flag. Every dialog in formpath goes through askForm (previewEdit and effectDialog too), so FormDialog reports what it returned through formHooks.onResult; a command recorded while a dialog is open waits for that result and stores the values. Engine operations reach the panel through Engine.recorder from a few methods: transform (Move by arrows, Transform Again, agents), commitDrag after a tool called noteDragTransform (Selection move, scale and rotate; Rotate, Reflect, Scale and Shear tools), addNodes (drawn shapes, kept as their nodes), setFill, setStroke, setObjectProps (opacity, blend) and applyGraphicStyle. To keep a dialog command from also recording the engine edit it performs, Commands.onBefore and onAfter raise Engine.recordMute around every command, and operations are ignored while a dialog is open or while a dialog result is settling (inflight, cleared on the next macrotask after onResult, after the command's then-callbacks ran).

Playback sets formHooks.supply before running a command: askForm then resolves at once with the recorded values over the field defaults, or opens prefilled when the step is modal, and the player waits between steps until no dialog is open and the engine is not busy. A transform operation is stored with the centre of the selection it moved; it plays as the same linear part about the centre of the current selection plus the recorded displacement of that centre, so a recorded move or rotation applies to whatever is selected. Commands that are views, panels, files, recent items, tools or the Graph Data window are not recorded (SKIP).

### src/ui/panels/actions.ts · library, files and batch
- refers-to: src/ui/panels/actions.ts :: ActionsPanel.load, ActionsPanel.save, ActionsPanel.fileOf, ActionsPanel.batch, predefined; src/io/api.ts :: actionSets, saveActionSet, deleteActionSet, listFolder, readFile, writeFile; backend/app/routers/batch.py
- kind: explainer
- logged: v0.20.0 · 2026-10-10

Each set is one .fpaction file ({format: com.nodemode.formpath.actions, version 1, name, actions}) in the Actions folder of the engine's data folder, read at start and written 250 ms after any change; Save writes the same JSON for download and Load reads one. With the engine offline the sets live in memory and the status line says so. A Default Actions set is created when the library is empty. Batch over a folder lists the .fpth, SVG and PDF files through the engine, opens each as a document, plays the action without stops (a stop that does not allow continue fails the file), saves the result through the engine (or into a zip) as the source format or the chosen one, closes the document and returns to the one that was active; batch over data sets builds each variation as a temporary document. formpath-batch-log.txt lists each file as ok or error and is written even when nothing failed. The batch does not run inside engine.task: the player waits for the engine to be idle between steps, so an outer task would make it wait forever.

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

Define Grid is a previewEdit form, so every change previews by re-projecting the drag origin and OK commits one step. The form cannot rewrite its own fields when the Preset select changes, so the preset is the base and only the fields the person changed from their opening values override it; picking a preset and pressing OK applies the preset as saved. Saved presets are app wide, as in Illustrator, in localStorage under formpath.perspectivePresets (name and the whole grid); they are offered in Define Grid and in View > Perspective Grid > Grid Presets, because the menu tables are static and cannot list them. Applying a built-in preset from the menu keeps the document's grid colours and opacity.

## src/ui/panels/stroke.ts

### src/ui/panels/stroke.ts · new brushes and previews
- refers-to: src/ui/panels/stroke.ts :: BrushesPanel.create, options, ask, preview; src/engine/index.ts :: Engine.newBrush, editBrush, deleteBrush
- kind: rationale
- logged: v0.12.0 · 2026-10-07

New Brush asks the type and name, then the type's options, the same dialog Brush Options uses. Scatter, art and pattern brushes take the selected artwork: groups are flattened and every stroke is expanded into filled shapes first, because the brush engine draws filled pieces only, then the art moves to the origin. New brushes keep the art's own colours (colorization None), as Illustrator does. Deleting a brush that is in use leaves those strokes as plain strokes. The panel draws each brush along the same S-curve through the real brush geometry instead of a sketch of its type, at a stroke weight that fits its art in the row; a row redraws only when its brush's definition changes (`data-sig`).

### src/ui/panels/stroke.ts · Transparency panel knockout and mask controls
- refers-to: src/ui/panels/stroke.ts :: TransparencyPanel, triCheck; src/styles/formpath.css :: .cv-transp-mask
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

### src/ui/panels/image-trace.ts · advanced controls and overlapping runs
- refers-to: src/ui/panels/image-trace.ts :: ImageTracePanel.run, args, sync
- kind: explainer
- logged: v0.22.0 · 2026-10-10

Palette, Corners, Noise, Method, Create Fills and Strokes, Stroke width and Snap Curves to Lines all go through `args` to `traceOptions`. The panel no longer ignores changes while a trace runs: each change starts a run and `app.ts` aborts the previous worker, and a counter keeps the busy state until the last run settles. Palette hides in black and white mode, Colors is enabled only for Limited, and Strokes and Stroke only in black and white mode, as in Illustrator.

## src/ui/file-dialog.ts

### src/ui/file-dialog.ts · choosing a path through the engine
- refers-to: src/ui/file-dialog.ts :: FilePathDialog; src/io/api.ts :: listFolder, readFileInfo, statFiles; backend/app/routers/batch.py :: files_list, files_stat, files_read
- kind: rationale
- logged: v0.22.0 · 2026-10-10

A browser file input never reveals a path, and the desktop shell has no dialog plugin, so linking needs its own chooser: a folder field, a list of subfolders and images from `/api/files/list` (with `dirs`), and the chosen path. It remembers the last folder in local storage. Rows are keyed by full path so moving between folders replaces rows rather than rebuilding them.

### src/ui/panels/image-trace.ts · Image Trace
- refers-to: src/ui/panels/image-trace.ts :: ImageTracePanel
- kind: explainer
- logged: v0.12.0 · 2026-10-07

The panel keeps its own options and loads them from a tracing object whenever the selection or that object's options change. With Preview on, an option change on a tracing object traces again after 280 ms of quiet; on a plain image nothing happens until Trace, because tracing a photo takes long enough that it should be asked for. Colours and Threshold share one slot and swap with the mode. The form and the hint are built once and swapped with `hidden`.

## src/ui/panels/generative.ts

### src/ui/panels/generative.ts · Shape Fill, Generate Patterns and Retype panels
- refers-to: src/ui/panels/generative.ts :: ShapeFillPanel, PatternGenPanel, RetypePanel, ModelPanel, paintPreview, tiles
- kind: explainer
- logged: v0.23.0 · 2026-10-10

Each panel is built once. The status line reserves four lines and says which model runs, or why nothing can (no model, engine offline, no image reading); it is checked when the panel is built, when the pointer enters it (at most every four seconds) and before each run, so a model set in Preferences shows up without a reload. Generate stays disabled while no model is set. The variation tiles are fixed: three square tiles for Shape Fill (hidden past the chosen count, which is a direct input) and a two by two grid for patterns; previews are drawn into their canvases with `renderRegion` (the fill clipped to the shape, the pattern tile repeated twice each way), so nothing is rebuilt. The palette strip always has twelve chips and empty ones are dashed. Retype's matches are a keyed list at the end of the panel, so rows arriving never move anything above them; the read text sits in a line that reserves two lines.


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

Fill Rule buttons (Non-Zero Winding, Even-Odd) with the current rule named beside them (Mixed when the targets differ), Reverse Path Direction, and the object Note. Show Center and Overprint are left out: formpath draws no centre point and has no separations or overprint preview, so either control would store a value nothing reads. `NodeBase.note` existed with no way to set or read it; the panel and the `attributes` tool now do, `get_object` returns it, and `.fpth` keeps it. The note is written on change (blur) and never overwritten while the field has focus. Built once; every value is patched with the guarded setters.

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

## src/ui/app-dialogs.ts

### src/ui/app-dialogs.ts · Export dialog holds still
- refers-to: src/ui/app-dialogs.ts :: ExportDialog.reserve, ExportDialog.ask, ExportDialog constructor row order; src/styles/formpath.css :: .cv-export .cv-dialog-body
- kind: rationale
- logged: v0.23.0 · 2026-10-10

Each format shows a different set of option rows (DXF has seven, PDF three), so the dialog changed height on every format switch and the centred scrim moved the whole dialog (layout shift about 0.008). On open, reserve walks every format through sync in the same task (selectedIndex, so the dropdown label is not touched), takes the tallest body height and sets it as the body's min-height; nothing paints in between. The body aligns its rows to the top so the spare space sits below the options. Preserve editing now comes before Convert type to outlines, so switching SVG to PDF hides a row below Preserve instead of above it and no row moves. Anchoring the dialog's top was the alternative; it was not taken because every other dialog is centred and the Export dialog would then sit differently from them. The other dialogs are untouched: the rule is scoped to the cv-export class.

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

Most of this file is the NodeMode icon subset and icons drawn for formvis and formpath, but some entries come from outside sets and carry a license obligation recorded in `NOTICE.md`: six from Lucide (ISC, with its license text in NOTICE), two from Remix Icon (Apache-2.0) and five from Phosphor (MIT). Replacing one of these with an icon drawn here is fine; when the last icon from a set is gone, remove that set's row (and for Lucide the license section) from NOTICE. Adding an icon from any outside set needs its row in NOTICE in the same commit.

## src/styles/tokens.css

### src/styles/tokens.css · stage tokens
- refers-to: src/styles/tokens.css :: --cv-layer-color, --cv-smart, --cv-pasteboard, --cv-artboard, --cv-artboard-edge, --cv-guide, --cv-chip
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Added for the vector stage and the paint chips; `src/ui/palette.ts` reads them.

## src/styles/formpath.css

### src/styles/formpath.css · scope
- refers-to: src/styles/formpath.css :: whole file
- kind: explainer
- logged: v0.9.0 · 2026-10-07

Every class the vector modules introduced: the fill and stroke widget, the Layers tree rows, the panel kit, Properties, Color, Swatches, Gradient, Stroke, Appearance, Symbols, Artboards, Links, Actions, type panels, the picker, status bar, home presets, New Document, dialogs. `.cv-stage-col` gets its own stacking context so the rulers stay under the Properties column that overlays the stage.

### src/styles/formpath.css · number fields in form dialogs
- refers-to: src/styles/formpath.css :: .cv-dialog .cv-field > .cv-num; src/ui/form-dialog.ts :: FormDialog.ask
- kind: rationale
- logged: v0.21.0 · 2026-10-10

Form dialog number fields used the panel width (a 34 px input beside the spinner), which cut off values of three or more digits such as Define Grid's distances and extents. Inside a dialog field row the box is now 110 px with the input filling it; the row's grid column already has the room, so no dialog grows.

## Inherited from formvis

### src/styles/shell.css, panels.css, dialogs.css · unused rules
- refers-to: shell.css (.cv-vtl timeline block), panels.css (brushes, channels, frames, paths, kind, lock rows), dialogs.css (.cv-nd new document grid, liquify, curves)
- kind: todo
- logged: v0.9.0 · 2026-10-07

About 215 class rules came over with the formvis shell and are not used by formpath. They cost nothing at runtime; remove them block by block when those files are next edited.

### src/ui/panels/controls.ts · removed module
- refers-to: src/ui/panels/controls.ts :: whole file
- kind: removed-code
- logged: v0.9.0 · 2026-10-07

formvis's row controls (57 lines), superseded by `src/ui/panels/kit.ts` and imported by nothing; not shipped.

## src/ui/terminal-dock.ts

### src/ui/terminal-dock.ts · the dock
- refers-to: src/ui/terminal-dock.ts :: TerminalDock, toggle, reveal, claude, showChat, send, mount, connect, isToggle; src/styles/terminal.css; index.html (dock boot script)
- kind: explainer
- logged: v0.24.0 · 2026-10-15

The window's bottom band, formvis's layout with formlit's agent features: tabs of engine PTYs over `/api/terminal/{id}/stream` drawn by xterm.js, a Claude Code button that opens the person's `claude` in a tab already connected to formpath's tools, a Chat tab, Restart, Hide, and an ask bar that sends to Chat when Chat is the active tab and otherwise types into Claude Code (starting it if needed), adding the document name and selected node ids as context. The open state and height are written on `documentElement` (`data-ft-dock`, `data-ft-dock-h`, `--ft-dock-size`) by the boot script in `index.html` before the first paint, and `terminal.css` adds the dock's grid row from those, so opening and closing reserve or release one row without moving anything else in a frame. The shortcuts are Alt+Shift+Mod+T, C and H because Illustrator's Mod+J is Join and Alt+Mod+J is Average; a capture listener on `document` handles the toggle so it also works while focus is in xterm's textarea, and keys typed inside the dock do not reach the window's command handler.

### src/ui/chat-pane.ts · the Chat tab
- refers-to: src/ui/chat-pane.ts :: ChatPane, listen, on, load, adopt, handoff
- kind: explainer
- logged: v0.24.0 · 2026-10-15

formlit's chat pane on formpath's transport: the engine's chat events arrive over `/api/claude/chat/stream` (formlit uses its SSE event bus, which formpath has not got), the history over `GET /api/claude/chat`, and replies stream into `MarkdownStream`, which appends finished blocks once and shows only the unfinished tail as text, so a long answer never re-renders. Tool calls show as chips that turn done or error in place.

### src/ui/markdown.ts · from formlit
- refers-to: src/ui/markdown.ts :: renderMarkdown, MarkdownStream
- kind: explainer
- logged: v0.24.0 · 2026-10-15

Copied from formlit v0.45.3 (same owner, Apache-2.0) with its class names moved to the `ft-md` prefix. It builds DOM nodes from Markdown blocks (paragraphs, headings, lists, tables, fenced code and rules) and never parses HTML, so a reply cannot inject markup.

### src/ui/icons.ts · agent icons
- refers-to: src/ui/icons.ts :: terminal, agent, agentChat
- kind: explainer
- logged: v0.24.0 · 2026-10-15

Drawn for formlit (same owner) and carried over unchanged; not from an outside set, so NOTICE needs no row.

## src/automation/catalogue.ts

### src/automation/catalogue.ts · the command catalogue
- refers-to: src/automation/catalogue.ts :: Catalogue, build, list, describe, run, runMany, mirror, WINDOW_ONLY; src/ui/commands.ts :: Command, CommandParam, onChange, run
- kind: explainer
- logged: v0.25.0 · 2026-10-15

formvis's window-owned catalogue, the model formpath follows because its shell and bridge came from formvis. `build` turns every registered command and every tool into a `CatalogueEntry`: the group is the command's own `group` or the top menu that holds it (found by walking the live menu definitions, so a command moved between menus follows), the path is its menu trail, and the description is the command's own or one written from that path; `mutates` defaults to false for the View, Window and Help menus and `risky` marks the few commands Undo cannot reverse. Tools appear as `tool.<id>` entries that make the tool active. `Commands.onChange` debounces a mirror of the entries to `POST /api/commands/catalogue`, so the engine, `./formpath cli` and `agents` see the same list without a window round trip. `run` validates parameters against the command's `params` (unknown keys, types, enums, ranges) before it runs anything, and refuses the WINDOW_ONLY commands (terminal, Claude Code, Chat, Preferences, Quit) to agents, as formlit keeps its terminal, Claude Code and chat commands out of `run_command`. `runMany` wraps the steps in `engine.beginStep()` and `endStep()`, so a batch is one undo step even when it stops early. `window.formpath.catalogue` exposes the same four calls to the console and to tests.

### src/automation/agent-bridge.ts · in-app calls while agents are off
- refers-to: src/automation/agent-bridge.ts :: loop
- kind: rationale
- logged: v0.25.0 · 2026-10-15

The poll loop ran a delivered item only when outside agents were allowed, so the Claude Code tab and the Chat tab, whose calls the engine marks `inapp`, were refused with "formpath stopped taking requests" whenever the person had not switched outside agents on. An `inapp` item now runs either way; every other item still needs the switch.

## src/engine/corners.ts

### src/engine/corners.ts · Live Corners on any path
- refers-to: src/engine/corners.ts :: cornered, cornerFrame, cornerFit, cornerRadiusFor, bakeSub; src/engine/types.ts :: Anchor, CornerSpec; src/engine/geometry.ts :: tracePath, toSvgD, pathBounds, windingAt, transformAnchor, reversePath
- kind: explainer
- logged: v0.26.0 · 2026-10-15

A corner is an optional `corner: { type, r, mode? }` on an anchor, stored in the manifest as is, so files without it load unchanged and files with it round trip untouched. The anchors are never rewritten while the attribute is live: `cornered(d)` derives the effective geometry and caches it per `PathData` identity in a WeakMap, returning `d` itself when no anchor carries a radius above zero. It sits at the lowest shared geometry layer instead of in each consumer, in `tracePath` (canvas Path2D cache), `toSvgD`, `pathBounds`, `windingAt` (fill hit), `nodePath`, `effectPath` (strokes, effects, outline stroke), `toPaper` (Pathfinder and booleans), the PDF `path` writer and rectangle hit testing, so canvas, SVG and PDF show the same curve. Segment indexes stay those of the raw anchors, which keeps insert-anchor and segment dragging correct. A corner is a real corner only when the tangents on its two sides differ by more than about one degree and it is not an open path end, which is why a rounded rectangle's arc joints and smooth anchors get no widget. For each corner the tangent distance is `r / tan(theta / 2)` for round and inverted, `r` for chamfer, and `r` times the limit for relative mode (a fraction, 100 percent being the limit), clamped to half the shorter adjacent segment so two neighbouring corners can share a segment without overlapping. Curved neighbours are trimmed by arc length (`segTAtLength` then `bezSub`) and joined by one cubic whose handles follow the trimmed tangents; the inverted join is the round one reflected across the chord, so it meets the sides at an angle as in Illustrator. `cornerFit` returns the clamped tangent and the maximum radius so the widget can turn red when a drag reaches the limit. `transformAnchor` scales an absolute radius by the matrix scale and leaves a relative one alone; `reversePath` carries the attribute. Applying a corner clears `live` on the path, the same as Expand Shape, because a live rectangle or polygon would regenerate its anchors and drop the attribute.

### src/tools/select.ts · Direct Selection corner widgets
- refers-to: src/tools/select.ts :: pathWidgets, pathWidgetAt, cornerDown, cornerMove, cornerUp, cornerOverlay; src/engine/ops/corner-ops.ts :: setCornersOp, patchCorners; src/app.ts :: cornersDialog
- kind: explainer
- logged: v0.26.0 · 2026-10-15

The Direct Selection tool draws a circle-and-dot widget inside every corner of the selected paths, on the bisector at the centre of the fillet and never closer than 14 pixels, from frames cached per `PathData`. A drag previews through `beginDrag` and `dragTo` and commits once, so it is one undo step; when the dragged anchor is part of the anchor selection, every selected corner takes the radius, otherwise only that one does. Alt-click without movement cycles round, inverted, chamfer on the same targets and keeps a zero radius so the type is remembered. Double-click runs the `corners-dialog` command, which edits through `previewEdit`; with `type`, `radius` or `mode` parameters it applies them directly, which is the route the agent bridge uses through run_command. The radius is in document units (percent when relative). `expand-corners` replaces the anchors with the derived ones in one step. The existing Selection tool widgets for live rectangles and polygons are untouched.

## src/i18n/index.ts

### src/i18n/index.ts · 26 languages
- refers-to: src/i18n/index.ts :: LANGUAGES, initLanguage, t, lookup, walk, SKIP; src/i18n/keys.json; src/i18n/locales/*.json; src/main.ts; src/ui/app-dialogs.ts (Interface, Language)
- kind: explainer
- logged: v0.27.0 · 2026-10-15

formlit's design: the English strings stay in the code and are the keys, so no string in the interface carries an id. When a language other than English is stored (`formpath.lang`), `initLanguage` loads only that language's table (`import.meta.glob`, one lazy chunk per language), translates `document.title` and every text node and `title`, `placeholder`, `aria-label` and `alt` attribute under `body`, and a MutationObserver translates whatever is added later. Observer callbacks run as microtasks before the browser paints, so English never shows first, and `main.ts` starts the app only after the table is in, so the first frame is already in the chosen language. Keys with `{0}` become patterns (longest first) whose captures are translated in turn; a trailing colon or full stop, a shortcut in parentheses and ` · ` joined parts are tried against their bare forms. `SKIP` keeps user content in its own words: the canvas, editable text, the terminal, chat replies, layer, document, swatch group, variable, link, asset and recent file names. Unlike formlit there is one `keys.json` and one table per language keyed by the English string (formlit uses numbered batches keyed by index), so a key never shifts when another is added. Translating a string the interface never shows is harmless, which is why the extractor errs toward more keys. Command ids, MCP descriptions and engine errors stay English. The picker is Preferences > Interface > Language, which reloads the window.

## src/engine/snap.ts

### src/engine/snap.ts · Tangent, perpendicular and construction-angle snapping

- refers-to: snapLine, DEFAULT_SNAP_ANGLES, SnapTargets.curves
- kind: explainer
- logged: v0.28.0 · 2026-10-15

`collectTargets` now keeps the bezier segments of every visible path (capped at 6000) beside the anchor spots. `snapLine(p, from, targets, tol, angles)` is what the stage calls when a tool passes `from` to `ctx.snap`: it offers the construction angles (default 0, 45, 90 and 135, replaceable through `Stage.prefs.snapAngles`), the foot of the perpendicular from the fixed end onto a nearby segment, and the tangency point of a line from the fixed end to a nearby curve. Perpendicular points are roots of (B(t) - from) . B'(t) and tangent points are roots of the cross product of the same two vectors, found by sampling each segment 14 times and bisecting every sign change; only segments whose control box lies within six tolerances of the pointer are tried. The nearest candidate inside the snap tolerance wins, with a small bias that lets tangent and perpendicular beat an angle at the same distance, and its guide line and label ("tangent", "perpendicular" or the angle) go through the usual smart-guide overlay.

## src/tools/liquify-detail.ts

### src/tools/liquify-detail.ts · Scallop, Crystallize and Wrinkle

- refers-to: detailTool, refine, shape
- kind: explainer
- logged: v0.28.0 · 2026-10-15

The three tools share the Warp group and its brush size and bracket keys, and add Intensity and Detail options held in module state. Each pointer step (after the brush has moved a fifth of its radius) first subdivides every segment near the brush until anchors are about a thirteenth of the brush apart at the default detail, then displaces the anchors inside the brush with a squared falloff: Scallop pulls random anchors toward the centre and gives them smooth catmull handles, Crystallize pushes random anchors outward and makes them corners, Wrinkle jitters every anchor in a random direction and carries its handles. The random stream is seeded from the pointer-down position plus the current step position, so the same drag over the same path gives the same result, and the whole stroke is one drag preview committed once on release.

## src/engine/ops/illustrator.ts

### src/engine/ops/illustrator.ts · Ungroup All, Hard and Soft Mix, Trap, Object on Path

- refers-to: src/engine/ops/illustrator.ts :: ungroupAll, anchorCount, mixPathfinder, trapShapes, objectOnPath; src/engine/index.ts (ungroupAll, mixPathfinder, trap, objectOnPath, anchorCount); src/app.ts (ungroup-all, pf-hard-mix, pf-soft-mix, pf-trap, object-on-path-*)
- kind: explainer
- logged: v0.28.0 · 2026-10-15

Ungroup All repeats `ungroupNodes` on the plain groups left in the result until none remain, in one `edit`; clipping groups and live groups (Live Paint, trace, dimension, graph, intertwine, shaper) are left whole, as Illustrator keeps clipping sets. Hard Mix and Soft Mix run `arrangement` (the Divide faces) and decide which shapes cover a face by whether the face lies more than half inside each shape (a single interior point is unreliable on L-shaped faces, where the bounds centre can sit on the overlap's edge). Hard Mix paints a covered-twice face with the per-channel maximum (CMYK when every contributor is CMYK, else RGB); Soft Mix folds the contributors bottom to top with `mixColor` at the mixing rate, so 100% shows the top colour and 0% the bottom one. Faces covered once keep their fill; strokes are dropped as in Trim. Trap pairs every two solid-filled shapes of different colour, spreads the lighter one (the darker one with Reverse Traps) by `offsetPath` and keeps the part that lies inside the other shape and outside the spreading one, filled with the spreading colour tinted by the reduction and set to Multiply; Height/Width scales y before and after so horizontal and vertical edges get different thickness. The strips are added as a group named Traps above the topmost selected object and the originals stay. Object on Path takes the topmost selected path or compound as the guide and the others, in stacking order, as the objects: each centre lands on the guide at equal arc-length steps (closed guides wrap, open guides run from the offset to the end), optionally turned to the tangent, and Flip adds a half turn. There is no live link, so Release only says so and changes nothing; Arrange is the same dialog as Attach.

## src/engine/kernel.ts

### src/engine/kernel.ts · simplifyWith and pathSampler

- refers-to: src/engine/kernel.ts :: simplifyWith, pathSampler, dpKeep, cornerTurn; src/engine/ops/paths.ts (simplify case, PathOpArgs.straight and angle); src/app.ts (simplifyDialog)
- kind: explainer
- logged: v0.28.0 · 2026-10-15

Simplify keeps `simplifyPath` for the plain case so existing results do not change. With Straight Lines or an Angle Threshold it cuts each subpath at its corner anchors (open ends, and any anchor whose tangent turn, taken from the handles or the neighbouring anchors, exceeds the threshold) and treats each run alone: curves are fitted by paper's `simplify`, straight lines by flattening the run and keeping the Douglas-Peucker points within the tolerance. A closed path with no corner is simplified as a ring, or cut at its first anchor when Straight Lines is on. Show Original is not done: `previewEdit` has no overlay and drawing the original into the document would be committed with the result. The dialog's point count is a note whose text is patched in place from the preview build (found by the interpunct in its text, so a translation does not break it), which adds no node and shifts no layout. `pathSampler` returns arc-length position and tangent angle of the longest subpath for Object on Path.

## src/engine/geometry.ts

### src/engine/geometry.ts · Scale Corners

- refers-to: src/engine/geometry.ts :: cornerScale, transformAnchor; src/engine/transform.ts :: transformNode (live rect); src/engine/index.ts (ViewFlags.scaleCorners, setView); src/app.ts (toggle-scale-corners)
- kind: explainer
- logged: v0.28.0 · 2026-10-15

`cornerScale.on` is a module flag set by `Engine.setView` from `view.scaleCorners` (default on), so every caller of `transformNode`, including the tools, follows it without being edited. Off, `transformAnchor` leaves an absolute `corner.r` as it was, and a live rectangle is rebuilt from its normalised live shape with the radii it had in document points instead of stretching the rounded outline. The flag is not stored in preferences yet and the Properties panel has no checkbox for it; the command `toggle-scale-corners` in Object > Transform is the switch.

## src/app.ts

### src/app.ts · Transform Each absolute mode and command parameters

- refers-to: src/app.ts :: transformEachDialog, simplifyDialog, softMixDialog, trapDialog, objectOnPathDialog
- kind: explainer
- logged: v0.28.0 · 2026-10-15

Transform Each gains a Scale mode select. Absolute reads Scale horizontal and vertical as target width and height in document units for every object (0 keeps that dimension), always about each object's centre; Relative is the old percentage. The dialog opens in Relative because one default cannot be right for every object in Absolute. Every command added or extended here takes `params` and, when any are given, skips the dialog and applies at once, so an agent gets the same result as the dialog's OK in one undo step. An Object > Pathfinder submenu now lists the existing pf-* commands, which had no menu, followed by the three new ones.

## src/ui/prefs.ts

### src/ui/prefs.ts · Generative switch, anchor size, snap angles and the bars

- refers-to: src/ui/prefs.ts (Prefs.showGenerative, anchorSize, snapAngleSet, scaleCorners, helpBar, taskBar, pasteOnArtboards); src/app.ts (applyUiPrefs, setPref, commands.gate, toggle-generative, toggle-help-bar, toggle-task-bar, paste-on-selected-artboards); src/tools/util.ts (anchorUi, ANCHOR_TOL, tolDoc); src/ui/panel-group.ts (setTabHidden)
- kind: explainer
- logged: v0.29.0 · 2026-10-15

Every new switch lives in Prefs and is applied by one function, applyUiPrefs, so the command, the Preferences dialog and the startup path cannot disagree; the dialog reloads prefs on show, so a command toggle is never overwritten by a stale copy. Generative off is enforced three ways: commands.gate refuses the six generative ids (so menus grey nothing, agents and the catalogue get a refusal), the Object, Type and Window menu definitions drop the entries because their items are functions evaluated when a menu opens, and PanelGroup.setTabHidden hides the three panel tabs and moves an active one to its neighbour. The anchor size is a scale in tools/util.ts read by every anchor, handle and corner widget draw; the hit radius follows because tolDoc scales the 5 px request that is used only for anchor hit tests. The bounding-box handles keep their size. Paste on Selected Artboards: artboards have no multi-selection, so with the switch on Paste puts the copy in place and duplicates it onto every other artboard, one undo step per artboard. Artboard names in Outline already draw, because the overlay canvas draws them in both views; nothing was changed there.

## src/ui/taskbar.ts

### src/ui/taskbar.ts · Contextual task bar and help bar

- refers-to: src/ui/taskbar.ts; src/ui/helpbar.ts; src/styles/helpbar.css; index.html (data-fp-help boot script); src/app.ts (SHELL .fp-helpbar)
- kind: explainer
- logged: v0.29.0 · 2026-10-15

The help bar is a grid row of the app, present in the shell markup from first paint; its height is the variable --fp-help-h, set to 0 or the control height by the data-fp-help attribute that a boot script in index.html reads from the saved prefs, as the terminal dock does. The task bar is a fixed element in the overlay root with all nine buttons created once; a selection kind only toggles which are hidden, and the position is a transform written only when it changes. It is made invisible, not removed, while a pointer gesture runs on the stage and when nothing suitable is selected.

## src/engine/types.ts

### src/engine/types.ts · Large Canvas class

- refers-to: src/engine/types.ts :: MAX_ARTBOARD_PT, clampArtboardSide; src/engine/doc.ts :: newDoc; src/engine/index.ts :: addArtboard, setArtboard; src/engine/viewport.ts :: Viewport.MIN; src/io/pdf.ts :: PDF_MAX_SIDE; src/io/raster.ts :: rasterCap, exportRasterTiles
- kind: explainer
- logged: v0.29.0 · 2026-10-15

Before this change the engine had no upper bound on an artboard side (only a floor of 1 pt), the engine service refused any artboard over 16,383 x 72 = 1,179,576 pt in a saved project, the zoom floor was 3.125 percent (so a 100,000 pt board could not be fitted) and the PDF page box had no UserUnit. The effective canvas is now capped at 163,440 pt (2,270 in, Illustrator's Large Canvas class) on each side by one helper that new documents, new artboards and Artboard Options all go through, and the zoom floor is 0.25 percent so the largest board still fits a normal window. Canvas 2D carries the transform in 32-bit floats, which resolves about 0.016 pt at 163,440 pt, finer than any print or screen output needs, so no 1/10 working scale was added. PDF pages over 14,400 pt (Acrobat's limit) get /UserUnit, chosen as the smallest value to the thousandth that fits the longer side in 14,400 units; the content matrix and every gradient pattern matrix carry the inverse scale so the page matches the canvas. Raster export cannot draw past 16,384 px per side, so `rasterCap` reports the capped size and a message the dialog can show, and `exportRasterTiles` writes the full-resolution image as a zip of 8,192 px tiles (at most 256).

### src/engine/paint.ts · gradient blend and dither

- refers-to: src/engine/types.ts :: Gradient.blend, Gradient.dither; src/engine/paint.ts :: gradientAt, mixOklab, perceptualStops, setGradientBlend, setGradientDither; src/engine/render.ts :: addStops, ditheredPattern; src/io/svg.ts :: gradient; src/io/pdf.ts :: fnFor
- kind: explainer
- logged: v0.29.0 · 2026-10-15

Both fields are optional and are dropped when they hold their default, so old files load and save unchanged. A perceptual gradient mixes each stop pair in OKLab; the canvas, SVG and PDF writers all take the same list of 16 extra stops per segment from `perceptualStops`, so the three outputs agree to one level per channel. Dither is a render-time pass: `ditheredPattern` fills the shape bounds into a cached canvas at device resolution (capped at 16 million pixels) from a 1,024-entry float lookup of the gradient, adding an 8 x 8 Bayer threshold before rounding to 8 bits, and returns it as a pattern in document space. Linear and radial gradients without a focal point use it; others fall back to the plain canvas gradient. Chromium already dithers its own canvas gradients, so the visible gain is in engines and rasterizers that do not; SVG and PDF output omit dithering because the formats have no equivalent.

### src/io/raster.ts · dithered rasterize

- refers-to: src/io/raster.ts :: DitherOpts, ditherCanvas, renderRegion
- kind: explainer
- logged: v0.29.0 · 2026-10-15

`ditherCanvas` maps a rendered canvas onto a chosen colour set in place. Bitmap uses two colours (foreground for dark, background for light), Grayscale uses N levels on the ramp between them, Palette picks the nearest of a list in RGB. Methods are None (threshold), Diffusion (Floyd-Steinberg, left to right) and Pattern (Bayer 4 x 4). Pixels under half alpha stay fully transparent and the rest become fully opaque, so the output holds only the chosen colours plus transparency.

### src/ui/panels/spelling.ts · Check Spelling dialog and auto-check ranges

- refers-to: src/ui/panels/spelling.ts :: SpellingDialog, misspelledRanges, wordsOf, resetSpellCache; src/io/api.ts :: spellCheck, spellDictionary, spellDictionaryEdit
- kind: explainer
- logged: v0.29.0 · 2026-10-15

The dialog is built once and patched in place. It walks visible, unlocked text nodes in document order, asks the engine service about the distinct words (cached per session, so Auto Spell Check and the dialog share lookups) and shows the first unknown word in context. Change and Change All write through `setTextSpans`, one history step per changed text node, keeping the spans' styles; Ignore All is per dialog run; Add to Dictionary persists in the data folder and clears the cache.

### src/io/fonts.ts · findSimilarFonts

- refers-to: src/io/fonts.ts :: findSimilarFonts; src/io/api.ts :: similarFonts; app/services/fonts.py :: similar
- kind: explainer
- logged: v0.29.0 · 2026-10-15

Ranking runs in the engine service, which already reads the font files; the frontend only resolves a family and style to an installed font id and asks for the top ten other families.

## src/ui/home.ts

### src/ui/home.ts · the home screen sat under the panels
- refers-to: src/ui/home.ts :: HomeScreen (host); src/app.ts :: new HomeScreen(root, ...); src/styles/shell.css :: .cv-home; src/styles/tokens.css :: --z-home-screen; src/styles/formpath.css :: .cv-main > .cv-stage-col
- kind: rationale
- logged: v0.30.0 · 2026-10-15

The Properties column, panel tabs and Layers list drew on top of the home screen. The home screen is `position: fixed` and asked for a high layer, but it was mounted inside `.cv-stage-col`, which is `position: relative; z-index: var(--z-base)` and therefore a stacking context at layer 0: nothing inside it can rise above the stage column's siblings, and the Properties column at a higher layer won. A bigger number could not fix it. The home screen now mounts on `.cv-app`, which creates no stacking context, at the named layer `--z-home-screen` (150): above the workspace chrome (`--z-chrome`, 100) so it covers every panel, below menus (`--z-menu`, the overlay root) and dialogs (`--z-modal`) so the File menu and New Document open over it, and below the task bar and floating windows, which the person opens. The stage column keeps its own context, which is what keeps the canvas overlays inside the stage.

### src/ui/home-files.ts · the empty line is reserved before the library answers
- refers-to: src/ui/home-files.ts :: HomeFiles.render (empty)
- kind: fix
- logged: v0.52.6 · 2026-10-26 · FB-107

`render` hid the empty line until the first `refresh` finished, then showed "Documents you open or save appear here." with margins, about 40 px, so with no recent file the New document section under Recent moved down once, a layout shift of 0.0054 at 4x CPU slowdown that the window smoke (F7) measured. Before the library answers the line now holds a no-break space, so it takes the same line and the later text changes only its words. With files, the grid still replaces the line; that case is unchanged.

### src/styles/panels.css · the last raw z-index values
- refers-to: src/styles/panels.css :: .cv-dock-split, .cv-props-col:not(.is-collapsed), .cv-props-resize
- kind: rationale
- logged: v0.30.0 · 2026-10-15

These three values (2, 4 and 5) came with the formvis shell in the first commit. They now read `--z-raised`, `--z-selected` and `--z-raised`, keeping their order: the Properties column above the stage column (layer 0), the dock split and the resize grip above their own neighbours. No raw numeric `z-index` remains outside `tokens.css`.

### src/styles/tokens.css · the layer scale
- refers-to: src/styles/tokens.css :: --z-*
- kind: explainer
- logged: v0.30.0 · 2026-10-15

From the bottom: `--z-base` 0 (document flow, the stage column), `--z-raised` 8 and `--z-selected` 9 (siblings that must overlap a neighbour), `--z-rail` 10, `--z-chrome` 100 (the narrow-window fixed panels), `--z-home-screen` 150, `--z-menu` 200 (the overlay root, menus and popovers), `--z-temp` 500, `--z-companion` 800 (floating windows, the assistant), `--z-taskbar` 900, `--z-modal` 1000 (dialog scrims), `--z-settings` 1500, `--z-context` 2000 (context menus, drag ghosts, dropdowns), `--z-toast` 3000, `--z-portal` 4000, then the inherited `--z-home*`, `--z-account-panel` and `--z-overlay*` levels, which formpath does not use. Add a layer here, never inline.

## frontend/src/ui/spell-marks.ts

### frontend/src/ui/spell-marks.ts · Auto Spell Check underlines
- refers-to: src/ui/stage.ts :: Stage.painters
- kind: explainer
- logged: v0.30.0 · 2026-10-15

Auto Spell Check draws on the stage overlay through `Stage.painters`, a set of functions run after the selection is drawn, so turning it on or off only emits `overlay` and never touches the scene canvas. Misspelled ranges are cached per text string and requested after a 350 ms debounce; glyph positions come from `selectionQuads`, whose bottom edge carries a sine wave that is phased by distance so adjacent glyphs join. The Edit Custom Dictionary command clears the cache. The Simplify dialog uses the same hook to dash the original outline while it previews; the outline is overlay drawing, not document content.

## src/io/tiff.ts

### src/io/tiff.ts · TIFF encoder
- refers-to: src/io/tiff.ts :: encodeTiff; src/io/raster.ts :: canvasBlob
- kind: explainer
- logged: v0.30.0 · 2026-10-15

Baseline little-endian TIFF, 8 bits per sample, RGB or RGBA (unassociated alpha) or CMYK, one IFD, strips of about 64 KiB, resolution tags from the export ppi. Compression is none, PackBits, LZW (MSB first with early change, clear code at 4094) or Deflate through CompressionStream, which writes the zlib stream that Adobe Deflate expects. CMYK uses `rgbToCmyk`, the same naive conversion the PDF writer uses, so no ICC profile is embedded.

## src/io/pdf-marks.ts

### src/io/pdf-marks.ts · marks and bleed geometry
- refers-to: src/io/pdf-marks.ts :: pageGeometry, marksContent; src/io/pdf.ts :: exportPdf
- kind: explainer
- logged: v0.30.0 · 2026-10-15

Each side of the page is the bleed, or when marks are on, `max(offset, bleed) + 18 pt` of mark area. The art is clipped to the bleed box and the artboard background is filled out to it; TrimBox is the artboard, BleedBox is written only when the bleed is not zero. Marks use a Separation `All` colour space (all four inks at 100 percent), the same one the `[Registration]` swatch uses, so a plate setter prints them on every plate. Colour bars are CMYK solids and tints on the left half of the bottom margin; page information is Helvetica text at the top left and can run under the top registration target on a narrow artboard.

## src/engine/render.ts

### src/engine/render.ts · overprint preview and separations
- refers-to: src/engine/render.ts :: plateGray, plateBlend, paintStyle; src/engine/types.ts :: FillItem.overprint, StrokeItem.overprint
- kind: rationale
- logged: v0.30.0 · 2026-10-15

Overprint preview multiplies an item that has `overprint` onto what is beneath, which is what an overprinting ink does on a plate; items without the flag still knock out. A separation maps every colour to a gray equal to its ink amount on that plate (C, M, Y, K from `toCmyk`, or a spot swatch's tint when its name matches), so a plate reads as dark where ink lands. Spot swatches are white on process plates. Gradient stops are mapped too; freeform gradients and raster effects are not. Both flags ride on `RenderContext`, so the stage must pass them from `engine.view`, and exports leave them off.

## src/ui/panels/separations.ts

### src/ui/panels/separations.ts · Separations Preview and Document Info windows
- refers-to: src/ui/panels/separations.ts :: SeparationsDialog; src/ui/panels/document-info.ts :: DocumentInfoDialog; src/ui/stage.ts :: Stage.renderContext
- kind: explainer
- logged: v0.30.0 · 2026-10-15

Both are dialogs built once and patched in place. Separations Preview uses the pass-through scrim of Recolor Artwork so the stage stays visible and clickable behind it; its plate list (All, the four process inks and one row per spot swatch) is a keyed list with a reserved minimum height, a row sets `engine.view.separation`, and closing the window sets it back to null. Document Info shows `documentInfoText` in a fixed-height scrolling block and rewrites it on the next frame after a document change, so counts follow edits while it is open. The stage now passes `overprintPreview` and `separation` from `engine.view` into the render context.

### src/ui/app-dialogs.ts · Export gains TIFF and PDF marks and bleeds
- refers-to: src/ui/app-dialogs.ts :: ExportDialog (reserve, sync, value), ExportChoice.tiff, ExportChoice.marks; src/app.ts :: exportBlob, packageDialog, documentSetup
- kind: rationale
- logged: v0.30.0 · 2026-10-15

The Export dialog already reserved the height of its tallest format; the PDF marks and bleed rows made PDF the tallest, so `reserve` now also forces the Bleed menu to Custom while it measures, which keeps the dialog the same height for every format and every bleed choice. TIFF reuses the Resolution menu (ppi is 72 times the scale) and adds Compression and Color. Bleed in Document Setup is saved as one history step named Bleed. Package is a form that calls `packageProject`, and a 409 from an existing folder is shown as an error toast.

### src/ui/panels/similar-fonts.ts · rows were created empty
- refers-to: src/ui/panels/similar-fonts.ts :: openSimilarFonts
- kind: rationale
- logged: v0.30.0 · 2026-10-15

`patchList` calls `create` for a new row and `update` only for rows that already exist, so the similar-fonts rows came out blank and unclickable. The row fill is now one function that `create` calls before returning the node and `update` reuses.

## src/ui/panels/attributes.ts

### src/ui/panels/attributes.ts · Overprint Fill and Overprint Stroke checkboxes
- refers-to: src/ui/panels/attributes.ts :: AttributesPanel.syncOver; src/engine/index.ts :: Engine.overprintOf, Engine.setOverprint
- kind: rationale
- logged: v0.31.0 · 2026-10-15

The flag lives on the first fill and first stroke of each object, so the engine reads and writes exactly those: `overprintOf` walks the selection (into groups, skipping type) and answers true, false, mixed or null when nothing has such an item, and `setOverprint` is one history step named Overprint Fill or Overprint Stroke. The two rows are always present so the panel never changes height; a mixed selection sets the native indeterminate state through a guarded write. The agent tool set_paint takes overprint_fill and overprint_stroke beside its existing fields.

## src/engine/ops/corner-ops.ts

### src/engine/ops/corner-ops.ts · Live rectangles and polygons keep their live parameters
- refers-to: src/engine/ops/corner-ops.ts :: liveCorners, setCornersOp, firstCorner
- kind: rationale
- logged: v0.31.0 · 2026-10-15

Setting a corner on a live rectangle used to stamp a per-anchor corner on the path and drop `live`. A live rectangle now maps each targeted anchor back to its corner (a rounded corner owns two anchors, a square one owns one, computed from the current radii) and writes that corner's radius, and the corner type applies to the whole rectangle. A live polygon takes the shared radius from any targeted anchor. Relative mode, and a chamfer or inverted type on a polygon, still take the generic path because live shapes cannot express them, so those turn the shape into a plain path as before. The Corners dialog reads the live radius for its starting value.

## src/io/package.ts

### src/io/package.ts · bundled fonts are sent by the frontend
- refers-to: src/io/package.ts :: packageProject; src/io/fonts.ts :: bundledFontFile; src/io/api.ts :: api.packageFull
- kind: rationale
- logged: v0.31.0 · 2026-10-15

Inter and JetBrains Mono come from @fontsource, so a machine without them installed gave the engine nothing to copy and the Fonts folder was silently left out. The frontend now fetches the bundled face it loaded for each used family and uploads it as `font_files` with a `font_map` from file name to family and style; the engine uses an installed font first and the uploaded face only when none is installed.

## src/app.ts

### src/app.ts · Document Setup is one undo step
- refers-to: src/app.ts :: documentSetup
- kind: rationale
- logged: v0.31.0 · 2026-10-15

Bleed and the other setup fields were wrapped in a gesture, which only merges edits that share a name, so Undo needed two presses. The dialog now brackets its edits with beginStep and endStep, which squash them into one step named after the first change.

### src/app.ts · the narrow-window preference does what it says
- refers-to: src/app.ts :: fitDock, narrow; src/ui/prefs.ts :: narrowCollapse; src/ui/dock.ts :: setCollapsed
- kind: rationale
- logged: v0.31.0 · 2026-10-15

Preferences > Workspace "Show the side column as icons in a narrow window" came with the formvis shell and was stored but read by nothing, which the independent audit flagged. Below 1,100 px wide, with the preference on, the side dock now collapses to its icon strip; when the window widens again it expands, but only if it was collapsed automatically, so a person's own choice to keep it collapsed survives. With the preference off nothing happens.

## src/ui/panels/text-to-vector.ts

### src/ui/panels/text-to-vector.ts · Text to Vector Graphic panel
- refers-to: src/ui/panels/text-to-vector.ts :: TextToVectorPanel; src/io/generative.ts :: textToVectorVariations, placeVector
- kind: explainer
- logged: v0.31.0 · 2026-10-15

The panel reuses the Generative Shape Fill plumbing: ModelPanel for the model status, the same tile grid and preview painter, and the same SVG cleaner in io/generative.ts. All three tile slots stay in the layout from the start, so variations arriving only enable buttons and paint canvases and nothing moves. Place fits the picked art by one uniform scale into the first selected object's bounds, or the middle 70 percent of the active artboard, and adds it with one addNodes call, so one Undo removes it. The command and its panel tab are in the generative gate list in app.ts, so Show generative features hides and refuses them.

## src/io/generative.ts

### src/io/generative.ts · Text to Vector and Generative Recolor helpers
- refers-to: src/io/generative.ts :: textToVectorVariations, vectorTarget, placeVector, generativePalettes, parsePalettes, recolorWithPalette
- kind: explainer
- logged: v0.31.0 · 2026-10-15

Palettes are asked for in one request as JSON and parsed leniently: any array of strings inside the reply counts, and a reply with only hex codes on lines is accepted. Applying a palette uses the existing fitRowsToPalette and rowsFn with tints preserved, so the dialog and the generative_recolor tool give the same result. The tool refuses when the preference is off because the bridge reads loadPrefs, since the command gate only guards commands.

## src/ui/panels/recolor.ts

### src/ui/panels/recolor.ts · Generative Recolor inside Recolor Artwork
- refers-to: src/ui/panels/recolor.ts :: RecolorDialog.generatePalettes, applyGenerated; src/styles/formpath.css :: cv-rc-gen
- kind: explainer
- logged: v0.31.0 · 2026-10-15

A palette click only rewrites the dialog rows and previews through the open drag session, so OK commits one history step and Cancel restores the art. The section has a fixed height (single row of sample prompts, four strip buttons that are always present, a two line note) and the dialog grid is taller while it is shown, so palettes arriving move nothing. With the preference off the section is hidden before the dialog opens.

## src/engine/ops/live-shapes.ts

### src/engine/ops/live-shapes.ts · star corner radius
- refers-to: src/engine/types.ts :: LiveShape star radius; src/engine/geometry.ts :: starPath; src/engine/ops/corner-ops.ts :: liveCorners; src/tools/select.ts :: cornerWidgets
- kind: rationale
- logged: v0.31.0 · 2026-10-15

The star live shape gained an optional radius, generated with roundCorners the same way a polygon's is, and left out of the stored shape when it is zero so older files load and save unchanged. The Corners dialog keeps a star live by writing the radius, as it does for a polygon; a chamfer or inverted corner still expands it to a plain path because the star has no corner type. The widget sits on the top tip along the bisector, at the radius divided by the sine of the tip's half angle.

## src/io/pdf-text.ts

### src/io/pdf-text.ts · live text in PDF
- refers-to: src/io/pdf-text.ts :: LiveFonts, liveStream; src/io/pdf.ts :: exportPdf, Painter.livePlan; src/io/fonts.ts :: fontSource, glyphAdvance; src/io/api.ts :: subsetFont
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Type is written as a Type0 font with Identity-H, one `Tm` and one hex `Tj` per glyph, so on-path, vertical, rotated, touched and scaled type land exactly where outlineText put them. The matrix is the outline matrix (the node xf, or none on a path, times glyphMat times the size, hscale and vscale scale) with its second row negated, because the page is y-down and PDF glyph space is y-up; the font size is 1. Each face (family, style and variation axes) is embedded once per document: a planning pass in exportPdf lays out every text node and collects the glyph ids, the engine subsets each face once with glyph ids kept so Identity needs no remap, and nodes whose face could not be subset (no font bytes, engine down, CFF2, an axis that cannot be fixed) keep their outlines. Glyph ids go through ToUnicode, so a ligature maps to its letters and extraction reads "fi". Spaces are emitted as glyphs (not skipped as outlineText does) so extractors see word breaks; tabs and control characters are skipped. Fill and stroke follow each glyph's own style, not the first span as the outline path does, so multi-colour runs stay multi-colour. Text render mode 3 is never used.

Live text is used only when it is faithful: solid or separation fills and strokes, no visible appearance items or effects on the node, no 3D, no opacity mask, not inside an envelope, and not in a symbol definition (an instance can be tinted, which the plan would not see). A plan is also dropped when the node object at paint time is not the one planned. Everything else, and every raster case, is unchanged. Underline and strikethrough are not drawn, as before. liveText defaults to true; false is the previous behaviour for all type.

Widths in W come from the font's advances at the used axis values; FontDescriptor flags are symbolic (4) plus italic and fixed pitch from the font, StemV is derived from the weight, and the bounding box and metrics are scaled from the face's head, hhea and OS/2 tables.

## src/engine/color-management.ts

### src/engine/color-management.ts · document colour settings, LUT caches and the paint.ts hook
- refers-to: src/engine/color-management.ts :: activateDocument, cmToRgb, cmToCmyk, setProofing, applyProof; src/engine/paint.ts :: toRgb, toCmyk; src/engine/types.ts :: Doc.cm
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Settings live in the optional `Doc.cm` (rgb and cmyk profile references as id plus name, intent, bpc, proof setup). It rides inside the manifest's document object through the existing spread, so .fpth needs no new code, and a document without `cm` behaves exactly as before: paint.ts only calls into the module and falls back to the formula whenever `cmToRgb` or `cmToCmyk` return null, which is the case with no CMYK profile set or before its tables arrive. The module is global state, not per document, because paint.ts has no document argument; `activateDocument` runs on doc, active and projects events and keys the load by profile ids, intent and bpc. When the tables land, the app invalidates cached layers and emits render, the way fontsChanged does for fonts. A profile is found by id first and then by name, so a project opened on another computer with a different copy of the same profile still resolves. The CMYK to RGB table is 9 points per axis with quadrilinear interpolation (tetrahedral was not worth the code at that size), RGB to CMYK is 17 points trilinear, and results are memoised for the last query because renders ask for the same colour many times in a row. The engine never fetches: `setColorBackend` is installed by io/color-ops.ts, which keeps engine/ free of io.

### src/engine/color-management.ts · unresolved profiles clear the active tables
- refers-to: src/engine/color-management.ts :: loadActive, activateDocument
- kind: fix
- logged: v0.53.1 · 2026-11-10

When the newly active document's profiles could not be resolved, loadActive returned early and kept the previous document's tables, so its CMYK colours were previewed and converted through another document's profiles, and since `wanted` already held the new key, it never retried. That return now clears `active` (the formula fallback applies) and resets `wanted`, so the next activateDocument tries again. A failed table fetch (the catch) still only clears `active`, so a backend that is down is not asked again on every edit. Checked with tsc only.

### src/engine/color-management.ts · Proof Colors is a post pass on the scene canvas
- refers-to: src/ui/stage.ts :: Stage.proofPass; src/engine/color-management.ts :: applyProof, isProofing, activeProof
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Proof Colors is a view state in the module (not saved), the proof setup is saved in the document. The pass runs at the end of the artwork draw inside the same frame, over each artboard rectangle clipped to the canvas, so the pasteboard, grid, guides and the overlay canvas are never proofed and nothing is presented unproofed. The command awaits the 33 point table before the flag turns on, so toggling never shows a frame without the proof. The pass reads back with getImageData and writes with putImageData, and the table lookup skips repeated neighbouring colours, which is most of a vector drawing. Measured under 4x CPU throttling a render grew from about 32 ms to about 65 ms and layout shift stayed 0. Preserve Color Numbers is stored and shown in Proof Setup but does not change the table yet: it needs a CMYK to monitor table, which is a different endpoint.

### src/engine/ops/profile-convert.ts · Convert to Profile
- refers-to: src/engine/ops/profile-convert.ts :: convertDoc, throughCmykFn, toRgbFn; src/io/color-ops.ts :: convertToProfile
- kind: rationale
- logged: v0.32.0 · 2026-10-15

The conversion is one Engine.edit that maps layers, swatches, symbol art, graphic style appearances and artboard backgrounds, then writes colorMode and the new profile in the same step, so one Undo returns the old colours, mode and settings together. Unlike recolor.ts it keeps swatch ids and tints on paints because the swatch itself is converted in the same pass. To CMYK, an RGB or gray-derived colour goes through the destination's RGB to CMYK table, an existing CMYK colour goes through the old profile to RGB and then the new table, and gray colours stay gray. To RGB, only CMYK colours change; an RGB to RGB conversion between two RGB profiles is not done (the numbers are kept and the profile is assigned). Brush art and pattern tiles are left as they are.

### src/engine/ops/profile-convert.ts · patterns, masks and region fills convert too
- refers-to: src/engine/ops/profile-convert.ts :: convertDoc, convertNode
- kind: fix
- logged: v0.53.1 · 2026-11-10

Pattern tile art, opacity mask art, Fill Regions seeds and Shaper fills kept their old colours after Convert to Profile, so a CMYK document still printed and separated them from RGB values. convertDoc now converts `doc.patterns[*].art`, and convertNode converts `mask.art` and, for groups, `livePaint.fills` and `shaper.fills`. This replaces "pattern tiles are left as they are" above; brush art is still not converted. Checked with tsc and the module bundled with esbuild in a scratch folder and run on a small document.

### src/io/pdf-x.ts · pdfxParts helper
- refers-to: src/io/pdf-x.ts :: pdfxParts; src/engine/color-management.ts :: documentCmykProfileBytes
- kind: explainer
- logged: v0.32.0 · 2026-10-15

A pure helper for the PDF exporter: the ICCBased stream dictionary (N, Alternate, Length, no filter, so the caller may add FlateDecode and fix Length), the OutputIntent dictionary as a function of the profile's object number, and the PDF/X-4 markers as ready-to-write key fragments (`/GTS_PDFXVersion (PDF/X-4)` for the Info dictionary, `/Trapped /False`). Strings with non-ASCII text are written as UTF-16BE hex. PDF/X-4 also needs a PDF 1.6 header and an XMP stream, which the caller owns; io/pdf.ts is not touched by this change.

### src/ui/color-settings.ts · dialogs and Load Profile
- refers-to: src/ui/color-settings.ts :: colorSettingsDialog, assignProfileDialog, convertToProfileDialog, proofSetupDialog, toggleProofColors
- kind: explainer
- logged: v0.32.0 · 2026-10-15

The dialogs are askForm forms. Load Profile uses the form's extra button: the file picker opens inside that click so the browser allows it, the dialog closes, the file is uploaded, and the dialog opens again with the new profile already picked and the other choices kept. Settings that equal the defaults (built-in sRGB, relative colorimetric, black point on, no CMYK profile) are stored as absent so a document that never used colour management does not gain a `cm` field. Assign Profile changes only `cm`; Convert to Profile changes numbers. The tools list_color_profiles, set_color_settings, convert_to_profile and proof_colors reach the same functions through the bridge.

### src/engine/raytrace.ts · quality table and renderer shape
- refers-to: src/engine/raytrace.ts :: rayTrace, RAY_QUALITY, RAY_DRAFT_PX, Tracer
- kind: rationale
- logged: v0.32.0 · 2026-10-15

The renderer is DOM-free and returns a Uint8ClampedArray plus size so it can run anywhere the engine runs. Primary visibility is a raster pass over triangle bounding boxes (one ray-triangle test per covered pixel), not a ray per pixel through the BVH, because that alone brought Low from about 450 ms to about 220 ms for a 300 pt extrude; only edge pixels get the supersampling. The BVH is used for shadow and occlusion rays, with spatial-median splits, near-first ordering and leaves of at most four triangles. The quality table (pixel budget, shadow rays, AO rays, edge samples, denoise passes) was tuned against the Low budget of well under 300 ms: low 130000 px / 1 / 1 / 2 / 2 passes, medium 250000 / 4 / 3 / 3 / 1, high 400000 / 8 / 5 / 3 / 0. A bilateral 3x3 denoise stands in for samples at Low and Medium. Ambient occlusion rays are limited to 16 percent of the object size so a large flat cap does not darken from far geometry.

### src/engine/raymesh.ts · smooth normals and cap triangulation
- refers-to: src/engine/raymesh.ts :: rayMesh, triangulate
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Side quads share vertex normals across a crease only when the neighbouring face normals have a dot product above 0.84, so a star keeps its hard edges while a rounded shape or a revolve shades as a smooth surface; caps stay flat. The outward direction of each side quad comes from a hint recorded in `scene3dWith` (ring winding and hole parity) rather than from the centroid, since a concave star has points where the centroid test flips. Caps are triangulated with an earcut port that joins holes by bridging, so compound paths and text outlines extrude correctly.

### src/engine/threed.ts · lights parameter and material fallbacks
- refers-to: src/engine/threed.ts :: lightSources, lightsToParam, lightSpecs, lightingPreset, MATERIAL_BASE, LIGHT_LIMIT
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Several lights are stored in one string param `lights` (JSON array of `{c, i, r, h, s}`: colour, intensity, rotation, height, softness) because effect params are scalars. An empty or missing `lights` takes the untouched legacy single-light path (`light` and `intensity`), so documents saved before this change render byte for byte as before; this was checked against reference renders of four old documents. The preset shown in the panel is derived by comparing the lights with the presets, never stored. The light direction is `[cos h sin r, -cos h cos r, -sin h]`, and the legacy top_left light is about rotation -45, height 40. Vector shading sums the light contributions with the same terms the single light used. Textured materials (brushed metal, wood, rough) fall back to metal, matte and matte in vector mode through MATERIAL_BASE, so they never show a texture outside ray tracing.

### src/engine/effects.ts · trace cache, draft pass and progressive render
- refers-to: src/engine/effects.ts :: rayTraceImage, setTraceDraft, pumpTraces, traceHash, onTraceReady, rasterEffectsOf
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Results are cached by a hash of the mesh, lights, material, quality, texture scale and ground shadow (eight entries, least recently used out). While a gesture is open the engine turns on draft mode and the tracer uses the 40000 pixel budget; on release it draws full quality. A node that has no image yet keeps showing the vector faces and the traced image replaces them when it is ready, which is why toggling Ray Tracing in the panel moves nothing (measured layout shift 0 under 4x CPU throttle). Jobs run through a queue so a slider drag keeps only the newest request. Ray tracing is a `filter` kind in `rasterEffectsOf`, so SVG, PDF and EPS rasterise the node through the existing path instead of needing their own code; DXF ignores it.

### src/engine/render.ts · drawnFx and drawTraced
- refers-to: src/engine/render.ts :: drawnFx, drawTraced, traceCanvas
- kind: explainer
- logged: v0.32.0 · 2026-10-15

`drawnFx` is the effect list the layer path draws with: the same as the node's effects minus the trace entry, because the traced image is drawn by `drawTraced` in `drawBody` and must not be run through `runFilter`, which has no kernel for it. The traced canvas is memoised per node in a WeakMap.

### src/io/raster.ts · bakeTraced and Expand Appearance
- refers-to: src/io/raster.ts :: bakeTraced; src/engine/index.ts :: Engine.expand; src/automation/agent-bridge.ts :: expand
- kind: rationale
- logged: v0.32.0 · 2026-10-15

Expand Appearance on a ray-traced object cannot be done inside the engine, which has no PNG encoder, so the app and the MCP expand tool first call `bakeTraced`, which renders each traced node at print resolution, stores the PNG as an asset and hands `Engine.expand` a map of node id to image node. The expand is still one history step, and undo restores the live 3D object. Expand Object leaves ray tracing alone.

### src/ui/panels/three-d.ts · lighting and render sections
- refers-to: src/ui/panels/three-d.ts :: ThreeDPanel.specs, ThreeDPanel.patchLight
- kind: explainer
- logged: v0.32.0 · 2026-10-15

Choosing a preset writes the whole `lights` string and the ambient value in one edit; add, duplicate and delete do the same, and a light colour pick is wrapped in a gesture so a drag across the picker is one history step. Slider edits patch the selected light inside the string. The Quality select and Texture Scale are disabled instead of hidden when they do not apply, so the panel never changes height when Ray Tracing is toggled.

### src/io/pdf.ts · PDF/X-4 and the .ai writer
- refers-to: src/io/pdf.ts :: exportPdf, PdfFile.build; src/io/pdf-x.ts :: pdfxParts; src/engine/color-management.ts :: outputProfileBytes; src/ui/app-dialogs.ts :: ExportDialog
- kind: rationale
- logged: v0.32.0 · 2026-10-15

PDF/X-4 writes a 1.6 header, an OutputIntent whose DestOutputProfile is the document CMYK profile (formpath Generic CMYK when none is set), OutputConditionIdentifier Custom with the profile name as Info, GTS_PDFXVersion and Trapped in the Info dictionary and in XMP, ModDate, and a trailer ID. DeviceRGB content stays as written and a DefaultRGB ICCBased space carries the document RGB profile, bc that is how the PDF specification makes device RGB colorimetric without converting every colour and image. The formpath editing payload is left out under PDF/X bc it is an embedded file. The page information mark font is not embedded, so PDF/X with page information still fails a strict preflight. The .ai writer is the same PDF with the editing payload always on and no marks or standard, which is what Illustrator's own PDF-compatible .ai is from the outside: Illustrator opens it as PDF content and formpath reopens it fully editable. Illustrator's private data stream is not written, bc its format is unpublished.

### src/ui/properties.ts · Properties panel reserves its final height
- refers-to: src/ui/properties.ts :: PropertiesPanel.stack, PropertiesPanel.fillQuick, PropertiesPanel.widest; src/ui/shape-fields.ts :: ShapeFields.reserve; src/styles/formpath.css :: .cv-propsp-stack
- kind: rationale
- logged: v0.33.0 · 2026-10-15

Opening a document measured a 0.039 layout shift (0.063 at 1100, 0.094 at 900) and selecting an object 0.033, both the same mechanism: the Properties panel swapped a hidden Document box for a visible one (or the Selection box), so the group grew by 334 or 553 px and pushed the Type group, below it in the props column, down. The two boxes now sit in one grid cell (the stack) and the inactive one is inert and visibility hidden, so neither toggles display; this is reserved geometry, not a reveal. While nothing is selected the Selection box renders its widest state (the Shape section with the rectangle group, the multi-selection Quick Actions list) so the stack measures the worst case, and a ResizeObserver raises a floor (min-height through --cv-props-floor) in the same frame, before paint; the floor never shrinks, so a later selection of any kind fits. The cost is blank space under the Document box. With no document the Document box shows with its controls disabled instead of the panel being empty. The Shape section moved from under Transform to the end of the Selection box: it is the only block whose presence depends on the object kind, and above Appearance it moved Appearance and Quick Actions when the kind changed (0.008 measured), at the end it moves nothing. A wider reserve by hand-set pixel heights was not taken because the column width is user-resizable and the Quick Actions wrap with it.

### src/ui/status.ts · status bar keeps its width
- refers-to: src/ui/status.ts :: StatusBar.sync; src/styles/formpath.css :: .cv-status-boards, .cv-status .cv-dd-btn, .cv-status-sel
- kind: rationale
- logged: v0.33.0 · 2026-10-15

The artboard dropdown had no options until a document opened, so its button was about 61 px narrower and the artboard-next button, the tool label and the dropdown chevron all moved when the first artboard arrived. It now has a fixed 128 px width in both states. The selection label was toggled with the hidden attribute, which dropped its 110 px minimum width and moved the whole right group (0.0325 with the Properties shift); it is now always laid out and only its text changes.

### src/styles/shell.css · reserved glyphs and rows against late content
- refers-to: src/styles/shell.css :: .cv-tab-dot::after; src/styles/formpath.css :: .cv-appp-list
- kind: rationale
- logged: v0.33.0 · 2026-10-15

The document tab's modified asterisk used to add its width only once the document was dirty, moving the RGB mode label 6 px on the first edit; the asterisk is now always in the layout and only its visibility changes (a width reservation, nothing is hidden that has content). The Appearance panel list reserves three rows (fill, stroke, opacity, 86 px) so selecting a plain path no longer pushes the Layers panel below it down by 86 px; lists with more rows (effects, groups) grow as before.

### src/io/pdf.ts · opacity masks as soft masks
- refers-to: src/io/pdf.ts :: Painter.maskState, Painter.node, Painter.group
- kind: rationale
- logged: v0.33.0 · 2026-10-15

A node with an enabled opacity mask is always written as a transparency group form drawn under one ExtGState that carries the SMask, the node opacity (CA and ca) and the blend mode. The mask art is painted by the same Painter into a form with a transparency group, `/S /Luminosity`; formpath's mask has no alpha mode, and its canvas rule (art alpha times luminosity over nothing) is what a luminosity mask over the default black backdrop computes, so no /BC is written. Invert is a /TR type 2 function (1 to 0), which also inverts outside the form BBox, as the canvas does. Clip is a rectangle clip of the mask art visual bounds inside the group content. The mask group colour space is DeviceRGB even in CMYK documents: a DeviceCMYK group has a white default backdrop in viewers, which made non-inverted masks nearly transparent. Luminosity uses the PDF weights (0.30, 0.59, 0.11) and the canvas uses Rec. 709, a difference of a few levels on saturated mask art.

### src/io/pdf-shading.ts · gradient mesh as type 6 patches
- refers-to: src/io/pdf-shading.ts :: meshShading, meshHasAlpha; src/io/pdf.ts :: Painter.meshBody; src/engine/mesh.ts :: patchEval
- kind: rationale
- logged: v0.33.0 · 2026-10-15

`patchEval` is a Coons surface (two ruled surfaces minus the bilinear one) with bilinear colour, which is exactly what a type 6 patch is, so each mesh cell is one patch with its 12 boundary control points taken from the point handles and no tensor interior is needed. Coordinates are 32 bit over the control point box, colours 16 bit, flag 8 bit. Per point opacity cannot live in a shading, so a mesh with any opacity below 1 gets a second DeviceGray type 6 shading of the same patches used as a luminosity soft mask on the colour shading. Poppler draws hairline seams between patches inside that soft mask; the canvas has its own quad seams there.

### src/io/pdf.ts · patterns as tiling patterns
- refers-to: src/io/pdf.ts :: Painter.prepare, Painter.buildPattern, Painter.patternPaint; src/engine/render.ts :: patternStyle
- kind: rationale
- logged: v0.33.0 · 2026-10-15

Paint is synchronous but tile art needs the async node painter, so `prepare` walks the document before the pages, finds every pattern in use (appearance items, text spans, masks, symbols, live children, and patterns inside pattern art, built dependencies first), and paints each tile art once into a shared form. A tiling pattern object per use (the matrix is xf times the page matrix) draws the form at each lattice copy, with BBox and steps equal to the lattice cell, as the canvas tile does. A pattern that is part of a cycle has no tile and the node keeps the raster fallback. The canvas rounds the tile bitmap up to whole pixels but scales it by 1/scale, so its period drifts by up to a pixel per tile far from the tile origin; the PDF is exact, so the two differ by that drift on fills a long way from the pattern origin. Poppler shows hairline seams where art crosses the tile cell edge.

### src/io/pdf-shading.ts · freeform gradients as type 4 grids
- refers-to: src/io/pdf-shading.ts :: freeformShading; src/io/pdf.ts :: Painter.freeformPattern; src/engine/paint.ts :: freeformSampler
- kind: rationale
- logged: v0.33.0 · 2026-10-15

The on-canvas colour is an inverse distance cubed blend (points, or segments in lines mode), not an interpolation between the points, so a triangulation of just the points would not match it. The writer samples the same `freeformSampler` on a regular grid of about 96 cells on the long side and writes row strips of free-form triangles (flag 0 for the first three vertices, flag 1 after), 8 bit components, as a shading pattern filled through the shape path. Both modes use the same code. Nothing falls back to raster for freeform gradients. Streams are deflated through `Painter.defer` and awaited by `flush` because paint is synchronous.

### src/io/pdf-text.ts · embedded font for printer's marks
- refers-to: src/io/pdf-text.ts :: embeddedMarkFont; src/io/pdf.ts :: exportPdf fontId
- kind: rationale
- logged: v0.33.0 · 2026-10-15

Page information was drawn in an unembedded Helvetica, which every PDF/X preflight rejects. It now uses a subset of the bundled Inter as a simple TrueType font with WinAnsiEncoding over codes 32 to 126, bc the information line is printable ASCII by construction (pdfString replaces anything else) and a simple font keeps marksContent's literal strings unchanged. Widths come from the font. Helvetica stays as the fallback only when the engine cannot subset, so an offline export still prints marks.

### src/io/ai-legacy.ts · legacy Illustrator reader
- refers-to: src/io/ai-legacy.ts :: readAiLegacy, isLegacyAi; src/app.ts :: openFiles
- kind: rationale
- logged: v0.34.0 · 2026-10-15

Non-PDF .ai files (AI3 to AI8 PostScript, and AI9+ files whose art sits in Ascii85 zlib, AI12 deflate or AI24 ZStandard private data) are read by a line tokenizer over the operator set, not by a PostScript interpreter. Semantics come from the real Pillow illu10 and illuCS6 samples and from Skencil's ailoader: lowercase c v y are smooth points, D is a direction flag and is ignored, XR gives the fill rule, and the last painted subpath decides a compound's appearance. Gradients use the Bd/Bs definitions and the Bb, Bg, Xm/Bm, BB instance order; the first matrix after Bg overrides the Bg matrix. Art before the first Lb is definition art and is dropped when layers exist. Patterns, brushes, symbols, SVG filters, graphic styles, plug-in objects and meshes are skipped and named in the toast; pattern fills fall back to 50 percent gray. XI raster layout, area and path text frames (Tp to TP) and XR are inferred and not verified against Illustrator output. openFiles routes a .ai to this reader only when isLegacyAi finds no PDF header and no PDF objects, so PDF-compatible files keep the PDF path. MCP open_file goes through the same openFiles.

### src/io/ai-zstd.ts · pure TypeScript ZStandard decoder
- refers-to: src/io/ai-zstd.ts :: zstdDecompress
- kind: rationale
- logged: v0.34.0 · 2026-10-15

Browsers have no ZStandard, so a small decoder (FSE, Huffman with one or four streams, sequences with repeat offsets, predefined tables, skippable and multiple frames) lives beside the reader. It matched the reference encoder on 464 of 464 generated cases after the literal-length default table was corrected to the RFC 8878 values. Dictionaries throw, checksums are not verified.


## src/io/print.ts

### src/io/print.ts · printing through a PDF in a hidden frame
- refers-to: src/io/print.ts :: buildPrintPdf, printPdf; src/ui/print-dialog.ts :: PrintDialog; src/app.ts :: printDocument; index.html :: meta http-equiv Content-Security-Policy
- kind: rationale
- logged: v0.34.0 · 2026-10-15

File > Print builds a PDF with exportPdf and prints that, because @tauri-apps/api 2.12.1 has no print call and a webview prints its own page, not a document. The PDF goes in a hidden 1px iframe (blob URL) and `contentWindow.print()` runs on its load event, or after 2.5 s if load never fires (a headless browser with no PDF viewer). If print() throws, or there is no window, the PDF is saved with deliver() and the person is told where. A WKWebView that has no PDF viewer in frames cannot be told apart from one that printed, so on macOS the dialog may do nothing; the saved-PDF route is the way out there and is not detected. The page policy had to change for this: `frame-src 'none'; object-src 'none'` became `frame-src blob:; object-src blob:`. Blob documents inherit the policy of the page that made them, and a PDF viewer is an embed, so object-src needs blob: too. The plugin argument in the entry above still holds: a plugin frame cannot read the parent's blob URLs and blob: is not a place a document can be sent to, so navigations to http(s) stay refused.

### src/io/print-layout.ts · sheet geometry shared by the dialog and the PDF
- refers-to: src/io/print-layout.ts :: sheetFor, scaleFor, tilesFor; src/io/pdf-sheet.ts :: sheetPages, inCopies; src/io/pdf.ts :: exportPdf (sheet option)
- kind: rationale
- logged: v0.34.0 · 2026-10-15

One page of art (artboard plus bleed plus marks) is written once as a Form XObject and each sheet is a paper-sized page that places it with `q k 0 0 k tx ty cm /Fm Do Q`. Fit, custom percent and tiling are only different (k, tx, ty) lists from tilesFor, so the preview canvas draws the same numbers the PDF uses. Tiling steps by sheet minus overlap and refuses more than 64 sheets with a message instead of writing a thousand-page file. Copies repeat the page objects, not the content; collate repeats the whole set, uncollated repeats each page. Orientation `auto` picks landscape when the art is wider than tall. The UserUnit scale of a very large artboard is folded into k so a tiled giant artboard prints at the size the person chose. The dialog reserves its space by construction (fixed-height grid, panes stacked in one grid cell with visibility, rows disabled rather than hidden), so no option changes its size: layout shift stayed 0.000 under a 4x CPU throttle while switching sections and options.

### src/io/pdf-plates.ts · separations are raster plates
- refers-to: src/io/pdf-plates.ts :: exportPlates, platesOf
- kind: rationale
- logged: v0.34.0 · 2026-10-15

Each ink prints as one 8-bit DeviceGray page, rendered with the same `rc.separation` path as the Separations Preview panel (so the plates match what the panel shows), at 150, 300 or 600 ppi over artboard plus bleed. Plates with no ink are left out (K is kept if every plate is blank so the file never has zero pages). They are raster, not vector, on purpose: the panel's plate colours come from the canvas renderer, which has no vector twin for overprint, blends or effects. Marks use the existing marksContent with a Separation /All gray space, the colour bar is replaced by an 11-step gray wedge (the CMYK tints would print on a gray plate), and the page info line carries the plate name. Colour handling does not apply to plates.

### src/io/print.ts · colour management at print time
- refers-to: src/io/print.ts :: managed
- kind: decision
- logged: v0.34.0 · 2026-10-15

"Let formpath determine colors" converts a cloned Project (Object.create with its own doc, so the open document and its history are untouched) through the chosen printer profile with the same convertDoc, throughCmykFn and toRgbFn Convert to Profile uses. A CMYK profile also writes PDF/X-4 with that profile as the output intent; an RGB profile does not. "Let the printer determine colors" prints the document as it is. The dialog's profile and intent rows are disabled, not hidden, when the printer decides.

## src/engine/color-management.ts (display profile and Preserve CMYK Numbers)

### src/engine/color-management.ts · the proof uses the display profile
- refers-to: src/engine/color-management.ts :: refreshDisplayProfile, displayProfileInfo, setPreviewRender, loadProof, cmToRgb; src/ui/stage.ts :: applyProof; src/ui/color-settings.ts :: proofSetupDialog
- kind: rationale
- logged: v0.34.0 · 2026-10-15

The proof LUT's last step (device to what the screen shows) used a built-in sRGB monitor. It now sends the display profile id as `monitor` and keys the LUT body with it, so changing display or profile fetches a new table instead of reusing a stale one. With no display profile the id is the built-in sRGB one and the table is the same as before. Proof Setup shows a Display line saying which profile is used and where it came from. The display is looked up once per proof load, not per frame.

### src/engine/color-management.ts · Preserve CMYK Numbers is a pre-image LUT
- refers-to: src/engine/color-management.ts :: preserveLut, previewRender, GRID.preserve; src/ui/stage.ts :: previewRender flag
- kind: rationale
- logged: v0.34.0 · 2026-10-15

The proof pass maps canvas pixels working RGB to device to monitor, so a CMYK colour is shown as the device would print it after its numbers were converted. To show the numbers as they are, CMYK colours are drawn through a 9-point CMYK grid whose entries are the working-RGB value that the proof pass then maps back to about the monitor colour of the raw CMYK numbers (device to monitor, then monitor to working RGB). Colours outside the working RGB gamut clip, so very saturated device inks are approximate; that limit is the price of doing it as one pass on pixels. The flag `previewRender` is set only around the stage's own render, so exports and the PDF never use the pre-image grid. RGB colours are unchanged by it. Measured with FOGRA39: cyan 0/255/255 became 84/153/207 with preserve on, against 177/215/218 with the plain proof.


## src/engine/raytrace.ts (textures) and src/engine/inflate-trace.ts

### src/engine/raytrace.ts · textured triangles and the alpha clip
- refers-to: src/engine/raytrace.ts :: RayTexture, RayMesh.uv, Tracer.sample, clipTest, combine; src/engine/raymesh.ts :: rayMesh (RayMap); src/engine/effects.ts :: traceMap, traceHash
- kind: rationale
- logged: v0.34.0 · 2026-10-15

A mesh may carry per-vertex UVs and one RGBA texture, with a per-triangle flag for which triangles use it. The tracer interpolates UV in `surf`, samples bilinearly with alpha weighting, and mixes the texture into the albedo before lighting when the texture is `lit`, after lighting (unlit blend) when it is not; that is how Map Art's `shade_art` false stays vivid. A texture may also be a `clip` mask: a hit whose sampled alpha is under 0.5 is rejected in the primary pass and the edge supersampling, which is how a flat-bottomed heightfield gets a silhouette that follows the art instead of a grid edge. Map Art draws the symbol into the texture with a painter callback from drawTraced (the symbol art, rasterised at up to 2048 px a side), and the front-cap triangles get UVs from object-space xy against the art bounds, so placement matches the vector layout. traceHash only gains an `|art...` suffix when Map Art exists, so every existing cache key is unchanged. With ray tracing off nothing here runs: the vector path output was byte-identical against the baseline build on extrude, revolve, inflate, tilted inflate and a plane.

### src/engine/inflate-trace.ts · Inflate under ray tracing
- refers-to: src/engine/inflate-trace.ts :: inflateTrace; src/engine/filters.ts :: RUNS['3d.inflate'] (ray_trace branch); src/ui/panels/three-d.ts
- kind: rationale
- logged: v0.34.0 · 2026-10-15

Inflate stays a raster filter. With `ray_trace` on it builds a heightfield mesh from the same height field the filter uses, on a coarse grid (about 6000, 14000 or 30000 cells for low, medium, high; 3000 while drafting), uses the pixel colours as a lit texture with alpha as the clip mask, and traces at the quality's pixel budget, upsampling bilinearly. Normals come from the height gradient. Shadow and AO distance is the smaller of the object's extent and max(24, 4 x height), with a bias of 0.7 grid steps and denoise of at least 2; without those, high quality showed speckle and hatching on the smooth surface. Face-on keeps the art's own alpha, tilted uses the traced alpha. Known gap: the traced Inflate has no side walls (the raster tilt does). Timings at print quality, one render: 420 / 700-1100 / 830 ms for low / medium / high at 1x, against 38-55 ms with ray tracing off.

### src/engine/threed.ts · Graphic material: UV per face kind and surface shading
- refers-to: src/engine/threed.ts :: textureOf, surfaceOf, impliedSurface, oriented, scene3dWith; src/engine/raymesh.ts :: rayMesh (MatMap, matUv); src/engine/raytrace.ts :: Tracer.sampleMat, shadeSurface
- kind: rationale
- logged: v0.35.0 · 2026-10-15

A 3D effect may carry a texture (an embedded image key, or a symbol by id or name) with scale, rotation, offset, and roughness and metallic from 0 to 1. UVs are generated only when ray tracing is on and a texture is set: planar on the front and back caps (the back mirrored in x), along the outline and the extrusion on extrude sides, u = angle x radius and v = cumulative profile length on revolve sides, planar from the axis on revolve end caps, and a projection from the front on inflate. `oriented` checks the handedness of each face against its outward normal and flips the coordinate so the image is never mirrored or upside down. A tile is the object's longer side times scale / 100, aspect kept, repeating with wrap; rotation is counter-clockwise about the tile centre. The texture mixes into the albedo after the material look (wood, rough, brushed) and before Map Art, then `shadeSurface` runs last: Blinn exponent 4 x 2^(8 x (1 - roughness)), highlight peak 1 up to roughness 0.8 falling to 0.2 at 1, and a metal mix of an environment reflection blurred by roughness. A material's own implied roughness and metallic (plastic 0.8/0, matte 1/0, metal 0.77/1, brushed 0.7/1, wood 1/0, rough 0.9/0, flat 1/0) is what the shading reproduces when the sliders are left unset, so unset keeps the legacy look. Roughness and metallic are text params whose default is '' (unset), so effect defaults stay inert: five extrude, revolve and plane cases, the inflate flat case and both vector cases rendered byte-identical against the previous build.

### src/engine/effects.ts · Texture reference, texture_color and the pending protocol
- refers-to: src/engine/effects.ts :: traceHash, traceMap, traceMat, textureArt, textureTile, threeDFaces, make; src/engine/render.ts :: drawTraced
- kind: rationale
- logged: v0.35.0 · 2026-10-15

The reference is resolved doc.images first, then a symbol; the bytes live in Project.assets and are decoded lazily by the stage. Filters and threeDFaces have no asset access, so the params also carry `texture_color`, the alpha-weighted 24 px average, which the vector fallback and the ray tracer's base albedo use. A bitmap that is not decoded yet makes the painter return 'pending'; make() then does not cache the trace, and the stage re-traces once the bitmap exists, so a cold open never freezes a texture-less image into the cache. traceHash gains a `|mat{ver}:{ref}` suffix only for textured effects. Known limits: a symbol texture's colour is a snapshot and goes stale if the symbol art is edited later, and an asset that is missing for good keeps the trace uncached.

### src/engine/render.ts · Inflate texture
- refers-to: src/engine/render.ts :: inflateTextured, bareVariants; src/engine/inflate-trace.ts :: inflateTrace
- kind: rationale
- logged: v0.35.0 · 2026-10-15

Inflate is a raster filter, so a texture is applied by pre-drawing the tiled texture clipped to the path and rendering the path without its first fill (a WeakMap keeps the bare variant stable so cache keys do not churn). It covers path and compound nodes only, not groups or text. Roughness and metallic reach inflate only through the ray traced branch (`inflateTrace(..., params)` then `surfaceOf`).

### src/engine/texture.ts · Texture averages
- refers-to: src/engine/texture.ts :: textureAverage, imageAverage, textureName
- kind: rationale
- logged: v0.35.0 · 2026-10-15

One place computes the average colour of an image or a symbol for `texture_color` and names a reference for messages, so the panel and the MCP tool store the same value.

### src/io/svg.ts · Loose texture images
- refers-to: src/io/svg.ts :: exportSvg, importSvg; src/engine/effects.ts :: textureImageKeys
- kind: rationale
- logged: v0.35.0 · 2026-10-15

A texture image is not placed anywhere, so it would be lost on a preserve export. exportSvg decodes texture bitmaps before baking and, with preserve, writes them in a hidden `<g display="none"><image data-formpath-src=...>` that importSvg restores into the assets. .fpth already writes every doc.images key, so it needed nothing; the PDF carries the editable document as before. Expand Appearance on a textured 3D object gives one history step and one image object.

### src/automation/agent-bridge.ts · three_d texture, roughness and metallic
- refers-to: src/automation/agent-bridge.ts :: three_d; backend/app/routers/mcp.py :: TOOLS three_d
- kind: rationale
- logged: v0.35.0 · 2026-10-15

three_d gains texture (image key, id of a placed image, or a symbol name or id; an empty string clears), texture_scale, texture_rotation, texture_offset_x and texture_offset_y, roughness and metallic (0 to 1, checked) and reset_surface, which clears both. The tool stores texture_color with the reference. Unknown references and out of range values fail with a message that lists what exists. The path is set3d, the same as the panel, so one call is one history step.

### src/ui/panels/three-d.ts · Graphic section and surface sliders
- refers-to: src/ui/panels/three-d.ts :: pickTexture, addFile, sync
- kind: rationale
- logged: v0.35.0 · 2026-10-15

Roughness and Metallic sit under Material and enable only with ray tracing; the Graphic section holds Source, Image from File, Texture Scale, Rotation and Offset X and Y, enabled only with a texture. A picked file is decoded, stored and referenced inside one gesture, so choosing it is one undo step, and slider drags merge into one step each. The source list is memoised on the identity of doc.images and doc.symbols, so no keyed node is rebuilt and the layout does not shift (measured 0.000 under 4x CPU throttle).

### src/io/ai-legacy.ts · Patterns, symbols and brushes from private data
- refers-to: src/io/ai-legacy.ts :: prepare (KEPT, Def), buildDefs, Reader.patternPaint, readAiLegacy; src/app.ts :: openFiles
- kind: rationale
- logged: v0.35.0 · 2026-10-15

Pattern, Symbol, BrushPattern and PluginObject blocks are captured instead of skipped, with the %_ prefix of private lines removed, and run through a second Reader that shares the main one's swatches, custom colours and pattern names. Verified on the real Pillow illu10 and illuCS6 files: `%AI3_BeginPattern: (name)` has the header `(name) llx lly urx ury` (a trailing `[matrix] Bp` is accepted if present), becomes a PatternDef (tile = that box flipped to the page, art = the block) plus a swatch; `%AI10_BeginSymbol` and `%AI14_BeginSymbol` blocks, named by the first string of the first line, become symbols with the art centred on its bounds (the formpath convention: reg 0,0); `%AI8_BeginBrushPattern` blocks are the brush tiles, found by name from the brush tool records `%AI8_BeginPluginObject (Adobe ... Brush Tool) (name) (params) .`. Brush records: calligraphic `1 size a b, roundness a b, angle a b, variation kinds` (fixed values are exact; a random range is reduced to its midpoint and reported, the angle is negated because formpath's y axis points down); art and pattern brushes split the params on '/' into version, side, outer corner, inner corner, start, end, then colorization and options. Tiles are named by block, so a brush is made only when every named tile exists; otherwise it is reported. Stroked tile art is expanded to outlines first because the brush engine bends filled outlines only. What is not decoded and takes formpath defaults: art brush stretch, flip and direction, pattern spacing and fit, and colorization methods other than 0 to 3 (those become none). Pattern fills `(name) px py sx sy angle rf r k ka [a b c d tx ty] p` (and P for strokes) use the matrix alone, as F M F^-1 on the flipped page; with no matrix the pattern keeps its natural place. That operator layout is from the AI file format notes and is tested only on hand-written fixtures, because none of the real files uses a pattern fill. Likewise no real file here shows how a symbol instance or a brushed stroke is recorded, so instances and brush use are not linked: the art stays as the expanded paths the file already holds, and both are named in the left-out list. Scatter brushes (their parameter layout is unknown) and patterns or symbols that hold placed images are also reported. The open message now says what was brought in.

### src/io/dwg.ts · Native DWG reader, clean room
- refers-to: src/io/dwg.ts :: parseDwg, build, entityRec, assemble; src/io/dwg-bits.ts :: Bits, lz77; src/io/dwg-file.ts :: readSections, objectMap, readClasses; src/io/dwg-header.ts :: readHeader; src/app.ts :: readForeign
- kind: rationale
- logged: v0.35.0 · 2026-10-15

DWG is read in the window, in TypeScript, from the layout of the ODA Open Design Specification for .dwg files (v5.4.1: bit-coded values, the R2000 locators, the R2004 and later encrypted header with page map and section map, the type 2 LZ77 compression, the object map, the classes section, the header variable list, and the object framing with its data, string and handle streams). It was written clean room: no GPL DWG source (LibreDWG or any other) was read, copied or paraphrased. LibreDWG 0.13.3 binaries were used only as a black box, `dwg2dxf -y` turning its sample DWGs into reference DXF files that the existing `parseDxf` reads, so the comparison is made on observable output and never on code. Where the specification was unclear (the exact extra fields of a few objects, the number of handles at the end of the header, where the data for INSUNITS sits), the answer was found by decoding the sample files and checking against the reference values, not by reading anybody's source. `parseDwg` returns the same structure as `parseDxf` (entities as group code pairs, layers, blocks, styles, header units) plus the linetype table, LTSCALE and the extents, so `dxfToDoc` is unchanged and a DWG and its DXF come in the same way. Versions: R2000 (AC1015), R2004 (AC1018), R2010 (AC1024), R2013 (AC1027) and R2018 (AC1032) natively. R2007 (AC1021) is not read: it wraps the file in Reed-Solomon interleaving and uses a different compression, and the specification text for those was not at hand, so it throws DwgUnsupportedError and goes to the converter like R13 and R14. Only that error falls back; a damaged file reports its own message. Objects: LAYER (colour, off, frozen, lineweight), LTYPE, STYLE, BLOCK_HEADER with BLOCK and ENDBLK, LINE, CIRCLE, ARC, ELLIPSE, LWPOLYLINE, POLYLINE 2D and 3D with VERTEX, SPLINE (control and fit, helix read as its spline), TEXT, MTEXT, ATTRIB and ATTDEF, INSERT with MINSERT arrays, SOLID, 3DFACE, HATCH (lines, arcs, ellipses, splines, polylines, solid and gradient fill), POINT, DIMENSION through its anonymous block, LEADER, VIEWPORT. Everything else (3D solids, surfaces, tables, proprietary classes such as Tangent objects) is counted as a left-out kind by the same list the DXF reader makes, and objects that fail to decode are counted in native.unreadable with the first messages in native.failures. Verified on the LibreDWG sample set (104 files of R2000 to R2018): block lists and layer tables identical on all, per-kind and per-layer entity counts identical except the kinds that are left out on purpose, coordinates within 3e-11 of the reference on every file where the reference is right. Known differences that are the reference's, not ours: zero bulges are written by the reference and omitted here, the reference mangles the degree sign in some R2000 text, and R2018 ATTDEF flags are read from a different field by the reference. Entities of a block follow the block's own list (R2004 and later), grouped as model space, then each layout. Left to do: R2007, multiline attributes, and the draw order table.

### src/io/dwg-header.ts · Header variables by position
- refers-to: src/io/dwg-header.ts :: readHeader, walk
- kind: rationale
- logged: v0.35.0 · 2026-10-15

Only LTSCALE, the model space extents and INSUNITS are used, but the header has no index, so every variable before them is stepped over in the order the specification gives. Facts that were not obvious and are now fixed by checks against 110 sample files: the colours of R2004 and later are three fields (BS, BL, RC) with names only when the flag bits say so; from R2007 the handles are in their own stream so they are skipped, while the handle seed stays in the data; menu name is present up to R2004; the paper space group comes before the model space group; R2000 has one more handle (the viewport entity header control) than R2004; after the three dictionaries come two shorts, two zero shorts (up to R2004), three handles (R2000) or five (R2004), then a 32-bit flags word and then INSUNITS. Metric is taken from the units because MEASUREMENT was not located. A header that cannot be walked leaves unitless and no extents, so the drawing itself still opens.

### src/app.ts · readForeign reads DWG natively first
- refers-to: src/app.ts :: readForeign; backend/app/routers/mcp.py :: _run
- kind: rationale
- logged: v0.35.0 · 2026-10-15

`readForeign` tries `parseDwg` on the bytes. Only a DwgUnsupportedError sends the file to `api.dwgToDxf` and `parseDxf`; the toast says "natively" or "through <converter>". MCP open_file and place_image no longer convert in the engine: .dwg is in the openable and placeable lists and the bytes reach the window like any other file, which then has the same fallback, so an agent and a person get the same result. The open dialog note and the files-and-export skill text were rewritten because they said DWG does not open.

## src/engine/ops/live-shapes.ts

### src/engine/ops/live-shapes.ts · live polygons and stars keep any corner type
- refers-to: src/engine/types.ts :: LiveShape polygon star corner; src/engine/ops/live-shapes.ts :: liveShapePath, patchLive, typedCorners; src/engine/ops/corner-ops.ts :: liveCorners, firstCorner; src/tools/select.ts :: cornerWidgets; src/ui/shape-fields.ts :: ShapeFields
- kind: rationale
- logged: v0.36.0 · 2026-10-16

Polygon and star live shapes gained an optional `corner` (inverted or chamfer), stored only when it is not round, so every older file and every round shape serialises byte for byte as before. Illustrator gives a live polygon one corner radius and one corner type for all corners, and a star one radius for all points, so that is what is stored: no per-corner radii and no separate inner and outer radius. Rendering for a non-round type builds the plain polygon or star, gives every anchor `{ type, r }` and bakes it through `cornered`, the same geometry as Live Corners on a path, so canvas, SVG, PDF and the Corners dialog agree; the round type still goes through `roundCorners`. `liveCorners` no longer drops `live` for inverted or chamfer on polygon and star, and `firstCorner` reports the stored type. The widget on the top vertex is placed at `r / sin(half)` for round and inverted and at `r * cos(half)` along the bisector for chamfer, with the chamfer limit `side / 2`. Properties Shape gained a Corners select for both kinds. Relative mode still expands the shape to a plain path, as for a rectangle.

### src/engine/ops/live-shapes.ts · Convert to Shape
- refers-to: src/engine/ops/live-shapes.ts :: convertLive, CONVERT_KINDS; src/engine/index.ts :: convertLiveShape; src/app.ts :: convert-to-rectangle, convert-to-rounded-rectangle, convert-to-ellipse, convert-to-polygon, convert-to-star; src/ui/shape-fields.ts :: convert; src/automation/agent-bridge.ts :: edit_shape; backend/app/routers/mcp.py :: edit_shape
- kind: rationale
- logged: v0.36.0 · 2026-10-16

A live rectangle, ellipse, polygon or star converts to another live kind in one history step, keeping its transform, its fill and stroke and its corner type. The unrotated bounds come from the live parameters, not from the path, so a rotated rectangle stays rotated. A polygon and a star are regular, so they take the shorter side as their diameter and a non-square box loses its aspect; a polygon gets 6 sides, a star 5 points with the inner radius at half the outer, and a rounded rectangle takes the source radius or a quarter of the shorter side. A conversion that changes nothing adds no history step. Lines are not convertible and Expand Shape is unchanged. The menu is Object > Shape, the Properties Shape section has a Convert to select above the kind fields (so the rows below never move when the kind changes), and the MCP edit_shape tool takes `convert_to` and applies its other fields after the conversion inside one step.

### src/tools/transform.ts · Width tool edits width points
- refers-to: src/tools/transform.ts :: width tool, pickWidth, widthLayout; src/engine/effects.ts :: widthFrames, widthAxisNearest, addProfileSamples, strokeOutline; src/engine/index.ts :: widthSel, setWidthPoints; src/ui/width-point-dialog.ts :: editWidthPoint; src/ui/taskbar.ts :: kindOf
- kind: rationale
- logged: v0.36.0 · 2026-10-16

The model needed no change: a width point is already {t, l, r} with t the arc length fraction of the flattened path and l, r the two sides as multiples of half the stroke weight, so asymmetric widths were stored but never made by the tool, and strokeOutline already offered each side its own value, which is why SVG, PDF and EPS (all call strokeOutline) honour them and the .fpth round trip is untouched (no new document field, an old document serialises byte for byte as before; the selected points live on the engine as widthSel, like currentBrush). The tool now shows the points and side handles of the selected stroked paths and of the hovered one (kept while the pointer is within 30 px so the handles can be reached). Drag on the path adds a point (Alt: only the side the pointer is on); drag a point moves it, and every selected point with it (Shift-click toggles selection); Alt-drag copies the selected points, and a copy dropped within 0.003 of another point takes its exact t, which is how a discontinuous pair (two points at one location) is made; drag a handle changes that side on both sides by the same delta (Alt: one side), for all selected points; Delete or Backspace removes the selected points; double-click runs the command width-point-edit, a form with Side 1, Side 2, Total Width (scales both sides when only it is changed), Adjust adjoining width points (scales the two neighbours by the same factors) and Delete. Each gesture is one history step through beginDrag and commitDrag. A discontinuous pair is drawn 10 px apart along the path so both can be picked, and strokeOutline renders the step by sampling at t minus and plus 0.0001. strokeOutline also now inserts samples at every width point t when the stroke has a profile; before, a straight two-anchor path had only its end vertices, so Lens or any mid-path point drew as a flat bar. Strokes without a profile are untouched. The contextual task bar is hidden while the Width tool is active because it sat on top of the lower handles of thick strokes. Not done: no cursor change over a point or handle, no marquee select of points, and the continuous or discontinuous state has no checkbox in the dialog (Alt-drag a point back onto itself, or send width_points with a repeated offset).

### src/ui/panels/stroke.ts · Profile flip, custom profiles
- refers-to: src/ui/panels/stroke.ts :: StrokePanel; src/io/width-profiles.ts; src/engine/effects.ts :: CUSTOM_WIDTH_PROFILES, flipProfile, widthProfileNamed; src/automation/agent-bridge.ts :: set_stroke; backend/app/routers/mcp.py :: set_stroke
- kind: rationale
- logged: v0.36.0 · 2026-10-16

Under the Profile select the Stroke panel has Flip Along (mirror t, the sides stay), Flip Across (swap the sides), Add to Profiles (a name, then the stroke's points are stored), Delete Profile (added profiles only) and Reset Profiles (removes all added ones after a confirm). The 8 presets stay and cannot be deleted. Added profiles are kept in localStorage under formpath.widthProfiles like the perspective grid presets, loaded by src/io/width-profiles.ts into the registry in effects.ts, because they belong to the person and not to a document; a profile applied to a stroke is copied into it, so deleting a profile never changes artwork. The select has a last entry, Custom width points, shown when the stroke's points match no profile, so the select no longer shows a stale name. There was no Control bar or Properties profile menu in this code base, so the Stroke panel is the only place. The MCP tool set_stroke gains width_points ({offset, left, right}), flip_along, flip_across, custom_profile and save_profile_as beside the old profile enum, which is unchanged. The commands width-point-edit, width-flip-along and width-flip-across are registered in app.ts with entries in command-meta.ts.

### src/engine/pathfinder.ts · Live compound shapes, Pathfinder effects, Pathfinder Options
- refers-to: src/engine/pathfinder.ts :: liveArt, compoundNode, pathfinderNodes, settle, isLive, liveExpanded; src/engine/shaper.ts :: derivedArt; src/engine/types.ts :: GroupNode.compoundShape, NodeBase.smode
- kind: rationale
- logged: v0.36.0 · 2026-10-16

A live compound shape is a group with compoundShape true whose children carry a shape mode (smode: add, subtract, intersect, exclude; absent means add). Its art is a left fold of the paper.js boolean over the visible children, painted with the top-most child, and it reaches render, SVG, PDF, EPS and DXF through derivedArt, which already served the shaper and intertwine, so no exporter has its own boolean code. Each fold step is cached by identity (previous result, child node, mode), so dragging child k recomputes only steps k onward: measured 6 shape group, last child 0.2 ms, first child 2 to 7 ms, cached call about 1 microsecond, frame time vsync bound at 16.5 ms median. Pathfinder effects (pathfinder.* ids on a group's appearance, 13 of them) are applied by liveArt in order with the same kernel as the destructive operations and cached by (children, effects) identity. They are limited to groups, because the operation needs a set of objects and a layer or a type object has no stable set; on anything else the effect dialog gives a notice. Pathfinder Options (precision 0.028 pt, Remove Redundant Points, Divide and Outline Will Remove Unpainted Artwork) are module state in this file, persisted as prefs pfPrecision, pfRemoveRedundant and pfRemoveUnpainted, and applied by settle() to the destructive, live and effect paths alike; changing them replaces the caches. Remove Redundant Points drops collinear anchors and anchors that join smoothly (checked by sampling), measured 17 to 13 anchors on an ellipse united with a rectangle. Expand turns a compound shape into the bare art; an effect group keeps a wrapper group so its other properties survive. Hit testing (hit.ts liveHit) returns a child when the point is on its edge, or on the result's fill, and nothing in a subtracted hole. Not done: the SVG importer does not rebuild compound shapes, the options dialog has no live preview, the task bar has no Expand or Release, and Ungroup leaves a stale smode on the children (only Release strips it, harmless because it is read only inside a compound shape).

### src/ui/properties.ts · Pathfinder panel menu and Alt-click
- refers-to: src/ui/properties.ts :: PathfinderPanel; src/app.ts :: pathfinderOptionsDialog, compound-shape-make, pf-options; src/automation/agent-bridge.ts :: pathfinder; backend/app/routers/mcp.py :: pathfinder
- kind: rationale
- logged: v0.36.0 · 2026-10-16

The shape mode buttons now make a live compound shape on Alt-click (and set the mode of a selected compound child when one is chosen), the old Make Compound Shape button, which made a compound path, is gone from the panel and lives in the panel menu with Release, Expand and Pathfinder Options; Expand is also a button, enabled only for a compound shape. Layout shift measured 0 under 4x CPU throttle for every panel interaction and for opening the dialog. The MCP tool pathfinder gains live (the four shape modes only), compound (expand or release), shape_mode and the three option fields, and the commands compound-shape-*, shape-mode-*, pf-options and fx-pathfinder.* have entries in command-meta.ts; ./formpath agents sync was run.

## src/io/icc-embed.ts

### src/io/icc-embed.ts · ICC profiles in PNG, JPEG, WebP and TIFF exports
- refers-to: src/io/icc-embed.ts :: embedPng, embedJpeg, embedWebp, embedIcc; src/io/tiff.ts :: encodeTiff (tag 34675, convert); src/io/raster.ts :: exportRaster, rasterIcc, canvasBlob; src/engine/color-management.ts :: outputProfileBytes, printCmykLuts, rgbToCmykBytes; src/ui/app-dialogs.ts :: ExportDialog.embedIcc
- kind: rationale
- logged: v0.37.0 · 2026-10-16

The canvas encoders write no profile, so the bytes are rewritten after encoding: PNG gets an iCCP chunk (keyword from the profile name, zlib body through CompressionStream, existing sRGB, gAMA and iCCP chunks removed, gAMA 45455 added for sRGB), JPEG gets APP2 ICC_PROFILE segments of at most 65519 bytes numbered n of count right after the JFIF segment, WebP is rewritten as VP8X plus ICCP (a plain VP8 or VP8L file gets a VP8X built from its size and alpha flag), TIFF gets tag 34675 in encodeTiff. The profile is the document RGB profile (built-in sRGB when the document has none), the document CMYK profile for a CMYK TIFF. Default: the Export dialog row Embed ICC Profile starts on when the document has colour settings (doc.cm) and off otherwise, as Illustrator ties it to the working space; callers that pass no icc (Export for Screens, Send to NodeMode, Data Merge) follow the same rule, and icc true embeds the built-in sRGB for a document without settings. A CMYK TIFF converts through the document RGB-to-CMYK table (17 point grid, trilinear in rgbToCmykBytes, one lookup per run of equal pixels) whenever doc.cm.cmyk is set, even with the embed switch off; without a CMYK profile it keeps the formula and embeds nothing, because the formula values do not belong to any profile (the synthetic formpath Generic CMYK is deliberately not used as a silent fallback). Verified by reading the files back with Pillow: PNG, JPEG, WebP and TIFF return the profile byte for byte (sRGB 588 bytes, FOGRA39L 121368 bytes, JPEG in two segments, a 1.8 MB ECI profile in 28 JPEG segments, PNG and WebP too; Pillow caps a PNG iCCP at 1 MB unless MAX_TEXT_CHUNK is raised, which is Pillow, not the file). Pixel values are unchanged by embedding. CMYK TIFF of 8 known colours through FOGRA39L against lcms (Pillow ImageCms, relative colorimetric with black point compensation): 6 colours identical, grey and (216,58,58) within 1 to 2 of 255, formula values differ by up to 69 (red formula 0,255,255,0 against 0,247,251,0). Not done: no profile in SVG or EPS, no soft proof applied to the raster before a CMYK TIFF, and JPEG CMYK is not offered.

## src/engine/inks.ts

### src/engine/inks.ts · Ink Manager model: print, convert to process, aliases
- refers-to: src/engine/inks.ts :: platesOf, inkRows, inkTarget, plateValue, setInkPrint, setInkProcess, setInkAlias, withInks; src/engine/types.ts :: Doc.inks, InkSettings; src/ui/ink-manager.ts :: InkManagerDialog; src/engine/render.ts :: plateGray; src/io/pdf.ts :: Painter.separation; src/io/pdf-plate-map.ts :: routeInk
- kind: rationale
- logged: v0.37.0 · 2026-10-16

Ink settings live in the document (doc.inks: off, process, alias, allSpotsToProcess), so they travel in .fpth through the generic document copy (checked: serialize then docFromManifest returns the same object) and take part in Undo as one step named Ink Manager. A spot ink resolves through inkTarget: follow the alias chain to the last spot that exists (a cycle stops), then it is process if All Spots to Process, the ink or the alias target is converted, otherwise it is a spot plate under the target name. plateValue gives one ink's coverage for one paint and is the only place that decides it, used by the Separations Preview in render.ts, the vector plates and the PDF spot export, so the three cannot disagree. Spot-to-process uses the swatch CMYK equivalent scaled by the tint. platesOf(doc, true) leaves out inks that are off; the Separations Preview lists that set and drops the shown plate if it disappears. PDF export of a spot colour uses routeInk: a converted spot is written as its CMYK (or RGB for PDF/A) with the tint, an aliased one as a Separation of the target name; verified with qpdf on four settings (two Separations, one Separation plus CMYK, one Separation shared by both objects, none). The dialog (ui/ink-manager.ts) opens from Window > Ink Manager (command ink-manager, entry in command-meta.ts), from the Separations Preview footer and from the Print dialog Output pane; its list is patched in place with patchList and reserves its height (248 px). Separations Preview list now has a fixed height (232 px) because adding or removing a plate through the Ink Manager shrank the bottom anchored window and shifted layout by 0.003; after the change layout shift is 0 under 4x CPU throttle for the dialog, the Print dialog path and the Export dialog. Not done: no ink limit or Black Overprint, no per-ink screen angle or density, the Ink Manager does not rename inks, and SVG and EPS exports ignore the ink settings.

## src/io/pdf-plates.ts

### src/io/pdf-plates.ts · Separations as vector plates
- refers-to: src/io/pdf-plates.ts :: exportPlates; src/io/pdf-plate-map.ts :: PlatePaint, routeInk; src/io/pdf.ts :: Painter.plate; src/ui/print-dialog.ts :: PrintDialog
- kind: rationale
- logged: v0.37.0 · 2026-10-16

File > Print separations used to render every ink to a grayscale bitmap per page. Each plate is now a page drawn by the normal PDF Painter with a PlatePaint set: every colour becomes the ink's coverage as DeviceGray (1 minus coverage, so ink is black), strokes and fills, gradient stops (Axial or radial shading in DeviceGray, freeform and mesh through the same map), spot colours on their own plate with their tint, and overprint is honoured by dropping a fill or stroke that carries nothing on this plate when it overprints (so it neither knocks out nor draws) while a knockout paints white over lower inks. Rasters keep the bitmap path: an image is converted per pixel to the ink's value with the same CMYK formula the engine uses for RGB art (it does not go through the document profile), and a raster effect or an image warp is rendered with separation set and placed as a gray picture. Pages that no plate touches are left out (an empty document gets one blank K page). Marks, bleed, trim boxes, UserUnit and the sheet and tile layouts are the same code as the composite PDF. Verified on a test document (CMYK rectangles, a K overprint with a stroke, a 60 percent spot ellipse, a gradient, live text, a raster image, a spot under a K knockout): 5 pages, exactly 5 image XObjects in the file (one per plate, all the 80 by 60 raster picture), none for the vector art, qpdf --check clean; pdftoppm at 300 ppi against the old bitmap plates outside the image and the overprint area: mean difference 0.04 to 0.35 of 255 per plate, at most 0.36 percent of pixels differ by more than 32; spot converted to process gives magenta 54 and yellow 48 percent on the 60 percent tint (pixels 117 and 133, expected 117 and 133). With marks, color bars, page information and custom bleed the plates render correctly. The file size for the test is 11 KB against 2.8 MB of PNG references at the same resolution. Not done: raster images use the RGB-to-CMYK formula and not the document profile, plates are DeviceGray and carry no /Separation page tag or ink name metadata (the ink is in the page information line), and only linear gradients were checked on a real plate (freeform and mesh shadings take the plate map in code but were not rendered here).

## src/io/pdf-icc.ts

### src/io/pdf-icc.ts · PDF import honours ICCBased colour spaces
- refers-to: src/io/pdf-icc.ts :: pdfProfiles, assignPdfProfile; src/io/pdf-read.ts :: Painter.toColor (ICCBased branch); src/app.ts :: openFiles (PDF)
- kind: rationale
- logged: v0.37.0 · 2026-10-16

An ICCBased space used to be read as DeviceGray, DeviceRGB or DeviceCMYK by its component count alone. Now the reader uses the profile stream's /Alternate when it matches the count (CalGray, CalRGB, Lab, the Device spaces), so a Lab alternate no longer comes in as RGB numbers. For a CMYK profile the colour numbers stay CMYK and the profile becomes the document CMYK working space, which is what Illustrator does with a tagged CMYK PDF and is the only way both the numbers and the look are kept: the colours then display, proof and export through that profile's table from the engine. pdf-icc.ts finds the profile streams without the page interpreter (the async inflate cannot run inside the synchronous colour reader), by scanning the file for stream dictionaries with /N 1, 3 or 4 that are not images, honouring /Length, inflating Flate, and checking the acsp signature and the data colour space; the first CMYK profile wins, it is uploaded to the engine (which dedupes by SHA-1 id, so a profile it already has is not copied again) and the toast names it. Verified with a hand written PDF (FOGRA39L ICCBased N 4 and an ICCBased N 3 with a Lab alternate): the four fills come in as CMYK 100/0/0/0, 0/100/0/0, 0/0/0/100 and the Lab 50, 60, -40 as RGB 184, 72, 188, and opening the file in the window sets doc.cm.cmyk to the profile. Only one hook lives in pdf-read.ts (the ICCBased branch of toColor, nine lines). Not done: an RGB ICC profile that is not sRGB is not converted (there is no RGB to RGB table route), ICCBased images are still read by their component count, an encrypted file yields no profile, and a PDF with several different CMYK profiles gets only the first.

### src/io/pdf-text.ts · live text as runs
- refers-to: src/io/pdf-text.ts :: liveRuns, liveStream, LiveFonts.plan; src/io/pdf-read.ts :: Painter.place
- kind: rationale
- logged: v0.37.0 · 2026-10-16

Supersedes the one Tm and Tj per glyph of the v0.32.0 entry. Consecutive glyphs with the same face, ink and linear matrix whose origins lie on one baseline (perpendicular distance under 0.01 pt) go out in one BT with one Tm and one TJ array; the numbers are the pen position minus the layout position in thousandths of text space, so kerning, tracking and justification are exact, and any residue under 0.25 is left out without accumulating (the next number includes it). Spaces stay real glyphs, so pdftotext gives words and lines. Type on a path, rotated glyphs and baseline shifts break the run and keep a Tm of their own. Advances in W are written with one decimal. On the way in, pdf-read.ts joins a line that sits directly under the previous point text (same matrix, left edge, style, even step) into one text object with leading, so a formpath PDF without the native copy reopens as paragraphs: an area text of four lines came back as one node, a point line with tracking as one node. Not done: justified lines whose word gaps differ are one run with big TJ numbers, which reopens as one line with a tracking fit.

### src/io/pdf.ts · export security, standards, compression and layers
- refers-to: src/io/pdf-std.ts; src/io/pdf-crypt.ts :: makeSealer, sealStrings; src/io/pdf.ts :: PdfFile.build, exportPdf, Painter.backdrop, Painter.flat; src/io/pdf-image.ts; src/io/pdf-x.ts :: pdfaParts, xmpPdfA; src/ui/app-dialogs.ts :: ExportDialog; backend/app/routers/mcp.py :: export_file
- kind: rationale
- logged: v0.37.0 · 2026-10-16

Security is the Standard handler V5 R6 with AESV3: a random 32 byte file key, U/UE from the user password, O/OE from the owner password and U, Perms with the P flags, and every string and stream sealed with that key directly (AES-256-CBC, random IV in front, PKCS#7), no per-object derivation. The Encrypt dictionary, xref and trailer stay clear; the document ID is made when absent. Verified against pikepdf, qpdf and poppler (user and owner open, wrong password refused, all eight permission flags read back as set, U, O, UE, OE and Perms recomputed independently in Python), and by formpath's own reader. Passwords longer than 127 bytes are cut as the specification says, which poppler does not do; SASLprep is not applied. Without an owner password a random one is made, and restricting anything without one is refused. PDF/X and PDF/A with passwords are refused with a message, as are layers in X-1a and X-3, in both the dialog (controls disabled) and the MCP tool. The editing payload is left out when encrypted, like under the standards.

Standards: X-1a writes 1.3, everything as DeviceCMYK or Separation (images too, flattened on white), GTS_PDFXVersion PDF/X-1:2001 with conformance PDF/X-1a:2001, no XMP. X-3 writes 1.3 with the CMYK intent and keeps RGB tagged through a DefaultRGB ICC space. Both flatten transparency by drawing the region of each object that needs it (opacity, blend, mask, knockout, soft gradients, translucent images, raster effects) as the whole document looks there, at the document resolution, as one opaque picture over the vectors below it; objects inside patterns and symbols cannot be placed that way, so the export stops and lists them. X-4 is as before, and its layer configuration no longer carries /AS. PDF/A-2b writes 1.7, DeviceRGB only with an sRGB GTS_PDFA1 output intent, an XMP packet with pdfaid part 2 conformance B whose title, producer and dates repeat the Info dictionary, embedded fonts, no encryption and no editing payload. veraPDF is not available, so these were checked by a script of the key requirements, not by a validator; the X-3 flattened pictures are RGB over CMYK vectors, which a strict preflight may flag as a colour mismatch.

Compression: content, form, shading and tile streams can be left uncompressed (images and fonts keep theirs), images are automatic (JPEG kept, the rest Flate), all Flate, or all JPEG at a quality, and downsampling resamples with the browser's high quality filter only images above the "above" resolution (default 1.5 times the target); a JPEG source stays JPEG after resampling in automatic mode. Fill gradients with stop opacity are now rasterised like stroke gradients, because the PDF gradient ignored the stop opacity (found when comparing the render with the canvas).

Layers: each non-template top-level layer becomes an OCG (hidden layers start in /OFF and print state OFF, non printing layers print state OFF), with /Order top first, the content in BDC /OC ... EMC, and /AS only without a standard. pdf-read.ts reads OCGs back: a BDC /OC group with a known OCG becomes a layer in order of first painting, named from the OCG, hidden from /OFF and BaseState, non printing from Print usage; content in a clip group keeps its clip around each piece. The export dialog groups the PDF options in four tabs (General, Marks and Bleeds, Compression, Security) so its reserved height is 599 px for every format and tab; the note sits in the footer.

## src/io/gen-options.ts

### src/io/gen-options.ts · shared generation options for the three generative features
- refers-to: src/io/gen-options.ts :: detailLimits, detailText, GEN_STYLES, GEN_TONES, GEN_EFFECTS, constraints, enforcePalette, applyEffects, styleFromNodes, styleFromImage, styleReference; src/io/generative.ts :: textToVectorVariations, shapeFillVariations, patternVariations
- kind: rationale
- logged: v0.38.0 · 2026-10-16

Text to Vector Graphic, Generative Shape Fill and Text to Pattern were graded Partial because the model's output was plain primitives with no control over detail, style, reference or colour. The three now build one constraint block from a shared GenCommon (detail 1 to 10, style preset, style reference, effects, tone or palette). Detail is a table, not prose alone: each level gives a shape budget (8 at level 1 up to 230 at level 10), a gradient budget (none below level 3, 80 at level 10), a stroke policy (none, a few key outlines, free) and whether compound paths are allowed (from level 4); the same Limits are enforced after generation, so a model that ignores the prompt still gets trimmed (smallest shapes dropped first past 1.3 times the budget, extra gradients flattened to their middle stop, strokes removed or capped, compound paths split). Style presets add drawing rules and tighten the limits (Flat, Isometric, Retro and Minimal take no gradients, Line Art takes strokes only and turns fills into strokes). The old 1 to 3 detail still works: low, medium and high map to 3, 5 and 8 in the MCP tools. Effects are formpath's own live effects added to the art group (Color Halftone, Grain, Outer Glow, Drop Shadow, with the glow tinted from the lightest palette colour and the shadow from the darkest), so they stay editable in Appearance. Colour and Tone is enforced after generation, never trusted to the prompt: colours within 0.08 OKLab of a palette colour snap to it, and the rest go through the Recolor engine's fitRowsToPalette (clustered, matched by lightness) with rowsFn(rows, false) so no tint drift can leave the palette. Earlier the Generative Recolor path kept tints, which is right for recolouring artwork but not for a palette that must hold.

The style reference is read from the document, not from pixels, when it is artwork: palette (reduced to 8 by clustering), stroke widths measured on a 1000 unit canvas, corner style from live rectangle radii and handle ratios, gradient counts, and a reduced SVG outline (at most 30 elements and 2200 characters, coordinates normalised to 0 to 100) so the prompt stays well under the engine's 12000 character cap. A placed image is rendered at 256 px and its palette and tone (dark, mid and light shares, contrast, saturation, warmth) come from the pixels; the image itself is sent with the request only when Preferences > Plugins marks the model as reading images, through the same image field the Assistant code already uses.

## src/io/gen-repair.ts

### src/io/gen-repair.ts · validate, repair and report the model's SVG
- refers-to: src/io/gen-repair.ts :: repairSvg, finishNodes, seamlessWrap, seamCheck, reportText; src/io/generative.ts :: svgNodes, sanitizeSvg
- kind: rationale
- logged: v0.38.0 · 2026-10-16

sanitizeSvg used to drop everything it disliked without saying so, and kept only primitives, gradients and clip paths. repairSvg replaces it with a pass that counts: unsupported elements (text, image, filter, mask, use, script and the like) are dropped by name; shapes with unreadable data, no size or runaway numbers are dropped with the reason; colours that do not parse, gradients with fewer than two stops or pointing nowhere become a solid colour, stop offsets are clamped and made monotonic; opacity, stroke width, cap, join, miter limit, fill rule, dash array, transform and blend mode values are clamped or removed if invalid; markup that is not well formed (truncated output, unclosed tags, unquoted attributes) is re-parsed with the HTML parser and serialised again, and shapes nested inside shapes are moved out. After the importer, finishNodes closes open subpaths of filled shapes, drops shapes with coordinates beyond ten times the canvas, clamps the rest to one canvas either side, drops shapes wholly outside the canvas and applies the detail limits. Every step is written into a Report that the panels show under the buttons and the MCP tools return as `report`.

The model's SVG is wrapped in one unnamed layer group before importSvg, because the importer turns an SVG whose top level is all named groups into layers and drops their opacity and blend mode; with the wrapper each named group (and a Scene's Background, Midground and Foreground) arrives as a real group with its opacity, blend mode, strokes, evenodd rule and gradients. Linear and radial gradients, round and square caps, bevel joins and evenodd compound paths were checked to survive. Silhouette fitting in Shape Fill now stretches the art's bounds clipped to the viewBox plus 10 percent, so one stray element no longer shrinks the art.

### src/io/gen-repair.ts · seamless tiles
- refers-to: src/io/gen-repair.ts :: seamlessWrap, seamCheck; src/io/generative.ts :: patternVariations; src/engine/index.ts :: addPatternSwatches
- kind: rationale
- logged: v0.38.0 · 2026-10-16

The pattern renderer already draws neighbouring copies of a tile at reach 1, so motifs crossing an edge show correctly in a filled object, but the panel preview draws one tile and repeats it, so an edge motif showed as a cut. seamlessWrap adds a copy of each top-level motif that crosses an edge on the opposite side (corner motifs get three), skips full-tile backgrounds and skips translucent motifs, whose overlapping copies would double their alpha; the pattern engine still covers those. seamCheck then renders the tile and compares the first and last rows and columns against the average difference between neighbouring rows and columns, so a tile that is seamless reads near zero and a motif that sits on the edge without crossing it reads as a seam; it reports a number, with a 6 percent threshold, and it is a hint, not a gate. Pattern options reach the swatch: addPatternSwatches takes a type (grid, brick, hex), horizontal and vertical spacing per tile; the old call without them still makes a grid with no spacing.

## src/ui/panels/gen-options.ts

### src/ui/panels/gen-options.ts · the shared options block in the three panels
- refers-to: src/ui/panels/gen-options.ts :: GenOptionsUi; src/ui/panels/text-to-vector.ts; src/ui/panels/generative.ts :: ShapeFillPanel, PatternGenPanel; src/automation/agent-bridge.ts :: genCommon, shapeFillTool, textToVectorTool, patternsTool; backend/app/routers/mcp.py :: _GEN, _GEN_DETAIL
- kind: explainer
- logged: v0.38.0 · 2026-10-16

One class builds Detail, Style, Use Selection and Clear for the reference, four Effects checks, Color and Tone, a document swatch picker and an eight chip palette strip, once per panel. Nothing is added or removed after build: the picker has a fixed 52 px height and scrolls, the chips are eight fixed spans, the reference note reserves three lines and the report under the buttons is a fixed four line scroll box, so generating, picking swatches and reading a reference move nothing. The swatch picker is patched with patchList keyed by swatch id; clicking a swatch while another tone is chosen switches to Custom palette and starts from that swatch. The Text to Pattern panel's old Colors list (earth, forest, ocean, document, selection, custom text) became tones and the picker; earth, forest and ocean are tones too, document swatches are the picker, and the colours of a selection are the Style reference colours (Use Selection, then Color and Tone > Style reference colours).

The MCP tools take the same options: detail (integer 1 to 10 or low, medium, high), style_preset, style_reference (an object id), effects, color_tone and palette (up to 8); generate_patterns also takes seamless, layout, h_spacing and v_spacing. A bad value fails before any model call with the list of valid values. The existing names (detail low, medium, high; colors and preset on generate_patterns) are unchanged.

### src/engine/threed.ts · per-surface materials in the `surfaces` param
- refers-to: src/engine/threed.ts :: surfaceSpecs, surfaceResolver, SURFACE_CHOICES; src/engine/effects.ts :: surfaces, threeDFaces, traceHash; src/engine/raymesh.ts :: rayMesh; src/engine/raytrace.ts :: RaySurf; src/ui/panels/three-d.ts :: route
- kind: decision
- logged: v0.38.0 · 2026-10-16

Effect params are scalars, so the per-surface data is one JSON string param, `surfaces`, like `lights`: {"front": {...}, "sides": {...}}. Each entry holds material, color, roughness, metallic and the texture keys; a key a surface does not have follows the global param, an empty texture string means no picture. Absent or empty `surfaces` runs the old code unchanged: the resolver is null, the legacy face and ray paths are the same statements, and the trace cache hash only gains a suffix when a surface has a texture. That is how old documents stay byte-identical (ten legacy 3D cases hashed through exportSvg match a HEAD build exactly). Ids are front, back, sides, bevel for extrude (bevel quads are the rings on the front), outer, inner, caps for revolve, front for the flat plane, and g0, g1 for an imported model's groups. Vector mode paints each surface in its own flat colour; the ray tracer gets a per-triangle surface table (look, roughness and metallic, colour) and a per-triangle texture list, and a `flat` look for a surface that has only a colour override. The panel keeps one control set: route() redirects the material keys into the JSON while a surface other than All is picked, so nothing is added or removed and the panel does not shift. The MCP three_d tool takes `surface` and `color` and validates the id per kind. Clicking a surface on the canvas to pick it is not built; the panel picker is.

### src/engine/modelmesh.ts · imported 3D models as a mesh asset and the 3d.model effect
- refers-to: src/engine/modelmesh.ts; src/engine/threed.ts :: modelScene; src/engine/raymesh.ts :: modelRayMesh; src/engine/effects.ts :: 3d.model; src/engine/index.ts :: addModel
- kind: decision
- logged: v0.38.0 · 2026-10-16

An imported model is a normal path (a placeholder rectangle that gives the centre and size) carrying a `3d.model` effect, so it selects, moves, scales, rotates, undoes, saves and expands like any 3D object. The mesh itself is an asset in doc.images with the mime application/x-formpath-mesh: an FPM1 binary (positions f32, normals int16 snorm, optional uv f32, indices u16 or u32, group ids, a JSON group table), 11 KB for a cube and 1 to 2.5 MB for the 4 to 35 thousand triangle test models. A registry in modelmesh.ts decodes it lazily from Project.assets and repaints when it is ready, so reopening a .fpth restores the model without any other step. The file is named modelmesh.ts and not mesh.ts because engine/mesh.ts is the gradient mesh. Vector mode simplifies by vertex clustering to max_faces (default 4000, cached per mesh and budget), culls back faces (perspective aware, the Hide Back Faces box), shades flat triangles with averaged normals and sorts far to near; each face also gets a hairline in its own colour so seams do not show. The ray tracer uses the whole mesh up to 150,000 triangles. SVG and PDF export the vector faces, or an image when ray traced; the mesh blob is never base64-embedded in an SVG, so the SVG preserve round trip does not carry the model (use .fpth). Expand Appearance turns the vector faces into plain paths.

### src/io/obj.ts · OBJ and glTF parsers and the open and place glue
- refers-to: src/io/obj.ts :: parseObj, parseMtl; src/io/gltf.ts :: parseGltf; src/io/model.ts :: importModel, modelSiblings; src/app.ts :: splitParts, openModel, placeModel; src/automation/agent-bridge.ts :: siblings
- kind: decision
- logged: v0.38.0 · 2026-10-16

OBJ: v, vt, vn and f in all index forms, triangles, quads (split on the shorter diagonal) and n-gons (ear clipping), groups by usemtl else the g or o name, an .mtl for Kd, d and map_Kd. glTF and GLB: accessors with strides and normalised types, node transforms, triangle, strip and fan primitives, baseColorFactor (linear to sRGB) and a simple baseColorTexture with TEXCOORD_0. Draco and meshopt files are refused with a message; there is no dependency. Y up becomes Y down by (x, -y, -z), a rotation, so winding is kept; the model is centred and scaled to a maximum extent of 1, and winding is checked against the normals. Siblings (.mtl, .bin, texture images) travel with a multi-file choice: app.ts keeps them for 120 seconds, and the MCP tools read them from the model's folder (the engine service lists the mtllib, map_ and buffer and image uris and sends them as `parts`). place_image and open_file take the three extensions; width is the placed size in points. Not done: model per-surface textures (a model surface takes material, colour, roughness and metallic; pictures come from the file), textures above 1024 px in ray tracing are scaled down.

## src/io/dwg-write.ts

### src/io/dwg-write.ts · Native DWG writer (AutoCAD 2000), clean room
- refers-to: src/io/dwg-out.ts :: writeDwg; src/io/dwg-write.ts :: dwgFromDxf, exportDwg; src/app.ts :: exportAs, exportBlob, export-dwg; src/ui/app-dialogs.ts :: ExportFormat; src/automation/agent-bridge.ts :: export_file; backend/app/routers/mcp.py :: export_file
- kind: decision
- logged: v0.38.0 · 2026-10-16

Export > AutoCAD Drawing (DWG) and MCP export_file with a .dwg path write a binary AC1015 drawing. `exportDwg` builds the same DXF model the DXF exporter builds (so units, drawing_scale, outline_text and scale_lineweights behave as for .dxf) and `writeDwg` serialises it: bit-coded entities, a classes section, the header variables, the object map and handle stream, CRC16 on every section and object (seed 0xC0C1), and the two required tables, layers and text styles, plus the Model and a paper layout. Entities written: LINE, ARC, CIRCLE, ELLIPSE, LWPOLYLINE (with bulges), SPLINE, TEXT, HATCH (solid). Clean room: the layout comes from the ODA Open Design Specification as remembered, from byte-level analysis of sample .dwg files, and from LibreDWG used strictly as a black box (the dwgread trace, dwg2dxf and JSON output of the compiled program were read as output; no LibreDWG source, which is GPL, was opened, copied or ported). Checks: dwgread reports SUCCESS and dwg2dxf decodes every written type; a batch over 105 sample drawings (open, write, read back with dwg2dxf and ezdxf, compare per kind and layer) showed no count differences and a largest coordinate difference near 3.5e-15; the native reader reads the output back. dwgread warns "Object handle not found" for the HANDSEED value, which is the next free handle by definition and not an object. Not done: AutoCAD itself was not available to open the files; no INSERT or block definitions (blocks are exploded by the DXF model), true colours become the nearest ACI colour, no paper space VIEWPORT, the Model PLOTSETTINGS carries placeholder values, R13, R14 and R2004+ are not written, and `dxf_version` R12 is refused for .dwg.

### src/io/dwg-r2007.ts · Native R2007 (AC1021) container reader, clean room
- refers-to: src/io/dwg-r2007.ts :: readContainer, lz2007, codewords, sysPage; src/io/dwg-file.ts :: readSections; src/ui/app-dialogs.ts :: open dialog note
- kind: rationale
- logged: v0.38.0 · 2026-10-16

R2007 used to go to the converter. The container is not the R2004 page layout: the file header (3 codewords of 239 data bytes at 0x80), the page map and the section map are error-corrected blocks of 255-byte codewords interleaved across the block, and every data page is the same interleave with 251 data bytes per codeword, then a compression of its own (an LZ77 variant whose literal runs are copied in groups of 32 bytes with reversed 8-byte words and a tail cut in pieces of 8, 4 and 1 bytes). Parity bytes are skipped, nothing is corrected, so only undamaged files read. How it was worked out: byte-level study of 19 sample files, with four checks that must all hold before a rule was kept: the stored sizes, the CRC16 of every object, the object map, and the section map and Handles plaintext rebuilt from the LibreDWG trace of the same file (black box output only, no source). That settled the literal piece table (found by CRC search over the candidate orders), the F0 to FF opcodes that act as the long match only when the previous literal count was 0, and the 255 literal run extension that continues with 16-bit words. dwg.ts and dwg-header.ts needed no change: the R2007 string stream and header reading were already in place. Results: all 19 sample files have valid CRCs on every object; against reference DXFs from a converter the counts and coordinates per kind and layer agree with no coordinate mismatches, apart from objects the converter itself omits (Helix SPLINE; WIPEOUT, ARC_DIMENSION, ACAD_TABLE and VIEWPORT in example_2007). Unverified: raw (uncompressed) data pages and page-map entries with negative ids in a gap layout were not met in the samples.

### src/i18n/keys.json · strings for DWG export and the changed open note
- refers-to: src/i18n/keys.json; src/i18n/locales; src/ui/app-dialogs.ts; src/app.ts
- kind: rationale
- logged: v0.38.0 · 2026-10-16

Only the keys of this change were added (the DWG menu label, the dialog title and note, and the reworded open note) and the old "DWG R2007 is not read natively." and its open note were removed; `./formpath i18n import` filled the 25 locales and `i18n check` passes. Internal error messages stay in English, as elsewhere.

## src/ui/layers.ts

### src/ui/layers.ts · the Layers panel draws only the rows in view
- refers-to: src/ui/layers.ts :: LayersPanel, sync, paint, locate; src/styles/formpath.css :: .cv-lp-rows
- kind: decision
- logged: v0.39.0 · 2026-10-16

Opening Dynblocks.dwg (33,288 paths in 34 layers, all layers open) took 13 to 20 s in the window although the native parse takes 0.2 to 0.5 s. A profile of the open showed none of the import: the Layers panel built one row of eight elements for each of the 33,288 paths, and the Tabs strip then paid for it, because its render reads getBoundingClientRect on the tab strip, which forces a layout of the whole 33,000 row document (7.5 to 10.4 s of the profile; row creation was the other 2 to 5 s: setHtml, el, insertBefore). Phases before and after at 1400x900, in the window: parseDwg 0.2 s and dxfToDoc 0.2 s and addProject 0.01 s both times; the two frames after adoption 13.0 s before, 0.5 s after; first usable frame after confirming the open dialog 12 to 20 s before, 1.1 to 1.5 s after. The same cure applies to any large file: a 33,000 path SVG opened in 12.1 s and now 2.2 s, a 66,000 path flattened PDF opens in 1.9 s, a 33,000 path preserved PDF (30 MB) in 1.0 s, and the same drawing as a 9.8 MB DXF from the converter (27,919 paths) in 1.3 s. Counts are unchanged (34 layers, 33,288 paths, 33,335 nodes).

The panel still computes the flat row list for the whole tree, with a cumulative top per row (28 px for objects, 32 px for layers, the CSS heights), and paints only the rows between the scroll position minus and plus 420 px, in steps of 10 rows; padding-top and padding-bottom on .cv-lp-rows, set from the custom properties --pt and --pb, stand in for the rows left out so the scroll height and thumb are exact. A scroll event or a resize of the list repaints through requestAnimationFrame and does nothing when the window of rows has not moved; rows that stay in the window keep their elements, so nothing flashes and the 420 px margin means no blank row shows while scrolling. Locate Object, which used scrollIntoView on a row that may not exist, now finds the row in the flat list and sets the scroll position. If the CSS row heights change, ROW_H and LAYER_H change with them. The flat list also stopped lowercasing every label when there is no filter. Select All on 33,300 objects takes 0.75 s end to end; that path (ancestors for every selected id) is unchanged and is the next cost if it matters.

## src/io/pdf.ts (PDF/A marks)

### src/io/pdf.ts · printer's marks in PDF/A-2b are drawn in the RGB intent
- refers-to: src/io/pdf.ts :: regSpace, exportPdf; src/io/pdf-marks.ts :: marksContent
- kind: decision
- logged: v0.39.0 · 2026-10-16

The Registration colour of the marks was always [/Separation /All /DeviceCMYK ...] and the colour bars were written with the k operator, so a PDF/A-2b file with marks carried DeviceCMYK although its only output intent is sRGB, which PDF/A-2 forbids. Two ways out: refuse marks with PDF/A, or draw them in RGB. Illustrator itself offers no PDF/A preset (its Save as PDF presets are PDF/X), so there is no Illustrator behaviour to copy, and InDesign, which does export PDF/A, keeps Marks and Bleeds available as far as I recall (not checked against the product here). Marks are page content in the trim margin, not archival data, and refusing would take a working option away, so they stay: with the PDF/A rules (painter.rgbOnly) the Registration space is [/Separation /All /DeviceRGB ...] with tint 1 giving black, exactly as the Registration swatch already was when it is used in artwork under PDF/A, and the colour bars are written with rg from the plain (1-c)(1-k) conversion of their CMYK ink values. They are swatches for a press operator and an RGB intent has no press, so the conversion is not profile managed. Every other standard writes the same bytes as before. pdfstd_check.py (scratchpad) already flagged DeviceCMYK resources and k operators in a2b; it now also sweeps every object for a /DeviceCMYK name (nested separation alternates, forms, functions), and a PDF/A-2b with trim, registration, colour bars and page information all on passes with 0 CMYK operators, while an x1a file with the same marks is flagged by it as expected.

## src/io/dwg.ts (common entity handles)

### src/io/dwg.ts · commonHandles reads reactors and the extension dictionary before the entity links
- refers-to: src/io/dwg.ts :: commonHandles
- kind: decision
- logged: v0.39.0 · 2026-10-16

The Open Design Specification orders the common entity handles as owner (entity mode 0), reactors, extension dictionary (R2004 and later only when present, always counted for R13 to R2000), then for R2000 and earlier the previous and next entity handles (only when the no-links bit is 0), then layer, linetype, material and plot style. R2004 and later have no previous or next handles at all; the code already skipped them for versions other than 15. The code read the previous and next pair before the reactors; it now reads them after the extension dictionary. The values are not used, and the same number of handles is read either way, so the layer handle that follows was always the same one: all 104 sample drawings (2000, 2004, 2010, 2013, 2018 and the example and sample files) give identical per-layer entity counts, kind counts, block counts, layer tables and coordinate deviations before and after, and 22 of them have entities with reactors (the R2000 ones among them: Constraints, Leader, PolyLine2D, TS1 and example_2000, where 2, 6, 1, 5 and 14 entities carry both reactors and links), checked against reference DXFs from the converter used as a black box. So this is a correctness fix of the stream order with no change in any result today; it matters when something later reads those handles. Not verified: an R13 or R14 drawing, which the samples do not contain.

### src/io/dwg-file.ts, src/io/dwg-r2007.ts · section map counts are bounded
- refers-to: src/io/dwg-file.ts :: sysPage, r2004 (section info loop, load); src/io/dwg-r2007.ts :: readContainer
- kind: fix
- logged: v0.53.1 · 2026-11-10

The section maps were trusted: an R2004 to R2018 section-info entry with a page count like 0xFFFFFFFF pushed up to four billion page records, a system page, section or page size near 4 GB was allocated as asked, and an R2007 section-map name length of -64 walked the position back so the loop never ended; opening such a file froze the window. A page count that does not fit in the bytes left of the map, a system page over 64 MB decoded (the R2007 reader's limit), a section over 256 MB, a maximum page size over 16 MB and a negative or overlong R2007 name length now throw DwgError. Checked: tsc clean. Not run on a damaged or real R2004 or R2007 file (none in the repo; the writer writes R2000).

## src/engine/groupfx.ts (vector effects on groups, layers and type)

### src/engine/groupfx.ts · vector effects act on a group, layer or live type through one shadow node
- refers-to: src/engine/groupfx.ts :: fxNode, isGeomFx, hasGeomFx, fxBase; src/engine/render.ts :: renderNode; src/engine/bounds.ts :: visualBounds; src/engine/hit.ts :: deepHit; src/io/svg.ts :: node; src/io/pdf.ts :: node; src/io/eps.ts :: node; src/io/dxf.ts :: exportDxf; src/engine/ops/expand.ts :: expandFx; src/engine/index.ts :: expandNode
- kind: decision
- logged: v0.40.0 · 2026-10-16

Warp, Distort and Transform, Path, Round Corners, Scribble and Convert to Shape were evaluated only for path and compound nodes (effectPath in drawBody and in the four writers), so on a group, a layer or live type the effect was stored and did nothing. One function now answers for every output: fxNode(doc, n) returns a shadow of the node, or null when it has no geometry effect. For a group or layer the shadow is the same node with its children replaced by the effected art and the geometry effects removed from its appearance; for type it is a group of path nodes (one per run of equal fill and stroke, glyph outlines from textOutlineGlyphs) carrying each run's fill and stroke plus the type's own fill items, and the type's opacity, blend, mask and raster effects. renderNode, visualBounds, hit testing, the SVG, PDF, EPS and DXF writers and Expand Appearance each add one line that swaps the node for its shadow, so a document without such an effect takes the old code path and writes the same bytes (6 sample documents with path effects, plain and clipped groups, type, raster effects on groups and type, 3D, Pathfinder effects, repeat and envelope hash identically at 1x, 2x and outline canvases and in SVG, PDF, EPS and DXF before and after). The order is the Appearance stack's: a member's own effects first (effectPath), then the group's effects in their order, then the group's raster effects and opacity on the shadow, so a Drop Shadow on a warped group shadows the warped art. Pathfinder effects stay as liveArt computes them and the geometry effects run on that result; 3D effects keep their own face path (a node with a vector 3D effect is not shadowed). Results are cached per node identity, the text epoch and the symbol table; the per-member results are cached again per path identity, effect and frame, so dragging one member of a warped group of 20 recomputes one path unless the group's bounds change.

### src/engine/groupfx.ts · warps, Twist, Pucker and Bloat, Free Distort and Transform use the group's frame; the rest apply per member
- refers-to: src/engine/groupfx.ts :: SHARED, run, op; src/engine/effects.ts :: applyOne
- kind: decision
- logged: v0.40.0 · 2026-10-16

The effect's reference frame is the union of the geometric bounds of the group's effected members (for a clipping group only the clip path, since that is what the group's bounds are). Warps, Free Distort, Twist (whose radius is the farthest point of the whole group), Pucker and Bloat and Transform use that one frame so the whole group bends, tilts or puffs as one; Transform with copies repeats the whole group (every member, each keeping its paint) and a clipping group drops the copies, because its clip must stay the last child. Roughen, Tweak, Zig Zag, Round Corners, Scribble, Offset Path and Outline Stroke run per member with the group's parameters on the member's own bounds, so a Roughen size in percent means the same on a small member as on a large one; Roughen, Tweak and Scribble add 131 times the member's index to the seed so identical members do not jitter identically (member 0 equals the single path result). Convert to Shape collapses the group to one shape over the frame painted like the first member (an assumption: Illustrator paints it with the group's appearance). applyOne in effects.ts got two optional arguments, the frame and the points a Twist radius is measured around; with neither it computes what it always did, so path results are unchanged. The Illustrator behaviour for Pucker and Bloat on a group (group centre versus each member's centre) is from memory and was not checked against the product.

### src/engine/text.ts · textOutlineGlyphs
- refers-to: src/engine/text.ts :: textOutlineGlyphs, textOutlineRuns
- kind: decision
- logged: v0.40.0 · 2026-10-16

textOutlineRuns merges the glyphs of a run into one path, which is right for painting but wrong as the unit of an effect: a Roughen size relative to a whole word's bounds is huge for each letter. textOutlineGlyphs returns one path per glyph (outer contour and counters together) with its style and the effect code merges them back into runs after the effect. Underline and strikethrough are not part of the outlines, so effected type drops them; a gradient fill on effected type is laid over each run's own bounds instead of the whole text's.

### src/engine/ops/expand.ts · Expand Appearance on a group or type with geometry effects
- refers-to: src/engine/ops/expand.ts :: expandFx; src/engine/index.ts :: expandNode
- kind: decision
- logged: v0.40.0 · 2026-10-16

Expand Appearance on a group gives the group (same id) of the effected members, each then expanded as a path is (a fill path plus the outlined stroke, as Illustrator keeps paint and structure), with the geometry effects gone from its appearance and its raster effects, opacity and blend kept; on type it gives a new group of the effected run paths. The ids of Transform copies carry a ~fx marker inside the engine and are replaced by fresh ids when expanding. It is one history step (Expand). Checked on a warped group of three stroked shapes (group of 3 groups, 0 effects left, undo restores the group with its warp, 459 px of anti-aliasing difference against the live render) and on stroked, roughened type (1 step, 28 px).

### src/engine/groupfx.ts · what is not done
- refers-to: src/engine/groupfx.ts
- kind: todo
- logged: v0.40.0 · 2026-10-16

Images and gradient meshes inside an effected group stay as they are (the effect reaches vector members only). Live paint, tracing, shaper and intertwine groups are not shadowed. Hit testing of a Pathfinder-live group does not test the effected art, only a plain group, a layer and type do. Layers have no Expand Appearance. Appearance item effects on type (an effect on one of its fill items) still do nothing. Opacity masks of a member are copied to Transform copies unmoved. Export shows the effect as baked paths; PDF text with an effect is outlines, not live text. The existing difference between the canvas and PDF or EPS strokes for Outline Stroke on a single path (about 1100 px on a stroked rectangle) predates this and shows the same on groups.

### src/engine/ops/layers.ts · layer commands model
- refers-to: src/engine/ops/layers.ts; src/engine/index.ts :: layerSelection; src/app.ts :: layers-duplicate
- kind: decision
- logged: v0.40.0 · 2026-10-16

The Layers panel gets its own multi-selection, `Project.layerSel` (a set of layer ids), separate from the object selection and cleared by `select()`. Each operation is one `engine.edit` step. Merge Selected moves the contents of the other picked layers into the topmost picked one in stacking order. Flatten Artwork merges all visible layers into the bottom visible one and asks (`askForm`) when hidden art exists. Release to Layers (Sequence) puts each child on its own sublayer; (Build) clones the children cumulatively so the top sublayer holds all of them. Releasing a group turns it into a sublayer that keeps its opacity, blend, appearance, hidden and locked. A layer with look attributes (hidden, locked, clip, opacity, blend, appearance) is wrapped in a group by `carry()` when it is merged or flattened, so nothing visual is lost. The commands live in src/app.ts, not ui/commands.ts. The MCP tool is `layer_action`.

### src/io/raster-aa.ts · anti-aliasing None
- refers-to: src/io/raster-aa.ts; src/io/raster.ts :: renderRegion
- kind: decision
- logged: v0.40.0 · 2026-10-16

Canvas 2D cannot switch anti-aliasing off, so None renders at up to 8x (`hardScale`) and `reduceHard` point-samples the most uniform sub-pixel per output pixel; `hardEdges` is the fallback when the supersample would not fit. Type Optimized re-renders plain text only and lifts its coverage curve (`sharpenType`). Sub-0.25 pt hairlines stay unresolved under None; type sharpening skips text with effects, opacity, a mask or a clip.

### src/io/psd-write.ts · PSD composite
- refers-to: src/io/psd-write.ts; src/io/icc-embed.ts :: embedPsd
- kind: decision
- logged: v0.40.0 · 2026-10-16

The merged composite is stored pre-matted on white when it has alpha (readers un-matte it), CMYK is stored inverted, hidden layers use flag 2, names carry a 'luni' block, and each layer is trimmed to its bounds. ICC goes in as image resource 1039. GIF/PNG-8/BMP encoders live in src/io/{gif,png8,bmp,palette}.ts; the transparent palette entry is index 0.

### src/io/raster.ts · what is not done
- refers-to: src/io/raster.ts; src/ui/layers.ts
- kind: todo
- logged: v0.40.0 · 2026-10-16

PNG-8 has no interlace option. Deleting several picked layers at once is not wired to the panel selection. Merge, flatten and release do not carry layer attributes beyond opacity, blend, appearance, hidden, locked and clip.

### src/io/place.ts · one entry for Place, Place Linked, drops and Open
- refers-to: src/io/place.ts :: placeSpecial; src/ui/place-dialog.ts; src/app.ts :: placeFile
- kind: decision
- logged: v0.40.0 · 2026-10-16

`placeSpecial(engine, src, at, width, given, deps, fresh)` serves PDF, AI, PSD and TIFF. `given === undefined` shows the dialog; an object (the MCP path, or `{}`) never asks. `fresh` is Open: it makes a new document sized from the image at its resolution, leaves it unmodified, and does not use the CMYK profile. Each place is one `beginStep` and `endStep`. Embed of a PDF page is a group, wrapped in a clip group whose last child is the box rectangle for every crop except Bounding Box (which uses the art's visual bounds), so transparent margins cannot change the size. Legacy .ai (non-PDF) goes through readAiLegacy as embed only. The dialog has fixed-size thumbnail cells loaded lazily in a serial queue, so layout shift stays 0.

### src/io/pdf-read.ts · page options, box clipping and the session
- refers-to: src/io/pdf-read.ts :: readPdfVector; src/io/pdf-read.ts :: probePdf
- kind: decision
- logged: v0.40.0 · 2026-10-16

`PdfReadOpts { pages, box, session }` reads chosen pages only, against one `PdfSession` so the file is parsed once for the dialog, thumbnails and the final read. Media, Crop, Trim, Bleed and Art boxes are clipped to the media box (`within`) and MediaBox, CropBox and Rotate are inherited from the page tree; without the clipping a rotated page with an oversized CropBox did not match poppler.

### src/io/links.ts · Link is a raster, Embed is vector
- refers-to: src/io/links.ts :: LinkManager.read; src/io/place.ts :: displayBlob, linkScale
- kind: decision
- logged: v0.40.0 · 2026-10-16

A linked PDF, AI, PSD or TIFF is an image node showing a raster of the file (scale `linkScale`, 4x to 16x and at most 8192 px) because the engine has no placed-vector node. `ImageLink` keeps `page`, `crop` and `layers`; `LinkManager.read` wraps `readRaw` and converts through `displayBlob`, so Update and hydrate re-render the new file, and the stored scale is not reused (a page that changed size would give a huge raster). Embed is the way to get editable vector art. The Links panel Embed on a linked PDF only drops the link.

### src/io/psd-read.ts · reader decisions
- refers-to: src/io/psd-read.ts :: readPsdComposite; src/io/psd-read.ts :: readPsdLayers
- kind: decision
- logged: v0.40.0 · 2026-10-16

Clean-room, no dependency. Alpha of the merged image is taken from the first extra channel only when the layer count is negative (the spec rule), and then un-matted against white. 16-bit samples use round(v/257). Layer masks are baked into the layer alpha. Blend modes map through BLEND_KEYS; dissolve, linear burn, linear dodge, vivid, linear and pin light, hard mix, subtract and divide become Normal and are reported. Text layers come in as pixels and are reported; clipping masks, effects, adjustment layers and layer comps are not applied (adjustment layers are skipped and reported). The embedded ICC profile is not used to convert: psd-tools applies it by default, and with `apply_icc=False` 3 of 5 real Photoshop files matched exactly. 32-bit files throw a clear error.

### src/io/tiff-read.ts · reader decisions
- refers-to: src/io/tiff-read.ts :: decodeTiffPage
- kind: decision
- logged: v0.40.0 · 2026-10-16

Strips and tiles, chunky and planar, None, PackBits, LZW (predictor 2), Deflate and JPEG with JPEGTables (an Adobe APP14 marker is injected for RGB photometric so the browser does not treat it as YCbCr). Orientation is applied; resolution tags give the placed size, and no tags means 1 px = 1 pt. CMYK uses the document profile when set, else the plain formula. Palette conversion rounds v/257 where Pillow uses v>>8, hence a difference of 1. Not done: BigTIFF, old-style JPEG, CCITT, float samples.

### backend · restart the engine after this change
- refers-to: backend/app/routers/mcp.py :: place_image; backend/app/routers/batch.py :: READABLE
- kind: todo
- logged: v0.40.0 · 2026-10-16

place_image gained `page`, `crop`, `psd_import` and `link`, and the openable and placeable lists and batch READABLE gained psd, psb, tif and tiff. A running engine must be restarted to pick this up (a stale one refuses .tif with 422).

### src/io/ai-styles.ts · Art styles, live effects and style links from private data
- refers-to: src/io/ai-styles.ts :: parseStyles, resolveStyle; src/io/ai-legacy.ts :: buildDefs, Reader.flushHeld, Reader.exec (XW), styleNotices
- kind: decision
- logged: v0.41.0 · 2026-10-16

Learned from the real Illustrator CC 2017 private data (requests.ai) and the python-logo and webpack files. %AI9_BeginArtStyles holds `/KnownStyle : (name) /Name , /ActiveStyle : <filter> /Execution ;`; a filter is a tree (`/CompoundFilter :` Chain or Stack, `/BasicFilter :` leaves, each child closed by `/Part ,`), a leaf carries `(name) 0 0 /Filter ,`, `/Visible`, an optional `/Dictionary :` of `v /Real|Int|Bool (key) ,` pairs and paint blocks (`/FillStyle : ... /Def ; (sclr) ,`) that are ordinary AI operators, so they run through a Reader of their own. A Stack lists fills and strokes top first (formpath keeps them bottom first, so the list is reversed), Conduit marks where the object's own art sits, a Blend filter after a Fill or Stroke gives that item's opacity and blend and after a Stack the object's. %AI9_BeginArtStyleList names the styles that show in the panel; those become document graphic styles (the [Default] one is not copied, since formpath has its own). Effects mapped, with parameters from the dictionaries (all in points): Adobe Drop Shadow (blnd as BLEND index, horz, vert, blur, opac 0..1, sclr; csrc 1 means darkness and is read as the plain colour), Adobe Outer Glow (blnd, blur, opac, sclr), Adobe Fuzzy Mask as Feather (Radius), Adobe Round Corners (radius), Adobe Offset Path (ofst, mlim, jntp where only 2 = miter is confirmed; 0 round and 1 bevel are a guess), Adobe Transform (scaleH_Percent, scaleV_Percent, moveH_Pts, moveV_Pts, rotate_Degrees, numCopies, reflectX, reflectY; the vertical move sign is unverified because every real sample is zero), Adobe Stroke Offset as stroke alignment (StrokeOffsetInside) and Adobe Calligraphic Brush Tool after a Stroke as a link to a calligraphic brush (an existing brush with the same size, roundness and angle is reused). Inner Glow reuses the outer glow keys and is unverified. A brush filter that opens its chain (Chrome Highlight) has no stroke to attach to and counts as left out. An object that wears a style is written twice: first a legacy `1 (style) XW` then a group of expanded art, then `9 () XW` and the unpainted source path or compound (the `%_` lines), whose own `0 (style) XW` marks its appearance. The reader holds the expanded group, collects the unpainted paths that follow, and when the style maps completely replaces the group with the source path wearing the style (an effect-only style borrows the fills and strokes of the expanded art, and a gradient inside a style is relative to the object so the placed gradient of the expanded art is borrowed; with none to borrow the expanded art stays). A style with an effect that has no formpath equivalent keeps the expanded art and names the effect in the notices. Not learnable from the files at hand: how a symbol instance is written (no sample places one, so instances stay as artwork and are reported), how art, pattern and scatter brushes are attached to a stroke (no sample uses one), and the keys of Roughen, Pucker and Bloat, Zig Zag, Twist, Free Distort, Inner Glow and Gaussian Blur (no sample contains them, GitHub search is closed to this session and no other repository holding such a file was found). Notice strings in the reader stay plain English like the rest of this reader, because app.ts joins them into the toast.

### src/io/ai-private.ts · Illustrator private data in the .ai export
- refers-to: src/io/ai-private.ts :: buildAiPrivate; src/io/pdf.ts :: exportPdf (aiOn, pieceId); src/app.ts :: exportBlob (aiPrivate)
- kind: decision
- logged: v0.41.0 · 2026-10-16

Export > .ai now also writes what Illustrator keeps in a page's /PieceInfo /Illustrator /Private dictionary: /AIMetaData (the header comments through %%EndComments) and /AIPrivateData1..K, where block 1 holds %%BoundingBox, %%HiResBoundingBox and the %AI7_Thumbnail (8 bit, the fixed 256 colour palette, run length coded as FD count value) and the remaining blocks are 65536 byte slices of `%AI12_CompressedData` followed by one zlib stream of the AI text (CR line ends), with /ContainerVersion 11 /CreatorVersion 21 /RoundtripVersion 17 /RoundtripStreamType 1 as in Illustrator CC 2017 files. Every page points at the same dictionary, as in real multi artboard files. The streams are not Flate filtered in the PDF, because none of the 34 real files is (the brief said they were; the bytes say otherwise). Text order follows the real files: header, plug-in group list, gradients (Bd, ramps, Bs stops, BD), symbols (%AI14_BeginSymbol), art styles, palette (Pb, Pc, spot Xx with Lab alternates, PB), symbol list, %AI9_BeginDocumentData with the ArtboardArray, %%EndSetup, then the layers. Coordinates are y up with artboard 1's top left as the origin, so %AI3_Cropmarks of a 400 by 300 board is 0 -300 400 0 as in CC files. Layers use the 14 argument Lb (visible, preview, unlocked, printing, dimmed, 0, visible again, colour index, r g b, 0, 50, 0) with the 26 colours Illustrator hands out in turn; sublayers are nested %AI5_BeginLayer blocks inside the parent as in the real webpack-palette file; groups are u/U, clip groups u, q, content, clip path W n, Q, U, compound paths *u/*U, paths use O/R, g k Xa (seven numbers, CMYK then RGB) XA K G, Xs/XS for spot tints, Xy (blend, opacity, isolate, knockout, alpha), J j w M d, XR and f s b n; gradients are Bb, Bg, Xm, Bm, f, BB; rasters are the %AI5_BeginRaster form with hex data. Live type is written as outlines (a compound path filled with the first span's paint) because no real file here shows the AI11 text object, and the editable text stays in formpath's own embedded data, which the reader tries first, so formpath reopens its own .ai unchanged. Also written as plain art: symbol instances (expanded, not linked), effects (the base shape), brushes and width profiles (a plain stroke), opacity masks (omitted), extra fills and strokes beyond the first of each, hidden objects (omitted), freeform gradients (first stop colour) and pattern paints (50 percent gray). Object names go to the ArtDictionary key /XMLUID (the SVG id Illustrator derives from a name, _1_ suffixes for repeats), which is the only per object name record the real files show; the exact key for a name that differs from its id was not observed. The header says Adobe Illustrator 17.0 (the file format version that selects the private data layout) and %%For: (formpath).

### src/io/ai-private.ts · Illustrator itself was not available
- refers-to: src/io/ai-private.ts :: buildAiPrivate; src/io/pdf.ts :: exportPdf
- kind: warning-context
- logged: v0.41.0 · 2026-10-16

Illustrator was not available, so nobody has opened this output in it. What is checked: the PDF passes qpdf --check, renders with pdftoppm and opens in pypdf; the private blocks decode back with the same extractor that reads the 34 real files, the header, block layout and every operator used appear in the real corpus (only %%EndData and the thumbnail form are taken from the AI spec and the real thumbnails), and formpath's own legacy reader rebuilds the same layers, groups, clip group, compounds, gradient, spot swatch, symbol art and coordinates from the decoded text. What is unverified: whether Illustrator accepts the file or falls back to the PDF; the meaning of a few operators copied from real files (the 4 in `4 %_Br`, `Xm` beside `Bm`, the `0 AE`, `0 Xw` and `0 Ae` lines, the second Lb flag after the visible flag); the template layer flags (inferred, no real template layer in the corpus); the Bg leading flag for stroke gradients; the hex raster layout of XI (real files use binary); the document data dictionary being reduced to the artboards and two keys instead of Illustrator's full set; and whether Illustrator wants an /AIPrivateData block boundary at a specific place (real files cut at the %AI12_CompressedData marker and every 65536 bytes after, which is what is written).

### src/io/ai-private.ts · gradient ramp in Xm/Bm, symbol art moved per instance
- refers-to: src/io/ai-private.ts :: Emit.gradientInstance, Emit.moved
- kind: fix
- logged: v0.53.1 · 2026-11-10

Gradients went out with origin, angle and length on Bg and an identity Xm/Bm, but the reader (ai-legacy.ts Reader.exec 'Xm'/'Bm') takes that matrix as the unit ramp's map to the page, replacing Bg's frame, so a placed .ai showed every gradient from (0,0) to (1,0). Bg now has the unit frame (0 0, angle 0, length 1) and Xm and Bm the ramp `dx dy -dy dx x1 y1`, so a reader that concatenates and one that replaces get the same ramp; a zero-length ramp uses dx 1. `moved` overwrote the shared outline of a text in a symbol's art, so instance k carried k transforms, and left nested symbols, blends, envelopes and repeats in place; a text now gets its moved outline under a new key `id~n`, a nested symbol composes its matrix and other containers move their children (withChildren). Checked: tsc clean; a scratch check outside the repo reads the private text back with buildAi: the gradient spans the rect edge to edge, and two instances (1x and 2x) of a symbol holding a text have their outlines in place. Not opened in Illustrator.

### src/io/ai-modern.ts · PDF compatible .ai opened through its private data
- refers-to: src/io/ai-modern.ts :: readAiModern, aiPrivateText, modernText, aiArtboards; src/io/pdf-read.ts :: readAiPrivateBlocks; src/io/ai-legacy.ts :: buildAi; src/app.ts :: openFiles
- kind: decision
- logged: v0.41.0 · 2026-10-16

Learned from 35 real files (Illustrator 13 to 24 with creator versions 16 to 30.8.1, zlib and ZStandard) and no other reader. A PDF compatible .ai is opened by joining the page's /PieceInfo /Illustrator /Private /AIPrivateData1..K streams in numeric order (the dict's lexical order puts 10 before 2), then unpacking what follows %AI12_CompressedData (zlib, starts at once with 78 xx) or %AI24_ZStandard_Data (28 B5 2F FD at once, and in these files the header text is inside the frame; before 2020 the marker follows plain header text). There is never a line break after the marker. The text is cleaned by modernText before buildAi: the %AI17_Begin_Content_if_version_gt block keeps its first half and drops the Alternate_Content half (left in, the generic Begin handler skipped everything to the end of the file), the font encoding vectors in the setup that open [ and close with TE or TZ instead of ] are removed (left in, the tokenizer's open array swallowed every later operator), and nested %AI5_BeginLayer / %AI5_EndLayer pairs, which are sublayers, become u/U groups named by the new SL operator (name, visible, enabled) so the layer count equals %AI5_NumLayers. Artboards come from the document dictionary's ArtboardArray (Name, PositionPoint1 left and top, PositionPoint2 right and bottom, in art space; the plain names are not the RealPointRelToROrigin suggestion), else the single %AI3_Cropmarks rectangle; art space is y up with the ruler origin anywhere, so buildAi's existing offset by the leftmost artboard edge and topmost top edge places artboard 1 where the PDF page is, checked by pixel diff of each artboard against the PDF path (many files 0.0 percent). When assembly, unpacking or parsing fails or no art is found, the PDF reader opens the file and a toast gives the reason. Password protected files skip the private data and fall through to the PDF path's password prompt. The legacy path is untouched: readAiLegacy now calls buildAi with no overrides.

### src/io/ai-modern.ts · what the private data path still gets wrong
- refers-to: src/io/ai-modern.ts; src/io/ai-legacy.ts :: prepare (Raster), Reader.exec (XW)
- kind: todo
- logged: v0.41.0 · 2026-10-16

Binary %AI5_BeginRaster images are skipped ("Raster blocks"): prepare treats the block as a generic skip, and real files hold the pixels as raw bytes after %%BeginData that the line split corrupts; taking them from the PDF page's image XObjects was not built. Colours written as CMYK `k` in an RGB document come out brighter than the PDF's ICC rendering (the vue badge green). Some files render darker or black where the PDF is light (webpack palette, vue badge outlined, sindresorhus badge, godot jam header): appearance fills that the art stream leaves to the object's graphic style. Object names come only through the XW work in ai-styles.ts; placing (Place) still uses the PDF path for .ai files. NumLayers can exceed the layers found (godot logo 2017: 2 vs 1) because a template layer carries no BeginLayer block.

### src/io/pdf-read.ts · readAiPrivateBlocks
- refers-to: src/io/pdf-read.ts :: readAiPrivateBlocks
- kind: decision
- logged: v0.41.0 · 2026-10-16

New export that finds the page's (or the catalog's) /PieceInfo /Illustrator /Private dict, takes the AIPrivateDataN streams in numeric order, decodes each with the file's own filters (and decryption) and returns the joined bytes plus the page boxes. It reuses PdfFile and pageRecords, so object streams and the session cache are shared with readPdfVector; app.ts passes one PdfSession to both so the fallback does not parse the PDF twice.

### src/io/ai-legacy.ts · buildAi split and sublayer groups
- refers-to: src/io/ai-legacy.ts :: buildAi, Reader.exec (SL), Ctx.sub, closeCtx
- kind: decision
- logged: v0.41.0 · 2026-10-16

readAiLegacy's body after the text is found became buildAi(text, title, early, opts) so the PDF compatible reader feeds it assembled text, optional artboard boxes and names; with no opts it behaves as before (the Artboard n names and tile box fallback are unchanged). latin1, inflate and findZstd are exported for ai-modern.ts. The SL operator exists only in text that modernText wrote: it names the group a nested layer became and carries hidden and locked into closeCtx.

### src/app.ts · openFiles tries the private data first for .ai
- refers-to: src/app.ts :: openFiles (.pdf and .ai branch)
- kind: decision
- logged: v0.41.0 · 2026-10-16

After the legacy and native checks, a .ai goes through readAiModern with a shared PdfSession; the toast reports layers and artboards, what was brought in and what was left out. A failure falls through to readPdfVector and adds one toast with the reason and "Opened through its PDF page instead." The new strings go through t() inside ai-modern.ts; the i18n extract has not been run for them.

### src/io/ai-guard.ts · Private data result checked against the file's own PDF page
- refers-to: src/io/ai-guard.ts :: guardAi; src/app.ts :: openFiles (.ai branch)
- kind: decision
- logged: v0.41.0 · 2026-10-16

After readAiModern succeeds, guardAi reads the same file's PDF pages with readPdfVector (same PdfSession, so the parse is shared), renders each artboard of both documents offscreen through renderRegion at about 256 px on the long side on white, and counts the share of pixels where any channel differs by more than 40. If any artboard exceeds 12 percent (or the private data has fewer artboards than the PDF has pages) the already read PDF result is adopted with the notice "The Illustrator data did not match the page, so the file opened through its PDF page."; the decision and per board diffs go to console.debug only. The 12 percent line sits in the gap of the 35 file corpus: files that look right measured at most 11.5 percent on any board (and 2 to 10 percent after the colour fixes), files with missing or wrong art measured 15 percent and up. A PDF page that renders blank (under 0.2 percent inked pixels) counts as no evidence, because that is a PDF reader failure more often than a wrong private read. The guard is skipped, with the private data kept, for documents of more than 20,000 objects (none in the corpus; the largest has 9,483), and when the PDF page cannot be read. Added open time: a few ms to about 250 ms for typical files, but about 3.7 s for the 9,483 object, 5 artboard KubeCon file, where the cost is the PDF vector read and the renders. Known weakness: the comparison trusts formpath's own PDF reader; where that reader misses art (babel opens with only one of its two layers) a right private read can fail the guard.

### src/io/ai-private.ts · distinct TileBox, no versioned content block
- refers-to: src/io/ai-private.ts :: buildAiPrivate (header)
- kind: decision
- logged: v0.41.0 · 2026-10-16

%AI3_TileBox is now the printable tile, not a copy of the crop marks: in the real files it is the Letter page minus margins (593.28 by 773.28, or 773.28 by 593.28 for a landscape board) centred on artboard 1, so the writer emits that. The %AI17_Begin_Content_if_version_gt wrapper around %AI9_OpenToView is gone: the content it holds is a plain view record that older readers also accept, so nothing is written in a versioned block. ArtboardArray already carried every exported artboard and reads back whole (two artboards, names and positions checked); nested %AI5_BeginLayer blocks match the real webpack form and read back as a named group inside the parent layer (an unpainted path inside a sublayer is dropped by the reader, which is correct). Still lost on reopen through private data: raster images ("Raster blocks" skipped by the reader), symbol links (placed art only), object names and the type object (outlines).

### src/io/ai-modern.ts · binary rasters lifted before the line work
- refers-to: src/io/ai-modern.ts :: liftRasters, readAiModern; src/io/ai-legacy.ts :: prepare, Reader.takeData, rasterPng
- kind: decision
- logged: v0.41.0 · 2026-10-16

Learned from 20 real files. A modern raster is %AI5_File:, %AI5_BeginRaster, `() 1 XG`, `/DeviceRGB|CMYK|Gray XN`, `[m] w h 0 Xh`, the XI argument line `[m] 0 0 w h w h bits type alpha reserved bin ...` and then `%%BeginData: N` followed by `XI`, a line feed and the pixels, %%EndData, XH, %AI5_EndRaster. XI sits inside the data, not on the argument line, so prepare now pushes an XI after a BeginData. N counts XI, the line feed and the colour bytes only: when the XI line says alpha is present (webpack, python-logo-mods, fastlane) a plane of w*h alpha bytes follows after N, planar and not interleaved, so liftRasters looks for %%EndData from N on instead of trusting N as the end. The pixels are cut out of the text before modernText splits lines (a CR or LF byte would corrupt them) and handed to buildAi as opts.rasters by index (an @BIN n line stands in for them). Row padding is whole bytes (1-bit 456 wide is 57 bytes a row); 8-bit gray, RGB and CMYK are decoded, CMYK through cmToRgb like the other colours. Image space is x right and y up with the image hanging below its origin, so the placement is the XI matrix times a flip about y 0 (the old flip about h placed every image one height too high; checked by overlay against the PDF page on the webpack palette). A raster written inside an %_ dictionary is an opacity mask (Mask, Clipping, Linked): its payload is dropped and "opacity mask images" is reported. Rasters inside brush pattern blocks (requests, vue, ansible, rust) stay with the brush skip. Not done: the PDF image XObject fallback for rasters whose pixels are absent (every file here has them, and no linked `(path) 1 XG` occurs in any sample), and opacity masks are not applied.

### src/io/ai-legacy.ts · object names from XMLUID
- refers-to: src/io/ai-legacy.ts :: xmlName, Reader.exec (: and ;), Reader.lastNode, prepare (Raster, XI)
- kind: decision
- logged: v0.41.0 · 2026-10-16

Illustrator keeps an object's name only as /XMLUID : (id) ; (AI10_ArtUID) in the %_/ArtDictionary written right after the object's closing operator (f, n, U, *U, Q or N), so the reader remembers the last node it placed (lastNode, cleared at a layer, a group open, a sublayer, a compound member and a close with nothing to add) and names it when the ; arrives. Layers and sublayers keep their Ln name, since their XMLUID follows Ln. xmlName reverses the derivation: a trailing _N_ repeat suffix is dropped, _xHH_ escapes are decoded (an A0 becomes a space), underscores become spaces, and the machine ids XMLID_000... are ignored. The result is lossy where a name held a real underscore. A name already set (sublayer) is not overwritten. Sublayer names from Ln still show UTF-8 bytes as latin1 (a non-breaking space reads as a capital A circumflex), not fixed. prepare no longer treats %AI5_BeginRaster as a generic skipped block, and `() 1 XG` (an embedded image) no longer reports linked images.

### src/io/place.ts · placing .ai embedded uses the private data
- refers-to: src/io/place.ts :: placeSpecial (pdf branch)
- kind: decision
- logged: v0.41.0 · 2026-10-16

An .ai placed embedded now goes through readAiModern first and becomes one group named after the file holding one group per layer (hidden layers stay hidden), scaled to the requested width like the legacy placement; when the private data is absent or fails, the notes carry the reason and the PDF page path runs as before. Linked placement is untouched and stays the PDF page picture. The page and crop choices do not apply to the private data path, which places all layers' art at its bounding box.

### src/io/ai-legacy.ts · modern art that rendered wrong against the PDF page
- refers-to: src/io/ai-legacy.ts :: prepare (layerIn, %_ lines), parseGradient, Reader.exec (Bg, Xm, Bm, u, U)
- kind: decision
- logged: v0.41.0 · 2026-10-16

Six causes found by rendering the private data and the PDF page of the same file and reading both. (1) Inside a layer, `%_` lines that are not dictionary entries (not starting with `/`, `;`, `:` and not an /Int, /Real... entry) are the editable source of the object above (a compound shape part or live effect input, drawn black or in a placeholder colour) and are now dropped; the plain lines already drew the result. This was the black webpack palette, the dark badge and the doubled shapes; outside layers `%_` still reads as before, so legacy files, which carry none in their art, are unchanged. (2) A `u` inside a `*u` compound (babel writes the member paths of one compound in several u/U runs) opened a group the paths then went into, leaving only specks in the compound; it is now counted on the compound (Ctx.inner) and the paths stay members. (3) Gradient stop lines read `c m y k r g b 2 opacity 6 mid ramp`: the colour test wanted exactly eight numbers before mid, so these stops were taken as CMYK (the bright Jupyter blue) and the opacity after the type (0.1 in the awesome badge, whose overlay gradient is nearly clear) was ignored; the test is now eight or more and the opacity is read. (4) Bg took its last ten numbers, which in modern files include the trailing 1; it now takes the numbers after the name. (5) When Xm or Bm follows Bg, that matrix maps the ramp's unit space (0,0 to 1,0) to the page, as the PDF shading's cm matrix shows (the Jupyter Python matrix a and b are identical to it), so the origin, angle and length from Bg are replaced by 0 0 0 1 and the matrix is used as is; with neither (legacy files) Bg's own numbers still drive it. (6) The remaining CMYK colour gap is not in the parser: the PDF path gives the document the file's embedded CMYK ICC profile (assignPdfProfile in app.ts) and the private data path does not, so CMYK `k` paint is shown naive; applying it in the harness took the vue badge from 14.0 to 0.9 percent, the outlined badge from 51.1 to 0.0 and the vue logo from 11.8 to 0.0.

### src/io/ai-legacy.ts · what still differs from the PDF page
- refers-to: src/io/ai-legacy.ts :: paintWith, flushHeld; src/io/ai-modern.ts; src/app.ts :: openFiles
- kind: todo
- logged: v0.41.0 · 2026-10-16

Open: the godot jam header (a compound path of text outlines whose gradient fill comes out across the whole board, and an outer rectangle among its members), the godot jam icon, the kubernetes do-not-use ribbon (the blue ribbon and its text are missing and the rope pieces carry a black stroke), and a few percent on the CNC stacked logos, fastlane pilot and requests logo. app.ts and ai-modern.ts need to call assignPdfProfile on the private data document as the PDF branch does, and the guard in ai-guard.ts compares documents without that profile, so it overstates the difference for CMYK files.

### src/io/ai-guard.ts · both sides of the guard carry the file's CMYK profile
- refers-to: src/app.ts :: openFiles (.ai branch); src/io/ai-guard.ts :: guardAi
- kind: decision
- logged: v0.41.0 · 2026-10-16

Done for the todo above: the .ai open path now calls assignPdfProfile on the private data document before the guard, and the guard tags the PDF page document the same way before rendering, so CMYK paint is converted through the file's own profile on both sides. On the 36-file corpus that leaves 33 files on the private data (worst artboard 0 to 7.7 percent) and three on the PDF page (godot jam header 81.9, godot jam icon 15.0, kubernetes do-not-use 16.6). Because the PDF page document comes back already tagged, the PDF branch's own assignPdfProfile finds a profile set and returns no name, so after a guard fallback the "it is now this document's CMYK working space" toast does not show; the profile is still applied.

### src/io/place.ts · placing one artboard of a multi-artboard .ai
- refers-to: src/io/place.ts :: placeSpecial (.ai embedded through private data)
- kind: decision
- logged: v0.42.0 · 2026-10-16

The sixth audit found that placing page 2 of a multi-artboard .ai through its Illustrator data brought in the whole file, the same 444 paths for every page. The private data branch now keeps, per layer, only the top-level objects whose visual bounds overlap the chosen artboard (the private data's artboards are in the same order as the PDF pages). The CNCF Green Reviews file now places 148, 74 and 148 leaf objects for pages 1 to 3. An object that straddles two artboards comes with both, as Illustrator's own Place of a page crops it rather than splitting it; it is not clipped to the artboard.

### src/io/icc-embed.ts · PNG and JPEG record the export ppi
- refers-to: src/io/icc-embed.ts :: stampPpi; src/io/raster.ts :: canvasBlob
- kind: decision
- logged: v0.42.0 · 2026-10-16

The sixth audit found that PNG and JPEG exports carried no resolution, so 300 ppi was only a pixel scale. canvasBlob now writes the ppi it is given (exportRaster always passes 72 times the scale) into a pHYs chunk in pixels per metre for PNG and into the JFIF APP0 density in dots per inch for JPEG, inserting an APP0 if the browser wrote none. PIL reads a 300 ppi export back as 299.9994 (PNG, metre rounding) and 300 (JPEG). WebP has no standard resolution field and is left alone; GIF, PNG-8, BMP, TIFF and PSD already wrote theirs.

### src/ui/panels/color.ts · Gradient panel Method row

- refers-to: src/ui/panels/color.ts :: method; src/styles/formpath.css :: .cv-gradp-method; src/engine/paint.ts :: paintFromInput, describePaint
- kind: decision
- logged: v0.43.0 · 2026-10-16

The Classic and Perceptual choice already existed in the Gradient panel as an unlabelled segmented control, which an audit missed. It now sits in a row labelled Method with a tooltip. Adobe's public Photoshop help page on gradient interpolation names the options Classic, Perceptual (OKLab) and Linear (linear colour space); the Illustrator pages for perceptual interpolation could not be read (their body is script rendered), so the label follows the Photoshop wording. Linear is not offered because the engine has no linear-light mix; the stored value 'linear' means Classic. paintFromInput takes a `method` of classic or perceptual for agents and describePaint reports the perceptual method.

### src/io/eps.ts · perceptual gradients in EPS and .ai

- refers-to: src/io/eps.ts :: fnFor; src/io/ai-private.ts :: gradientBlock
- kind: decision
- logged: v0.43.0 · 2026-10-16

EPS dropped Gradient.blend (it wrote only the stops, so a perceptual gradient came out Classic); fnFor now takes the 16 extra stops per segment from perceptualStops like SVG and PDF. The .ai writer stores each stop pair as a 256 sample ramp per channel, which was a straight line between the two stop colours; for a perceptual gradient each sample is now the OKLab mix of the pair (CMYK derived from the mixed colour), so the Illustrator gradient definition carries the curve. Illustrator itself was not available to open the result.

### src/ui/layers.ts · layer rows placed by transform

- refers-to: src/ui/layers.ts :: Row.y, paint, fill; src/styles/formpath.css :: .cv-lp-rows, .cv-lrow
- kind: decision
- logged: v0.43.0 · 2026-10-16

Opening the panel menu moved nothing (it is a fixed overlay), but every command that inserted a layer row above others (New Sublayer, Duplicate Layer, a new layer) shifted the rows below because they sat in a flex column under a padding spacer, which the layout-shift API counts. Rows are now absolutely placed with translateY from the known row offsets and the container has an explicit height, so row movement is a transform and not layout.

### src/engine/snap.ts · snap to path and intersection, spacing tags

- refers-to: src/engine/snap.ts :: snapPath, snapIntersect, nearSegs, closestOn, crossings, SnapTargets.segGrid, snapRect (tags, SnapOpts.spacing)
- kind: decision
- logged: v0.43.0 · 2026-10-16

The audit was right about path and intersection, but equal spacing and the dX/dY and W/H labels already existed (snapRect spacing, the tool HUDs) and fire in real drags. collectTargets now indexes every visible segment (up to 60000) in a 64 pt cell grid, with segments that span more than 256 cells in a side list, so a query only looks at the segments whose box holds the pointer within the tolerance. snapPoint tries anchors and centres first, then intersections of the nearby segments (flattened to 12 pieces, refined with Newton on the real curves; a line is linear in its own parameter, not the cubic's, which the first version got wrong and put the point 8 pt off), then the guide rules, and last the nearest point on a path. snapRect now also returns a tag per equal gap so the stage can write its distance. Measured with 2000 paths: building the targets takes about 22 ms once per drag and a query 0.02 ms, and drag frame time is the same with Smart Guides on or off.

### src/ui/stage.ts · smart guide overlay and moved-object reference point

- refers-to: src/ui/stage.ts :: snapRaw, snapBoxRaw, drawSmart; src/engine/index.ts :: overlay.tags, ViewFlags.smartLabels, smartMeasure, smartHighlight, smartSpacing; src/extensions/registry.ts :: ToolContext.snapRect
- kind: decision
- logged: v0.43.0 · 2026-10-16

ctx.snapRect takes an optional reference point (the pointer). When the box finds no guide or spacing snap, a moved selection puts that point on an intersection or on the nearest path, drawing the highlighted segment and the label. The overlay gains tags (distance pills on the equal-gap markers, written in document units). Labels, highlighting and spacing guides follow four view flags set from the Preferences; View > Smart Guides gates all of them. Tools that draw from a click now also show the snap on hover (shape tools), so the guide is visible before the press.

### src/tools/util.ts · measureHud

- refers-to: src/tools/util.ts :: measureHud; src/tools/select.ts, draw.ts, graph.ts (overlay)
- kind: decision
- logged: v0.43.0 · 2026-10-16

measureHud wraps hud for the dX, dY, W and H readouts of moving, resizing and drawing, so they obey View > Smart Guides and the Measurement Labels preference. Rotation and the other tools keep the plain hud.

### src/ui/prefs.ts · Smart Guide preferences

- refers-to: src/ui/prefs.ts (smartLabels, smartMeasure, smartHighlight, smartSpacing); src/ui/app-dialogs.ts (Selection & Snapping); src/app.ts (applyUiPrefs)
- kind: decision
- logged: v0.43.0 · 2026-10-16

Four checkboxes in Preferences > Selection and Snapping: Anchor/Path Labels, Measurement Labels, Object Highlighting and Spacing Guides, all on by default and tolerated when missing from older saved preferences. applyUiPrefs copies them onto the engine view flags only when they differ, so the stage and tools read one place.

### src/tools/freehand.ts · Scissors, Knife and Eraser pools, Alt and Shift+Alt
- refers-to: src/tools/freehand.ts :: leaves, strokeReach, straightLine, eraserMarquee, scissors, knife, eraser
- kind: decision
- logged: v0.43.0 · 2026-10-16

An audit reported that the Scissors click and Knife drag changed nothing. Driven with real mouse input at 50, 100 and 400 percent and with the artboard scrolled, both cut correctly on rectangles, ellipses, stars and lines, so that report came from the audit's own coordinates; the real faults were elsewhere. Scissors went through `engine.hit`, which returns the topmost fill, so an edge under another filled shape was missed, and it ignored compound paths; it now scans every visible unlocked leaf for the nearest segment within 5 screen pixels, snaps to an anchor inside that radius, and leaves the cut ends as selected anchors. Knife and Eraser took the selected group itself as a target, which fused its children into one shape (Knife) or did nothing (Eraser); `leaves` now expands groups and layers to their paths and compounds, and compound children are never handled alone. Knife had no Alt: Alt now cuts a straight start to end line and Shift+Alt snaps it to 45 degrees; Eraser with Alt erases the dragged rectangle. Eraser bounds are widened by half the stroke width so a thick stroke near the edge is reached.

### src/engine/ops/paths.ts · eraseRegion on open and stroke-only paths, scissorsCut on compounds
- refers-to: src/engine/ops/paths.ts :: eraseRegion, outsideRegion, scissorsCut, cutSub
- kind: decision
- logged: v0.43.0 · 2026-10-16

`eraseRegion` skipped every path with an open subpath and subtracted the eraser from stroke-only closed shapes as if they were fills, which turned a ring outline into a solid. Filled closed shapes still use the boolean subtract (and are now left alone when the eraser misses them); everything else is cut along the outline: each subpath is split where it crosses the eraser, with the eraser grown by half the stroke width, and pieces whose midpoint lies inside are dropped, so open lines and stroke-only shapes become open pieces that keep their appearance. `scissorsCut` shares `cutSub` for paths and for the subpaths of a compound path, removes the handle that pointed across the cut at both new ends, and returns the document unchanged when the cut lands on an open path's end, so no empty history step is made.

### src/engine/ops/paths.ts · eraseSegments keeps untouched paths
- refers-to: src/engine/ops/paths.ts :: eraseSegments; src/tools/freehand.ts :: pathEraser
- kind: fix
- logged: v0.53.1 · 2026-11-10

`eraseSegments` rebuilt every subpath as an open path on every call, so any Path Eraser drag, even over empty canvas, committed an Erase Path step that opened every selected closed path (with a doubled end anchor) and split a multi-subpath path into one node per subpath, losing an evenodd hole. A subpath with no erased segment is now kept as it is, nothing erased returns the document unchanged (the tool then cancels the drag), and a closed subpath is walked from its first erased segment so the run that wraps past the first anchor stays one piece. Checked with tsc and a node check on a copy of the loop: empty canvas, an erased edge and an erased closing segment of a rectangle.

### src/engine/ops/paths.ts · eraseSegments tests the curve midpoint
- refers-to: src/engine/ops/paths.ts :: eraseSegments
- kind: fix
- logged: v0.53.1 · 2026-11-10

The eraser test used the midpoint of the chord between a segment's anchors, which for a curve lies off the curve (70.7 from the centre on a quarter arc of radius 100), so dragging inside an ellipse deleted arcs the eraser never touched. The test point is now `bezPoint(s, 0.5)`, the same point as before on a straight segment. Checked with tsc and a node check of bezPoint on a quarter arc and a line.

### src/engine/index.ts · default type fill
- refers-to: src/engine/index.ts :: fillPicked, typeFill, setFill, defaultFillStroke, newDocument, addText; src/tools/type.ts :: activate
- kind: decision
- logged: v0.43.0 · 2026-10-16

New documents were created with whatever fill the previous document left, and `addText` used the current fill, which is white at start, so type made without choosing the Type tool (agents, scripts) was invisible on a white artboard. Shapes already matched Illustrator (white fill, black 1 pt stroke) and stay as they are. `newDocument` now resets the current fill and stroke to that default and clears `fillPicked`; `setFill` sets it and `defaultFillStroke` clears it. `typeFill` gives type black when the current fill is none, or white-ish while the user has not picked a fill, and the user's fill otherwise; the stroke of new type is always none. The Type tool's activate keeps a picked fill instead of forcing black over it. Opened files and existing documents are untouched.

### src/ui/three-d-widget.ts · on-canvas rotation widget
- refers-to: src/ui/three-d-widget.ts :: ThreeDWidget; src/app.ts; src/engine/threed-view.ts
- kind: decision
- logged: v0.44.0 · 2026-10-16

The widget is a stage painter plus capture-phase listeners on the overlay canvas, so stage.ts is untouched: a pointer that lands on a ring or inside the sphere is swallowed before the Selection tool sees it, anything else passes through, and Alt passes through too so Alt-drag still copies. It shows for one selected object with a 3D effect while the Selection or Direct Selection tool is active. The rings are the Euler axes themselves (X world, Y after rx, Z after rx and ry), so a ring drag changes exactly one of rx, ry, rz and the panel fields stay honest; the rings are drawn through a fixed display tilt so none is edge-on, and a ring that is still near edge-on falls back to 0.5 degrees per pixel. Dragging inside rotates freely (rx and ry), Shift snaps to 15 degrees, double-click sets 0, 0, 0. A drag opens one engine gesture on its first 3 px of movement and writes through set3d once per animation frame, so it is one undo step. During the drag the scene uses the draft tessellation (below) and on release the final values are written with draft off so the cached faces are full quality.

### src/engine/threed.ts · draft tessellation
- refers-to: src/engine/threed.ts :: setSceneDraft, scene3dWith, modelScene
- kind: decision
- logged: v0.44.0 · 2026-10-16

Interactive rotation needs vector faces fast, so `setSceneDraft(true)` coarsens flattening (tolerance size/70 against size/300), uses one bevel step for rounded bevels, 20 instead of 48 revolve steps per turn, and at most 1500 model faces. Shading stays the same (no flat-shading fallback) so the colours do not jump on release. Ray tracing keeps its own draft through beginGesture. The flag is module state set by the widget and the panel preview only around a drag or a preview draw; it is never saved and never reaches export.

### src/engine/threed-view.ts · rotation helpers
- refers-to: src/engine/threed-view.ts :: ringBases, ringAngle, freeRotate, lightFromOffset
- kind: decision
- logged: v0.44.0 · 2026-10-16

Pure maths for the widget and the preview, no DOM. ringAngle solves the pointer against the ring's two projected basis vectors and returns null near edge-on, where the callers use a linear fallback. Drags accumulate per-event angle deltas rather than an absolute angle, so switching between the two methods mid-drag does not jump. freeRotate maps a pointer delta to rx and ry at 0.5 degrees per pixel (dragging right turns the front face right). lightFromOffset and lightOffset map a light's rotation and height to a point in the preview disc: radius is cos(height), so height 90 sits at the centre.

### src/ui/panels/three-d-preview.ts · panel preview
- refers-to: src/ui/panels/three-d-preview.ts :: ThreeDPreview; src/ui/panels/three-d.ts
- kind: decision
- logged: v0.44.0 · 2026-10-16

A fixed 232 by 156 canvas at the top of the 3D panel form, reserved with the form so nothing shifts. It renders the selected object through threeDFaces on a clone with the local rotation and lights and the draft tessellation, ray tracing off, and fits it to the box. Dragging orbits (Shift snaps), dragging a light handle changes that light's rotation and height, double-click resets rotation; the preview alone updates during the drag and the document is written once on release, one undo step. A press on a handle also selects that light in the panel. The panel hides the preview with the form when no 3D effect is selected.

### src/ui/panels/three-d.ts · preview wiring
- refers-to: src/ui/panels/three-d.ts :: ThreeDPanel.view
- kind: decision
- logged: v0.44.0 · 2026-10-16

The panel owns a ThreeDPreview as the first child of the form and calls its sync at the end of every sync, passing the selected node, its 3D effect and the active light index. Picking a light handle in the preview sets lightAt and queues a sync.

### src/styles/formpath.css · 3D preview box
- refers-to: src/styles/formpath.css :: .cv-3dp-view, .cv-3dp-canvas
- kind: decision
- logged: v0.44.0 · 2026-10-16

The preview box has a fixed height (156 px) and a canvas of fixed intrinsic size, with touch-action none so a touch drag orbits instead of scrolling the panel. No z-index is used.

### src/app.ts · 3D widget mount
- refers-to: src/app.ts :: ThreeDWidget
- kind: decision
- logged: v0.44.0 · 2026-10-16

One line after the Stage is created attaches the rotation widget to the stage painters and the overlay canvas.

### src/app.ts · File > Place and drop keep file handles
- refers-to: src/app.ts :: useHandles, placePicked, placeHandled, linkHint, placeDeps, chooseLinkFile, relinkFolder, unembed, drop handler; src/io/links.ts :: pickPlaceFiles, dropHandles
- kind: decision
- logged: v0.44.0 · 2026-10-16

`caps` is set whenever the engine service answers, not only on the desktop, so a web page with a local engine used to take the server-side path dialog for every link and File > Place (a plain input) never linked at all. `useHandles` (File System Access API present and not the desktop shell) now routes Place, Place Linked, Relink, Relink Missing from Folder and Unembed through showOpenFilePicker, showDirectoryPicker and showSaveFilePicker, and drop reads DataTransferItem.getAsFileSystemHandle synchronously in the drop event. Raster images placed this way are linked by default; PDF, PSD and TIFF reach the Place dialog with Link available. Where the picker or a handle is missing, the dialog now says why before placing (PlaceSpec.linkHint). The desktop keeps its path route unchanged.

### src/io/links.ts · picker for Place, drop handles, .psb
- refers-to: src/io/links.ts :: pickPlaceFiles, dropHandles, linkable, IMAGE_KINDS, FileHandle
- kind: warning-context
- logged: v0.44.0 · 2026-10-16

`dropHandles` must be called synchronously from the drop event because DataTransferItems are dead after the first await. Only linkable kinds keep a handle in IndexedDB; SVG, EPS and models come back as plain files. Playwright cannot drive showOpenFilePicker (the filechooser event does not fire; the call rejects with AbortError), so the browser tests replace the pickers with OPFS handles, which are real FileSystemFileHandles; real permission prompts are therefore untested.

### src/ui/place-dialog.ts · link hint
- refers-to: src/ui/place-dialog.ts :: sync; src/io/place.ts :: PlaceSpec.linkHint
- kind: decision
- logged: v0.44.0 · 2026-10-16

When Link is not offered the note shows `linkHint` (browser without the API, or a file that arrived without a handle) instead of the fixed Place Linked sentence, so the person knows before pressing Place.

### src/io/place.ts · PlaceSpec.linkHint
- refers-to: src/io/place.ts :: PlaceSpec
- kind: decision
- logged: v0.44.0 · 2026-10-16

PlaceSpec carries an optional `linkHint` set by the app wrapper around the ask function; placeSpecial itself is unchanged.

### src/io/psd-vector.ts · editable PSD blocks
- refers-to: src/io/psd-vector.ts :: typeBlock, vectorMaskBlock, solidBlock, gradientBlock, strokeBlock, sectionBlock
- kind: decision
- logged: v0.44.0 · 2026-10-16

Clean-room from Adobe's Photoshop File Formats Specification (https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/) and real PSD files used as data only. The spec gives the descriptor structure, TySh, SoCo, GdFl, vmsk and vstk framing but not the EngineData text dictionary, the path-record operation field or the vstk keys, which were learned by parsing real files with an own throwaway reader: a subpath length record carries the operation as int16 at byte 4 (1 combine, 2 subtract, 3 intersect, 0 exclude), a constant 1, and the subpath index at byte 14; initial fill rule record is 0; shape layers are SoCo or GdFl then vmsk then vstk, with layer flags 8 plus 16; type layers carry the warp rect as 16 zero bytes, not the 4 doubles the spec table shows. Blocks are padded to 4 bytes as Photoshop does. Honest limit: Photoshop itself was not available, so no output was opened in it; the check is psd-tools as a black-box reader (kinds, text, fonts, paths, composite) and the layer bytes against real files. Even-odd compound paths use exclude for every subpath after the first; non-zero uses subtract only for an opposite-wound subpath that lies inside an earlier one, else combine. Font names are the installed PostScript name when the font list has one, else Family-Style with spaces removed.

### src/io/psd-layers.ts · what becomes what
- refers-to: src/io/psd-layers.ts :: buildPsdLayers, shapeReason, textReason
- kind: decision
- logged: v0.44.0 · 2026-10-16

Layers, sublayers and plain groups become Photoshop groups (open, pass-through when Normal at 100 percent, else with the real blend key in lsct); point and area type become TySh layers with the rendered pixels; paths and compound paths with one solid or linear or radial gradient fill and at most one solid stroke become shape layers with the rendered pixels. Stays pixels, and is listed in PSD_NOTES which the export toast shows: type on a path, vertical, threaded or multi-column type, wrap, gradient or stroked type, effects, opacity masks, perspective, several fills or strokes, fill opacity or blend, patterns, freeform gradients, width profiles, brushes, arrowheads, clip groups and live groups (trace, Live Paint, dimension, graph). Stroke alignment, cap, join, miter and dashes map to vstk; a gradient angle comes from the gradient geometry. Type leading, size and tracking are written in canvas pixels (size times export scale) with the node matrix as the type transform. Unverified without Photoshop: that it opens every block without a repair prompt, the type metrics after a reflow, and gradient placement.

### src/io/psd-write.ts · layer record extras
- refers-to: src/io/psd-write.ts :: PsdLayerIn
- kind: decision
- logged: v0.44.0 · 2026-10-16

PsdLayerIn gained key (blend key override, pass for groups), blocks (extra additional-layer-info blocks written after luni) and irrelevant (flag bit 4, which psd-tools needs to classify a SoCo plus vmsk layer as a shape). Out and BLEND_KEYS are exported for psd-vector.ts. Section dividers use an empty pixel layer.

### src/io/raster.ts · psdEdit option
- refers-to: src/io/raster.ts :: RasterExtra.psdEdit, exportOther; src/ui/app-dialogs.ts; src/automation/agent-bridge.ts :: psd_edit
- kind: decision
- logged: v0.44.0 · 2026-10-16

PSD export has three choices: Write layers with Maximum editability (default), Write layers alone (pixel layers per layer as before, selection as one layer), and Flat image (Write layers off). The MCP export reads psd_edit (default true) but the tool schema in backend mcp.py was not extended, so it is only reachable by name until the next agents sync. The export dialog row labels go through t().

### src/styles/tokens.css · the contextual task bar under menus
- refers-to: src/styles/tokens.css :: --z-taskbar; src/styles/helpbar.css :: .fp-taskbar
- kind: decision
- logged: v0.45.0 · 2026-10-16

The seventh audit found the floating contextual task bar drawn over open menus: it covered the left half of Select > Same and swallowed clicks there, and a rectangle drag started under it. --z-taskbar was 900, above --z-menu (200), --z-temp (500) and --z-companion (800). It is now 120: above the canvas chrome (100) so it floats over the stage and docked chrome as before, and below the opening screen (150), menus, popovers, dialogs and toasts, as Illustrator's Contextual Task Bar sits under its menus. Checked in Chromium: with the bar under the Select menu, the left edge of Same now hits the menu label, and the bar computes z-index 120. The note on psd_edit above was resolved in v0.44.0 (the export_file schema declares it).

### src/engine/mesh.ts · bicubic point colours across patches
- refers-to: src/engine/mesh.ts :: patchEval, patchColor, cardinal; src/io/pdf-shading.ts :: meshShading
- kind: decision
- logged: v0.46.0 · 2026-10-16

A red point added with the Mesh tool drew as a small faint blob because each patch blended its four corner colours bilinearly, so the colour died out linearly inside the four patches touching the point. Patch colour is now a tensor-product cardinal spline over the 4 by 4 neighbourhood of points (C1 across patch edges, edge points repeated), clamped between the two nearest point values so a white neighbourhood never rings; the point reads as a full colour patch that spreads into the neighbouring patches. Canvas, PNG and SVG all go through meshQuads and so agree. The PDF writer used the four corner colours of a Coons patch, so each patch is now cut into 4 by 4 type 6 sub-patches whose corner colours come from patchColor and whose edges come from the patch surface, keeping PDF in step. Reload restore of a mesh drawing white was not reproduced: the recovery copy was never written in the headless run, so that part is still open.

### src/engine/snap.ts · grid wins, intersect radius, grid-aware box snap
- refers-to: src/engine/snap.ts :: snapPoint, snapRect; src/ui/stage.ts :: snapRaw, snapBoxRaw
- kind: decision
- logged: v0.46.0 · 2026-10-16

Snap to Grid snapped only the first corner of a shape: the drag end then went through snapLine (45 degree construction angles from the start point), which pulled (396,396) to (397.5,397.5), and snapRect ignored the grid whenever Smart Guides were on, so moves did not snap either. With the grid on, snapPoint now returns an anchor spot if one is in reach and otherwise the grid point, and snapRaw skips the angle guides for a grid hit; snapRect snaps the nearer of the left and right (and top and bottom) edges to the grid. Intersections are searched in 1.5 times the path tolerance so intersect beats path as it does in Illustrator, and a Selection drag takes an intersection before the alignment guides (never with the grid on).

### src/tools/pen.ts · intersect before add-anchor, pencil start snaps
- refers-to: src/tools/pen.ts :: down; src/tools/freehand.ts :: pencil down
- kind: decision
- logged: v0.46.0 · 2026-10-16

A Pen click on a crossing of two selected paths added an anchor to one of them (the segment-under test ran before any snap), so no path started at the crossing and no label showed. The click now snaps first and only adds an anchor when the snap is empty or a plain path hit; at an intersect, anchor or centre snap a new path starts on the snapped point. The Pencil took its first point raw; it now snaps the start (Smart Guides or Snap to Grid). A rectangle started 3 px from a crossing already snapped to the intersection in every setup I could drive (lines made with the Line or Pen tools), so that half of the report was not reproduced; the guard is that the label shows as intersect.

### src/engine/ops/paths.ts · Smooth tool refit, Average on whole paths
- refers-to: src/engine/ops/paths.ts :: smoothRegion, pathOperation average; src/tools/freehand.ts :: smooth tool
- kind: decision
- logged: v0.46.0 · 2026-10-16

Smooth simplified and re-smoothed only the anchors inside the brush and needed three of them, so a thin brush moved points about 2.5 pt and left corners. smoothRegion now samples the run (the brushed anchors plus one fixed neighbour each side), relaxes the samples with a short binomial filter and refits cubic curves with fitCurve, so each pass lowers the zigzag, corners become smooth anchors and the anchor count can fall; the tolerance follows a Fidelity option (shared with the Pencil) and the brush is 16 px. Average took only selected anchors, so whole selected paths did nothing; with no real anchor selection it now averages every anchor of the selected paths, as Illustrator does.

### src/tools/select.ts · Direct Selection on a live shape anchor
- refers-to: src/tools/select.ts :: directDown
- kind: decision
- logged: v0.46.0 · 2026-10-16

Clicking a live shape's fill with the Direct Selection tool marks the whole object selected (-1), and pressing on one of its anchors then dragged every anchor. For a live rectangle, ellipse, polygon or star a press on an anchor now selects just that anchor, so the drag moves it alone and the shape becomes a plain path (the live flag is dropped by withPath), as in Illustrator 30.

### src/tools/transform.ts · Liquify tools add points
- refers-to: src/tools/transform.ts :: liquifyTool; src/tools/liquify-detail.ts :: refine
- kind: decision
- logged: v0.46.0 · 2026-10-16

Warp, Twirl, Pucker and Bloat moved existing anchors only, so a drag along a four-anchor rectangle edge did nothing. They now subdivide segments inside the brush (the refine used by Scallop, exported) before deforming, with a Detail option that sets the target spacing; a drag along a 200 pt edge turns the 4 anchors into 69 to 90 and bends the edge. There is no Simplify setting yet, so long drags keep their points.

### src/engine/pathfinder.ts · Trap fallback for contained shapes
- refers-to: src/engine/pathfinder.ts :: trapNodes
- kind: decision
- logged: v0.46.0 · 2026-10-16

Driven with two overlapping filled rectangles the trap was already a thin L along the lighter shape's edge, exactly Thickness wide (0.25 pt gave 350..400.25, 6 pt gave 350..406), so the reported whole-overlap shape was not reproduced. What did fail was a lighter shape that fully contains the darker one: the strip came out empty and no trap was made. trapNodes now falls back to the rim of the target shape (its edge band, Thickness wide) clipped to the spreading shape. Intertwine was driven and needed no change: Make leaves the Intertwine tool active with the group selected, and a click on a crossing flips the over path there (crossing pixel blue, red, blue over three clicks).

### frontend/src/ui/layers.ts · Layers panel pointer capture, rename and Layer Options
- refers-to: src/ui/layers.ts :: bind, fill; src/styles/formpath.css :: .cv-lrow-name; src/engine/index.ts :: setLayer
- kind: decision
- logged: v0.46.0 · 2026-10-16

Row clicks never selected and double-click never renamed because pointerdown captured the pointer on the rows container at once, which retargets the click to the container; capture now starts only when a drag passes 5 px. A second cause hid the rename field: fill() re-set the name text on every sync and wiped the input, so it now skips a name cell that holds an input. The name cell is shrink-to-fit so a double-click on the text renames and a double-click on blank row space opens Layer Options. setLayer deselects the objects of a layer being locked. Driven with real mouse and keyboard: click, Shift and Ctrl select on the canvas, typed letters stay in the field, Enter commits, Escape cancels.

### frontend/src/ui/panels/kit.ts · Slider typed values commit
- refers-to: src/ui/panels/kit.ts :: slider; src/ui/panels/color.ts :: fromSliders
- kind: decision
- logged: v0.46.0 · 2026-10-16

The Colour panel rebuilds a colour from the range inputs, and the typed field never wrote into its range, so a typed value was lost. The text field now sets the range, clamps and reformats before calling change, once, on Enter, Tab or blur (the Enter key blurs). Driven in CMYK, RGB, HSB and Gray; one undo step per entry.

### frontend/src/ui/form-dialog.ts · Colour field with a hex box, name field selected on open
- refers-to: src/ui/form-dialog.ts :: color field; src/ui/dialogs.ts :: open
- kind: decision
- logged: v0.46.0 · 2026-10-16

The native colour input cannot be typed or dragged in a driven browser, so Swatch Options could not commit a colour. The field is now the native chip plus a hex text box kept in step. Dialogs select the text of a first text field on open, so typing replaces the hex default of New Swatch instead of appending to it. Driven: editing a global swatch to 00AA55 recoloured both objects using it, and a spot swatch exported a /Separation in the PDF (qpdf check clean).

### frontend/src/tools/paint.ts · Gradient tool follows the active slot
- refers-to: src/tools/paint.ts :: gradient tool move, up
- kind: decision
- logged: v0.46.0 · 2026-10-16

A Gradient tool drag always wrote the first fill. It now reads engine.activeSlot and writes the first stroke (drag and click) when Stroke is active. Driven with X then G on a 12 pt stroked rectangle: the stroke became a gradient and the fill stayed a colour.

### frontend/src/io/api.ts · Shared engine status
- refers-to: src/io/api.ts :: engineStatus; src/ui/panels/actions.ts :: load
- kind: decision
- logged: v0.46.0 · 2026-10-16

Every capabilities() call now publishes up or down, and a 5 s poll while a subscriber exists keeps it current. The Actions panel subscribes: it marks itself offline when the engine goes, reloads the sets and keeps session-only ones when it returns, and re-checks capabilities before declaring itself offline after a failed list. Driven by aborting then restoring /api: the offline note appeared and cleared within one poll.

### frontend/src/engine/index.ts · Separations Preview turns Overprint Preview on
- refers-to: src/engine/index.ts :: setView
- kind: decision
- logged: v0.46.0 · 2026-10-16

Choosing a plate switches Overprint Preview on and remembers the earlier state; returning to All or closing the dialog restores it. Driven through Window, Separations Preview, plate rows and Done.

### frontend/src/i18n/index.ts · Language switch keeps open documents
- refers-to: src/i18n/index.ts :: setLanguage; src/app.ts :: languageHooks.beforeSwitch, offerRecovery
- kind: decision
- logged: v0.46.0 · 2026-10-16

The switch still reloads, but first writes every open document to the recovery store and sets a session flag; the next start reopens them silently (modified state kept) whether or not restore-session is on. Undo history is not carried over. Driven: two rectangles drawn, language changed to Spanish in Preferences, the unsaved document came back with both.

### src/io/generative.ts · generated pattern art is fitted into the tile
- refers-to: src/io/generative.ts :: svgNodes, patternVariations
- kind: decision
- logged: v0.47.0 · 2026-10-16

svgNodes now returns the viewBox it used (vbW, vbH) and patternVariations scales the art by tile / max(vbW, vbH) and centres it, instead of the fixed tile / 200. A model that answers with its own 1000 unit viewBox (or 480 wide art) used to land five times too large, so the tile showed one clipped colour and the previews and swatches looked solid. The 200 unit request is kept; only the scale follows what came back.

### src/ui/pattern-thumb.ts · pattern swatch thumbnails from the tile art
- refers-to: src/ui/pattern-thumb.ts :: patternThumb, onPatternThumb; src/ui/rail.ts :: paintCss; src/ui/panels/color.ts :: SwatchesPanel
- kind: decision
- logged: v0.47.0 · 2026-10-16

paintCss returned a grey checker for every pattern paint. patternThumb renders the tile art once per PatternDef object (WeakMap, so an edited pattern re-renders) into a 64 px canvas repeated two by two and keeps a data URL; until it is ready paintCss still returns the checker, and the Swatches panel re-syncs through onPatternThumb when a thumbnail lands, so tiles patch in place without a rebuild.

### src/ui/print-dialog.ts · live preview of marks, bleed, plates and colour management
- refers-to: src/ui/print-dialog.ts :: thumb, paint, plate; src/io/print.ts :: managed
- kind: decision
- logged: v0.47.0 · 2026-10-16

The preview canvas keeps its fixed size. Marks (trim, registration, colour bars, page information) are drawn on it with the same pageGeometry numbers the PDF uses; the bleed is rendered into the thumbnail (region grown by the bleed) so art runs past the trim; with Output set to Separations a new Preview plate select picks one plate and the thumbnail renders it in grey through renderRegion's separation option; a chosen printer profile runs the thumbnail through the exported managed() conversion, the same one the PDF uses. Thumbnails are cached by artboard, bleed, plate and profile key, and the previous image stays on screen until the next one lands, so changing an option never blanks the preview.

### src/io/print.ts · managed is exported
- refers-to: src/io/print.ts :: managed
- kind: decision
- logged: v0.47.0 · 2026-10-16

managed() only gained export so the Print dialog preview converts through the identical path as the printed PDF.

### src/ui/color-settings.ts · Proof Setup presets
- refers-to: src/ui/color-settings.ts :: proofPreset, proofPresetOn; src/app.ts :: proof-working-cmyk, proof-profile-N, proof-monitor-rgb
- kind: decision
- logged: v0.47.0 · 2026-10-16

View > Proof Setup lists Customize, Working CMYK, each installed CMYK profile and Monitor RGB. Working CMYK clears the proof device so the document CMYK profile (or the generic one) is used; a profile entry sets it as the device; both turn Proof Colors on. Monitor RGB turns Proof Colors off, since the plain display path is the monitor RGB view. The View menu items became a function so the profile entries follow the profiles loaded; app start now calls refreshProfiles so the list is ready before the first open.

### src/app.ts · proof preset commands and View menu
- refers-to: src/app.ts :: commands proof-working-cmyk, proof-monitor-rgb, proof-profile-0..11; View menu
- kind: warning-context
- logged: v0.47.0 · 2026-10-16

Twelve fixed proof-profile-N commands exist because commands are registered once; their labels read the Nth installed CMYK profile and the menu only lists as many as there are. More than twelve CMYK profiles show the first twelve here; Customize still lists all.

### src/ui/panels/color.ts, src/ui/rail.ts · pattern swatch paint
- refers-to: src/ui/panels/color.ts :: constructor; src/ui/rail.ts :: paintCss
- kind: decision
- logged: v0.47.0 · 2026-10-16

Both only hook patternThumb (see pattern-thumb.ts): paintCss asks for the pattern thumbnail and the swatch panel queues a sync when one is ready.

### frontend/HASHOUT_LOG.md · Phase 43 items not done
- refers-to: Character panel OpenType (item 5); Asset Export per-asset settings and Collect for Export (item 6)
- kind: todo
- logged: v0.46.0 · 2026-10-16

Not reached inside the time budget: proving each OpenType toggle changes rendered glyphs (whole object and edit-mode range), and per-asset Asset Export settings with multi-select editing plus Collect for Export in the canvas context menu.

### src/io/trace-core.ts · corners from the raw outline, exact corner points, straight runs
- refers-to: src/io/trace-core.ts :: findCorners, lineFit, cornerPoint, fitSmooth, fitRun
- kind: decision
- logged: v0.47.0 · 2026-10-16

Rectangles traced with rounded corners and wobbly sides because corners were looked for on the relaxed, RDP-simplified outline: relaxing turned each 90 degree corner into two 45 degree turns, neither above the 45 degree default threshold, and the densified samples (edge midpoints) cut every corner by half a pixel. Corners are now found on the unrelaxed densified outline as peaks of the turning angle measured over a 4-sample support (non-maximum suppressed, threshold still set by Corners), each corner anchor is placed at the intersection of least-squares lines fitted to the straight stretches on either side (kept only within 2.2 px of the raw point and when both fits are straight within 0.9 px), and a run between two corners whose raw points all lie within max(0.6, 0.45 x Paths tolerance) of its chord becomes a plain two-anchor straight segment before any curve fit. Curved runs still go through Schneider's fit on the relaxed points. A 200 x 100 rectangle went from 8 anchors, corners 0.75 px off and curved handles, to 4 anchors on the corners exactly with straight segments at the default and the Black and White Logo presets. Sub-pixel staircase edges can still read as a corner at Corners 100 percent, which is the control's intent.

### src/ui/panels/effect-gallery.ts · folders, vector filters and stacked layers
- refers-to: src/ui/panels/effect-gallery.ts :: EffectGallery (CATEGORIES, inFolder, layers, sync, addLayer, removeLayer); src/styles/formpath.css :: .cv-fxg-cat, .cv-fxg-layer
- kind: decision
- logged: v0.47.0 · 2026-10-16

The list already held every Photoshop-family folder but only the Artistic folder's first twelve tiles were visible in the 360 px list, and nothing showed the rest was there. Folders are now collapsible headers with counts, in Illustrator's order (Artistic, Brush Strokes, Distort, Sketch, Stylize, Texture, then Blur, Pixelate, Video kept after them); the folder of the picked filter opens. The vector effects that live as separate Effect menu items (distort.* and stylize.*) are listed in the Distort and Stylize folders with the same live preview. Several filters stack as effect layers (up to eight, pooled rows built once): a tile replaces the active layer's filter, New Effect Layer duplicates it, the preview draws every layer, and OK adds them in one history step named Effect Gallery through `Engine.addEffects`.

### src/engine/index.ts · addEffects
- refers-to: src/engine/index.ts :: Engine.addEffects
- kind: decision
- logged: v0.47.0 · 2026-10-16

Adds an ordered list of effects to the targets (or to one appearance item) as a single history step, and remembers the last one as the last effect. The Effect Gallery uses it so a stack of filters is one undo.

### src/engine/mesh.ts · gradient mesh after reload not reproduced
- refers-to: recovery restore, src/io/project-io.ts :: serialize, docFromManifest
- kind: warning-context
- logged: v0.47.0 · 2026-10-16

Driven with real input: a mesh with a red point (Create Gradient Mesh, Mesh tool click) reloaded after the 20 second recovery copy and reopened red; a serialize, JSON, docFromManifest round trip leaves every mesh point colour and opacity identical. Mesh nodes keep colours inline in the manifest and use no asset registry (registerMesh and setMeshSource belong to imported 3D models), so nothing is lost in serialisation. The white drawing reported before the cardinal-spline change was the faint bilinear blob. Save to library and Download Project then Open from Disk were not driven separately inside the time budget.

### src/io/links.ts · handle files are copied to memory, never kept as stale File objects
- refers-to: pickLinkedFile, linkFromHandle, readRaw, saveLinkedFile, LinkManager.unreadable
- kind: decision
- logged: v0.47.0 · 2026-10-16

A File from FileSystemFileHandle.getFile() points at the file on disk, so once that file changes it fails when read (ERR_UPLOAD_FILE_CHANGED on upload, NotReadableError in the zip) and the save toast blamed the engine. Every LinkFile blob now goes through snap(), which copies the bytes into a Blob at read time, so assets and previews are immutable. LinkManager.unreadable names any linked file whose cached bytes still cannot be read, and Save and Download Project report that name instead of an engine problem. Driven with OPFS handles and a stubbed showOpenFilePicker: before, Save failed with the engine toast and Download threw; after, both work after outside edits, Update, and a PDF page link.

### src/app.ts · save and download check linked bytes; Collect for Export in the canvas menu
- refers-to: save, projectZip, contextMenu.setItems
- kind: decision
- logged: v0.47.0 · 2026-10-16

save and projectZip call links.unreadable first and toast the unreadable link names. The canvas context menu gained a Collect for Export submenu with the existing collect-single and collect-multiple commands.

### src/ui/panels/symbols.ts · Links row shows the placed page and crop
- refers-to: LinksPanel.fill
- kind: decision
- logged: v0.47.0 · 2026-10-16

A PDF or AI link row reads "name (page 2)", with ", crop box" appended when the crop is not the bounding box.

### src/ui/panels/kit.ts · selectCtl.allow greys single options
- refers-to: selectCtl
- kind: decision
- logged: v0.47.0 · 2026-10-16

selectCtl returns allow(ok), which disables individual options. The Character panel uses it so Figures, Position and Sets list only what the current font has, as Illustrator does.

### src/ui/panels/type.ts · OpenType option greying and measured results
- refers-to: CharacterPanel OpenType controls
- kind: warning-context
- logged: v0.47.0 · 2026-10-16

The bundled Inter and JetBrains Mono are web latin subsets whose GSUB holds only calt, frac, numr, dnom, pnum and tnum (Inter) and calt, frac (JetBrains Mono); that is why most controls are disabled for them. No installed font has swsh or titl, so those stay disabled. Measured through the Character panel with TeX Gyre Pagella (liga, dlig, frac, salt, zero, onum, tnum, ss01, smcp) and Inter: every enabled feature changed the glyph sequence from layoutText, and the SVG and PDF exports differed, for the whole object, and a range in edit mode changed only its glyphs. The defect found was that unavailable choices in the Figures, Position and Sets lists stayed selectable.

### src/engine/types.ts · ExportAssetItem per asset
- refers-to: ExportAsset.items
- kind: decision
- logged: v0.47.0 · 2026-10-16

Each export asset carries its own optional scale, suffix and format list; assets without one use the panel defaults (1x PNG, 2x PNG, 1x SVG). It lives in doc.exportAssets and so is saved in .fpth.

### src/engine/index.ts · setExportAssetItems
- refers-to: Engine.setExportAssetItems
- kind: decision
- logged: v0.47.0 · 2026-10-16

One history step sets the item list on every given asset id, which is what multi-select editing in the Asset Export panel calls.

### src/io/raster.ts · exportAssetsZip uses each asset's own items
- refers-to: exportAssetsZip
- kind: decision
- logged: v0.47.0 · 2026-10-16

Each asset exports with its own items, falling back to the list passed in only when it has none.

### src/ui/panels/asset-export.ts · per-asset settings with multi-select editing
- refers-to: AssetExportPanel
- kind: decision
- logged: v0.47.0 · 2026-10-16

The settings rows now show the first picked asset's items and write to every picked asset on change; with nothing picked they are disabled. Driven: edits to one asset left the others at defaults, and a Ctrl-click multi-pick edit changed both picked assets only.

### public/splash.html · the formvis splash card with the logo image
- refers-to: formpathSplashDone
- kind: decision
- logged: v0.48.0 · 2026-10-22

The splash is now formvis's rounded 360 by 200 card with `formpath-logo.png` at 72 px and the gradient bar; the old page drew an inline SVG and the words "Starting the formpath engine". The main window stays at alpha 0 on macOS until the page calls `app_ready`, and the splash closes 2.6 s after launch at the earliest. The in-app `brandMark` in `ui/brand.ts` is a one-colour `currentColor` vector of the same picture, so it stays as is.

### public/splash.html · the splash content has a fixed box
- refers-to: public/splash.html :: .box
- kind: fix
- logged: v0.52.6 · 2026-10-26 · FB-108

The logo, the line and the bar sat directly in a centring body, so when the browser painted after the logo and before the rest was parsed (slow CPU), the logo then moved up 27.5 px and the group widened from 72 to 180 px: an intermittent layout shift of 0.0001 that failed the window smoke (F7) once in about six runs. The three now live in `.box`, 180 by 127 px (72 + 18 + 16 + 18 + 3), and the line has a fixed 16 px height, so the box is centred the same before and after the parse. Reproduced on demand by writing the page in two parts 700 ms apart: shift 0.000105 before, 0 after.

### src/ui/dom.ts · revealApp calls app_ready
- refers-to: revealApp
- kind: decision
- logged: v0.48.0 · 2026-10-22

After `body.app-ready` is set, one more frame later the desktop shell is told through `invoke('app_ready')` so the native reveal runs once the first render has painted. The overlay title bar puts the macOS traffic lights over the left of the page's title bar, which has no inset or drag region for them yet.

### src/ui/caption-buttons.ts · title row as formvis: overlay inset, drag regions, custom caption buttons
- refers-to: CaptionButtons
- kind: decision
- logged: v0.50.0 · 2026-10-22

`CaptionButtons` is formvis's class: under Tauri on macOS it sets `has-overlay-titlebar` on the root (38 px row, 78 px left padding that clears the traffic lights) and marks the header, brand, `.cv-tb-doc`, `.cv-tb-app`, zoom and tool groups as `data-tauri-drag-region`; on Windows and Linux the View > Custom Title Bar command (`formpath.customTitleBar`) swaps the system frame for Minimize, Maximize and Close. The title row now has five grid columns (brand, menus, document name, zoom, tools) placed explicitly so the hidden document name keeps its flexible column. `Tabs.render` writes the current document into `.cv-tb-doc` and the window title as `• name - formpath` through `set_window_title`. The capabilities file gains the window permissions the buttons call. New strings (Custom Title Bar, Minimize, Maximize, Restore) are not in the locale tables yet.

### src/ui/native-menu.ts · text-field routing, check items, Menus in Window
- refers-to: NativeMenus
- kind: decision
- logged: v0.50.0 · 2026-10-22

The macOS menu bar items for undo, redo, cut, copy, paste and select-all go to the focused text field through the shell's `text_edit` command (the menu's accelerators otherwise take Cmd+Z, X, C, V and A before a field can), and run the command when no field has focus. Commands with `checked` become check items and are refreshed with the enabled state, which also follows pointer, key and focus events. The app menu says "About formpath" and View > Menus in Window (`formpath.menusInWindow`, applies at next start) keeps the in-window bar. `has-native-menus` is now set on the root only after the menu is built, so a failed build leaves the in-window bar. `text_edit` is a new app command: listed in `src-tauri/build.rs`, allowed in the capability file, registered in `main.rs`.

### src/ui/home.ts · Home as formvis: nav, pages, hero, sections, files browser
- refers-to: HomeScreen
- kind: decision
- logged: v0.50.0 · 2026-10-22

Home is now a navigation column (Start, Recent, Projects with count pills, Create, Back to Canvas, Preferences, Help) beside a main area of pages built once and toggled with `hidden`. Start has the greeting written into an empty h1, a hero for vector art (formats FPTH, SVG, PDF, PNG, JPEG, WEBP), a short Recent grid, and formpath's own six document presets as outline tiles (applied through `newDoc.createPreset`). `HomeFiles` in `ui/home-files.ts` is the grid or list browser patched in place by key; its prefs are under `formpath.home`. Outputs is left out because the engine API has no exports listing, and rows show a glyph instead of a thumbnail for the same reason. The new pref `homeOnLastClose` (off by default) decides whether Home returns when the last document closes; `autoShowHome` now reads "Show the Home screen at launch". The old centred layout and its preset-card styles were removed from `shell.css` and `formpath.css`.

### src/ui/themes.ts and index.html · the family's 28 themes
- refers-to: THEMES; theme-boot PROFILES, LIGHT
- kind: decision
- logged: v0.50.0 · 2026-10-22

The theme choice is shared across the Form family (`nodemode_ui_settings`) and formvis offers 28 themes; formpath had 15, so a theme picked in formvis such as Pro Dark or Soft Light fell back to Studio. The 13 missing profiles are added with formvis's values to THEMES and to the boot script's PROFILES and LIGHT map, which must stay equal. Checked in headless Chromium with the store set to pro-dark, soft-light and nineties: the right `--bg-primary` at the first script turn and after start, `theme-light` on the light ones.

### src/ui/app-dialogs.ts · Preferences as formvis: floating rail, stacked cards, scroll spy, wire
- refers-to: SettingsDialog
- kind: decision
- logged: v0.51.0 · 2026-10-22

The dialog keeps its prefs, stored keys and value labels and takes formvis's shell: a floating rail of icon tabs left of the frame (`formpath.prefsRailCollapsed` remembers the collapsed state), one scrolling pane of foldable section cards with titled group cards, a scroll spy that picks the current card, an SVG wire from the active tab to a port on the header divider, a head icon, a bordered close button and the Done footer. It is built once; `show()` only patches values and the wire path is written only when it changes. Sections follow formvis's names and order: General, Interface, Workspace, Tools (was Selection & Snapping), File Handling, History & Cache (holds Undo steps kept, moved out of File Handling), Units & Rulers (was Units), Guides & Grid, Plugins (was Plugins & Agents). `data-section` is the English name and `add()` order is the display order. Transparency grid rows stay in Guides & Grid because formpath has no Gamut section. Reset All Preferences already clears every `formpath.` key. New pf icons are in the 24-unit stroke style. New strings (group names, Tools, History & Cache, Units & Rulers, Plugins, Collapse tabs, Expand tabs) are not in the locale tables yet and show in English.

### src/ui/status.ts · status bar as formvis: tools, fixed slots, info cycling, whole-segment hint, Working
- refers-to: StatusBar
- kind: decision
- logged: v0.51.0 · 2026-10-22

The bar is now flat in formvis's order and widths: the history and zoom tools (undo, redo, zoom out, a zoom field that takes Enter and Escape, zoom in, fit; the buttons are `data-cmd` so the enabled state follows the command), then formpath's artboard stepper, the active artboard's size in document units, the info button, the tool hint (flexible), then formpath's selection and pointer slots, the engine state and the Working indicator. The info button cycles Artboards, Objects, Color mode and units, and Timing (the last busy span) on click, Shift reverses, and the choice is kept under `formpath.statusInfo`; it and every other slot have fixed widths, checked at 1400 px with all four readouts at identical widths. The hint splits on the interpunct and shows whole segments that fit, the full text in the tooltip, and an engine error takes the slot for six seconds in the danger colour. Working is shown through `pendingClass` on the engine's busy event, so a job under 300 ms never flashes; its slot is `visibility` based and keeps its width. Left out because formpath's engine has no equivalent: the jobs list and progress bar (no job registry or progress events), memory and the GPU and proof slots. The tool hint repeats what the Help Bar row already shows; it is kept because the map lists it. The old `.cv-status-*` rules for the zoom label, rows and slots are gone.

### src/engine/shaper.ts, src/tools/shaper.ts · the scribble's operation is the user's choice
- refers-to: shaperScribble, ShaperOp, Engine.shaperScribble, SH.op
- kind: decision
- logged: v0.52.0 · 2026-10-23

The operation (Merge, Punch or Delete) comes from the Operation choice in the Shaper options bar (Merge by default), switched while Alt (Punch) or Shift (Delete) is held, as Shape Crafter takes Alt for erasing. `shaperScribble(g, stroke, op)` takes the operation as a parameter; the stroke only picks which cells it touches. Merge needs two or more touched cells, Punch cuts the touched cells covered by two or more shapes, Delete removes the topmost shape of each touched cell. An operation that does not fit what was touched changes nothing and the status line says so; the operation is never chosen from cell counts or location. The agent bridge and MCP tool `shaper` take `operation` as a required argument for scribble. Comments removed from code (kept here): the operation is always the caller's choice; action 'none' means the operation did not fit and nothing changed, null means the scribble touched no shape.

### src/automation/agent-bridge.ts · file tools only for outside agents
- refers-to: AgentBridge.run (`from`), AgentBridge.loop; src/ui/panels/assistant.ts :: tool call; src/plugins/host.ts :: case 'call'
- kind: fix
- logged: v0.53.1 · 2026-11-10

Plug-ins and the in-app assistant were kept from file tools only by a regex of the five public names, while `run` also answers the internal `__open`, `__place`, `__project` and `__export` (meant for the backend loop) and `variables` and `actions` have file actions. A plug-in posting `__place` with `link: true` and an absolute path read any file the engine serves; `variables export` and `actions batch` wrote into any folder. `run(name, args, from)` now takes the caller, `'plugin'` by default; only `loop()` passes `'loop'`. Any other caller is refused names starting with `__`, the five public file tools, `variables` export, show and load (show and load fetch image variables by path) and `actions` batch. The assistant passes `'assistant'` and its own regex also refuses `__` names. Checked with `npx tsc --noEmit`; not run with a plug-in in the window.

### src/ui/panels/three-d.ts · a cancelled colour pick closes its gesture
- refers-to: ThreeDPanel constructor :: picking
- kind: fix
- logged: v0.53.1 · 2026-11-10

Shading Color, Light Color and Surface Color opened `engine.beginGesture()` on the first `input` and closed it only on `change`. Cancelling the native picker after dragging in it puts the value back, so no `change` fires and the gesture stayed open: every later edit merged into the previous history step and the trace draft stayed on. The gesture now also closes 800 ms after the last `input` and on `blur`; `end` checks `open`, so a second close does nothing. Checked with `npx tsc --noEmit`; the native picker was not run.

### src/ui/form-dialog.ts, src/ui/app-dialogs.ts · Enter on a button is the button's
- refers-to: FormDialog constructor :: scrim keydown; NewDocumentDialog constructor :: scrim keydown
- kind: fix
- logged: v0.53.1 · 2026-11-10

The scrim's Enter handler called `preventDefault()` and applied the dialog for every Enter outside a textarea, so Enter on a focused Cancel applied the edit, on Delete (Width Point Edit) edited instead of deleting, on an enhanced select's `.cv-dd-btn` committed the form, and in New Document Cancel or a preset card created a document. Both handlers now skip targets that are `HTMLButtonElement`, as `PlaceDialog` already does; the focused button then activates itself (OK and Create still apply). Checked with `npx tsc --noEmit`; keyboard not run in the window.

### src/tools · every dragging tool has a cancel
- refers-to: src/tools/select.ts :: groupSelect, lasso, selection cancel (CW); src/tools/pen.ts :: anchorPoint, pen cancel (P.closing); src/tools/freehand.ts :: cancel (shared by all eight freehand tools); src/tools/transform.ts :: xformTool, reshape, liquifyTool; src/tools/paint.ts :: mesh; src/tools/view.ts :: hand, rotateView, zoom, artboard
- kind: fix
- logged: v0.53.1 · 2026-11-10

Stage unwinds a drag that is cut short (another tool's shortcut, a second finger, `pointercancel`, Escape) only through `tool.cancel`, and these tools had none: `engine.dragBase` stayed set with the preview in the document, so the next click with Rotate, Reflect, Scale or Shear committed the cancelled transform (stale `T.on` and `T.moved`), the next `beginDrag` took the preview as its base and the next `edit` snapped the art back. The Selection tool's cancel left `CW.on` set, so the next move drag ran `dragWidget` and changed a corner radius under the name Move. Each cancel now calls `cancelDrag()` when the engine is dragging and clears that tool's drag flags; the Selection cancel also clears `CW` and the overlay, and the Pen cancel clears `P.closing` (a stale value made the next path end after its first anchor). Checked with `npx tsc --noEmit`; the drags were not run in the window.

### src/automation/agent-bridge.ts · counts held to the published ranges
- refers-to: AgentBridge.run :: undo, redo, make_blend, repeat; AgentBridge.perspectiveTool :: grid cell
- kind: fix
- logged: v0.53.1 · 2026-11-10

`backend/app/routers/mcp.py` publishes maxima in each tool's `inputSchema` but does not validate `arguments`, and `num()` only drops non-finite values, so `undo {steps: 1e15}`, `make_blend {steps: 1e7}`, a radial `repeat` with 1e8 instances or a grid `cell` of 1e-6 froze the window; blend and repeat specs are saved in the document and the recovery copy, so it froze again on reopen. The bridge now clamps to the schema: undo and redo steps 1 to 100, blend steps 1 to 1000 (make and options), repeat instances 2 to 400 and rows and columns 1 to 100 (make and options), grid cell 1 to 2000 pt. The engine undo loop that keeps going after history runs out is engine code and not changed here. Checked with `npx tsc --noEmit`; not run against a window.

### src/tools/view.ts · Rotate View measures the pointer's own angle
- refers-to: rotateView :: down, move
- kind: fix
- logged: v0.53.1 · 2026-11-10

`p.screen` comes from `Stage.unturn` with the live `viewport.rotation`, which this drag keeps changing, so `atan2(p.screen)` was the pointer's angle minus the rotation and `deg = base + (a - start)` fed the rotation back into itself: the view turned about half as far as the pointer and jittered. Both the start angle and the moving angle now add the current rotation back (in radians). Checked with `npx tsc --noEmit` and a node simulation of `unturn` and the tool: a 90 degree sweep from a 30 degree view reads 45, 60, 75, 90, 105, 120 at 15 degree marks. Not run in the window.

### src/app.ts, src/tools/transform.ts · transform dialogs use the tool's reference point
- refers-to: src/app.ts :: transformDialog; src/tools/transform.ts :: toolOrigin, origin, xformTool up
- kind: fix
- logged: v0.53.1 · 2026-11-10

The Rotate, Reflect, Scale and Shear tools set `T.origin` on a click (Alt-click also opens the dialog), but `T.origin` is private to the tool module and `transformDialog` always used `centerOfSel()`, so the dialog turned the art about the selection centre, not the point just set. `toolOrigin(e)` exports `origin(e)` (the set point for the current selection, else the geometric centre) and `transformDialog` uses it while `engine.tool` is one of those four; otherwise `centerOfSel()` as before. Checked with `npx tsc --noEmit`; not run in the window.

### src/ui/properties.ts · Transform fields use the preview-bounds setting
- refers-to: TransformFields :: x, y, rot, shear, flips, resize, sync; src/engine/index.ts :: setBounds
- kind: fix
- logged: v0.53.1 · 2026-11-10

The fields read `selectionBounds(false)` (geometric) while `setBounds` measures `view.previewBounds`, so with Use Preview Bounds on and a 10 pt stroke, W = 200 on a 100 pt square scaled by 200/110 and shifted the art, and X or Y landed half a stroke off. Every bounds read in `TransformFields` now calls `selectionBounds()` with its default, the same rectangle `setBounds` uses; with the setting off nothing changes. Checked with `npx tsc --noEmit`; not run in the window.

### src/ui/panels/symbols.ts · Artboard Options keeps the background
- refers-to: ArtboardsPanel.options
- kind: fix
- logged: v0.53.1 · 2026-11-10

The Background field was seeded with the literal `#ffffff` and `bg` was rebuilt from it on OK whenever Transparent was unchecked, so renaming an artboard through the dialog turned a coloured background white. The field is now seeded with `hex(a.bg)` (imported as `hexOf`, because the function's own `hex` constant would shadow it), and when the field still holds that value on OK the stored `a.bg` is kept as it is, so a CMYK background is not rewritten as RGB. Checked with `npx tsc --noEmit`; not run in the window.

### src/ui/panels/actions.ts · set names are unique
- refers-to: ActionsPanel.unique, newSet, editRow (set rename), duplicate, loadText, save, remove
- kind: fix
- logged: v0.53.1 · 2026-11-10

Sets are stored through `api.saveActionSet(s.name, ...)` and removed through `deleteActionSet(s.name)`, so two sets with one name shared a file: the later save replaced the other set, only one came back after a reload, and deleting one removed the other's file. Only `loadText` made names unique. `unique(base, self?)` now holds that loop (it compares without case, for case-insensitive disks) and New Set, a set rename, Duplicate on a set and `loadText` all go through it. Checked with `npx tsc --noEmit`; not run in the window.

### src/ui/dropdown.ts · enhanceSelect returns a disposer
- refers-to: enhanceSelect; src/ui/form-dialog.ts :: FormDialog.disposers, ask; src/ui/panels/asset-export.ts :: rowDisposers, fillRows, addRow
- kind: fix
- logged: v0.53.1 · 2026-11-10

Each call appended a `.cv-dd-pop` to `#overlay-root`, a capture `pointerdown` listener to `document` and a `MutationObserver`, none ever removed. `FormDialog.ask` rebuilds its body on every open and Asset Export refills its rows on every asset pick, so popups, document listeners and observers (each keeping its detached select alive) grew without bound. `enhanceSelect` now returns `() => { pop.remove(); removeEventListener; mo.disconnect(); }`; FormDialog runs its selects' disposers before clearing the body, and Asset Export runs a row's disposer when the row is deleted and all of them before a refill. Callers that build their selects once ignore the return value. Checked with `npx tsc --noEmit`; the popup count was not checked in the window.

### src/ui/stage.ts · docPoint follows the view rotation
- refers-to: Stage.docPoint; src/app.ts :: stage contextmenu, drop handler, RecolorDialog stagePoint
- kind: fix
- logged: v0.53.1 · 2026-11-10

`docPoint` converted client coordinates with `viewport.toDoc` alone, without the `Stage.unturn` step `pointer()` applies for the CSS-rotated canvases, so in a rotated view right-click selected and acted on the object at the un-rotated spot, drops landed at the wrong point and the Recolor eyedropper sampled the wrong place. It now unturns by `v.rotation` first; at rotation 0 `unturn` returns the point as it is. Checked with `npx tsc --noEmit`; not run in a rotated view.

### src/tools/transform.ts · Ctrl+Alt shear selects its copy
- refers-to: shearDrag; freeTransform up; src/tools/select.ts :: endTransform
- kind: fix
- logged: v0.53.1 · 2026-11-10

`shearDrag` passed `p.alt` to `transformNodes`, so a copy was made, but dropped the result's ids and never called `noteDragTransform`: `endTransform` committed with the original selected and Transform Again did not know the shear. It now keeps the result, sets `FT.copyIds` to the copy's ids when Alt is held (null otherwise) and notes the matrix, as the other Free Transform drags do. Checked with `npx tsc --noEmit`; not run in the window.

### src/automation/catalogue.ts · the gate lists real command ids
- refers-to: WINDOW_ONLY, RISKY; src/app.ts :: commands settings, manage-plugins, action-batch, package, clear-recent
- kind: fix
- logged: v0.53.1 · 2026-11-10

`WINDOW_ONLY` named `preferences` and `quit` and `RISKY` named `revert`, `close-all`, `delete-library` and `batch`; none of these ids exist. Preferences is `settings`, so agents could open it, and Batch is `action-batch`, so `list_commands` did not say undo cannot reverse it. Now `WINDOW_ONLY` adds `settings` and `manage-plugins` and `RISKY` is `clear-recent`, `action-batch` and `package` (which writes a folder). Checked with `npx tsc --noEmit`; not run with an agent.

### src/ui/layers.ts · a released press drops the row drag
- refers-to: LayersPanel.bind :: rows pointermove
- kind: fix
- logged: v0.53.1 · 2026-11-10

A press on a row that left the list sideways (under 5 px vertically) and was released outside it left `this.drag` set, since no capture was taken yet and `pointerup` never reached the rows. A later hover turned it into a moving drag with a drop line, and the `pointerup` of a click on another row's eye or lock button ran `end()` and moved the old ids. `pointermove` now clears the drag and the line when `ev.buttons & 1` is off, as `Dock.move` does. Checked with `npx tsc --noEmit`; not run in the window.

### src/ui/place-dialog.ts · a stale thumbnail run hands over its queue
- refers-to: PlaceDialog.drain, ask
- kind: fix
- logged: v0.53.1 · 2026-11-10

`busy` is shared across dialog sessions. Reopening Place while the previous session's thumbnail was rendering queued the new visible pages and called `drain`, which returned because `busy` was still set; the old run then saw `token` change and exited without draining, so the first thumbnails stayed blank until a scroll. The `finally` of `drain` now restarts it when the queue holds work and the token has moved on. Checked with `npx tsc --noEmit`; not run with a slow PDF.

### src/ui/text-editor.ts · caret steps by code point
- refers-to: TextEditor.key :: Backspace, Delete, ArrowLeft, ArrowRight; prevPoint, nextPoint
- kind: fix
- logged: v0.53.1 · 2026-11-10

Caret steps were one UTF-16 code unit, so Backspace after an emoji left its high surrogate and an arrow key landed inside the pair; the lone surrogate showed as a replacement glyph and was saved. `prevPoint` and `nextPoint` step over a high and low surrogate pair as one character; Backspace and ArrowLeft use the first, Delete and ArrowRight the second. Grapheme clusters (an emoji with a skin-tone modifier or a ZWJ sequence) still take one step per code point. Checked with `npx tsc --noEmit` and the helpers in node; typing not run in the window.

### src/ui/terminal-dock.ts · New Terminal opens one when the dock was hidden
- refers-to: TerminalDock.newTerminal, open, boot, opens
- kind: fix
- logged: v0.53.1 · 2026-11-10

With the dock hidden, `newTerminal` called `toggle(true)` and awaited `pending`, and `boot` opens a terminal only when there are no tabs, so with terminals already open the command just showed the old tab. `open()` now counts its calls in `opens`; `newTerminal` notes the count before showing the dock and, if start-up did not open a terminal, opens one. A dock that starts empty still gets exactly one. Checked with `npx tsc --noEmit`; not run against the terminal service.

### src/ui/app-dialogs.ts · an empty preference number is not its minimum
- refers-to: SettingsDialog constructor :: num
- kind: fix
- logged: v0.53.1 · 2026-11-10

`Number('')` is 0, which is finite, so clearing a Preferences number and leaving it saved the field's minimum; for Undo steps kept that called `setHistoryLimit(10)` and dropped the history beyond 10 steps at once. An empty or non-numeric field now gets `this.prefs[key]` written back and nothing is saved. Checked with `npx tsc --noEmit`; not run in the window.

### src/app.ts · Space on a keyboard-focused button
- refers-to: window keydown :: Space hand
- kind: fix
- logged: v0.53.1 · 2026-11-10

The global keydown took Space for the temporary Hand on every element that is not a field and called `preventDefault()`, so buttons, dropdown items, menu items and tabs could not be pressed with Space. Space now passes to the element when it matches `:focus-visible` and is a `button` or has role button, option, menuitem or tab. `:focus-visible` keeps the Hand after a mouse click, which leaves focus on the clicked button without matching it. Checked with `npx tsc --noEmit`; keyboard not run in the window.

### src/ui/app-dialogs.ts · Export checks the range only when it is used
- refers-to: ExportDialog constructor :: Export button; ExportDialog.sync (Range row), value
- kind: fix
- logged: v0.53.1 · 2026-11-10

The Export button refused any invalid Range text and focused the field, also when the Range row was hidden (scope other than the active artboard, or DXF or DWG) and the range would not be read, so Export silently did nothing. It now validates under the same condition `sync` uses to show the row and `value` uses to read it. Checked with `npx tsc --noEmit`; not run in the window.

### src/ui/panels/graph-data.ts · the grid is built from the data, not from text
- refers-to: gridOf; GraphDataWindow.load, import handler
- kind: fix
- logged: v0.53.1 · 2026-11-10

`load` wrote the data through `dataToText` (which quotes a label holding a quote, tab or newline and doubles its quotes) and split it on newlines and tabs, stripping only the outer quotes, so `He said "hi"` came back with doubled quotes that every Apply doubled again and a newline split the row. The import handler did the same with `parseTable`'s result. `gridOf(d)` builds the rows directly from `cleanData(d)` (series header, one row per category, empty cells for null) and both paths use it; `dataToText` is no longer imported here. Checked with `npx tsc --noEmit`; not run in the window.
