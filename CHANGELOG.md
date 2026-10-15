# Changelog

Versions follow `v*.*.*` with dots. Dates are UTC.

## 0.26.0 · 2026-10-15

The agent inside the window, the command catalogue, a one-run desktop build and Live Corners on any path.

### Added

- Terminal dock (Window > Terminal): real shells over engine PTYs, a Claude Code button that runs the person's own `claude` connected to formpth's tools without the outside-agent question, a Chat tab that answers through Claude Code in plain words, Restart, Hide and an ask bar that adds the document and selection as context.
- `./formpth claude` and `formpth.bat claude`: Claude Code in the current terminal with formpth's MCP server attached.
- The command catalogue: 649 menu commands and tools with group, menu path, description, parameters, risky and enabled state, mirrored to the engine. MCP `describe_command` and `run_commands` (one undo step); `list_commands` filters by group and word; `run_command` takes parameters. `GET` and `POST /api/commands`, and `./formpth cli list|describe|run`.
- `build_app` and `build_app.bat`: install, build the window, freeze the engine and bundle the desktop app in one run; DMG and Applications install on macOS, a `.deb` on Linux.
- Live Corners on any path: per-point Round, Inverted Round or Chamfer corners with absolute or relative radius, Direct Selection widgets with drag, Alt-click and double-click, a red limit preview, Object > Path > Corners... and Expand Corners; drawn the same on the canvas, in SVG and in PDF.

### Fixed

- Calls from the in-app Claude Code and Chat tabs run while outside agents are switched off.

## 0.23.0 · 2026-10-10

Files and generation. Every one of the 76 parity rows is built; an independent audit of the code puts parity at 72 of 76, 94.7 percent (68 Full, 8 Partial).

### Added

- DXF: open, place and drop ASCII DXF from R12 to 2018 (lines, polylines with arcs, circles, ellipses, splines, text and MTEXT, hatches, solids, dimensions, blocks and attributes, layers with colours and lineweights) with DXF Import Options; export AutoCAD 2000 or R12 with units, scale and type as text or outlines.
- EPS: Level 3 export per artboard in RGB or CMYK with real gradient shadings; formpth's own EPS reopens editable, and other EPS opens through a PostScript path reader. DWG is refused with a message to convert to DXF.
- Generative Shape Fill, Generate Patterns and Retype panels, running only on the model set for the Assistant and disabled until one is set. Model SVG is cleaned of scripts, images, event handlers and links before import.
- Retype matches outlined type to installed fonts by letter shape without a model, and reads text in images with a model that reads images; Preferences > Plugins has "The model reads images".
- MCP tools `generative_shape_fill`, `generate_patterns` and `retype`; EPS and DXF in open, place and export. 84 tools.

### Changed

- `docs/PARITY.md` takes its grades from a second independent audit, with PDF held at Partial; Smart Guides drops to Partial for fixed construction angles.

### Fixed

- The Export dialog no longer moves when its format changes.

## 0.22.0 · 2026-10-10

Libraries, paint and links. Parity is 69 of 76, 90.8 percent.

### Added

- Swatches: colour groups as folders with drag and drop, tint and registration swatches, 15 swatch libraries in a Swatch Library panel, User Defined libraries, and ASE swatch files opened and saved.
- Spot colours and their tints are written to PDF as Separation colour spaces; [Registration] prints on every plate.
- Recolor Artwork: a smooth or segmented colour wheel, reduce to a colour count, merge and separate, recolor from a colour group or library, the Color Theme Picker, shuffles and colour job presets, with a live preview. The Color Guide can be limited to a library.
- The Bristle brush, pen pressure from the Paintbrush, five-tile pattern brushes, art brushes that stretch between guides and flip, five brush libraries and Save Brushes.
- Symbol editing mode, Redefine, Duplicate, Replace, Reset Overrides and Symbol Options; dynamic symbols with per-instance part overrides; 9-slice scaling; registration points; five symbol libraries.
- Image Trace at the image's own resolution in a worker, with Corners, Noise, Method, palettes, centreline strokes, Snap Curves to Lines and an Outline preset.
- Real linked images: Place Linked, Linked, Modified and Missing states, Update, Relink from Folder, Go To Link, Embed and Unembed, with a cached preview in `.fpth`.
- MCP tools `swatch_library`, `swatch_group`, `new_brush`, `brush_library` and `links`; new options on `recolor`, `add_swatch`, `apply_brush`, `image_trace`, `place_image` and the symbol tools. 81 tools.

### Changed

- Outline Stroke and Expand Appearance follow brushes.
- Image Trace swaps in the tracing object at once and fills it when the trace finishes.

## 0.21.0 · 2026-10-10

The Perspective Grid. Every drawing row is Full; parity is 66 of 76.

### Added

- View > Perspective Grid with one, two and three point grids, Define Grid with live preview, saved grid presets, Show, Lock, Snap and the plane widget.
- Perspective Grid tool (Shift+P) to move vanishing points, the ground and the planes, and Perspective Selection tool (Shift+V) to move, copy, scale and move perpendicular on a plane (5), and to drag flat art and type onto a plane.
- Shape tools draw on the active plane, chosen with 1 to 4 or the plane widget, while the grid shows.
- Art attached to a plane re-projects when the grid changes; type stays editable; Object > Perspective > Attach to Active Plane, Release with Perspective and Move Plane to Match Object.
- The `perspective` MCP tool. 76 tools.

### Changed

- Number fields in dialogs are wider, so three-digit values are no longer cut off.

## 0.20.0 · 2026-10-10

Data: graphs, variables and data merge, and Actions with Batch. Parity is 65 of 76.

### Added

- Nine graph tools (Shift+G): column, stacked column, bar, stacked bar, line, area, scatter, pie and radar, as live graphs. The Graph Data window takes typing, pasting from a spreadsheet and CSV, with transpose and Switch X/Y. Graph Type covers the options and combined graphs; column and marker designs; series styles survive data edits; scaling redraws the graph.
- Window > Variables: text, image, visibility and graph variables bound to objects; data sets captured, updated and stepped through live; CSV and JSON import; Export Variations as PNG, SVG, PDF or `.fpth` per data set.
- Actions record dialog values, transforms including tool drags, drawn shapes, fills, strokes, opacity and graphic styles; per-step and modal toggles, stops, editing, reordering and duplicating; sets saved as `.fpaction` files in `~/Formpth/Actions`, with a Default Actions set.
- File > Automate > Batch: run an action over a folder of `.fpth`, SVG and PDF files or over the document's data sets, with a log.
- History: New Document from State and History Options with the undo limit.
- MCP tools `graph`, `variables` and `actions`. 75 tools.

### Changed

- Actions live in the engine's library instead of browser storage.

## 0.19.0 · 2026-10-10

New tools: Puppet Warp, Dimension, Shaper and Intertwine. Parity is 62.5 of 76.

### Added

- Puppet Warp tool (J): pins on the art, drag a pin to bend while the others hold, Alt-drag to twist, Shift to select several, Delete, Expand and Show Mesh. The solve keeps each part of the art as rigid as it can; type, images and symbols are carried in an envelope.
- Dimension tool (Shift+I): linear (horizontal, vertical, aligned), angular, radius and diameter dimensions that keep measuring when moved or scaled and relabel when the document units change, with units, precision, scale ratio, arrow style, label font and position in the options bar, and Expand.
- Shaper tool (Shift+N): gestures become live rectangles, rotated rectangles, circles, ellipses, triangles, polygons and lines; scribbles punch out, merge or delete regions; Shaper Groups keep their source shapes, with Faces and Shapes modes, face fills and Expand.
- Object > Intertwine > Make, Release and Edit, and the Intertwine tool (Shift+J): click an overlap to flip or cycle which object is on top, drag to draw a zone; exported with real clip paths.
- The Measure tool shows area and perimeter for closed shapes.
- MCP tools `puppet_warp`, `add_dimension`, `shaper` and `intertwine`. 72 tools.

### Changed

- Options bar drop-downs have a fixed width, so changing a value no longer shifts the bar.

## 0.18.0 · 2026-10-10

Type depth. Every type row is Full; parity is 58.5 of 76.

### Added

- Variable fonts: the font menu marks variable faces and filters to them, named instances appear as styles, and the Character panel has a slider for each axis the font declares. Glyphs are drawn at the chosen axes on the canvas, in Create Outlines and in PDF; SVG keeps `font-variation-settings`.
- Touch Type tool (Shift+T): move, scale and rotate single characters with a box and handles or the arrow keys, with values in the options bar. The text stays live.
- Hyphenation in line breaking with words longer than, after first, before last, hyphen limit, zone and capitalized words, from a rule-based English syllable splitter.
- Justification settings: word spacing, letter spacing and glyph scaling as minimum, desired and maximum, and single word justification.
- Window > Type > Tabs: a ruler with left, centre, right and decimal stops, leaders and Align On.
- Character rotation, optical kerning measured from glyph outlines, and Bullets and Numbering in the Paragraph panel.
- `set_text` takes `axes`, `touch`, `rotation`, `kerning`, `hyphenation`, `justification`, `tabs` and `list`.

### Changed

- A tab with no stops advances to a 36 pt grid, so documents with tabs lay out again.
- The fonts service reports variable faces, and an unknown italic style now finds an italic face of the family.

## 0.17.0 · 2026-10-10

Honest parity and the first gap release. Parity is now graded on the full 76-row Illustrator 30 baseline: 56 of 76.

### Added

- Attributes panel: non-zero or even-odd fill rule and Reverse Path Direction, for compound paths and single paths.
- Effects on a single fill or stroke from the Appearance panel and `apply_effect` with `item`; appearance on groups and layers; Graphic Style Libraries, Redefine Graphic Style and styles that stay linked.
- Gradients along and across strokes, drawn and exported.
- Knockout Group in three states, drawn on the canvas and written to SVG and PDF; opacity mask Disable and Link and the new-mask defaults.
- Vertical Type, Vertical Area Type and Vertical Type on a Path, set in columns with upright and rotated glyphs, a vertical caret and Type Orientation, in outlines, SVG and PDF.
- Area Type Options with rows, columns, gutter, inset and first baseline; Type on a Path Options with Rainbow, Skew, 3D Ribbon, Stair Step, Gravity, alignment, spacing and Flip; start, end and centre brackets on the canvas.
- Free Transform widget and modes: Constrain, Free Transform, Perspective Distort and Free Distort, with the modifier keys. Distortions are projective; type, images and symbols are carried in an envelope and type stays editable. Ctrl on a side handle shears.
- The bounding box turns with the object, and Object > Transform > Reset Bounding Box.
- Editable envelope meshes (Direct Selection and the Mesh tool add, move and remove points and lines), Envelope Options, Edit Contents and Edit Envelope, Reset with Mesh and Reset with Warp. Type and images inside an envelope are distorted.
- MCP: the `attributes` and `opacity_mask` tools, knockout on `set_object`, `gradient_mode` on `set_stroke`, orientation and path and area type options on `add_text` and `set_text`, envelope mesh actions, and `corners`, `perspective` and `reset_bounding_box` on `transform`. 68 tools.

### Changed

- `docs/PARITY.md` grades the 76-row baseline (49 Full, 14 Partial, 13 None) instead of the narrower 59-row list, and no longer counts controls that only stored a value.
- Outline Stroke follows dashes and width profiles.

### Fixed

- The agent bridge accepts calls only from the formpth window that holds its session secret, on the app's own origin; a missing consent answer counts as not allowed.
- Plugin frames have no network access, and the app embeds no other frames.
- Knockout Group, the Within, Along and Across stroke gradient buttons, Vertical Type and Type on a Path Flip no longer only store a value.

## 0.16.1 · 2026-10-08

Third-party credits.

### Changed

- `NOTICE.md` credits the six Lucide icons in the shell's icon set (link, unlink, pilcrow, move, maximize and smart object) and carries Lucide's ISC license text.

## 0.16.0 · 2026-10-07

Map Art, 3D shadows and a tilting Inflate. Every parity row is Full.

### Added

- Map Art: a symbol on the front face of an Extrude or Plane, with scale, offset and Shade Artwork. It follows the face's rotation and perspective, is clipped to the face and exports to SVG and PDF.
- 3D shadows behind or below the object, with distance, softness and opacity.
- Inflate turns in X, Y and Z, ray-cast with soft edges.
- Map Art and Shadow sections in the 3D and Materials panel, which now shows Rotation for Inflate too.
- `three_d` takes `map_symbol`, `map_scale`, `map_x`, `map_y`, `shade_art`, `shadow`, `shadow_position`, `shadow_distance`, `shadow_softness` and `shadow_opacity`, and rx, ry, rz for Inflate.

### Changed

- Effect dialogs edit text parameters.
- Parity is 59 of 59.

## 0.15.0 · 2026-10-07

3D and Materials.

### Added

- 3D effects: Extrude & Bevel (depth, cap, classic or rounded bevel), Revolve (angle, offset, from the left or right edge), Inflate and Plane, live on paths, compound paths, type and groups. Position presets, X, Y and Z rotation and perspective; plastic, matte, metal, wireframe and flat materials; light direction, intensity, ambient light, highlight and shading colour. Caps keep the object's own paint, gradients included.
- Window > 3D and Materials panel, and Effect > 3D and Materials for each kind.
- 3D exports to SVG and PDF as vector faces, and Expand Appearance turns it into shaded paths.
- The `three_d` MCP tool with named positions and partial updates. 66 tools.

### Changed

- Type outlines are available synchronously once a font has loaded, which 3D uses for type.

## 0.14.0 · 2026-10-07

The Effect Gallery.

### Added

- 55 Photoshop effects as live raster effects: Artistic (Colored Pencil, Cutout, Dry Brush, Film Grain, Fresco, Neon Glow, Paint Daubs, Palette Knife, Plastic Wrap, Poster Edges, Rough Pastels, Smudge Stick, Sponge, Underpainting, Watercolor), Blur (Radial Blur, Smart Blur, beside Gaussian Blur), Brush Strokes (Accented Edges, Angled Strokes, Crosshatch, Dark Strokes, Ink Outlines, Spatter, Sprayed Strokes, Sumi-e), Distort (Diffuse Glow, Glass, Ocean Ripple), Pixelate (Color Halftone, Crystallize, Mezzotint, Pointillize), Sketch (Bas Relief, Chalk & Charcoal, Charcoal, Chrome, Conté Crayon, Graphic Pen, Halftone Pattern, Note Paper, Photocopy, Plaster, Reticulation, Stamp, Torn Edges, Water Paper), Stylize (Glowing Edges), Texture (Craquelure, Grain, Mosaic Tiles, Patchwork, Stained Glass, Texturizer) and Video (De-Interlace, NTSC Colors). They stay editable in the Appearance panel and keep their look at any zoom.
- Effect > Effect Gallery: every effect as a thumbnail of the selection, a large preview, and the chosen effect's options. The Effect menu now lists Illustrator effects above and Photoshop effects below.
- Effect > Rasterize as a live effect (resolution, white or transparent background, Add Around Object), and Effect > Document Raster Effects Settings.
- `apply_effect` lists and applies the new effects (`gallery.*`, `blur.radial`, `blur.smart`, `rasterize.raster`).

### Changed

- SVG export writes objects with these effects as images at the document's raster resolution; PDF export already rasterised raster effects there.
- A layer with one of these effects is rendered once per zoom and reused while panning.

## 0.13.0 · 2026-10-07

Reading other people's files, and the last partial rows.

### Added

- Any PDF or PDF-compatible `.ai` opens: one artboard per page with editable paths (fills, strokes, dashes, opacity, blend modes), clipping groups, gradients from axial and radial shadings, images, Type 3 glyphs as paths and point type. Gray, RGB and CMYK colours stay native; ICCBased, Indexed, Separation, DeviceN and Lab convert. Type takes the installed font with the same PostScript name or family, otherwise Helvetica, Times New Roman or Courier New, and is tracked to the width the PDF gave it. The open reports substituted fonts and anything left out.
- The Live Paint Selection tool (Shift+L): select faces and edges, Shift to add or remove, then change their fill, stroke and width from the panels or delete them. Edges are now painted per segment between crossings, and a fill chosen with the whole group selected paints every face.
- The Asset Export panel with File > Export > Collect for Export as Single Asset and as Multiple Assets: rename assets, set scales, suffixes and formats, and export each asset cropped to its art as PNG, JPEG, WebP, SVG or PDF in one ZIP.
- Contextual alternates (calt), with contextual and chaining contextual GSUB lookups now applied for every feature, and the Glyphs panel's alternates row for the selected character.
- `live_paint` with action `edge` takes a `width`; 0 hides the edge.

### Changed

- On Linux the font list includes every folder fontconfig is configured with, so fonts installed outside `/usr/share/fonts` appear in the Character panel and match PDFs.

## 0.12.0 · 2026-10-07

Live objects.

### Added

- Live Paint groups: Object > Live Paint > Make, Merge, Release, Gap Options and Expand. The Live Paint Bucket fills the areas the paths close and Shift-click paints a path's stroke; colours follow their areas when the paths are moved or reshaped, and gap detection closes small openings.
- Pattern editing mode from Object > Pattern > Make, Edit Pattern or a double-click on a pattern swatch, with the Pattern Options panel (tile type, brick offset, size to art or exact size, spacing, overlap, copies, dimming, tile edge) and Done, Save a Copy and Cancel. Brick and hex tiles now repeat as bricks and hexes.
- Image Trace makes a live tracing object that keeps the image: the Image Trace panel with presets, mode, colours or threshold, paths, ignore white, smoothing and preview; five views; Make and Expand, Expand and Release. Three more presets: Silhouettes, Line Art and Technical Drawing.
- The Symbol Shifter, Scruncher, Sizer, Spinner, Stainer, Screener and Styler, with diameter, intensity and the user defined, average and random methods.
- New Brush from the selected art for calligraphic, scatter, art and pattern brushes, Brush Options, Delete Brush and previews drawn from each brush.
- Gradient mesh editing: drag a point's handles to bend the patches, set a point's colour and opacity in the options bar, Shift-click to add lines in the colour already there, Alt-click to remove lines.
- MCP tools `live_paint`, `symbolism`, `gradient_mesh` and `edit_pattern`; `image_trace` makes, retraces, views, expands and releases tracing objects; `group` returns the new group's id. 65 tools.

### Fixed

- Image Trace produced slivers instead of shapes: closed outlines were simplified down to two points.
- The nearest point on a straight segment was found off along the line, so clicking straight edges, Add Anchor Point and the Scissors missed or cut in the wrong place, and anchors added to straight lines gained handles.
- Moving a mesh point moved its handles a second time.
- A pattern whose tile was not at the document origin exported to SVG as an empty fill, and an edited pattern could keep showing its old tile.

## 0.11.0 · 2026-10-07

Paint and selection gaps.

### Added

- Freeform gradients in points and lines modes: Freeform in the Gradient panel lays colour points over each selected object; the Gradient tool adds, moves, spreads and deletes points, and the panel sets a point's colour and spread. They export to SVG and PDF.
- The Color Guide panel: twelve harmony rules around the current colour, tints and shades, warm and cool, and vivid and muted variations, and saving a harmony as a swatch group.
- Live shapes stay editable after drawing: a Shape section in Properties (size, each corner radius and corner type, pie angles, sides, points, radii, line length and angle) and corner widgets on the canvas for rectangles and polygons.
- Magic Wand tolerances for fill colour, stroke colour, stroke weight and opacity, plus blending mode, with Shift to add and Alt to subtract.
- Ctrl-click (Cmd-click) selects the object behind; equal-spacing smart guides; View > Snap to Pixel and Show Corner Widget.
- MCP tools `edit_shape`, `select_similar` and `color_harmony`; freeform fills in `set_paint`; `get_object` reports live shape values. 61 tools.

### Fixed

- Moving or scaling an object with a freeform fill left the colour points behind.
- An agent call that made several changes (a fill and a stroke, say) took several undos; each call is now one step.

## 0.10.0 · 2026-10-07

Type gaps.

### Added

- Threaded text: Type > Threaded Text > Create, Release Selection and Remove Threading; in and out ports with overflow marks; loaded text from the out port into a click, a drag or a closed path; View > Show Text Threads.
- Text wrap: Object > Text Wrap > Make, Release and Options with offset and invert, around any object above area type in its layer.
- Area type in a closed shape flows inside the shape, not just its bounds.
- OpenType features shaped from the font (ligatures, discretionary ligatures, swash, alternates, stylistic sets, titling, ordinals, fractions, slashed zero, case forms, figure styles and positions) in a new section of the Character panel, drawn as the font's own glyphs on the canvas, in outlines, in PDF and in SVG.
- Small Caps from the font's small capitals, or synthesized when it has none.
- Character Styles and Paragraph Styles panels: new from the selection, apply, redefine, delete, rename, override marks and the Normal styles.
- Find Font: the fonts in use, find their type, replace a family and style everywhere.
- MCP tools `text_flow`, `text_style` and `find_font`; `set_text` takes `caps` and `features`; object descriptions report `overflow` and threads. 58 tools.

### Fixed

- The outline of a moved or rotated text box followed its original place.

## 0.9.0 · 2026-10-07

The application and the harness.

### Added

- The application controller: native and in-window menus, the command palette, keyboard shortcuts, workspaces (Essentials, Essentials Classic, Painting, Typography, Layout, Web) and document tabs wiring every subsystem together.
- The `formpth-harness` skill pack for agents drawing through MCP, and `formpth-skillset` for agents changing formpth's code; `.mcp.json`, Codex and Cursor configs, `CLAUDE.md` and `AGENTS.md`.
- CI: typecheck and build, the engine self-check and boot probe, the skill sync check, and desktop builds for macOS (Apple silicon and Intel), Windows and Linux.
- README, the parity scorecard in `docs/PARITY.md`, the wiki under `.docs/wiki`, and the living HASHOUT logs.

## 0.8.0 · 2026-10-07

Agents.

### Added

- The agent bridge in the window: every MCP tool runs against the engine, with one undo step per call, `render` and `inspect` for looking, and consent asked once in the window before any outside agent may draw.
- The plugin host: plugins add commands and draw by calling the same tools agents use.
- The assistant panel, which drives the same tools through the configured language model.
- Help: the manual inside the app, with the plugins dialog and the agent consent prompt.

## 0.7.0 · 2026-10-07

Files.

### Added

- `.fpth` projects: a versioned manifest with the document and its images, saved to the engine's library with conflict copies, or to disk.
- SVG import and export with gradients, clipping, masks, text and symbols; PDF export with a formpth stream so a saved PDF opens back as live artwork.
- PNG, JPEG and WebP export at any scale; Export for Screens across artboards and assets with suffixes and formats; image trace with presets, thresholds and colour counts.
- The home screen with recent projects, Preferences, and the New Document, Open, Export, Settings, Shortcuts and About dialogs.

## 0.6.0 · 2026-10-07

Type.

### Added

- Typing on the canvas with a caret, selection, IME and the clipboard.
- Type, Area Type, Type on a Path and Vertical Type; Character, Paragraph and Glyphs; Find and Replace.
- Bundled Inter and JetBrains Mono, installed fonts through the engine, and glyph outlines through opentype.js for Create Outlines and PDF.

## 0.5.0 · 2026-10-07

Panels.

### Added

- Properties, Transform, Align and Pathfinder; the Layers tree with layer colours, solo, lock, layer options, locate and drag to restack or nest.
- Color in five models, Swatches with global and spot colours, Gradient with stops and midpoints, the colour picker.
- Stroke with dashes, arrowheads and profiles; Transparency with opacity masks; Brushes; Appearance and Graphic Styles.
- Symbols, Artboards, Links, Navigator, Info, History and Actions with recording; dialogs that preview through the engine.

## 0.4.0 · 2026-10-07

Stage, transform and paint tools.

### Added

- The two-canvas stage: pasteboard, artboards, grid, art and isolation on one canvas; rulers, guides, selection marks in the layer colour, the bounding box, smart guides and tool overlays on the other.
- Rotate, Reflect, Scale, Shear, Free Transform with free distort, Reshape, Width, Warp, Twirl, Pucker and Bloat.
- Eyedropper, Gradient with its annotator, Mesh, Live Paint Bucket, Shape Builder, Blend, Symbol Sprayer and Measure.
- The tool rail with flyouts and Edit Toolbar, the Fill and Stroke widget, the options bar, the status bar and document tabs.

## 0.3.0 · 2026-10-07

Selection and drawing tools.

### Added

- Selection, Direct Selection, Group Selection, Magic Wand and Lasso; Hand, Rotate View, Zoom and the Artboard tool.
- Pen, Add and Delete Anchor Point, Anchor Point and Curvature.
- Rectangle, Rounded Rectangle, Ellipse, Polygon, Star, Flare, Line Segment, Arc, Spiral, Rectangular and Polar Grid, with exact sizes on a click.
- Pencil, Smooth, Path Eraser, Join, Paintbrush, Blob Brush, Eraser, Scissors and Knife.

## 0.2.0 · 2026-10-07

Document engine.

### Added

- The document model: artboards, layers and sublayers, groups, paths with absolute anchors and handles, compound paths, clipping groups, type, images, symbol instances, blends, meshes, repeats, envelopes and live shapes, each with an appearance stack of fills, strokes and effects.
- Snapshot history with one step per change and gesture merging; Canvas 2D rendering with a cached path per node; hit testing; point, grid and smart-guide snapping.
- Operations: Pathfinder's ten operations on curves through paper.js, Offset Path to Clean Up, align, distribute, arrange, expand, Recolor.
- The tool registry that the rail, the options bar and the keyboard are built from.

## 0.1.0 · 2026-10-07

Scaffold.

### Added

- The `formpth` and `formpth.bat` dispatchers, one-command installs, and one setup script per task with a `.bat` twin, including `./formpth mcp` and `./formpth agents install|sync`.
- The engine service on 127.0.0.1:8230: the `.fpth` project library with conflict copies, the installed-fonts service, file writes for agents, the MCP endpoint with its tool catalogue and the bridge to the window, the assistant's language model, plugins and sending to NodeMode.
- The frontend toolchain (TypeScript 7, Vite 8 on port 5230 bound to localhost) and the formvis shell base renamed: tokens and component styles, themes, dialogs, menus with native menus on macOS, the dock and panel groups, icons, toasts and the error log.
- The Tauri 2 desktop shell: splash, the engine sidecar on a free loopback port, `.fpth` association, the updater, and the app icon.
