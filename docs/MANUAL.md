# formpth manual

formpth is a vector illustration editor: artboards, layers, paths, live shapes, type, gradients, effects and
export for print and screens. It runs in the browser or as a desktop app, with an engine on your computer for the
work a browser cannot do alone (the project library, fonts installed on the system, sending to other apps, the
assistant and the agent server). This manual is also in the app: Help > formpth Help (F1), where you can search it and
ask it questions.

## Getting started

- New document: File > New (Ctrl+N) picks a preset (Letter, A4, A3, Tabloid, Web, Mobile, Post, Story, Icon and
  more) or a custom size in points, pixels, millimetres, centimetres, inches or picas, with any number of artboards
  and RGB or CMYK colour.
- Open: File > Open lists the projects saved in the library; Open File opens formpth projects (.fpth), SVG and SVGZ,
  any PDF and PDF-compatible .ai file, and images (PNG, JPEG, WebP, GIF) as a new document. Dropping files on the
  stage opens them; dropping them while a document is open places them.
- Save: File > Save (Ctrl+S) keeps everything editable in the library as a .fpth project; Save As names a copy;
  Download Project writes the .fpth to your downloads.
- The documents open when formpth closes reopen at the next start (Preferences > File Handling). With that off, only
  unsaved work is kept, and formpth offers to recover it after a crash.
- The engine: if a message says it is offline, start it with `./formpth boot` (or `formpth.bat boot` on Windows).

## The workspace

- The tools are in the rail on the left. Tools that share a slot open from a flyout: hold the button or right-click
  it. The ••• button lists hidden tools and opens Edit Toolbar, where you choose which tool slots the rail shows.
- Fill and Stroke sit at the foot of the rail. Click one to make it active (X swaps which is active, Shift+X swaps
  the paints, D restores black stroke and white fill); double-click one to choose a colour. The three buttons under
  them set the active one to a colour (,), a gradient (.) or none (/).
- Each tool's options are in the bar along the top.
- Properties (the column beside the stage) shows what matters for the selection: transform, fill, stroke, opacity
  and quick actions; with nothing selected it shows the document's units, artboards, rulers and grids.
- Panels dock on the right in groups: Color, Swatches, Gradient; Stroke, Transparency, Brushes; Appearance, Graphic
  Styles; Symbols, Artboards, Links, Image Trace; Navigator, Info, History, Actions; Layers; Properties, Transform,
  Align, Pathfinder, Pattern Options; Character, Paragraph, Glyphs. Drag a tab into another group or between groups; Window lists every
  panel and Window > Reset Panels puts them back. Workspaces in the title bar arrange the panels for a kind of work.
- Screen modes (F cycles): standard, full screen with menu bar, full screen. Tab hides the panels.

## Artboards

- A document holds any number of artboards, each with a name, position and size. The Artboard tool (Shift+O) draws
  new ones, moves them (with the art on them, or alone with Alt held to duplicate), resizes them by their handles,
  and deletes the selected one with Delete.
- The Artboards panel lists them: click to make one active, double-click a name to rename, and the options button
  sets its exact size and position. Object > Artboards fits an artboard to the art or the selection, makes
  artboards from selected objects, and rearranges them in a grid.
- Rulers measure from the active artboard's top-left corner. Export and Print work per artboard.

## Selecting

- Selection tool (V): click to select an object, Shift-click to add or remove, drag a marquee. The bounding box
  scales (Shift keeps proportions, Alt scales from the centre) and rotates from just outside a corner. Dragging
  moves; Alt-drag copies; arrow keys nudge by the keyboard increment (Shift ten times as far). Ctrl-click (Cmd-click
  on macOS) again on the same spot to select the object behind, and again to go further back.
- Double-click a group to isolate it: everything else dims and new art goes inside the group. Escape or the Exit
  Isolation Mode button leaves.
- Direct Selection (A): selects anchors, handles and segments. Drag an anchor or handle to move it, drag a segment
  to reshape the curve, marquee or Shift-click to collect anchors.
- Group Selection selects a group within a group with each click. Magic Wand (Y) selects every object close to the
  one clicked: check Fill Color, Stroke Color, Stroke Weight, Opacity or Blending Mode in its options and set each
  tolerance (0 to 255 per colour channel, points, percent). Shift-click adds, Alt-click subtracts. Lasso (Q)
  selects anchors inside a freehand loop.
- Select > Same selects by fill colour, stroke colour, stroke weight, fill and stroke, opacity, blending mode,
  appearance, graphic style, shape, font family, font size or symbol instance. Select > Object selects all of a kind
  (paths, text, images, clipping masks, stray points, brush strokes, symbol instances).

## Drawing

- Shapes: Rectangle (M), Rounded Rectangle, Ellipse (L), Polygon, Star, Flare, Line Segment (\\), Arc, Spiral,
  Rectangular Grid and Polar Grid. Drag to draw (Shift constrains, Alt draws from the centre); click without
  dragging for a dialog with exact sizes. While dragging, the arrow keys change sides, points, radius or grid lines.
  Rectangles, rounded rectangles, ellipses, polygons and stars stay live. The Shape section of Properties changes
  their size, each corner's radius and its type (round, inverted, chamfer), an ellipse's pie angles, a polygon's sides
  and a star's points and radii; with the Selection tool, drag a rectangle's or polygon's corner widget (the small
  circles inside the corners) to round its corners, Alt to round just one. Object > Shape > Expand Shape turns them
  into ordinary paths.
- Pen (P): click for corner points, drag for smooth points, click the first point to close, Enter or Escape to end.
  Over a selected path the Pen adds points on segments and deletes them on anchors; Alt over the last point converts
  it; clicking an open end continues that path. Add Anchor Point (=), Delete Anchor Point (-) and Anchor Point
  (Shift+C, converts smooth and corner points and drags handles independently).
- Curvature (Shift+~): click points and the curve passes smoothly through them; Alt-click makes a corner.
- Pencil (N) draws a fitted path from a freehand stroke and extends a selected open path when you start at its end.
  Smooth simplifies under the drag, Path Eraser removes under the drag, Join joins two open ends.
- Paintbrush (B) draws strokes with the current brush. Blob Brush (Shift+B) draws filled shapes that merge with
  overlapping shapes of the same fill. Eraser (Shift+E) cuts shapes away; Scissors (C) splits a path at a point; Knife
  cuts shapes along a freehand line.
- Smart guides (Ctrl+U) show alignment to other objects' edges and centres, equal spacing between neighbours (the
  matched gaps are marked), and angles of 0, 45, 90 and 135 degrees; snapping to the grid, to points and to whole
  pixels is in the View menu.

## Transforming

- Rotate (R), Reflect (O), Scale (S) and Shear: click to set the origin, then drag; Alt-drag copies; double-click the
  tool or press Enter for a dialog with exact values (and Copy).
- Free Transform (E) scales, rotates and shears from the box; hold Ctrl (Command on a Mac) on a corner to distort
  it freely. Reshape moves selected points with their neighbours.
- Object > Transform: Transform Again (Ctrl+D), Move, Rotate, Reflect, Scale, Shear and Transform Each (each object
  about its own centre, with random variation if you like).
- The Transform panel and Properties type exact X, Y, W, H, rotation and shear, from the reference point you pick
  in the 3 by 3 grid; fields accept arithmetic (100/3, 2*72).
- Width (Shift+W) drags out variable stroke widths at any point along a stroke; Warp (Shift+R), Twirl, Pucker and
  Bloat reshape art under the brush.
- Align: to the selection, a key object (the last one selected) or the artboard; Distribute Objects and Distribute
  Spacing with an exact gap.

## Paths and Pathfinder

- Object > Path: Join (Ctrl+J), Average, Outline Stroke, Offset Path, Reverse Path Direction, Simplify, Smooth, Add
  Anchor Points, Remove Anchor Points, Close, Divide Objects Below, Split into Grid and Clean Up (stray points,
  unpainted objects, empty text).
- Pathfinder: Unite, Minus Front, Intersect, Exclude, and Divide, Trim, Merge, Crop, Outline and Minus Back. Shape
  modes make a single new path; Divide and the rest make groups of pieces.
- Shape Builder (Shift+M): drag across regions of the selected shapes to merge them; Alt-drag to delete regions.
- Live Paint Bucket (K): click an area closed by the selected paths to fill it with the current fill, as if the
  paths were a colouring book. The paths become a Live Paint group (Object > Live Paint > Make, Ctrl+Alt+X) that stays
  editable: move or reshape a path and the colours follow their areas. Shift-click an edge to paint its stroke; only
  the stretch of path between two crossings changes.
- Live Paint Selection (Shift+L): click faces and edges of a Live Paint group to select them (Shift-click adds or
  removes); the Fill and Stroke colours, the Stroke panel and Delete then act on just those. Selecting the whole
  group and choosing a fill paints every face. Gap Options closes small openings so an area that is not quite closed still fills; Merge adds more paths; Expand
  makes ordinary filled shapes and strokes; Release gives the paths back.
- Compound paths (Ctrl+8) cut holes by the fill rule; clipping masks (Ctrl+7) clip objects with the topmost path.

## Colour and paint

- Color panel: Grayscale, RGB, HSB, CMYK and Web Safe sliders, a hex field and a spectrum. Global swatches show a
  Tint slider. Edit > Edit Colors > Recolor Artwork lists the colours in the selection and maps each to another;
  Invert, Grayscale, Convert to CMYK and Convert to RGB act on everything selected.
- Swatches: colours, gradients and patterns, filtered by kind. Global swatches (the white corner) recolour every use
  when edited; spot swatches carry a dot. New swatches come from the active paint.
- Gradient panel and Gradient tool (G): linear and radial gradients with any number of stops and midpoints; drag a
  stop off the bar to remove it, click under the bar to add one. The Gradient tool drags the direction on the art
  and shows its annotator. Strokes take gradients within, along or across.
- Freeform gradients: choose Freeform in the Gradient panel; colour points appear over the selected object. With the
  Gradient tool, click inside the object to add a point, drag a point to move it, drag the square on its dashed ring
  to spread it, and press Delete to remove it; the panel sets the selected point's colour and spread. Lines mode joins
  the points so colour flows along the line.
- Color Guide: harmonies of the current colour. Choose a rule (complementary, analogous, triad and nine more), click
  any swatch to use it, and pick tints and shades, warm and cool, or vivid and muted variations below. The plus saves
  the five harmony colours as a swatch group.
- Mesh (U): click into a shape to make a gradient mesh, then click inside it to add mesh lines in the fill colour
  (Shift keeps the colour already there). Click a point to select it: drag it, drag its handles to bend the lines,
  and set its colour and opacity in the options bar. Alt-click a point to remove its lines.
- Eyedropper (I) picks up the fill, stroke and type attributes of what you click and applies them to the selection.
- Patterns: Object > Pattern > Make opens pattern editing mode on a copy of the selection: the tile repeats around
  it, and Pattern Options sets the name, tile type (grid, brick by row or column with an offset, hex by column or
  row), the tile size (fitted to the art or exact), spacing, which neighbour overlaps in front, how many copies show
  and how dim. Edit the art as usual, then Done (or Escape) adds the swatch, Save a Copy adds another, Cancel leaves
  nothing behind. Double-click a pattern swatch, or Object > Pattern > Edit Pattern, to change one; every object
  filled with it updates. Patterns fill and stroke like colours.

## Stroke, transparency and appearance

- Stroke panel: weight, caps, corners, miter limit, alignment (center, inside, outside), dashes and gaps, arrowheads
  for start and end, and width profiles.
- Transparency panel: blend mode (all 16), opacity, opacity masks (Make Mask uses the topmost selected object;
  Clip and Invert Mask), isolate blending and knockout group.
- Appearance panel: every fill, stroke and effect on an object, top to bottom. Add another fill or stroke, hide
  items, click an effect's name to edit it, Clear Appearance, Reduce to Basic Appearance. Graphic Styles save an
  appearance to apply in one click.
- Effects (Effect menu) stay live and editable: Warp (15 styles), Distort & Transform (Free Distort, Pucker & Bloat,
  Roughen, Transform, Tweak, Twist, Zig Zag), Path (Offset Path, Outline Stroke), Stylize (Round Corners, Scribble,
  Drop Shadow, Inner Glow, Outer Glow, Feather), Blur (Gaussian Blur) and Convert to Shape. Apply Last Effect repeats
  the last one; Expand Appearance makes it permanent.
- Brushes: calligraphic, scatter, art and pattern brushes apply to any stroke from the Brushes panel. New Brush
  makes a calligraphic brush, or a scatter, art or pattern brush from the selected art; double-click a brush for its
  options and colorization.

## Type

- Type (T): click for point type, drag for area type; click a path with Type on a Path to set type along it;
  Vertical Type sets columns. Typing works as in any text field: arrows, Shift to select, double-click a word,
  Ctrl+A selects all of the type, copy and paste.
- Character panel: font family and style, size, leading, kerning, tracking, scale, baseline shift, case, and the fonts
  installed on your computer when the engine runs. Paragraph panel: alignment, indents, space before and after,
  and Area Type Options (rows, columns, gutter, inset). Glyphs shows a font's characters to insert; with a character
  selected in type, the row above the grid shows its alternates, and clicking one sets that character in it.
- OpenType, at the foot of the Character panel: figure style, position, stylistic set, and ligatures, contextual
  alternates, swash, alternates, titling, ordinals, fractions, slashed zero and case forms. Options the font does
  not have are dimmed;
  the bundled Inter offers fractions and figure styles, installed fonts offer whatever they carry. Small Caps uses
  the font's small capitals, or smaller capitals when it has none.
- Character Styles and Paragraph Styles: select type set the way you want, click the plus to make a style from it,
  then click the style to apply it to other type (to the selected characters while typing). A plus after the name
  means the type differs from its style; click the style again to clear that. Change one example and click Redefine
  to update every use. Double-click a style to rename it.
- Threaded text: when area type has more text than fits, its out port (bottom right) shows a red plus. Click the out
  port with the Selection tool, then click the canvas (a frame the same size), drag (a frame that size) or click a
  closed path, and the story continues there. Or select the frames and choose Type > Threaded Text > Create. Release
  Selection takes a frame out of the thread; Remove Threading breaks every link and leaves the text where it is.
  View > Show Text Threads draws the links. Area type in a circle or any closed shape flows inside the shape.
- Text wrap: select an object above area type in the same layer and choose Object > Text Wrap > Make; the paragraphs
  run around it. Text Wrap Options sets the offset and Invert Wrap, which flows the type inside the object.
- Type > Create Outlines turns type into paths, letter by letter, in a group. Change Case sets upper, lower, title or
  sentence case. Find and Replace searches every text object. Find Font lists the fonts the document uses, selects
  the type that uses one, and replaces a family and style everywhere.

## Layers and objects

- The Layers panel shows layers, sublayers, groups and objects in stacking order, each layer with its own colour for
  selection marks. The eye hides (Alt-click shows only that layer), the lock column locks, the circle on the right
  selects, and the square shows what is selected. Drag rows to restack or move them into another layer or group.
- Double-click a layer for its options (name, colour, template, show, lock, print, dim images); double-click
  an object to rename it. The panel's buttons locate the selection, make a layer clipping mask, and add sublayers and
  layers.
- Object > Arrange (Ctrl+] and Ctrl+[ with Shift for front and back) and Send to Current Layer; Group (Ctrl+G),
  Ungroup, Lock (Ctrl+2), Unlock All, Hide (Ctrl+3), Show All.

## Live objects

- Blends (W or Object > Blend): smooth colour, a number of steps, or a distance, along a straight spine or a path you
  choose with Replace Spine.
- Repeats: radial, grid and mirror, editable in Repeat Options until released or expanded.
- Envelope Distort: warp presets, a mesh, or the top object's shape.
- Symbols: Object > Symbol > New Symbol stores art in the Symbols panel; instances update when the symbol changes;
  Break Link makes an instance ordinary art. The Symbol Sprayer (Shift+S) sprays instances into a symbol set, and
  the symbolism tools in its flyout change the instances under the brush: Shifter pushes them (Shift-click and
  Shift-Alt-click restack), Scruncher pulls them together, Sizer grows them, Spinner turns them toward the drag,
  Stainer tints them with the fill colour, Screener fades them and Styler applies the graphic style chosen in the
  options bar. Alt reverses each one. Diameter, intensity and the method (user defined, average, random) are in the
  options bar; [ and ] change the diameter.
- Image Trace: Object > Image Trace > Make traces a placed image into a tracing object that keeps the image, so the
  Image Trace panel can change the preset, mode, colours or threshold, paths, ignore white and smoothing and trace
  it again (with Preview on, as you change them). View switches between the result, the result with outlines,
  outlines, outlines over the image and the image. Expand makes ordinary paths; Release brings the image back.
  Embed turns a linked image into one stored in the document.

## Saving and exporting

- .fpth projects keep everything editable: artboards, layers, live shapes, effects, symbols, swatches, styles,
  brushes and the images inside.
- File > Export > Export As writes SVG, PDF, PNG, JPEG or WebP of the active artboard, every artboard, or the
  selection. Export for Screens writes chosen artboards at several scales and formats in one ZIP.
- Asset Export: File > Export > Collect for Export as Single Asset adds the selection as one asset, as Multiple
  Assets adds each selected object. The Asset Export panel (Window) shows them; double-click to rename, set scales,
  suffixes and formats (PNG, JPEG, WebP, SVG, PDF), and Export writes each asset cropped to its art in one ZIP.
- SVG export keeps gradients, patterns, clipping, masks, symbols (as use) and type (as text or outlined), and can embed
  formpth's editing data so formpth reopens it fully editable. SVG import reads paths, shapes, transforms, CSS
  classes, gradients, clip paths, use and symbol, text and embedded images, with top-level groups becoming layers.
- PDF export writes every artboard as a page with real vector paths, gradients as smooth shadings, transparency and
  blend modes, outlined type and images; effects a PDF cannot express are rasterised at the document's resolution.
  It carries formpth's editing data, so formpth reopens its own PDFs fully editable.
- Opening any other PDF, or an .ai file saved with PDF compatibility, gives one artboard per page with its art as
  editable paths, gradients, clipping groups, images and point type. Type takes the installed font of the same name,
  or the nearest of Helvetica, Times New Roman and Courier New; a message lists the substitutions and anything left
  out (encrypted files, mesh shadings, tiling patterns and some scanned image formats do not come in).
- File > Send to NodeMode sends the active artboard as an image to a NodeMode canvas (Preferences > Plugins sets its
  address).

## Agents and the assistant

- formpth runs an MCP server so agents (Claude Code, Claude Desktop, Codex, Cursor and others) can draw in the open
  window. Turn it on in Preferences > Plugins (Allow agents); the first call asks your permission. Connect with
  `./formpth mcp` (a stdio bridge) or the HTTP endpoint the engine prints at boot.
- The tools cover everything here: reading the document (get_document, get_image, get_svg, get_object), drawing
  (draw_shape, draw_path, add_text, edit_anchors), paint (set_paint, set_stroke, set_appearance, add_swatch,
  graphic_style), structure (group, arrange, compound_path, clipping_mask, layers), transforms and align, Pathfinder
  and path operations, live effects, blends, envelopes, repeats, symbols, brushes, image trace, opening, saving and
  exporting, and run_command for any menu command. Every change is one undo step.
- The assistant (Window > Assistant) uses a language model you set in Preferences > Plugins (a local Ollama model or
  an OpenAI-compatible endpoint) with the same tools, and Undo This Turn reverses all of its changes at once.

## Plugins

- Plugins add commands to the Plugins menu and can read the document, place SVG and call the same tools agents use.
  Plugins > Manage Plugins adds a plugin script (.js) and turns plugins on and off. A plugin runs in a sandbox and
  cannot open, save or export files on its own.

## Keyboard

- Help > Keyboard Shortcuts lists every command and tool with its keys; Change and Remove set your own.
- Hold Space for the Hand tool. Ctrl+= and Ctrl+- zoom, Ctrl+0 fits the artboard, Ctrl+1 is 100%, Ctrl+Alt+0
  fits everything. Ctrl+Y toggles Outline view, Ctrl+R the rulers, Ctrl+; the guides, Ctrl+' the grid, Ctrl+H the
  edges. On a Mac, Command stands for Ctrl.

## Troubleshooting

- The engine is offline: run `./formpth boot`, or `./formpth doctor` to see what is missing.
- A font is missing: formpth draws the type with Inter until the font is available; install it, then restart the
  engine so it finds the new font.
- Something broke: Help > Copy Error Log copies the recent errors to paste into a report.
