# formpth and Illustrator: parity

formpth is measured against Adobe Illustrator the way formvis is measured against Photoshop. Each row is one capability a working illustrator uses. A row is graded only from code: its data model, the command or tool that changes it, the interface that reaches it, and the render or export path that shows it.

| Grade | Score | Meaning |
| --- | --- | --- |
| Full | 1 | Model, command, interface and render or export all exist and match what Illustrator users expect for everyday work |
| Partial | 0.5 | It exists and works, with a named part missing |
| None | 0 | Not built |

Platform rows are shown and not scored.

## Score at v0.13.0

**57 of 59 scored rows, 97 percent:** 57 Full, 0 Partial, 2 None. The tally is at the end.

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
| Transparency, blend modes, opacity masks | Full | 16 blend modes, opacity, opacity masks with Clip and Invert, Isolate Blending, Knockout Group |

## Selection and transform · 7 of 7

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Selection, Direct and Group Selection | Full | Bounding box, anchors, handles and segment reshaping, marquee and Shift selection, group-level clicks |
| Lasso and Magic Wand | Full | Lasso selects anchors; Magic Wand with fill colour, stroke colour, stroke weight, opacity and blending mode, each with its tolerance, Shift to add and Alt to subtract |
| Select Same and Select Object | Full | Twelve Same attributes; Select Object by kind, stray points, brush strokes, clipping masks |
| Bounding box and Free Transform | Full | Scale from centre or proportionally, rotate zones, Free Transform with free distort |
| Rotate, Reflect, Scale, Shear, Transform Each and Again | Full | Origin click, Alt copy, exact dialogs, Transform Each with random, Transform Again |
| Smart Guides and snapping | Full | Alignment to edges and centres, equal-spacing guides with gap marks, angle construction, labels, snap to point, grid and pixel |
| Rulers, guides and grids | Full | Rulers from the active artboard, guides dragged from rulers, lock, make, release, clear, grid with subdivisions and snapping |

## Drawing · 6 of 6

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Pen, Curvature and anchor tools | Full | Pen with close, continue, add and delete on paths, convert; Add, Delete and Anchor Point tools; Curvature |
| Pencil, Smooth, Path Eraser, Join | Full | Fitted Pencil that extends and closes paths; Smooth, Path Eraser and Join tools |
| Rectangle to Star with live corners | Full | Live rectangles, rounded rectangles, ellipses, polygons and stars with exact dialogs and arrow-key changes while drawing; Shape fields in Properties after drawing (size, every corner radius and corner type, pie angles, sides, points, radii, line length and angle); corner widgets on the canvas for rectangles and polygons |
| Line, Arc, Spiral and grids | Full | Line Segment, Arc, Spiral, Rectangular Grid, Polar Grid, Flare |
| Paintbrush and Blob Brush | Full | Paintbrush with the current brush; Blob Brush merging same-fill shapes |
| Eraser, Scissors and Knife | Full | All three cut real geometry |

## Paths and Pathfinder · 7 of 7

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Pathfinder | Full | Unite, Minus Front, Intersect, Exclude, Divide, Trim, Merge, Crop, Outline, Minus Back on curves through paper.js |
| Shape Builder | Full | Drag to merge regions, Alt to delete |
| Live Paint | Full | Live Paint groups (Make, Merge, Release, Expand) whose faces re-flow as the paths are edited, the Live Paint Bucket on faces and Shift on edges, each edge painted per segment between crossings, the Live Paint Selection tool (faces and edges, Shift to add, fill and stroke from the panels, Delete), Gap Options |
| Compound paths | Full | Make and Release with non-zero and even-odd |
| Offset Path and Outline Stroke | Full | With joins and miter limit, as commands and as live effects |
| Simplify, Average, Join, anchors | Full | Simplify with preview, Smooth, Average, Join, Add and Remove Anchors, Reverse, Divide Objects Below, Split into Grid, Clean Up |
| Width tool and profiles | Full | Width points dragged on strokes; eight width profiles |

## Paint and colour · 8 of 8

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Colour panel and modes | Full | Grayscale, RGB, HSB, CMYK, Web Safe, hex, spectrum, global tints |
| Swatches, global and spot | Full | Colours, gradients and patterns, global and spot swatches, groups for agents |
| Gradients on fill and stroke, gradient tool | Full | Linear and radial with stops, midpoints, opacity and aspect; within, along and across strokes; the Gradient tool and annotator; freeform gradients in points and lines modes, made in the Gradient panel, edited with the Gradient tool (add, move, spread, recolour, delete points) and exported to SVG and PDF |
| Gradient mesh | Full | Create Gradient Mesh and the Mesh tool: add lines in a colour, move points, drag each point's handles to reshape patches, point colour and opacity, Alt-click to remove lines |
| Patterns | Full | Pattern editing mode from Make or a swatch double-click: Pattern Options with grid, brick (with offset) and hex tiles, size to art or exact size, spacing, overlap order, copies, dimming and the tile edge; Done, Save a Copy, Cancel |
| Recolor and harmony | Full | Recolor Artwork maps and palettes, invert, grayscale, CMYK, RGB, saturate; the Color Guide with twelve harmony rules, tints and shades, warm and cool and vivid and muted variations, saved as swatch groups |
| Stroke panel | Full | Weight, caps, joins, miter, alignment, dashes, arrowheads with scale, profiles |
| Appearance and Graphic Styles | Full | Multiple fills and strokes, effects per item, visibility, Clear and Reduce to Basic, Graphic Styles |

## Effects and live objects · 8 of 10

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Distort and Transform effects | Full | Free Distort, Pucker and Bloat, Roughen, Transform, Tweak, Twist, Zig Zag |
| Warp and Envelope Distort | Full | Fifteen warp styles as effects and envelopes; mesh and top-object envelopes |
| Stylize effects | Full | Drop Shadow, Inner Glow, Outer Glow, Feather, Round Corners, Scribble |
| Blends | Full | Smooth colour, steps, distance, Replace Spine, Release, Expand |
| Symbols and symbolism | Full | Symbols panel, instances, Break Link, the Symbol Sprayer, Shifter, Scruncher, Sizer, Spinner, Stainer, Screener and Styler with diameter, intensity and the user defined, average and random methods |
| Repeat | Full | Radial, grid and mirror, with options, release and expand |
| Brushes | Full | Calligraphic, scatter, art and pattern brushes; New Brush from art for all four kinds, Brush Options, colorization, Delete Brush, previews drawn from the brush |
| Image Trace | Full | Live tracing objects with eleven presets, colour, grayscale and black and white modes, paths, ignore white and smoothing; five views; the Image Trace panel with preview; Make, Make and Expand, Expand, Release |
| 3D and Materials | None | Not built |
| Effect Gallery raster filters | None | Gaussian Blur only; no Effect Gallery |

## Type · 6 of 6

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Point and area type | Full | Point, area and vertical type typed on the canvas with a caret, selection, IME and clipboard; area type rows, columns, gutter and inset; area type in any closed shape flows inside the shape |
| Type on a path | Full | Type on any path, including live shapes, with options |
| Character and paragraph with styles | Full | Character and Paragraph panels in full; Character Styles and Paragraph Styles panels with new from selection, apply to a range or an object, redefine, delete, rename, override marks and the Normal styles |
| Threading and text wrap | Full | Threaded Text Create, Release Selection and Remove Threading; in and out ports, overflow marks, thread lines, loaded text from the out port into a click, a drag or a closed path; Text Wrap Make, Release and Options with offset and invert, around any object above the type in its layer |
| OpenType and glyphs | Full | Ligatures, contextual alternates, discretionary ligatures, swash, stylistic alternates and sets, titling, ordinals, fractions, slashed zero, case forms, four figure styles and four positions, shaped from the font through its GSUB lookups (contextual and chaining included) and drawn as its glyphs on the canvas, in outlines and PDF; Find Font; the Glyphs panel inserts any glyph and offers the alternates of the selected character |
| Create Outlines | Full | Glyph outlines through opentype.js, per glyph (shaped glyphs included), as compound paths in their colours |

## Files and output · 7 of 7

| Row | Grade | Evidence or gap |
| --- | --- | --- |
| Native projects | Full | `.fpth` with the whole document and its images, library with conflict copies, recovery, session restore |
| SVG in and out | Full | Gradients, patterns, clipping, masks, symbols, type, images; editing data embedded for exact round trips |
| PDF in and out | Full | Export with vectors, shadings, transparency, CMYK and outlined type, one page per artboard; formpth's own PDFs and `.ai` files reopen exactly; any other PDF or PDF-compatible `.ai` opens one artboard per page with paths, gradients, clipping, images and point type in installed fonts, and reports what it left out |
| Raster export | Full | PNG, JPEG, WebP of an artboard, all artboards or the selection, at any scale, with transparency |
| Export for Screens and asset export | Full | Export for Screens with artboards, scales, suffixes and formats in a zip; the Asset Export panel with Collect for Export as single or multiple assets, renaming, and each asset cropped to its art in PNG, JPEG, WebP, SVG or PDF |
| Placed images and links | Full | Place embedded or linked, Links panel, relink, embed |
| History and Actions | Full | History panel with every step; Actions record and play commands |

## Platforms and access (not scored)

| Row | State |
| --- | --- |
| Desktop app | Tauri 2 shell for macOS (arm64, x64), Windows (x64) and Linux (x64) with the frozen engine, file association and updater; built by `desktop.yml` |
| Web app | The same app in a browser against the local engine |
| Agents over MCP | 65 tools, one undo step per call, `run_command` over every menu command, consent in the window, the `formpth-harness` skill pack |
| Plugins | Sandboxed JavaScript plugins through the same tools, file tools blocked |

## Tally

| Category | Score | Rows |
| --- | --- | --- |
| Objects and layers | 8 | 8 |
| Selection and transform | 7 | 7 |
| Drawing | 6 | 6 |
| Paths and Pathfinder | 7 | 7 |
| Paint and colour | 8 | 8 |
| Effects and live objects | 8 | 10 |
| Type | 6 | 6 |
| Files and output | 7 | 7 |
| **Total** | **57** | **59** |

57 rows Full, 0 Partial, 2 None.

## Next to close

Ordered by how often the gap is hit in everyday work: Effect Gallery filters, 3D and Materials.
