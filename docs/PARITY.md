# formpth and Illustrator: parity

formpth is measured against Adobe Illustrator the way formvis is measured against Photoshop. Each row is one capability a working illustrator uses. A row is graded only from code: its data model, the command or tool that changes it, the interface that reaches it, and the render or export path that shows it.

| Grade | Score | Meaning |
| --- | --- | --- |
| Full | 1 | Model, command, interface and render or export all exist and match what Illustrator users expect for everyday work |
| Partial | 0.5 | It exists and works, with a named part missing |
| None | 0 | Not built |

A control that only stores a value, with nothing reading it, does not count toward a grade. Platform rows are shown and not scored.

The list is the 76-row baseline shared with the Illustrator, Inkscape and formpth comparison: every capability a working illustrator reaches for in Illustrator 30, generative features included. Until v0.16.0 this page graded a narrower list of 59 rows that left out 17 capabilities formpth did not have, and graded several rows Full on controls that did nothing. An independent audit of v0.16.1 against the full list found 41 Full, 22 Partial and 13 None (52 of 76). This page now follows that list. The v0.23.0 grades come from a second independent audit of the code at commit 803e327, done without this page, with one row held stricter than the auditor graded it (PDF, see its row).

## Score at v0.31.0

**74.5 of 76 scored rows, 98.0 percent:** 73 Full, 3 Partial, 0 None. Colour management and print and PDF in and out were raised to Full in v0.33.0 on work re-traced here; the next independent audit (plan v0.6.0 phase 31) grades them again. A third independent audit graded every row from a snapshot of the code at commit 85dbe07 (v0.30.0) with this page, the changelog, the README, the manual, the wiki and the HASHOUT logs removed: 71 of 76 (68 Full, 6 Partial, 2 None), plus 11.5 of 12 for the plan v0.5.0 additions. It raised Smart Guides to Full, lowered Rectangle to Star to Partial (stars had no live corner radius), and graded Text to Vector Graphic and Generative Recolor None, since the Assistant is not those features. All three gaps were then built in v0.31.0 and re-traced here, not by the auditor; the rows say so. The tally is at the end.

## Objects and layers · 8 of 8

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Layers and sublayers | Full | Layers panel tree with sublayers, layer colours, visibility (Alt for solo), lock, template, print, dim images, locate, drag to restack or nest |
| Groups and isolation | Full | Group, Ungroup, double-click to isolate with the veil and the Exit Isolation Mode bar |
| Arrange | Full | Bring to Front, Forward, Backward, to Back, Send to Current Layer |
| Align and distribute | Full | Align to selection, key object or artboard; distribute objects; distribute spacing with an exact gap |
| Artboards | Full | Artboard tool (draw, move with art, duplicate, resize, delete), Artboards panel, options, fit to art or selection, from selection, rearrange |
| Lock, hide, select behind | Full | Lock, Unlock All, Hide, Show All, Select Next Object Above and Below, Ctrl-click (Cmd-click) to step through the objects behind |
| Clipping masks | Full | Make and Release, layer clipping masks, isolation of clip groups |
| Transparency, blend modes, opacity masks | Full | 16 blend modes, opacity, opacity masks with Clip and Invert, Isolate Blending; Knockout Group drawn on the canvas and written to SVG and PDF (PDF also carries it through soft masks, since common readers ignore /K) |

## Selection and transform · 8 of 8

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Selection, Direct and Group Selection | Full | Bounding box, anchors, handles and segment reshaping, marquee and Shift selection, group-level clicks |
| Lasso and Magic Wand | Full | Lasso selects anchors; Magic Wand with fill colour, stroke colour, stroke weight, opacity and blending mode, each with its tolerance, Shift to add and Alt to subtract |
| Select Same and Select Object | Full | Twelve Same attributes; Select Object by kind, stray points, brush strokes, clipping masks |
| Bounding box and Free Transform | Full | The bounding box turns with the object and has Reset Bounding Box; Free Transform with its widget and options-bar modes (Constrain, Free Transform, Perspective Distort, Free Distort) and the modifier keys; distortions are projective, curves subdivided to follow them, type, images and symbols carried in an envelope with type still editable; Ctrl on a side handle shears |
| Rotate, Reflect, Scale, Shear, Transform Each and Again | Full | Origin click, Alt copy, exact dialogs, Transform Each with random, Transform Again |
| Smart Guides and snapping | Full | Alignment to edges and centres, equal-spacing guides with gap marks, labels, snap to point, grid and pixel; tangent and perpendicular snapping; construction angles chosen in Preferences (90 and 45, 30 to 90, or 30 degree sets) in `engine/snap.ts` snapLine; the Knife snaps too |
| Rulers, guides and grids | Full | Rulers from the active artboard, guides dragged from rulers, lock, make, release, clear, grid with subdivisions and snapping |
| Puppet Warp | Full | Puppet Warp tool (J): default and added pins, drag to bend while other pins hold, Shift to select several, Alt-drag to twist, Delete, Expand, Show Mesh; an as-rigid-as-possible solve over a triangle mesh of the art; type, images and symbols carried in an envelope. Pins belong to the tool, as in Illustrator |

## Drawing · 10 of 10

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Pen, Curvature and anchor tools | Full | Pen with close, continue, add and delete on paths, convert; Add, Delete and Anchor Point tools; Curvature |
| Pencil, Smooth, Path Eraser, Join | Full | Fitted Pencil that extends and closes paths; Smooth, Path Eraser and Join tools |
| Rectangle to Star with live corners | Full | Live rectangles, rounded rectangles, ellipses, polygons and stars with exact dialogs and arrow-key changes while drawing; Shape fields in Properties after drawing (size, every corner radius and corner type, pie angles, sides, points, radii, line length and angle); corner widgets on the canvas for rectangles, polygons and stars, which stay live when rounded; Live Corners on any path in Direct Selection (round, inverted, chamfer, absolute or relative, the Corners dialog). The audit graded this Partial because stars had no live corner radius; that was built in v0.31.0 and re-traced here |
| Line, Arc, Spiral and grids | Full | Line Segment, Arc, Spiral, Rectangular Grid, Polar Grid, Flare |
| Paintbrush and Blob Brush | Full | Paintbrush with the current brush; Blob Brush merging same-fill shapes |
| Eraser, Scissors and Knife | Full | All three cut real geometry |
| Shaper tool | Full | Shaper (Shift+N) turns gestures into live rectangles, rotated rectangles, circles, ellipses, triangles, polygons and lines; scribbles punch out, merge or delete regions; Shaper Groups keep their source shapes, with Faces and Shapes modes, face fills and Expand |
| Perspective Grid | Full | One, two and three point grids from Define Grid, with presets; the Perspective Grid tool (Shift+P) drags vanishing points, the ground and the planes; shape tools draw on the active plane (keys 1 to 4 or the plane widget); Perspective Selection (Shift+V) moves, copies, scales and moves perpendicular on a plane, and drags flat art and type onto one; attached art re-projects when the grid changes; type stays editable; Release; SVG and PDF without the grid |
| Dimension tool | Full | Dimension tool (Shift+I): linear (horizontal, vertical, aligned), angular, radius and diameter dimensions that keep measuring when moved or scaled and relabel with the document units; units, precision, scale ratio, arrows, label font and position; Expand. The Measure tool also reports area and perimeter |
| Graphs | Full | Nine graph tools (column, stacked column, bar, stacked bar, line, area, scatter, pie, radar) making live graphs; the Graph Data window with typing, paste, CSV import, transpose and Switch X/Y; Graph Type options and combined graphs; column and marker designs; series styles survive data edits; Ungroup gives plain art. Missing: sliding column designs and a second value axis |

## Paths and Pathfinder · 8 of 8

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Pathfinder | Full | Unite, Minus Front, Intersect, Exclude, Divide, Trim, Merge, Crop, Outline, Minus Back on curves through paper.js |
| Shape Builder | Full | Drag to merge regions, Alt to delete |
| Live Paint | Full | Live Paint groups (Make, Merge, Release, Expand) whose faces re-flow as the paths are edited, the Live Paint Bucket on faces and Shift on edges, each edge painted per segment between crossings, the Live Paint Selection tool (faces and edges, Shift to add, fill and stroke from the panels, Delete), Gap Options |
| Compound paths | Full | Make and Release; the Attributes panel sets non-zero or even-odd and reverses path direction, rendered and exported |
| Offset Path and Outline Stroke | Full | With joins and miter limit, as commands and as live effects |
| Simplify, Average, Join, anchors | Full | Simplify with preview, Smooth, Average, Join, Add and Remove Anchors, Reverse, Divide Objects Below, Split into Grid, Clean Up |
| Width tool and profiles | Full | Width points dragged on strokes; eight width profiles |
| Intertwine | Full | Make, Release and Edit Intertwine; the Intertwine tool (Shift+J) highlights overlaps, flips or cycles which object is on top with a click, and draws free zones with a drag; zones stay put when members move; Expand; drawn and exported with real clip paths |

## Paint and colour · 8 of 8

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Colour panel and modes | Full | Grayscale, RGB, HSB, CMYK, Web Safe, hex, spectrum, global tints |
| Swatches, global and spot | Full | Colour, gradient and pattern swatches; process, global, spot, tint, none and registration; colour groups as folders with drag and drop; 15 swatch libraries and User Defined; ASE read and write; spot colours and tints written to PDF as Separation colour spaces. Gradients with spot stops export as process |
| Gradients on fill and stroke, gradient tool | Full | Linear and radial with stops, midpoints, opacity and aspect; within, along and across strokes, each drawn and exported; the Gradient tool and annotator; freeform gradients in points and lines modes, made in the Gradient panel, edited with the Gradient tool (add, move, spread, recolour, delete points) and exported to SVG and PDF |
| Gradient mesh | Full | Create Gradient Mesh and the Mesh tool: add lines in a colour, move points, drag each point's handles to reshape patches, point colour and opacity, Alt-click to remove lines |
| Patterns | Full | Pattern editing mode from Make or a swatch double-click: Pattern Options with grid, brick (with offset) and hex tiles, size to art or exact size, spacing, overlap order, copies, dimming and the tile edge; Done, Save a Copy, Cancel |
| Recolor and harmony | Full | Recolor Artwork with a smooth or segmented colour wheel (linked or free markers, brightness), reduce to a colour count in OKLab with tints kept, the current-to-new colour list with merge and separate, recolor from a document group or a library, the Color Theme Picker, shuffles and colour job presets, live preview and one undo step; Edit > Edit Colors invert, grayscale, CMYK, RGB, saturate; the Color Guide with twelve harmony rules, tints and shades, warm and cool and vivid and muted variations, saved as swatch groups |
| Stroke panel | Full | Weight, caps, joins, miter, alignment, dashes, arrowheads with scale, profiles |
| Appearance and Graphic Styles | Full | Multiple fills and strokes, effects on the object or on one fill or stroke from the panel and MCP, visibility, Clear and Reduce to Basic; Graphic Styles with new, redefine, libraries and apply |

## Effects and live objects · 9.5 of 10

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Distort and Transform effects | Full | Free Distort, Pucker and Bloat, Roughen, Transform, Tweak, Twist, Zig Zag |
| Warp and Envelope Distort | Full | Fifteen warp styles as effects and envelopes; mesh and top-object envelopes; mesh points and handles edited with Direct Selection and the Mesh tool (add and remove lines); Envelope Options (fidelity, distort appearance, linear gradients and pattern fills, anti-alias); Edit Contents and Edit Envelope; Reset with Mesh or Warp; type and images distorted inside |
| Stylize effects | Full | Drop Shadow, Inner Glow, Outer Glow, Feather, Round Corners, Scribble |
| Blends | Full | Smooth colour, steps, distance, Replace Spine, Release, Expand |
| Symbols and symbolism | Full | Symbol editing mode with live instances, Redefine, Duplicate, Replace, Reset Overrides and Symbol Options; static and dynamic symbols with per-instance part overrides; 9-slice scaling and the registration point; five symbol libraries, User Defined and Save Symbols; the Symbols panel, instances, Break Link, the Symbol Sprayer, Shifter, Scruncher, Sizer, Spinner, Stainer, Screener and Styler with diameter, intensity and the user defined, average and random methods |
| Repeat | Full | Radial, grid and mirror, with options, release and expand |
| Brushes | Full | Calligraphic, scatter, art, pattern and Bristle brushes; pen pressure recorded by the Paintbrush; five-tile pattern brushes with stretch, add space and approximate fit; art brushes that scale, stretch or stretch between guides and flip; five brush libraries, User Defined and Save Brushes; Outline Stroke and Expand Appearance follow brushes; New Brush from art for all four kinds, Brush Options, colorization, Delete Brush, previews drawn from the brush |
| Image Trace | Full | Traces at the image's own resolution (up to 2000 px on the long side) in a worker; Paths, Corners, Noise, abutting or overlapping Method, Automatic, Limited, Full Tone and Document Library palettes, fills and centreline strokes, Snap Curves to Lines; live tracing objects with eleven presets, colour, grayscale and black and white modes, paths, ignore white and smoothing; five views; the Image Trace panel with preview; Make, Make and Expand, Expand, Release |
| 3D and Materials | Partial | Extrude & Bevel (depth, cap, classic and rounded bevels), Revolve (angle, offset, either edge), Inflate and Plane as live effects on paths, compound paths, type and groups; position presets, X, Y and Z rotation and perspective, Inflate included; plastic, matte, metal, wireframe and flat materials; light direction, intensity, ambient, highlight and shading colour; Map Art (a symbol on the front face of an Extrude or Plane, scaled, offset and shaded with the surface); shadows behind or below with distance, softness and opacity; the 3D and Materials panel; vector faces in SVG and PDF; Expand Appearance to shaded paths. Since v0.32.0: lighting presets and up to eight lights with colour, intensity, rotation, height and softness; Render with Ray Tracing at Low, Medium and High (soft shadows, ambient occlusion, specular) exported as an image; brushed metal, wood and rough materials. Not built: Substance materials, ray tracing for Inflate, Map Art under ray tracing |
| Effect Gallery raster filters | Full | The Effect Gallery with live thumbnails, options and preview; 55 Photoshop effects (Artistic 15, Blur 2 beside Gaussian Blur, Brush Strokes 8, Distort 3, Pixelate 4, Sketch 14, Stylize 1, Texture 6, Video 2) as live effects in the Appearance panel; the Rasterize effect and Document Raster Effects Settings; PDF and SVG export them at the document's raster resolution |

## Type · 8 of 8

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Point and area type | Full | Point and area type typed on the canvas with a caret, selection, IME and clipboard; area type rows, columns, gutter, inset and first baseline; area type in any closed shape flows inside the shape; Vertical Type and Vertical Area Type set in columns right to left with upright and rotated glyphs, a vertical caret, Type Orientation, and the same layout in outlines, SVG and PDF |
| Type on a path | Full | Type and Vertical Type on any path, including live shapes; on-canvas start, end and centre brackets; Type on a Path Options with Rainbow, Skew, 3D Ribbon, Stair Step and Gravity, alignment to the path, spacing and Flip |
| Character and paragraph with styles | Full | Character panel with character rotation and optical kerning measured from glyph outlines; Paragraph panel with hyphenation in line breaking (words longer than, after first, before last, limit, zone, capitalized words; a rule-based English splitter, not a dictionary), Justification settings (word and letter spacing, glyph scaling, single word justification) and Bullets and Numbering; a Tabs panel with left, centre, right and decimal stops and leaders; Character Styles and Paragraph Styles panels with new from selection, apply to a range or an object, redefine, delete, rename, override marks and the Normal styles |
| Threading and text wrap | Full | Threaded Text Create, Release Selection and Remove Threading; in and out ports, overflow marks, thread lines, loaded text from the out port into a click, a drag or a closed path; Text Wrap Make, Release and Options with offset and invert, around any object above the type in its layer |
| OpenType and glyphs | Full | Ligatures, contextual alternates, discretionary ligatures, swash, stylistic alternates and sets, titling, ordinals, fractions, slashed zero, case forms, four figure styles and four positions, shaped from the font through its GSUB lookups (contextual and chaining included) and drawn as its glyphs on the canvas, in outlines and PDF; Find Font; the Glyphs panel inserts any glyph and offers the alternates of the selected character |
| Create Outlines | Full | Glyph outlines through opentype.js, per glyph (shaped glyphs included), as compound paths in their colours |
| Variable fonts | Full | Variable faces marked and filterable in the font menu, named instances as styles, a slider per fvar axis; glyphs drawn at the axes (gvar, CFF2, HVAR) on the canvas, in Create Outlines and PDF; SVG keeps `font-variation-settings`. GPOS kerning is not varied by the axes |
| Touch Type tool | Full | Touch Type (Shift+T) moves, scales and rotates single characters with a box and handles, arrow nudges and options-bar values; the text stays live and the transforms follow their characters through editing, outlines, SVG and PDF |

## Generative AI · 5 of 5

formpth has no generative model of its own. Every row here runs on the language model the person configures for the Assistant, and the generative panels stay disabled until one is set. The art is SVG written by a general model, not by a trained vector model like Firefly, so its quality depends on the model chosen.

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Text to Vector Graphic | Full | Object > Generative > Text to Vector Graphic: Type (Subject, Scene, Icon, Pattern), Detail, up to three variations, the chosen one placed as editable groups and paths fitted to the selection or artboard, one undo step; MCP `text_to_vector`. Runs on the model set for the Assistant, like the other generative rows. The audit graded this None (only the Assistant existed); built in v0.31.0 and re-traced here |
| Generative Recolor | Full | A prompt with sample moods in Recolor Artwork returns up to four palettes that remap the artwork's colours with tints kept, one undo step; MCP `generative_recolor`. Runs on the configured model. The audit graded this None; built in v0.31.0 and re-traced here |
| Generative Shape Fill | Full | The Generative Shape Fill panel sends a prompt, shape strength, detail and a variation count to the configured model and brings the chosen variation in as editable paths clipped to the shape; model SVG is cleaned of scripts, images and links |
| Text to Pattern | Full | Generate Patterns turns a prompt, a colour preset or custom palette and a density into tile variations saved as editable pattern swatches |
| Retype | Full | Retype reads outlined type (by letter-shape matching, no model needed) or an image region (with a model that reads images), ranks installed fonts by shape and replaces the source with live text. Matches only installed fonts |

## Files, colour and output · 9 of 11

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Native projects | Full | `.fpth` with the whole document and its images, library with conflict copies, recovery, session restore |
| Illustrator .ai files | Partial | `.ai` files saved with PDF compatibility open through the PDF reader, so Illustrator-only data is lost. Since v0.32.0 Export writes a PDF-compatible `.ai` (every artboard a page) that Illustrator opens as PDF content and formpth reopens fully editable. Since v0.33.0 `.ai` saved without PDF compatibility (Illustrator 3 to 8, and later files whose AI9 private data is plain, Deflate or ZStandard compressed) opens with layers, paths, compound paths, clip groups, gradients, spot colours, type and embedded rasters. Missing: Illustrator's private data stream in the writer, and symbols, brushes, patterns and live effects from the private data when reading |
| SVG in and out | Full | Gradients, patterns, clipping, masks, symbols, type, images; editing data embedded for exact round trips |
| PDF in and out | Full | Raised from Partial in v0.33.0 and re-traced here, not by an auditor. Import since v0.33.0: soft masks as opacity masks, image soft masks and stencil masks as alpha, grid-shaped mesh shadings as gradient meshes (other meshes as a picture of the region, reported), tiling patterns as pattern swatches, and encrypted files through the Standard security handler R2 to R6 with a password prompt. Still left out on import: function-based shadings, public-key encryption. Export since v0.33.0: opacity masks as soft masks, gradient meshes as Coons patch shadings, patterns as tiling patterns and freeform gradients as triangle shadings, so only raster effects are rasterised, as in Illustrator. Built: export with vectors, shadings, transparency and CMYK, one page per artboard; live, searchable type with embedded font subsets since v0.32.0 (type with gradients, effects or an unavailable font is outlined); bleed and printer's marks since v0.30.0; PDF/X-4 with the document CMYK profile as the output intent since v0.32.0; formpth's own PDFs and `.ai` files reopen exactly; any other PDF or PDF-compatible `.ai` opens one artboard per page with paths, gradients, clipping, images and point type in installed fonts, and reports what it left out |
| EPS, DXF and DWG | Partial | DXF R12 to 2018 import (entities, blocks, layers, units and scale) and AutoCAD 2000 or R12 export; EPS Level 3 export per artboard in RGB or CMYK, formpth's own EPS reopened editable, other EPS read by a PostScript path reader. DWG opens since v0.32.0 through the ODA File Converter or LibreDWG's dwg2dxf when one is installed. Missing: reading DWG without a converter, writing DWG, and images in foreign EPS and in DXF |
| Raster export | Full | PNG, JPEG, WebP of an artboard, all artboards or the selection, at any scale, with transparency |
| Export for Screens and asset export | Full | Export for Screens with artboards, scales, suffixes and formats in a zip; the Asset Export panel with Collect for Export as single or multiple assets, renaming, and each asset cropped to its art in PNG, JPEG, WebP, SVG or PDF |
| Placed images and links | Full | Place Linked keeps a path or file handle; the Links panel shows Linked, Modified and Missing and checks on focus; Relink, Relink All Instances, Relink Missing from Folder, Update, Update All, Go To Link, Embed, Unembed and Link Info; `.fpth` keeps links with a cached preview; exports use the full pixels |
| History and Actions | Full | History panel with every step, New Document from State and History Options; Actions record menu commands, dialog values, transforms (tool drags included), drawn shapes, fills, strokes, opacity and styles, with per-step toggles, modal dialogs, stops, editing and reordering; action sets saved as `.fpaction` files with a Default Actions set; Batch over a folder or over data sets with a log. Dialogs outside the common form (Export, Effect Gallery) open during playback instead of replaying |
| Colour management and print | Full | Raised from Partial in v0.33.0 and re-traced here, not by an auditor. CMYK document mode and CMYK PDF; Overprint and Separations Preview, printer's marks and bleed since v0.30.0. Since v0.32.0, on LittleCMS: Color Settings with RGB and CMYK working spaces from installed, system or loaded ICC profiles, four intents and black point compensation; Assign Profile; Convert to Profile; Proof Setup and Proof Colors; PDF/X-4 output intent; formpth Generic CMYK when no press profile is loaded. Since v0.33.0: File > Print (paper, orientation, fit, percent or tiled scaling, marks and bleed, composite or separations, colour managed by formpth with a printer profile or by the printer; the printer is picked in the system dialog), proofing on the detected display profile, and Preserve CMYK Numbers. Limits: display detection was run on Linux only; separation plates print as raster pages |
| Variables and data merge | Full | Variables panel with text, image, visibility and graph variables bound to objects; data sets captured, updated, deleted and stepped through live; CSV and JSON import; Export Variations as PNG, SVG, PDF or `.fpth` per data set to a folder or a zip |

## Platforms and access (not scored)

| Row | State |
| --- | --- |
| Desktop app | Tauri 2 shell for macOS (arm64, x64), Windows (x64) and Linux (x64) with the frozen engine, file association and updater; built by `desktop.yml` |
| Web app | The same app in a browser against the local engine |
| Agents over MCP | 92 tools, a command catalogue with `list_commands`, `describe_command`, `run_command` and `run_commands`, Claude Code and Chat inside the window's terminal dock, one undo step per call, `run_command` over every menu command, consent in the window, a per-window session secret on the bridge, the `formpth-harness` skill pack |
| Plugins | Sandboxed JavaScript plugins through the same tools, file tools blocked |

## Tally

| Category | Score | Rows |
| --- | --- | --- |
| Objects and layers | 8 | 8 |
| Selection and transform | 8 | 8 |
| Drawing | 10 | 10 |
| Paths and Pathfinder | 8 | 8 |
| Paint and colour | 8 | 8 |
| Effects and live objects | 9.5 | 10 |
| Type | 8 | 8 |
| Generative AI | 5 | 5 |
| Files, colour and output | 10 | 11 |
| **Total** | **74.5** | **76** |

73 rows Full, 3 Partial, 0 None: 98.0 percent.

## Next to close

Every row is built. The three Partial rows, by what each lacks:

1. Illustrator `.ai`: Illustrator's private data in the writer; symbols, brushes, patterns and live effects from the private data when reading.
2. EPS, DXF and DWG: reading DWG without an installed converter; writing DWG.
3. 3D and Materials: Substance materials (Inflate and Map Art are ray traced since v0.33.0).

The generative rows run on the model the person sets up for the Assistant; formpth ships no image or vector model of its own.

## Plan v0.5.0 additions (not in the 76)

Graded by the same audit, 11.5 of 12, and 12 of 12 after v0.31.0:

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Live Corners on any path | Full | Per-anchor round, inverted or chamfer corners, absolute or relative, drawn the same on the canvas, in SVG and PDF; Direct Selection widgets, Alt-click cycling, the Corners dialog, Expand Corners |
| Liquify detail tools | Full | Scallop, Crystallize and Wrinkle with Size, Intensity and Detail |
| Object on Path | Full | Attach and Arrange along a path with spacing, offset and rotation; no live link |
| Pathfinder Hard Mix, Soft Mix and Trap | Full | Object > Pathfinder, with mixing rate and trap options |
| Large canvas | Full | Artboards to 163,440 pt a side, PDF UserUnit, raster tiles |
| Spell check | Full | Check Spelling, Auto Spell Check, a personal dictionary |
| Gradient Method and Dither | Full | Perceptual (OKLab) blending matched on the canvas, in SVG and PDF; dither on the canvas |
| TIFF export | Full | RGB, RGBA or CMYK with PackBits, LZW or Deflate |
| PDF marks and bleed | Full | Trim, registration, colour bars, page information, BleedBox and TrimBox |
| Package | Full | The document, linked images and fonts collected with a report |
| Overprint and Separations Preview | Full | Previews, the plates panel and PDF /OP; the audit graded it Partial because nothing set the overprint flag, which the Attributes panel and `set_paint` now do (v0.31.0, re-traced here) |
| Interface languages | Full | 26 languages with English the default |
