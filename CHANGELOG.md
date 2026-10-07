# Changelog

Versions follow `v*.*.*` with dots. Dates are UTC.

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
