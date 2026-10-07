# Changelog

Versions follow `v*.*.*` with dots. Dates are UTC.

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
