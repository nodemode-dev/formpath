# Changelog

Versions follow `v*.*.*` with dots. Dates are UTC.

## 0.53.2 · 2026-11-11

- Cancelling a symbol or pattern edit puts the document back as it was even when the edit took more steps than History Options keeps; before, the edit group stayed and the symbol instance stayed hidden.
- PDF export draws characters the chosen font lacks, such as Greek in Inter or Chinese and Japanese, from a font that has them: Inter's own Greek, Cyrillic, Vietnamese and extended Latin files first, then a font installed on the computer. Create Outlines and outlined PDF text use the same fallback. When no font has a character, it stays an empty box and the export says which characters.
- Invisible characters (variation selectors such as the one after a heart, joiners and other format characters) and combining marks the font lacks are left out instead of starting a search through installed fonts or drawing a box. Colour emoji cannot be embedded in a PDF; they are named once in their own note, without a font search.
- The export notes belong to the export that made them: two exports at once no longer mix them, and an export an agent asks for answers the agent instead of showing a message in the window.
- A fallback font whose licence forbids embedding (OS/2 `fsType` restricted) is not embedded; that text is drawn as outlines instead.

## 0.53.1 · 2026-11-10

- The Path Eraser leaves paths it does not touch unchanged, and it tests the curve itself rather than the straight line between its points.
- Plug-ins and the assistant can no longer reach the file tools through internal tool names.
- Grayscale, CMYK and EXIF-rotated JPEGs export correctly to PDF.
- Undo marks keep pointing at the same state once the history is full.
- Cancelling a colour pick in the 3D panel closes its undo step.
- Make Fill Regions leaves the objects it cannot use where they were.
- Enter on Cancel, Delete or a dropdown button no longer applies the dialog.
- A self-referencing `use` or marker no longer hangs SVG import.
- In the desktop app, Claude Code, the Chat tab and the dock's terminals reach the engine on its real port instead of port 0, so Claude Code has formpath's tools there.
- An agent's call that timed out is dropped instead of running later in the next window that opens.
- Make with Top Object maps art the same way whichever way the top path winds.
- The Windows desktop build packs the frontend it has just built, so the installed app no longer shows the previous interface.
- `./formpath mcp`, `cli` and `i18n` run Python 3.12 or newer and say so when there is none, instead of failing on an older Python or a missing `python3`.
- Pattern fills repeat at the tile's own width and height.
- `formpath.bat` `mcp`, `cli`, `i18n` and `agents` return Python's exit code, so a failed check or command no longer reports success.
- A damaged DWG section map fails with a clear error instead of hanging.
- A DXF HATCH with a huge vertex or edge count no longer freezes DXF import.
- A cancelled drag unwinds both the document and the tool's own state.
- A Chat message that starts with "-", such as a bulleted line, reaches Claude Code as text.
- Pathfinder gives each hole to its nearest enclosing shape in nested contours.
- The stdio MCP bridge answers a slow tool call with a timeout instead of starting a second engine and sending the call again.
- SVG saved with editing preserved keeps the pixels of hidden, warped and symbol-only images.
- Agent tools hold counts to the ranges they advertise.
- Rotating or reflecting a Mirror repeat turns its axis too.
- An opened project's images are kept in the person's own data folder instead of a temporary folder shared by every account on Linux.
- The Rotate View tool turns with the pointer.
- Convert to Profile also converts pattern art, masks and region fills.
- Moving the library folder moves every project or none, and a project whose name is taken lands under a new name without overwriting an earlier moved copy.
- SVG import sizes files that are given in percent, keeps layer effects and maps bounding-box gradients through transforms.
- The Rotate, Reflect, Scale and Shear dialogs use the tool's reference point.
- `formpath.bat clean --all` removes the engine's venv even when `node_modules` is already gone.
- A clip group's text wrap follows its clipping path.
- The Windows engine install stops with a message when its venv cannot be made, instead of installing into the system Python.
- X, Y, W and H read and write the same bounds when Use Preview Bounds is on.
- `./formpath check`, `counts`, `doctor` and `agents` find the engine's venv in Git Bash on Windows.
- Mirrored DXF ellipses, lines and splines import where they are drawn.
- A document whose colour profiles cannot be found no longer keeps the previous document's colour tables.
- `./formpath agents sync` and `counts` read the stored command catalogue from `FORMPATH_DATA_DIR`, where the engine keeps it.
- Artboard Options keeps a coloured artboard background.
- Copy carries the brushes and global swatches used inside groups and type.
- `build_app` finds and installs the macOS app under its name, FormPath.app.
- Every action set gets a name no other set has, so saving one never replaces another's file.
- DXF export writes non-ASCII text and layer names as code page escapes, and the DXF reader decodes them.
- Chat finds the Claude Code conversations of an agent folder whose path has non-ASCII letters.
- Placing an image is one undo step.
- Deleting an earlier artboard keeps the same artboard active.
- Dialogs with enhanced dropdowns no longer leave popups and listeners behind when they close.
- A vanishingly small pie wedge is left out instead of being drawn as a full disc.
- A formpath .ai placed through its private data puts gradients and symbol type where they are drawn.
- Right-click, file drops and the Recolor picker hit the right spot in a rotated view.
- A Ctrl+Alt shear with Free Transform selects the copy.
- The agent command gate names real command ids, so Preferences stays the person's and Batch is flagged.
- Aligned and Fit DXF TEXT starts at its first baseline point.
- Contextual OpenType features work in fonts that wrap their lookups in extensions.
- A layer row press released outside the list no longer leaves a drag that moves objects later.
- Page thumbnails appear when Place is reopened during a thumbnail render.
- Backspace, Delete and the arrow keys step over a whole emoji.
- New Terminal opens a new shell when the dock is hidden.
- Clearing a number field in Preferences keeps its value instead of setting the minimum.
- Space activates a keyboard-focused button instead of switching to the Hand tool.
- An installed font that failed to load while the engine was down loads once the engine is up.
- Export goes ahead when the hidden Range field holds an invalid range.
- Graph Data keeps quotes, tabs and newlines in labels.
- Placing page 201 or later of a long PDF works.
- PNG, JPEG and TIFF exports record the resolution they were rendered at.
- Data merge exports data sets whose names differ only in case to separate files.
- Changed shortcuts show in the menus and replace the native menu accelerators at once.
- The EPS five-operand `image` operator reads one gray sample per pixel in any colour space.
- Number fields convert typed units and take a decimal comma, and dash fields keep their checked value.
- Two PDF exports running at the same time each point at their own resources.

## 0.53.0 · 2026-11-03

- The README follows the Form family layout, with the project's own screenshots.

## 0.52.9 · 2026-11-03

- The app icon is the unified family icon on the desktop, in the browser tab and in the README, and the compiled app, its windows and its page titles are named FormPath.
- The repository lists its code owners.

## 0.52.8 · 2026-10-31

- The Windows desktop app no longer opens to a blank window on PCs where an installer set the `.js` file type to `text/plain` in the registry: the engine now serves scripts and stylesheets with their real types.

## 0.52.7 · 2026-10-30

- The engine installs on Windows, where Python is named `python`, and the Windows desktop build packs the frontend into the engine with Windows paths.
- Scripts keep LF line endings on every checkout, and the `.bat` files keep CRLF.

## 0.52.6 · 2026-10-26

- The home screen no longer jumps down by 40 px when the empty Recent line appears, and the desktop splash holds its logo, line and bar in a fixed box so the logo does not move while the page loads.
- The repository gains a window smoke test (the built window under a slow CPU and network: no layout shift, no console error, no failed or refused request), which CI runs on every push.

## 0.52.5 · 2026-10-26

- Letters turned into outlines are closed paths, so a stroke no longer shows a gap at the seam of each letter.
- The repository gains its automated tests (engine guard, outside-agent consent, MCP, project files, Pathfinder, SVG, PDF and type outlines), which CI runs on every push.

## 0.52.4 · 2026-10-26

- The desktop release build keeps its symbols, since macOS builds fail on a stripped binary.

## 0.52.3 · 2026-10-25

- A web page can no longer reach the engine through an image or a link.

## 0.52.2 · 2026-10-25

- The engine answers only this computer's own window and agents.

## 0.52.1 · 2026-10-24

- The copyright holder in LICENSE and the README is NodeAgentc, Inc.
- The Home screen credit reads "by nodemode.ai" in every language.

## 0.52.0 · 2026-10-23

- The Shaper tool's scribble does the operation you choose: an Operation choice in the options bar (Merge, Punch or Delete; Merge by default), with Alt held for Punch and Shift for Delete. The scribble only picks which regions or shapes are affected; a choice that does not fit what was touched changes nothing and the status line says so.
- The `shaper` agent and MCP tool take a required `operation` (merge, punch or delete) for scribble.
- Labels for the new choices and messages in all 26 languages.

## 0.51.4 · 2026-10-23

- NOTICE.md lists pyspellchecker and its word lists, xterm.js, the terminal packages, the Pillow wheel libraries with the FreeType credit, certifi, the frozen Python packages and the desktop shell crates; the installers carry LICENSE and NOTICE.md.

## 0.51.3 · 2026-10-23

- Eight more features carry formpath's own names, in all 26 languages: AI Shape Fill, AI Vector from Text, AI Patterns, AI Recolor, Glyph Touch, Interlace, Recolor Art and Font Match. Command and MCP tool ids and saved documents are unchanged.

## 0.51.2 · 2026-10-23

- Four features carry formpath's own names, in all 26 languages: Trace Image, Fill Regions (with its Bucket and Selection tools), Shape Crafter and Pin Warp. Shortcuts, command ids, MCP tool names and saved documents are unchanged.
- The translations of those features were written new; they no longer follow another product's localized names.
- NOTICE.md and the README carry the trademark notice; the README and the agent instructions no longer compare formpath with another product.

## 0.51.1 · 2026-10-22

- Releases are built by formcompiler (`nodemode-ai/formcompiler`), the release pipeline for every form* app, and published on its release page as `formpath-vX.Y.Z`. formpath's own GitHub Actions now only run the checks, on main, on pull requests and on `compile_vX.Y.Z` branches. A release starts when a `compile_vX.Y.Z` branch is pushed. The steps are on the wiki's Releasing page.
- The updater looks for new versions in formcompiler's `formpath-updates` feed.
- No change to the app itself.

## 0.51.0 · 2026-10-22

- Preferences follows the Form family: a floating rail of section tabs that folds to icons, every section as a foldable card in one scrolling pane that the rail follows, and a line from the active tab to the pane.
- The status bar follows the Form family: undo, redo and zoom tools with a typed zoom field, the artboard size, an info readout that cycles with a click, the tool hint, and a Working indicator that never flashes for quick jobs.

## 0.50.0 · 2026-10-22

- The title row follows the Form family: on macOS it leaves room for the traffic lights and drags the window; on Windows and Linux, View > Custom Title Bar draws Minimize, Maximize and Close in it. The row shows the document name and the window title follows it.
- macOS menu bar: Undo, Redo, Cut, Copy, Paste and Select All work inside text fields, check items show their state, and View > Menus in Window keeps the menus in the window.
- A new Home screen: navigation (Start, Recent, Projects), a greeting, a start card, recent files with filter, sort and grid or list, and the document presets; a preference brings Home back when the last document closes.
- All 28 Form family themes, so a theme picked in another form app shows the same here.

## 0.49.0 · 2026-10-22

- The desktop app starts like the rest of the Form family: a rounded splash card with the formpath icon, Starting formpath and a loading bar; the main window stays hidden until its page has painted, then appears whole at least 2.6 s after launch. On macOS the title bar is an overlay with the traffic lights centred in a 38 px row.
- The owner's icon is the master (`assets/formpath_icon_macos.png`); the macOS `icon.icns` now keeps its margin and shadow, so it no longer sits larger than the rest of the family in the Dock.

## 0.48.0 · 2026-10-21

The project is renamed from formpth to formpath.

### Changed

- Every name, file, folder, script, module, skill pack, MCP tool prefix (`mcp__formpath`), environment variable (`FORMPATH_*`), storage key and translation now says formpath: `./formpath`, `formpath.bat`, `backend/formpath_engine.py`, `frontend/src/styles/formpath.css`, `assets/formpath_icon.*`, `.claude/skills/formpath-skillset` and `formpath-harness`.
- The desktop identifier is `ai.nodemode.formpath` and the update endpoint is `nodemode-ai/formpath`.
- The `.fpth` project extension is unchanged, so existing projects still open.

### Upgrading

- Rename any `FORMPTH_*` variables in your `.env` to `FORMPATH_*`.
- Preferences and panel layout saved in the browser under the old name start fresh, and the desktop app keeps its data under the new identifier.
- Re-add the MCP server in other agents as `formpath` if they were set up by hand.

## 0.47.0 · 2026-10-16

Plan v0.10.0 phase 43, second part: the rest of the defects the seventh audit found.

### Added

- Adobe RGB (1998) compatible and Display P3 working spaces, built by formpath from their published definitions.
- View > Proof Setup presets: Working CMYK, each installed CMYK profile, Monitor RGB.
- The Effect Gallery groups its filters in folders (Artistic, Brush Strokes, Distort, Sketch, Stylize, Texture), includes the vector Distort and Stylize effects, and stacks several effect layers as one effect.
- Asset Export settings per asset, with several assets edited at once; Collect for Export in the canvas context menu.

### Fixed

- Image Trace keeps rectangle corners sharp and edges straight.
- Text to Pattern scales the generated art into the tile; pattern swatches show their tile.
- The Print dialog preview shows marks and bleed, a chosen plate and the colour-managed look.
- Saving and downloading a project after a linked file changed on disk; a link that cannot be read is named.
- The Links panel shows which PDF or AI page is placed.
- OpenType options a font does not have are disabled one by one.

## 0.46.0 · 2026-10-16

Plan v0.10.0 phase 43, first part: defects the seventh audit found by driving the interface.

### Fixed

- The Pen and Pencil start on path intersections; intersection snapping outranks path snapping.
- Snap to Grid snaps both corners of a drawn shape and moved edges.
- The Smooth tool rounds corners and reduces jaggedness (Fidelity option).
- Direct Selection on a live shape's corner moves only that anchor.
- Average with whole paths selected averages all their anchors.
- Warp, Twirl, Pucker and Bloat add points as they deform (Detail option); Trap handles a lighter shape that contains the darker one.
- Layers panel: clicking a row selects its object, double-clicking the name renames inline, double-clicking elsewhere opens Layer Options, and locking a layer deselects its objects.
- Typed values in the Colour panel apply on Enter, Tab and blur.
- Dialog colour fields take a typed hex value, and dialogs select their first text field, so swatch colours and names can be typed.
- The Gradient tool works on the active fill or stroke.
- The Actions panel shows the engine's real status.
- Separations Preview turns Overprint Preview on while a plate is shown.
- Switching the interface language keeps open documents.
- Gradient mesh colours spread smoothly across patches, on the canvas and in every export.

## 0.45.0 · 2026-10-16

Plan v0.9.0 phase 42: the seventh independent audit, the first to drive every row through the interface.

### Fixed

- The floating contextual task bar drew over open menus and swallowed clicks on them; it now sits under menus, popovers and dialogs.

### Changed

- `docs/PARITY.md`: 65.5 of 76 (86.2 percent), 55 Full and 21 Partial, from the seventh independent audit; additions 11 of 12. Each Partial row names the interface defect the audit found.

## 0.44.0 · 2026-10-16

Plan v0.9.0 phase 41: files and 3D.

### Added

- Photoshop export with Write Layers and Maximum Editability: layer groups, editable type layers and shape layers (solid or gradient fill, vector mask, vector stroke), with anything else as pixel layers and named in the export message. `export_file` takes `psd_edit`.
- 3D: an on-canvas rotation widget (X, Y and Z rings, free rotate, Shift for 15 degrees, double-click to reset) that redraws the object while you drag, and a live preview in the 3D panel to orbit, with draggable light handles.

### Fixed

- In a browser, File > Place, Relink, Relink from Folder and Unembed now keep file handles, so PNG and JPEG can be placed linked and PDF, PSD and TIFF offer Link; the Place dialog says when a file cannot be linked.

## 0.43.0 · 2026-10-16

Plan v0.9.0 phase 40: canvas proof and snapping.

### Added

- Smart Guides snap to the nearest point on any path and to path intersections, with labels and the segment highlighted; equal-spacing markers show their distance. Preferences > Selection and Snapping: Anchor/Path Labels, Measurement Labels, Object Highlighting, Spacing Guides.
- Knife: Alt cuts a straight line, Shift+Alt at 45 degrees. Eraser: Alt erases a rectangle.
- The Gradient panel's Classic and Perceptual choice is labelled Method.

### Fixed

- Scissors missed a segment under another filled shape and ignored compound paths; Knife fused a selected group; Eraser skipped open paths and treated stroke-only shapes as fills.
- EPS and `.ai` export dropped the perceptual gradient method.
- New type in a new document was white on a white artboard; it is now black with no stroke unless a fill was picked.
- Adding or duplicating layers shifted the rows below; rows now move by transform.

## 0.42.0 · 2026-10-16

Plan v0.8.0 phase 39: the sixth independent audit, and two defects it found.

### Fixed

- Placing one page of a multi-artboard `.ai` embedded through its Illustrator data brought in every artboard; it now brings in the objects on the chosen artboard.
- PNG and JPEG exports record the export resolution (300 ppi reads back as 300 ppi).

### Changed

- `docs/PARITY.md`: 73 of 76 (96.1 percent) from the sixth independent audit, which graded six rows Partial: Placed images, `.ai`, Raster export, 3D and Materials, Smart Guides, and Eraser, Scissors and Knife.

## 0.41.0 · 2026-10-16

Plan v0.8.0 phase 38: modern Illustrator files.

### Added

- PDF-compatible `.ai` files open through Illustrator's private data (zlib and Illustrator 24 ZStandard): layers, sublayers, hidden and locked states, object names, every artboard, raster images, gradients with stop opacity, art styles as graphic styles, and styled objects as the editable source with live Drop Shadow, Outer Glow, Feather, Round Corners, Offset Path, Transform or stroke alignment. The file's CMYK profile becomes the document's CMYK working space.
- A guard renders each artboard against the file's own PDF page and opens through the page when more than 12 percent of pixels differ. On 36 real files from Illustrator 13 to 24, 33 opened through the private data and 3 fell back.
- Placing an `.ai` embedded uses the private data.
- Export `.ai` writes Illustrator private data (layers, sublayers, groups, clip groups, compound paths, gradients, spot colours, symbols, artboards, images; type as outlines). Not yet confirmed in Illustrator itself.

### Known gaps

- Placed symbol instances and art, pattern and scatter brushes on strokes come in expanded, as do live effects formpath has no equivalent for; opacity masks are dropped.

## 0.40.0 · 2026-10-16

Plan v0.8.0 phases 36 and 37: the four rows the fifth audit found Partial.

### Added

- Vector effects (warp, Free Distort, Pucker and Bloat, Roughen, Transform, Tweak, Twist, Zig Zag, Round Corners, Scribble and the path effects) on groups, layers and live type, on the canvas, in bounds and hit testing, in Expand Appearance and in every exporter; type stays editable.
- Layers panel menu: Duplicate Layer, Duplicate Selection, Merge Selected, Flatten Artwork, Release to Layers (Sequence and Build), Reverse Order, New Sublayer, Layer Options; MCP `layer_action`.
- Export GIF and PNG-8 (Perceptual, Selective, Adaptive palettes, dither, interlacing, transparency and matte), 24-bit BMP, and layered Photoshop PSD with an ICC profile. Every raster export takes a resolution in ppi and an anti-aliasing choice (Art Optimized, Type Optimized, None).
- Place PDF and `.ai` (page picker, Crop To; linked or embedded), PSD (flattened or layers to objects) and TIFF; open PSD and TIFF directly. The MCP `place` and export tools take the new formats.
- 122 new strings in all 25 languages.

### Changed

- `docs/PARITY.md`: 75.5 of 76 (99.3 percent), self-graded; `.ai` is the one Partial row.

## 0.39.0 · 2026-10-16

Plan v0.7.0 phase 35: the fifth independent audit, and three known defects.

### Fixed

- A 33,000-object DWG opened in 12 to 20 seconds (88 in one run) because the Layers panel built a row for every object; the panel now draws only the rows in view, and the same file opens in about 1.3 seconds. Large SVG and PDF files benefit the same way.
- PDF/A-2b with printer's marks wrote a CMYK registration colour the standard forbids; marks are drawn in RGB under PDF/A.
- The DWG reader reads an entity's handles in the specified order (reactors and extension dictionary before the R2000 neighbour links); no sample changed.

### Changed

- `docs/PARITY.md`: 73.5 of 76 (96.7 percent) from the fifth independent audit, which graded five rows Partial: Layers, Distort and Transform, `.ai`, Raster export and Placed images.

## 0.38.0 · 2026-10-16

Plan v0.7.0 phase 34: generative controls, DWG, 3D models.

### Added

- Text to Vector Graphic, Generative Shape Fill and Text to Pattern: Detail, style presets, style reference from artwork or an image, effects, colour and tone presets or a custom palette; repaired and validated output with gradients, strokes and compound paths; Shape Strength; pattern tile size, layout, spacing and a seamless check. The MCP tools take the same options.
- File > Export > AutoCAD Drawing (.dwg), written as AutoCAD 2000; `export_file` writes .dwg.
- DWG R2007 opens natively.
- 3D per-surface materials; File > Open and Place read .obj (with .mtl) and .glb or .gltf models as 3D objects.
- Illustrator (.ai) export writes top-level layers as Acrobat layers.
- 62 new strings in all 25 languages.

### Changed

- `docs/PARITY.md`: 74.5 of 76 (98.0 percent), self-graded pending the next independent audit.

## 0.37.0 · 2026-10-16

Plan v0.7.0 phase 33: files.

### Added

- SVG import: pattern fills and strokes, masks, blur, drop shadow and glow filters as live effects, markers, styled tspans and text on a path; formpath's own SVG round-trips without its native copy.
- EPS import brings in images (image, colorimage, imagemask) with the common PostScript filters.
- PNG, JPEG, WebP and TIFF embed the document ICC profile (Embed ICC Profile in Export); CMYK TIFF converts through the document profile.
- Separations print as vector plates; the Ink Manager turns inks off, converts spots to process and aliases spots.
- PDF: live text as runs, AES-256 passwords and permissions, PDF/X-1a, PDF/X-3 and PDF/A-2b, compression options, Acrobat layers from top-level layers; PDF import reads layers and ICC-based colours. The Export dialog has General, Marks and Bleeds, Compression and Security tabs. `export_file` takes the same options.
- 88 new strings in all 25 languages.

### Changed

- PDF gradient fills whose stops have opacity are rasterised, as gradient strokes were, so the fade is kept.
- `docs/PARITY.md`: 72.5 of 76 (95.4 percent); SVG in and out is Full.

## 0.36.0 · 2026-10-16

Plan v0.7.0 phase 32: Pathfinder and shapes.

### Added

- Live compound shapes: Alt-click a Shape Mode in Pathfinder, or Make Compound Shape; children stay editable with their own mode; Expand and Release.
- Effect > Pathfinder: Add, Intersect, Exclude, Subtract, Minus Back, Divide, Trim, Merge, Crop, Outline, Hard Mix, Soft Mix and Trap as live effects on groups.
- Pathfinder Options: precision, Remove Redundant Points, Divide and Outline Will Remove Unpainted Artwork.
- Live polygons and stars keep inverted and chamfer corners; Object > Shape > Convert to Rectangle, Rounded Rectangle, Ellipse, Polygon or Star, and Convert to in Properties.
- Width tool: move, resize one side, duplicate and delete width points; Width Point Edit; Flip Along, Flip Across, Add to Profiles, Delete Profile, Reset Profiles.
- MCP: `pathfinder` takes `live`; `edit_shape` takes `corner_type` and `convert_to`; `set_stroke` takes `width_points`, flips and custom profiles.
- 52 new strings in all 25 languages.

### Changed

- Variable-width strokes now sample at every width point, so a width point in the middle of a two-anchor path shows.
- `docs/PARITY.md`: 72 of 76 (94.7 percent), the audited 70.5 plus three rows built since.

## 0.35.0 · 2026-10-15

Plan v0.6.0 phase 31: the fourth independent audit, and three rows narrowed.

### Added

- DWG R2000, R2004, R2010, R2013 and R2018 open natively, no converter needed; R2007 and older still use an installed converter.
- 3D Graphic material: an image or symbol as the surface texture with scale, rotation and offset; Roughness and Metallic. MCP `three_d` takes the same.
- Legacy `.ai` files bring in pattern swatches, symbols and calligraphic, art and pattern brushes.
- 55 new strings in all 25 languages.

### Changed

- `docs/PARITY.md`: 70.5 of 76 (92.8 percent) from an independent audit of v0.34.0, down from the self-graded 74.5. Eleven rows are Partial; the page lists what each lacks.

## 0.34.0 · 2026-10-15

Plan v0.6.0 phase 30: printing, import and 3D.

### Added

- File > Print: paper and orientation, fit, percent or tiled scaling, printer's marks and bleed, composite or separations, colour handling by formpath or the printer, live page preview.
- Proofing uses the display profile the engine detects (colord, X11, ColorSync, Windows, or FORMPATH_DISPLAY_PROFILE); Preserve CMYK Numbers works.
- PDF import: soft masks, image masks, mesh shadings, tiling patterns, and encrypted files (Standard handler R2 to R6) with a password prompt; `open_file` takes `password`.
- `.ai` files saved without PDF compatibility open, including AI9 private data compressed with Deflate or ZStandard.
- 3D: Inflate and Map Art under ray tracing.
- 65 new strings in all 25 languages.

### Changed

- The content security policy allows blob: frames and objects, so printing can load the generated PDF.
- `docs/PARITY.md`: 74.5 of 76 (98.0 percent), self-graded; colour management and print and PDF in and out are Full.

## 0.33.0 · 2026-10-15

Plan v0.6.0 phase 29: vector PDF, translations, verification and a steady window.

### Added

- PDF export writes opacity masks as soft masks, gradient meshes as Coons patch shadings, patterns as tiling patterns and freeform gradients as triangle shadings; only raster effects stay images. A test document fell from 1.64 MB to 240 KB.
- Printer's marks set their page information in an embedded subset of Inter, so PDF/X-4 files carry no unembedded font.
- The 68 strings added in 0.32.0 in all 25 languages.

### Fixed

- Opening a document, from any path, and selecting or deselecting objects no longer move the Properties column, the status bar or the Layers panel.

### Verified

- DWG from AutoCAD 2000, 2004, 2007, 2010, 2013 and 2018 converts through LibreDWG dwg2dxf; a 2018 drawing opens with its three layers and 80 paths, and the toast names the converter and what DXF leaves out.

## 0.32.0 · 2026-10-15

Plan v0.6.0 phase 28: the five Partial rows, first pass.

### Added

- Colour management on LittleCMS: Edit > Color Settings, Assign Profile, Convert to Profile; View > Proof Setup and Proof Colors; installed, system and loaded ICC profiles; formpath Generic CMYK when no press profile is loaded. MCP `list_color_profiles`, `set_color_settings`, `convert_to_profile`, `proof_colors`. 92 MCP tools.
- PDF export writes live, searchable type with embedded font subsets (fontTools); PDF/X-4 with the CMYK profile as the output intent (`export_file` `pdf_standard`).
- Export > Illustrator (.ai): PDF-compatible, every artboard a page, reopens fully editable.
- DWG opens through the ODA File Converter or LibreDWG's dwg2dxf when installed, in the window and through `open_file`.
- 3D and Materials: lighting presets and up to eight lights, Render with Ray Tracing at three qualities, brushed metal, wood and rough materials.

### Known

- 68 new interface strings show in English in the other 25 languages until the next translation pass.

## 0.31.0 · 2026-10-15

The re-grade, and the rows it found short.

### Added

- Object > Generative > Text to Vector Graphic: Subject, Scene, Icon or Pattern from a prompt, three variations, placed as editable paths; MCP `text_to_vector`.
- Generative Recolor in Recolor Artwork: palettes from a prompt remap the artwork's colours; MCP `generative_recolor`. Both run on the model set for the Assistant. 88 MCP tools.
- Stars take a live corner radius; live rectangles, polygons and stars stay live when their corners are rounded.
- Attributes panel: Overprint Fill and Overprint Stroke; `set_paint` takes `overprint_fill` and `overprint_stroke`.

### Fixed

- Package copies fonts formpath bundles as well as installed ones.
- Document Setup is one undo step.
- The preference to show the side column as icons in a narrow window now does so.

### Changed

- `docs/PARITY.md`: 73.5 of 76 (96.7 percent) after a third independent audit (71 at v0.30.0) and the rows built since; the 12 plan additions graded 12 of 12.

## 0.30.0 · 2026-10-15

Output, and the home screen fixed.

### Added

- Export TIFF (RGB, RGBA or CMYK; PackBits, LZW or Deflate; set resolution) and an artboard Range for every format.
- PDF marks and bleed: trim, registration, colour bars and page information, document or custom bleed, BleedBox and TrimBox; Document Setup gains bleed.
- File > Package... collects the document, linked images and fonts into a folder with a report. Window > Document Info.
- View > Overprint Preview and Window > Separations Preview (process and spot plates).
- Edit > Spelling > Auto Spell Check; Find Similar Fonts in the Character panel; Create Swatch Info; Smooth... with an amount; Simplify shows the original outline while previewing.
- Hand-written descriptions and Use when sentences for agents on the most used commands; `./formpath counts --commands --check`; `./formpath i18n prune` and `untranslated`.

### Fixed

- The home screen covers the workspace: the Properties column, panel tabs and Layers list no longer show through it. No raw z-index values remain outside the token scale.

## 0.29.0 · 2026-10-15

What professionals ask Illustrator for.

### Added

- A large canvas: artboards up to 163,440 pt (2,270 in) a side, PDF pages beyond 14,400 pt written with UserUnit, raster export tiles past the 16,384 px browser limit.
- Edit > Spelling: Check Spelling (Ctrl+I) and Edit Custom Dictionary, on a bundled word list with a personal dictionary.
- Gradients: Method Classic or Perceptual (OKLab) and Dither. Rasterize: colour model Color, Grayscale, Bitmap or Palette with diffusion or pattern dithering and custom colours.
- Preferences: Show generative features (off hides every generative entry point), anchor point and handle display size, Scale corners and Smart Guides construction angles.
- View > Help Bar, Window > Contextual Task Bar, Edit > Paste on Selected Artboards; Find Similar Fonts in the engine (`/api/fonts/similar`).
- The new strings in all 25 languages.

## 0.28.0 · 2026-10-15

Path and transform depth.

### Added

- Scallop, Crystallize and Wrinkle tools beside Warp, Twirl, Pucker and Bloat.
- Smart Guides snap to tangents and perpendiculars and to a list of construction angles; the Knife snaps to Smart Guides.
- Object > Ungroup All; Object > Pathfinder with the existing operations plus Hard Mix, Soft Mix and Trap; Object > Object on Path (Attach, Arrange); Object > Transform > Scale Corners.
- Simplify: Straight Lines, Angle Threshold and a point count; Transform Each: absolute sizes.
- The new strings in all 25 languages.

### Changed

- The Anchor Point tool ignores a drag under 3 px, so a click converts the point.

## 0.27.0 · 2026-10-15

The interface in 26 languages.

### Added

- Preferences > Interface > Language: English (the default) and 25 more, from Spanish and Brazilian Portuguese to Japanese, Chinese, Korean, Thai and Vietnamese, using Illustrator's localized terms. The window reloads in the chosen language and shows it from the first frame; document content, layer names, the terminal and chat replies stay as typed.
- `./formpath i18n extract|check|missing|export|import` to harvest the interface's strings, check every language and review one through CSV.

## 0.26.0 · 2026-10-15

The agent inside the window, the command catalogue, a one-run desktop build and Live Corners on any path.

### Added

- Terminal dock (Window > Terminal): real shells over engine PTYs, a Claude Code button that runs the person's own `claude` connected to formpath's tools without the outside-agent question, a Chat tab that answers through Claude Code in plain words, Restart, Hide and an ask bar that adds the document and selection as context.
- `./formpath claude` and `formpath.bat claude`: Claude Code in the current terminal with formpath's MCP server attached.
- The command catalogue: 649 menu commands and tools with group, menu path, description, parameters, risky and enabled state, mirrored to the engine. MCP `describe_command` and `run_commands` (one undo step); `list_commands` filters by group and word; `run_command` takes parameters. `GET` and `POST /api/commands`, and `./formpath cli list|describe|run`.
- `build_app` and `build_app.bat`: install, build the window, freeze the engine and bundle the desktop app in one run; DMG and Applications install on macOS, a `.deb` on Linux.
- Live Corners on any path: per-point Round, Inverted Round or Chamfer corners with absolute or relative radius, Direct Selection widgets with drag, Alt-click and double-click, a red limit preview, Object > Path > Corners... and Expand Corners; drawn the same on the canvas, in SVG and in PDF.

### Fixed

- Calls from the in-app Claude Code and Chat tabs run while outside agents are switched off.

## 0.23.0 · 2026-10-10

Files and generation. Every one of the 76 parity rows is built; an independent audit of the code puts parity at 72 of 76, 94.7 percent (68 Full, 8 Partial).

### Added

- DXF: open, place and drop ASCII DXF from R12 to 2018 (lines, polylines with arcs, circles, ellipses, splines, text and MTEXT, hatches, solids, dimensions, blocks and attributes, layers with colours and lineweights) with DXF Import Options; export AutoCAD 2000 or R12 with units, scale and type as text or outlines.
- EPS: Level 3 export per artboard in RGB or CMYK with real gradient shadings; formpath's own EPS reopens editable, and other EPS opens through a PostScript path reader. DWG is refused with a message to convert to DXF.
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
- Actions record dialog values, transforms including tool drags, drawn shapes, fills, strokes, opacity and graphic styles; per-step and modal toggles, stops, editing, reordering and duplicating; sets saved as `.fpaction` files in `~/Formpath/Actions`, with a Default Actions set.
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

- The agent bridge accepts calls only from the formpath window that holds its session secret, on the app's own origin; a missing consent answer counts as not allowed.
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
- The `formpath-harness` skill pack for agents drawing through MCP, and `formpath-skillset` for agents changing formpath's code; `.mcp.json`, Codex and Cursor configs, `CLAUDE.md` and `AGENTS.md`.
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
- SVG import and export with gradients, clipping, masks, text and symbols; PDF export with a formpath stream so a saved PDF opens back as live artwork.
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

- The `formpath` and `formpath.bat` dispatchers, one-command installs, and one setup script per task with a `.bat` twin, including `./formpath mcp` and `./formpath agents install|sync`.
- The engine service on 127.0.0.1:8230: the `.fpth` project library with conflict copies, the installed-fonts service, file writes for agents, the MCP endpoint with its tool catalogue and the bridge to the window, the assistant's language model, plugins and sending to NodeMode.
- The frontend toolchain (TypeScript 7, Vite 8 on port 5230 bound to localhost) and the formvis shell base renamed: tokens and component styles, themes, dialogs, menus with native menus on macOS, the dock and panel groups, icons, toasts and the error log.
- The Tauri 2 desktop shell: splash, the engine sidecar on a free loopback port, `.fpth` association, the updater, and the app icon.
