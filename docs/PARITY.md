# formpth and Illustrator: parity

formpth is measured against Adobe Illustrator the way formvis is measured against Photoshop. Each row is one capability a working illustrator uses. A row is graded only from code: its data model, the command or tool that changes it, the interface that reaches it, and the render or export path that shows it.

| Grade | Score | Meaning |
| --- | --- | --- |
| Full | 1 | Model, command, interface and render or export all exist and match what Illustrator users expect for everyday work |
| Partial | 0.5 | It exists and works, with a named part missing |
| None | 0 | Not built |

A control that only stores a value, with nothing reading it, does not count toward a grade. Platform rows are shown and not scored.

The list is the 76-row baseline shared with the Illustrator, Inkscape and formpth comparison: every capability a working illustrator reaches for in Illustrator 30, generative features included. Until v0.16.0 this page graded a narrower list of 59 rows that left out 17 capabilities formpth did not have, and graded several rows Full on controls that did nothing. An independent audit of v0.16.1 against the full list found 41 Full, 22 Partial and 13 None (52 of 76). This page now follows that list.

## Score at v0.21.0

**66 of 76 scored rows, 86.8 percent:** 60 Full, 12 Partial, 4 None. The tally is at the end.

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
| Smart Guides and snapping | Full | Alignment to edges and centres, equal-spacing guides with gap marks, angle construction, labels, snap to point, grid and pixel |
| Rulers, guides and grids | Full | Rulers from the active artboard, guides dragged from rulers, lock, make, release, clear, grid with subdivisions and snapping |
| Puppet Warp | Full | Puppet Warp tool (J): default and added pins, drag to bend while other pins hold, Shift to select several, Alt-drag to twist, Delete, Expand, Show Mesh; an as-rigid-as-possible solve over a triangle mesh of the art; type, images and symbols carried in an envelope. Pins belong to the tool, as in Illustrator |

## Drawing · 10 of 10

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Pen, Curvature and anchor tools | Full | Pen with close, continue, add and delete on paths, convert; Add, Delete and Anchor Point tools; Curvature |
| Pencil, Smooth, Path Eraser, Join | Full | Fitted Pencil that extends and closes paths; Smooth, Path Eraser and Join tools |
| Rectangle to Star with live corners | Full | Live rectangles, rounded rectangles, ellipses, polygons and stars with exact dialogs and arrow-key changes while drawing; Shape fields in Properties after drawing (size, every corner radius and corner type, pie angles, sides, points, radii, line length and angle); corner widgets on the canvas for rectangles and polygons |
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

## Paint and colour · 7 of 8

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Colour panel and modes | Full | Grayscale, RGB, HSB, CMYK, Web Safe, hex, spectrum, global tints |
| Swatches, global and spot | Partial | Colours, gradients and patterns, global and spot swatches. Missing: swatch libraries, swatch groups shown in the panel, and spot colours as PDF Separation spaces (they export as process) |
| Gradients on fill and stroke, gradient tool | Full | Linear and radial with stops, midpoints, opacity and aspect; within, along and across strokes, each drawn and exported; the Gradient tool and annotator; freeform gradients in points and lines modes, made in the Gradient panel, edited with the Gradient tool (add, move, spread, recolour, delete points) and exported to SVG and PDF |
| Gradient mesh | Full | Create Gradient Mesh and the Mesh tool: add lines in a colour, move points, drag each point's handles to reshape patches, point colour and opacity, Alt-click to remove lines |
| Patterns | Full | Pattern editing mode from Make or a swatch double-click: Pattern Options with grid, brick (with offset) and hex tiles, size to art or exact size, spacing, overlap order, copies, dimming and the tile edge; Done, Save a Copy, Cancel |
| Recolor and harmony | Partial | Missing: Recolor Artwork's colour wheel, Reduce Colors and applying a colour group. Built: Recolor Artwork maps and palettes, invert, grayscale, CMYK, RGB, saturate; the Color Guide with twelve harmony rules, tints and shades, warm and cool and vivid and muted variations, saved as swatch groups |
| Stroke panel | Full | Weight, caps, joins, miter, alignment, dashes, arrowheads with scale, profiles |
| Appearance and Graphic Styles | Full | Multiple fills and strokes, effects on the object or on one fill or stroke from the panel and MCP, visibility, Clear and Reduce to Basic; Graphic Styles with new, redefine, libraries and apply |

## Effects and live objects · 8 of 10

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Distort and Transform effects | Full | Free Distort, Pucker and Bloat, Roughen, Transform, Tweak, Twist, Zig Zag |
| Warp and Envelope Distort | Full | Fifteen warp styles as effects and envelopes; mesh and top-object envelopes; mesh points and handles edited with Direct Selection and the Mesh tool (add and remove lines); Envelope Options (fidelity, distort appearance, linear gradients and pattern fills, anti-alias); Edit Contents and Edit Envelope; Reset with Mesh or Warp; type and images distorted inside |
| Stylize effects | Full | Drop Shadow, Inner Glow, Outer Glow, Feather, Round Corners, Scribble |
| Blends | Full | Smooth colour, steps, distance, Replace Spine, Release, Expand |
| Symbols and symbolism | Partial | Missing: symbol editing mode to redefine a symbol's art, and symbol libraries. Built: Symbols panel, instances, Break Link, the Symbol Sprayer, Shifter, Scruncher, Sizer, Spinner, Stainer, Screener and Styler with diameter, intensity and the user defined, average and random methods |
| Repeat | Full | Radial, grid and mirror, with options, release and expand |
| Brushes | Partial | Missing: the Bristle brush, brush libraries and the art brush Stretch option. Built: Calligraphic, scatter, art and pattern brushes; New Brush from art for all four kinds, Brush Options, colorization, Delete Brush, previews drawn from the brush |
| Image Trace | Partial | Missing: tracing at full image resolution (images are reduced to about 420 px first), centreline tracing, and the corner, noise and method controls. Built: live tracing objects with eleven presets, colour, grayscale and black and white modes, paths, ignore white and smoothing; five views; the Image Trace panel with preview; Make, Make and Expand, Expand, Release |
| 3D and Materials | Partial | Extrude & Bevel (depth, cap, classic and rounded bevels), Revolve (angle, offset, either edge), Inflate and Plane as live effects on paths, compound paths, type and groups; position presets, X, Y and Z rotation and perspective, Inflate included; plastic, matte, metal, wireframe and flat materials; light direction, intensity, ambient, highlight and shading colour; Map Art (a symbol on the front face of an Extrude or Plane, scaled, offset and shaded with the surface); shadows behind or below with distance, softness and opacity; the 3D and Materials panel; vector faces in SVG and PDF; Expand Appearance to shaded paths. Not built: ray-traced rendering, more than one light, and Substance materials |
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

## Generative AI · 1 of 5

formpth has no generative model of its own. The Assistant panel drives the MCP tools from a model the person configures, which is what the two Partial rows rest on.

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Text to Vector Graphic | Partial | The Assistant turns a prompt into tool calls on the configured model; no dedicated generator, at most 14 tool steps a turn, and the model does not see the result |
| Generative Recolor | Partial | Through the Assistant a model can call the recolor tool with a palette from the prompt; one result, no variation set |
| Generative Shape Fill | None | Nothing fills a chosen shape from a prompt |
| Text to Pattern | None | No prompt-to-pattern feature |
| Retype | None | No font recognition from images or outlines |

## Files, colour and output · 8 of 11

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Native projects | Full | `.fpth` with the whole document and its images, library with conflict copies, recovery, session restore |
| Illustrator .ai files | Partial | `.ai` files saved with PDF compatibility open through the PDF reader, so Illustrator-only data is lost; no `.ai` writer |
| SVG in and out | Full | Gradients, patterns, clipping, masks, symbols, type, images; editing data embedded for exact round trips |
| PDF in and out | Partial | Missing: live text in exported PDF (type is outlined), vector masks and meshes (rasterised), PDF/X presets and bleed; import drops mesh shadings and tiling patterns. Built: export with vectors, shadings, transparency, CMYK and outlined type, one page per artboard; formpth's own PDFs and `.ai` files reopen exactly; any other PDF or PDF-compatible `.ai` opens one artboard per page with paths, gradients, clipping, images and point type in installed fonts, and reports what it left out |
| EPS, DXF and DWG | None | No EPS, DXF or DWG reader or writer |
| Raster export | Full | PNG, JPEG, WebP of an artboard, all artboards or the selection, at any scale, with transparency |
| Export for Screens and asset export | Full | Export for Screens with artboards, scales, suffixes and formats in a zip; the Asset Export panel with Collect for Export as single or multiple assets, renaming, and each asset cropped to its art in PNG, JPEG, WebP, SVG or PDF |
| Placed images and links | Partial | Place, a Links panel, Relink and Embed, but every placed image is copied into the document: a linked image does not follow its file |
| History and Actions | Full | History panel with every step, New Document from State and History Options; Actions record menu commands, dialog values, transforms (tool drags included), drawn shapes, fills, strokes, opacity and styles, with per-step toggles, modal dialogs, stops, editing and reordering; action sets saved as `.fpaction` files with a Default Actions set; Batch over a folder or over data sets with a log. Dialogs outside the common form (Export, Effect Gallery) open during playback instead of replaying |
| Colour management and print | Partial | CMYK document mode and CMYK PDF. Missing: ICC profiles (CMYK converts by formula), proof colours, separations and overprint preview, and a print dialog with marks and bleed |
| Variables and data merge | Full | Variables panel with text, image, visibility and graph variables bound to objects; data sets captured, updated, deleted and stepped through live; CSV and JSON import; Export Variations as PNG, SVG, PDF or `.fpth` per data set to a folder or a zip |

## Platforms and access (not scored)

| Row | State |
| --- | --- |
| Desktop app | Tauri 2 shell for macOS (arm64, x64), Windows (x64) and Linux (x64) with the frozen engine, file association and updater; built by `desktop.yml` |
| Web app | The same app in a browser against the local engine |
| Agents over MCP | 76 tools, one undo step per call, `run_command` over every menu command, consent in the window, a per-window session secret on the bridge, the `formpth-harness` skill pack |
| Plugins | Sandboxed JavaScript plugins through the same tools, file tools blocked |

## Tally

| Category | Score | Rows |
| --- | --- | --- |
| Objects and layers | 8 | 8 |
| Selection and transform | 8 | 8 |
| Drawing | 10 | 10 |
| Paths and Pathfinder | 8 | 8 |
| Paint and colour | 7 | 8 |
| Effects and live objects | 8 | 10 |
| Type | 8 | 8 |
| Generative AI | 1 | 5 |
| Files, colour and output | 8 | 11 |
| **Total** | **66** | **76** |

60 rows Full, 12 Partial, 4 None: 86.8 percent.

## Next to close

In release order:

1. v0.22.0: swatch libraries and Separation spaces, the Recolor colour wheel, the Bristle brush and brush libraries, symbol editing and libraries, full-resolution Image Trace, and linked images.
2. v0.23.0: DXF and EPS, and Generative Shape Fill, Text to Pattern and Retype on the person's configured model.
