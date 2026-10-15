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
- Panels dock on the right in groups: Color, Swatches, Gradient, Color Guide, Swatch Library; Stroke, Transparency, Brushes, Attributes, Brush Library; Appearance, Graphic
  Styles; Symbols, Artboards, Links, Image Trace; Navigator, Info, History, Actions, Variables; Layers; Properties, Transform,
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
  scales (Shift keeps proportions, Alt scales from the centre) and rotates from just outside a corner; after a
  rotation it stays turned with the object until Object > Transform > Reset Bounding Box. Dragging
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
- Shaper (Shift+N, in the Pencil flyout) turns rough gestures into live shapes: draw a rectangle (a square when the
  sides come out about equal; one drawn nearly level snaps square to the axes), a circle, an ellipse, a triangle, a
  polygon of five to eight sides or a straight line, and it becomes the matching live shape in the current fill and
  stroke. The options bar names what it recognised. Scribble (a zigzag) over shapes to cut and combine them: a
  scribble that stays inside one overlap punches that region out, a scribble across several regions merges them
  into one face in the colour of the face where it started, and a scribble over a single shape's area that no other
  shape overlaps deletes that shape. Overlapping shapes become a Shaper Group that keeps the shapes: with Click
  selects set to Faces, click a face to select it and change its fill (the Color panel, swatches or Face fill in the
  options bar); with Shapes, click a shape inside the group to select it and drag to move it (the Direct Selection
  tool and the Shape section of Properties edit it too), and the faces recompute. Expand (options bar, Properties,
  or Object > Shape > Expand Shaper Group) turns the group into plain paths; Ungroup gives the shapes back.
- Paintbrush (B) draws strokes with the current brush. Blob Brush (Shift+B) draws filled shapes that merge with
  overlapping shapes of the same fill. Eraser (Shift+E) cuts shapes away; Scissors (C) splits a path at a point; Knife
  cuts shapes along a freehand line.
- Smart guides (Ctrl+U) show alignment to other objects' edges and centres, equal spacing between neighbours (the
  matched gaps are marked), and angles of 0, 45, 90 and 135 degrees; snapping to the grid, to points and to whole
  pixels is in the View menu.

## Transforming

- Rotate (R), Reflect (O), Scale (S) and Shear: click to set the origin, then drag; Alt-drag copies; double-click the
  tool or press Enter for a dialog with exact values (and Copy).
- Free Transform (E) scales and rotates from the box, and Ctrl (Command on a Mac) on a side handle shears. A small
  widget beside the selection (and the options bar) picks the mode: Free Transform, Perspective Distort (drag a
  corner along its edge; the other corner on that edge moves the opposite way, so the box becomes a symmetric
  trapezoid) or Free Distort (drag any corner anywhere); Constrain keeps proportions and holds a distorted corner
  to one axis. Without changing mode, Ctrl on a corner distorts freely and Ctrl+Alt+Shift (Command+Option+Shift)
  distorts in perspective. Distortions are true perspective maps that bend curves where they need to; type, images
  and symbols go into an envelope mesh so the type stays editable. Reshape moves selected points with their
  neighbours.
- After a rotation the bounding box turns with the object, and its handles scale along the object's own sides.
  Object > Transform > Reset Bounding Box squares it to the page again.
- Object > Transform: Transform Again (Ctrl+D), Move, Rotate, Reflect, Scale, Shear and Transform Each (each object
  about its own centre, with random variation if you like).
- The Transform panel and Properties type exact X, Y, W, H, rotation and shear, from the reference point you pick
  in the 3 by 3 grid; fields accept arithmetic (100/3, 2*72).
- Width (Shift+W) drags out variable stroke widths at any point along a stroke; Warp (Shift+R), Twirl, Pucker and
  Bloat reshape art under the brush.
- Align: to the selection, a key object (the last one selected) or the artboard; Distribute Objects and Distribute
  Spacing with an exact gap.
- Puppet Warp (J, with Free Transform on the rail) bends art like a jointed puppet. Select paths, groups or compound
  paths (type, images and symbols go into an envelope mesh, as Free Distort does), then click the art: the first
  click places three pins at its extremes, each later click adds a pin. Drag a pin and the art bends while the other
  pins hold; the shape between them stays as rigid as it can, so a bar curves instead of shearing or collapsing.
  Shift-click selects several pins (they move together), Alt-drag near a selected pin twists the art around it (the
  dotted ring shows where), Delete removes the selected pins and leaves the art as it is. In the options bar, Expand
  grows the area the mesh covers past the art's edges, Show Mesh draws the triangle mesh, and Select All Pins selects
  every pin. Each drag is one undo step and the result is ordinary paths. Undo, or changing the selection, starts a
  new set of pins.

## Measuring and dimensions

- Measure (with the Eyedropper on the rail) drags a distance and angle; click a closed shape, or measure with closed
  shapes selected, for their area and perimeter in the document's units.
- Dimension (Shift+I) adds dimension objects that keep measuring. Pick the type in the options bar. Linear: drag
  (or click twice) between two points, then click where the dimension line goes; Measure picks Horizontal, Vertical
  or Aligned. Angular: click the vertex, a point on one arm and a point on the other, then click to set the arc's
  radius. Radial: click a circle or ellipse (or drag from a centre to the rim, or choose From Three Points and click
  three points on an arc), then click to place the label; Measure picks Radius or Diameter. Points snap to anchors,
  centres and smart guides.
- A dimension is a group that stores what it measures and its settings, and redraws its dimension line, extension
  lines, arrowheads and label whenever they change. With dimensions selected and the Dimension tool active, the
  options bar edits Units (the document's or a fixed unit), Precision, Scale (1:100 shows a 1 cm line as 100 cm),
  Unit Label, Arrows (filled, open, tick, dot or none) and their size, Font, Style and Size, Text (above, centred in a
  break in the line, or below), Colour, Weight and Offset. Drag a selected dimension's square handles to re-measure
  and its round handle to move the dimension line. Moving, scaling or rotating a dimension keeps it live; changing
  the document's units relabels it. Object > Expand turns it into plain paths and type. Dimensions export to SVG and
  PDF and are saved in .fpth files.

## Perspective drawing

- View > Perspective Grid > Show Grid (Ctrl+Shift+I) shows the document's perspective grid: a left plane, a right
  plane and a horizontal (ground) plane meeting at the origin on the ground level, with the horizon and the
  vanishing points. One Point, Two Point and Three Point Perspective each have a normal view preset laid out on the
  first artboard; Grid Presets applies one of them or a preset you saved with Save Grid as Preset. Lock Grid stops
  the widgets from moving and Snap to Grid snaps drawing on a plane to the gridlines.
- Define Grid sets the type, Gridline every (the cell size), the viewing angle and distance, the horizon height
  above the ground level, the third vanishing point (its distance below the horizon, negative above, for three point
  grids), the left, right and vertical extents, each plane's colour and the grid's opacity, with a live preview.
- The Perspective Grid tool (Shift+P) drags the grid's widgets: the round vanishing points (dragging one in a two
  point grid changes the viewing angle and distance, and its height moves the horizon), the square horizon handles,
  the ground level origin (moves the whole grid), the extent handles at the far ends of the ground lines and at the
  top of the corner line, the cell size handle one cell along the top edge, and the diamond plane controls that slide
  the left, right and horizontal planes parallel to themselves.
- The plane widget in the stage's top-left corner picks the active plane: click a face, or press 1 (left), 2
  (horizontal), 3 (right) or 4 (none) while the grid shows. With a plane active, the Rectangle, Rounded Rectangle,
  Ellipse, Polygon, Star, Flare, Line, Arc, Spiral and grid tools draw on that plane: the shape is built in the
  plane's own coordinates and projected, and it stays attached to the plane.
- The Perspective Selection tool (Shift+V) works on art in perspective. Drag art that is not in perspective onto the
  grid to bring it onto the active plane (paths and groups are projected, type, images and symbols are drawn through
  the projection). Drag perspective art to slide it along its plane, Alt-drag to copy it, and press 5 during the drag
  to move it perpendicular to its plane instead. The box around the selection is its bounding box in plane space;
  drag its handles to scale on the plane (Shift keeps proportions, Alt scales from the centre). Double-click type in
  perspective to edit it: the words change in place and stay in perspective.
- Object > Perspective: Attach to Active Plane attaches the selection to the active plane where it already looks
  right; Release with Perspective keeps the look and makes it ordinary art; Move Plane to Match Object moves the
  grid's plane to the selected object's plane; Edit Text edits type in perspective.
- Attached art remembers its plane and its coordinates on the plane, so editing the grid (any widget, Define Grid,
  a preset or a different grid type) re-projects it. Editing an attached path directly, or moving it with the
  Selection tool, keeps it attached at its new place. The grid itself never prints or exports; attached art exports
  to SVG and PDF as it looks. The grid, its view settings and the attachments are saved in .fpth files, and every
  change is one undo step.

## Graphs

- The graph tools share one rail slot (Shift+G): Column, Stacked Column, Bar, Stacked Bar, Line, Area, Scatter, Pie
  and Radar. Drag to set the size of the graph's body (Shift makes a square, Alt draws from the centre) or click for
  exact dimensions; labels and the legend sit outside the body. The Graph Data window opens with sample numbers.
- Graph Data (Object > Graph > Data, Ctrl+Alt+Shift+G, or Graph Data in Properties) is a spreadsheet: the top row
  holds the legend labels, the left column the category labels, the cells the numbers. Type in a cell or in the entry
  box above the grid; Tab moves right, Enter moves down (Shift+Enter up), Ctrl+Enter applies. Paste cells copied from
  a spreadsheet into any cell (tab-separated or CSV), or import a CSV file. Transpose swaps rows and columns, Switch X
  and Y swaps each pair of columns for scatter graphs, Revert throws away what you have not applied and Apply updates
  the graph as one undo step. Rows are categories (one pie each in a pie graph, one axis each in a radar graph) and
  columns are series; a scatter graph reads each pair of columns as Y then X.
- Graph Type (Object > Graph > Type, or Graph Type in a graph tool's options bar) switches the type and
  sets the value axis side, a drop shadow, the legend (right, top or none), the tick values (calculated, or your min,
  max and divisions), tick marks (none, short or full width gridlines), a prefix and suffix for the value labels,
  category tick marks, column and cluster width, line options (mark data points, connect them, edge to edge, filled
  lines, line width, marker size), pie options (legend, legends in wedges, sort, ratio, even or stacked position)
  and the label font and size. With nothing selected it sets the defaults for new graphs.
- A graph is a group of ordinary paths and type. The Direct Selection tool selects one column, wedge or label; the
  Group Selection tool selects one column, then clicking again selects its whole series with its legend key, so you
  can recolour, restroke or add effects to a series. Those styles stay when you edit the data or change options.
- Combined graphs: select a series with the Group Selection tool and choose a different type for it in Graph Type
  (column, stacked column, line or area), for example a column graph with one series drawn as a line.
- Designs: select some art and choose Object > Graph > Design, then New Design. Object > Graph > Column puts a
  design on the selected series (or all series): vertically scaled, uniformly scaled or repeating, where each copy
  stands for a number of units and fractions are chopped or scaled. Object > Graph > Marker uses a design for the
  markers of line, scatter and radar graphs. Paste Design puts a design's art back on the artboard to edit it.
- Moving, scaling or rotating a graph keeps it live; scaling resizes the body and redraws it with unscaled labels.
  Ungroup (or Object > Expand) turns it into plain art. Graphs export to SVG and PDF and are saved in .fpth files.

## Paths and Pathfinder

- Object > Path: Join (Ctrl+J), Average, Outline Stroke, Offset Path, Reverse Path Direction, Simplify, Smooth, Add
  Anchor Points, Remove Anchor Points, Close, Divide Objects Below, Split into Grid and Clean Up (stray points,
  unpainted objects, empty text).
- Live Corners: with the Direct Selection tool, every corner point of a selected path shows a small circle inside the
  corner. Drag it to round the corner; with several points selected, the drag rounds all of them. Alt-click it to cycle
  Round, Inverted Round and Chamfer; double-click it, or choose Object > Path > Corners..., for Type, Radius and
  Rounding (Absolute keeps a fixed distance, Relative a share of the neighbouring segments). A corner that has reached
  the largest radius its segments allow draws in red. Corners stay editable; Object > Path > Expand Corners turns them
  into plain points.
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
  Make Compound Path keeps the bottom object's fill rule (Non-Zero Winding unless it was set otherwise) and turns
  the paths above it the other way round, so where they overlap the bottom path you get holes; Release gives the
  paths back with their paint.
- Attributes panel (Window > Attributes): the two Fill Rule buttons set Non-Zero Winding or Even-Odd on the
  selected compound paths and paths (a self-intersecting path such as a five-pointed star drawn in one stroke gets
  a hole in its middle under Even-Odd). Under Non-Zero Winding a subpath running the opposite way to the one around
  it is a hole: select one subpath of a compound path with the Direct Selection tool and click Reverse Path Direction
  (also Object > Path) to turn a hole into a fill or back. Even-Odd makes every other nested area a hole whatever the
  direction. The Note field keeps a note with the object; it is saved in the file and agents can read it.

## Colour and paint

- Color panel: Grayscale, RGB, HSB, CMYK and Web Safe sliders, a hex field and a spectrum. Global and spot swatches
  show a Tint slider; with a tint set, New Swatch in the Swatches panel saves it as a tint swatch (the light band at
  its foot) that stays linked to its parent. Invert, Grayscale, Convert to CMYK and Convert to RGB (Edit > Edit Colors)
  act on everything selected.
- Swatches: process, global process (the white corner), spot (the white corner and a dot), tint, gradient, pattern,
  [None] and [Registration] swatches, filtered by kind. Global and spot swatches recolour every use when edited, and
  their tints follow. Colour groups show as folders: Shift or Mod click swatches and press New Color Group (the folder
  button) to group them, or make a group from the selected artwork's colours; drag swatches onto a folder or onto a
  swatch in a group to move them in, onto empty space to take them out; double-click a folder to rename or ungroup it,
  and Delete with a folder picked removes the group and its swatches.
- Swatch libraries: Window > Swatch Libraries (or the books button in the Swatches panel) opens Color Themes (Brights,
  Pastels, Retro), Skin Tones, Earth Tones, Metals, Web, Grayscale, Gradients (Spectrums, Sky and Water, Fades),
  Patterns (Basic Lines, Dots and Grids), Nature (Seasons), Color Books (Spot Inks) and User Defined in the Swatch
  Library panel. Click a swatch to add it to the document and paint with it, a folder to add the group, or the plus
  to add them all. Save Swatch Library as ASE writes an Adobe Swatch Exchange file of the solid colours with their
  groups and process, global or spot type; Save Swatch Library as formpth writes a .fpth holding every swatch,
  gradient and pattern. Saved libraries appear under User Defined; Other Library opens any .ase or .fpth (File > Open
  also takes .ase).
- Spot colours print on their own plate: PDF export writes each spot swatch as a Separation colour space named after
  the swatch, with its CMYK values as the alternate, and tints as the separation's tint value.
- Recolor Artwork (Edit > Edit Colors, or Recolor in Properties): a colour wheel (Smooth or Segmented) with a marker
  for each new colour; drag a marker to change hue and saturation, and use Brightness for the active row. With the
  link on, the markers move together as a harmony; the starred row is the base colour. Colors reduces the artwork to
  that many colours, clustered by how alike they look (OKLab); Recolor Exact or Preserve tints and shades. The Colors
  list maps the current colours of each row to its new colour: click the new colour to pick another, untick a row to
  leave it alone, Shift click rows and Merge them, or Separate a row back into its colours. Library recolours with a
  document colour group or any swatch library or library group; Preset sets up a 1 color job, a 2 color job or a
  colour harmony around the base colour (Harmony picks the rule). The eyedropper is the Color Theme Picker: click an
  image or object on the canvas to take its palette. The other buttons shuffle the colours or their saturation and
  brightness. The art previews live; OK is one undo step.
- Color Guide: harmony rules and tints and shades, warm and cool, or vivid and muted variations; Limit to snaps them
  to a swatch library.
- Gradient panel and Gradient tool (G): linear and radial gradients with any number of stops and midpoints; drag a
  stop off the bar to remove it, click under the bar to add one. The Gradient tool drags the direction on the art
  and shows its annotator. Strokes take gradients within, along or across: with the stroke active (X), the Within,
  Along and Across buttons under the ramp choose how. Within paints the gradient over the object's box; Along runs it
  from the path's start to its end, round every curve and corner (a closed path wraps back to its start point);
  Across runs it from one edge of the stroke to the other. Along and Across follow dashes, caps, corners, alignment
  and width profiles, and look the same on screen, in SVG and PDF, and after Expand Appearance or Outline Stroke,
  which turn them into a clipped group of gradient-filled pieces.
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
- Generate Patterns (Object > Pattern > Generate Patterns) turns a prompt into pattern swatches with the language
  model set for the Assistant. Choose the colours (a preset such as Warm, Cool, Pastel, Earth, Vivid, Monochrome,
  Forest or Ocean, the document's swatches, the colours of the selection, or up to 12 of your own as hex values),
  the density (1 very sparse to 5 packed) and how many variations. The model draws a seamless SVG tile; formpth
  imports it as editable paths, snaps every colour to your palette and shows each tile repeated. Click a tile to
  leave it out, then Save to Swatches makes a pattern swatch of each (Fill the selection with the first fills the
  selected objects); edit them like any pattern. One undo step.
- Generative Shape Fill (Object > Generative > Shape Fill) fills a selected closed path with vector art from an
  optional prompt. Shape Strength sets how closely the art follows the outline (high takes its silhouette, low
  composes freely and only crops), Detail sets how many shapes, Variations how many to compare. Pick a variation
  and Apply: the art comes in as editable paths, fitted to the shape and clipped by it (the shape is the clipping
  path, so its stroke stays). One undo step; Release Clipping Mask gives back the art and the shape.

## Stroke, transparency and appearance

- Stroke panel: weight, caps, corners, miter limit, alignment (center, inside, outside), dashes and gaps, arrowheads
  for start and end, and width profiles.
- Transparency panel: blend mode (all 16), opacity, opacity masks (Make Mask uses the topmost selected object;
  Clip, Invert Mask, Disable turns the mask off without removing it, Link keeps it moving with the art), isolate
  blending and knockout group. Object > Opacity Mask also has Disable and Unlink, and New Opacity Masks Are Clipping
  and New Opacity Masks Are Inverted set what Make Mask starts with (remembered between sessions).
- Knockout Group has three states: click to cycle on, inherit (a dash: take the setting of the enclosing group) and
  off. In a knockout group each object shows against what is under the group, not against the objects below it in
  the group, so three overlapping 50 percent circles show only the top one where they overlap. Opacity and Mask
  Define Knockout Shape, on an object inside the group, makes it knock out only as much as it is opaque. Knockout
  groups render the same on screen, in SVG (masks) and in PDF (a knockout transparency group, drawn with soft masks
  so viewers that ignore knockout show it too).
- Appearance panel: every fill, stroke and effect on an object, top to bottom. Add another fill or stroke, hide
  items, click an effect's name to edit it (the dialog previews as you change it), Clear Appearance, Reduce to Basic
  Appearance. Click a fill or stroke row to target it: Add New Effect, and any effect chosen from the Effect menu
  while it is targeted, then applies to that fill or stroke only (a roughened fill under a clean stroke, a blurred
  glow stroke under a sharp one). Its effects list under it with their own visibility, edit and delete; Duplicate
  Selected Item copies the targeted fill, stroke or effect, and the arrows move it. 3D effects always apply to the
  whole object.
- Groups and layers have their own appearance. Select a group to add fills, strokes and effects to it: they draw
  over its contents (the Contents row shows where). Click a layer's target circle in the Layers panel to target the
  layer itself; the Appearance panel then shows Layer, and fills, strokes, effects and graphic styles apply to the
  whole layer.
- Graphic Styles panel: New Graphic Style keeps the targeted object's appearance and links the object to it; click a
  style to apply it (the linked style is outlined). Redefine Graphic Style gives the picked style the selection's
  appearance and every object still linked to it follows; editing an object's appearance by hand ends its link, and
  Break Link to Graphic Style ends it on purpose. The Library menu at the top of the panel, or Window > Graphic Style
  Libraries, shows the built-in libraries (Shadows and Glows, Buttons, Outlines, Textures, Scribbles); clicking a
  library style adds it to the document's styles and applies it.
- Effects (Effect menu) stay live and editable: Warp (15 styles), Distort & Transform (Free Distort, Pucker & Bloat,
  Roughen, Transform, Tweak, Twist, Zig Zag), Path (Offset Path, Outline Stroke), Stylize (Round Corners, Scribble,
  Drop Shadow, Inner Glow, Outer Glow, Feather), Rasterize and Convert to Shape. Apply Last Effect repeats the last
  one; Expand Appearance makes it permanent.
- Photoshop effects, in the lower half of the Effect menu: Effect Gallery opens every one of them as a thumbnail of
  your selection, grouped as Artistic, Blur, Brush Strokes, Distort, Pixelate, Sketch, Stylize, Texture and Video;
  click one to see it large and set its options, double-click or OK to apply. Each is also in its own submenu (Blur
  holds Gaussian, Radial and Smart Blur). They stay live in the Appearance panel like any effect. Sizes are in points,
  so a look holds at any zoom; the Sketch effects draw in a foreground and background colour you choose.
- 3D: select art and open Window > 3D and Materials (or Effect > 3D and Materials). Plane turns the flat art in
  space, Extrude gives it depth (with a cap and an optional classic or rounded bevel), Revolve spins the art around
  its left or right edge like a lathe (draw half a bottle, revolve it), and Inflate puffs it up. Pick a position or
  set the X, Y and Z rotation and perspective, a material (plastic, matte, metal, wireframe, flat) and the light's
  direction, intensity, ambient level, highlight and shading colour. Inflate turns too (no perspective). Type and
  groups turn as one object. Map Art puts a symbol on the front face of an Extrude or Plane: make the label a symbol,
  pick it under Map Art, then set its scale and offset; Shade Artwork darkens it with the face. Shadow casts a soft
  shadow behind the object or below it on the ground, with distance, softness and opacity. The effect stays live in
  the Appearance panel; Expand Appearance makes plain shaded shapes.
- Rasterize (Effect > Rasterize) shows the object as pixels at a resolution you pick, optionally on white with a
  margin. Effect > Document Raster Effects Settings sets the resolution raster effects are written at in PDF and SVG.
- Brushes: calligraphic, scatter, art, bristle and pattern brushes apply to any stroke from the Brushes panel. New
  Brush makes a calligraphic or bristle brush, or a scatter, art or pattern brush from the selected art; double-click a
  brush for its options and colorization.
  - Bristle brushes paint with many thin, semi-transparent bristles: Shape (Round or Flat Point, Blunt, Curve, Angle,
    and Fan), Size, Bristle Length, Density and Thickness, Paint Opacity and Stiffness. With a pen tablet the
    Paintbrush records pressure, which widens the bristles (and calligraphic brushes) as you press.
  - Art brushes scale proportionately, stretch to the stroke length, or stretch between guides (only the art between
    the start and end guide stretches, so arrow heads and tails keep their shape); Flip Along and Flip Across mirror it.
  - Pattern brushes take a side tile (the art) and outer corner, inner corner, start and end tiles from pattern
    swatches; corner tiles sit at sharp corners, start and end tiles at the ends of open paths. Fit stretches the
    tiles, adds space between them, or approximates the path by scaling them.
  - Window > Brush Libraries (or the books button in the Brushes panel) opens Arrows, Borders, Decorative Scatter,
    Artistic Ink, Bristle Brushes and User Defined in the Brush Library panel; click a brush to add it and apply it.
    Save Brushes writes the document's brushes as a .fpth library (also kept under User Defined), and Open Brush
    Library loads the brushes of any .fpth. Brush strokes look the same on screen, in SVG and PDF, and after Expand
    Appearance.

## Type

- Type (T): click for point type, drag for area type; click a path with Type on a Path to set type along it;
  click a closed path with Area Type to fill it. Typing works as in any text field: arrows, Shift to select,
  double-click a word, Ctrl+A selects all of the type, copy and paste.
- Vertical type: Vertical Type, Vertical Area Type and Vertical Type on a Path (in the Type tool's flyout) set
  characters top to bottom in columns that advance right to left, inside a frame or any closed shape too. Chinese,
  Japanese and Korean characters and full-width forms stand upright, punctuation and brackets take the font's
  vertical forms, and Latin letters and digits turn 90 degrees clockwise; Upright Latin in vertical type in the
  Character panel stands them upright. Up and Down move through the characters, Left and Right move to the next and
  previous column. Type > Type Orientation switches selected type between Horizontal and Vertical. Vertical type
  draws, outlines, and exports to SVG and PDF the way it shows on the canvas; use a font that has the CJK glyphs,
  such as Noto Sans CJK, so outlines and PDF carry every character.
- Character panel: font family and style, size, leading, kerning, tracking, scale, baseline shift, character
  rotation, case, and the fonts installed on your computer when the engine runs. Kerning Auto uses the font's
  kerning pairs; Optical spaces each pair from the shapes of the two letters, so it also evens out fonts without
  kerning. Paragraph panel: the seven alignments, indents, space before and after, Hyphenate, Bullets and Numbering
  (a bullet character, or numbers as 1, 01, a, A, i or I from a starting number; a negative first-line indent makes a
  hanging list), and the area type columns, gutter and inset. Type > Area Type Options sets the frame's width and height, rows and
  row gutter, columns and column gutter, inset spacing, the first baseline (Ascent, Cap Height, Leading, x Height,
  Em Box Height, Fixed or Legacy, with a Min distance from the top) and whether text flows by rows or by columns.
  Glyphs shows a font's characters to insert; with a character selected in type, the row above the grid shows its
  alternates, and clicking one sets that character in it.
- Variable fonts: installed variable fonts show "(Variable)" in the Character panel's font list, and Variable fonts
  only narrows the list to them. With one chosen, the style list adds the font's named instances (Medium, SemiBold
  and so on), and a Variable Font section at the foot of the panel gives a slider and value for each axis the font
  has: Weight, Width, Slant, Italic, Optical size, and custom axes by name and tag. The canvas, Create Outlines and
  PDF draw the glyphs at those settings; SVG keeps the type live with font-variation-settings (and the matching
  weight, width and slant), and writes outlines for custom axes that a viewer cannot set.
- Hyphenation and justification: Hyphenate breaks words at line ends in area type. Paragraph > Hyphenation (or Type >
  Hyphenation) sets Words longer than, After first, Before last, Hyphen limit (lines in a row, 0 for no limit),
  Hyphenation zone (for unjustified type, the gap at a line's end below which no word is broken) and Hyphenate
  capitalized words. formpth breaks English words with its own syllable rules (prefixes and suffixes, consonant
  clusters, double letters), not a dictionary, so unusual words can break in places a dictionary would not.
  Justification sets word spacing, letter spacing and glyph scaling as minimum, desired and maximum percentages
  and how a line holding a single word is set. Desired values apply to every alignment; justified lines may
  squeeze to the minimums to fit more and stretch up to the maximums (word spacing past its maximum when nothing
  else is left).
- Tabs (Window > Tabs or Type > Tabs): choose left, centre, right or decimal, then click the ruler to add a stop at
  that distance from the frame's left edge; drag a stop to move it or down off the ruler to remove it. X, Leader
  (characters repeated across the gap, such as a dot) and Align On (the character a decimal tab lines up) edit the
  picked stop. Without stops, tabs advance to every 36 points.
- Touch Type (Shift+T, in the Type tool's flyout): click a character to put a box around it. Drag inside the box to
  move the character, a corner to scale it proportionally, the top or bottom handle to scale it vertically, a side
  handle to scale it horizontally, and the dot above the box to rotate it; arrow keys nudge it (Shift for 10 points).
  The options bar shows and sets its X, Y, H, V and rotation, and Reset clears it. The type stays editable: the
  character keeps its transform while you type around it, and outlines, SVG and PDF show it.
- Type on a path: select it with the Selection or Direct Selection tool to see three brackets. Drag the start or end
  bracket to change where the type begins and ends along the path; drag the centre bracket along the path to move
  the type, or across the path to flip it to the other side. Type > Type on a Path chooses the effect: Rainbow
  (baselines follow the path), Skew (letters stay vertical), 3D Ribbon (horizontal edges stay horizontal), Stair Step
  (upright letters stepping along the path) or Gravity (letters turn toward the path's centre). Type on a Path
  Options also sets Flip, Align to Path (Ascender, Descender, Center, Baseline), Spacing (tightens letters that fan
  out around tight curves), and the start and end.
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
- Retype (Type > Retype) finds the font of outlined type or of text in a placed image and makes it live type again.
  Select the outlines (or an image, plus a rectangle over it to read only that region) and click Find Fonts. If your
  language model reads images, it reads the words and describes the typeface first; without it, formpth reads
  outlined letters by comparing each letter's shape with the letters of every installed font, and for an image you
  type the words in the panel. formpth then sets the text in each installed font, compares the shapes with the
  original and lists the ten closest with a score. Pick one and Apply (or double-click it): the outlines become live
  type in that font, sized, tracked and placed over the original; for an image the type goes on top, and Keep the
  image decides whether the image stays. One undo step.

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
- Intertwine (Object > Intertwine): Make turns two or more overlapping objects (paths, groups, type) into an
  intertwine object and starts its editing mode (the Intertwine tool, Shift+J). Overlaps light up under the pointer;
  click one and the object below comes to the front inside that overlap, so two rings link like a chain. Where
  three or more objects overlap, each click brings the next one down to the top. Drag (or Alt-drag) a loop around
  part of an overlap to set the order there freely. Escape, Enter or Done leaves; Edit (or Edit Intertwine in
  Properties) comes back. Moving or reshaping one of the objects keeps the areas where they are on the page.
  Release gives back the plain objects in their original order; Object > Expand makes plain objects with clipped
  copies for each area. Live Paint, Repeat and Shaper Groups cannot be intertwined. SVG and PDF export draw the
  areas as clipping paths.
- Envelope Distort (Object > Envelope Distort): Make with Warp (the 15 warp presets), Make with Mesh (rows and
  columns) or Make with Top Object pours the selection, type and images included, into a shape. With the Direct
  Selection tool, drag a mesh point or one of its handles (Shift turns the opposite handle with it); with the Mesh
  tool, click inside to add a row and column there and Alt-click a point to remove its lines. A warp or top-object
  envelope becomes a mesh the first time a point moves; Reset with Mesh (keeping the shape or not) and Reset with
  Warp replace the shape on purpose. Edit Contents shows the art inside undistorted so you can select it, move it
  or edit the type; the envelope follows, and Edit Envelope goes back. Envelope Options sets Fidelity (how closely
  curves follow the mesh), Distort Appearance (strokes and effects bend too), Distort Linear Gradients, Distort
  Pattern Fills and Anti-Alias for images. Release gives back the art and the envelope shape; Expand makes plain
  paths (type becomes outlines, images keep their distortion). SVG and PDF export draw distorted images as pixels
  at the document's raster resolution.
- Symbols: Object > Symbol > New Symbol (F8) stores art in the Symbols panel; instances update when the symbol changes;
  Break Link makes an instance ordinary art. The New Symbol dialog sets the type (Dynamic or Static), the
  registration point (one of nine points of the art's bounds; instances are placed and transformed about it) and
  9-slice scaling guides. Double-click an instance with the Selection tool, or a symbol in the panel, for symbol
  editing mode: the symbol's art is shown unscaled at the instance with a crosshair at the registration point, every
  other instance follows each change as you make it, and Exit (or Escape, or a double-click outside) saves it as one
  undo step; Cancel throws the changes away. With 9-slice on, drag the dashed guides in editing mode: a scaled
  instance keeps the corners outside the guides at their own size and stretches only the middle. On a dynamic
  symbol, click a part of an instance with the Direct Selection tool and change its fill, stroke or opacity: only
  that instance changes (Reset Symbol Overrides clears it). The panel menu also has Duplicate Symbol, Redefine
  Symbol (the selection becomes the symbol's art), Replace Symbol (the selected instances use the picked symbol) and
  Symbol Options. Window > Symbol Libraries opens Arrows, Web Icons, Nature, Shapes and Flowchart (click a symbol to
  add it, double-click to place it), Save Symbols writes the document's symbols as a library (it also appears under
  User Defined) and Open Symbol Library reads one from a .fpth. The Symbol Sprayer (Shift+S) sprays instances into a symbol set, and
  the symbolism tools in its flyout change the instances under the brush: Shifter pushes them (Shift-click and
  Shift-Alt-click restack), Scruncher pulls them together, Sizer grows them, Spinner turns them toward the drag,
  Stainer tints them with the fill colour, Screener fades them and Styler applies the graphic style chosen in the
  options bar. Alt reverses each one. Diameter, intensity and the method (user defined, average, random) are in the
  options bar; [ and ] change the diameter.
- Image Trace: Object > Image Trace > Make traces a placed image into a tracing object that keeps the image, so the
  Image Trace panel can change the preset, mode, palette and colours or threshold and trace it again (with Preview on,
  as you change them). The image is traced at its own resolution up to 2000 pixels on its longest side, in the
  background, so the window stays responsive. Palette: Automatic picks the number of colours from the image,
  Limited uses the Colors slider, Full Tone keeps many tones for photos, Document Library uses the document's colour
  swatches. Advanced: Paths (how closely the outline follows the pixels), Corners (more keeps sharper corners),
  Noise (areas smaller than this many pixels merge into their neighbours), Method (Abutting cuts each colour out of
  the others; Overlapping stacks them so there are no gaps), Create Fills and Strokes (black and white mode: lines
  up to the Stroke width are traced along their centre as stroked paths, wider areas stay fills), Ignore White,
  Smooth Curves and Snap Curves to Lines (nearly straight curves become lines, lines near 0 or 90 degrees snap
  straight). The Line Art, Technical Drawing and Outline presets trace strokes. View switches between the result,
  the result with outlines, outlines, outlines over the image and the image. Expand makes ordinary paths; Release
  brings the image back.
- Links: File > Place Linked keeps a placed image linked to its file instead of copying it in. With the engine
  service (the desktop app or ./formpth boot) you choose the file by its path, and formpth stores the path, size and
  time; in a browser without the engine, Chromium browsers link through a file you pick (the browser asks once for
  permission), and other browsers can only embed, which the Links panel says. The Links panel lists every placed
  image as Linked, Modified (the file changed on disk: checked when the window regains focus and every few seconds)
  or Missing, or Embedded. Update Link reads the file again, Relink points the image at another file, Relink All
  Instances changes every image sharing the link, Relink Missing Links from Folder finds missing files by name in a
  folder, Go To Link selects and shows it, Embed copies it into the document, Unembed writes an embedded image to a
  file in a "Links" folder next to the project and links it, and Link Info shows the path, size, date, pixels and
  effective resolution. Each is one undo step. A .fpth keeps the links with a small cached preview, so a missing
  file still shows (turn Save Previews of Linked Images off in the panel menu to keep only the link); opening the
  project reads each unchanged linked file again. Exports always embed the current pixels.

## Variables and data merge

- Window > Variables binds data to objects. Select an object and click a kind under Make from selection: Text String
  (point or area type), Linked File (a placed image, whose picture is replaced), Visibility (any object) or Graph
  Data (a graph). With nothing selected the variable is made unbound; pick it and click Bind to bind it later. Unbind,
  Select Bound Object and Delete act on the picked variable; double-click a variable to rename it.
- Data sets: Capture Data Set records the bound objects as they are now; Update Data Set overwrites the shown one
  with the artboard as it is; Previous and Next (or the menu) show a data set, and the artboard changes to it as one
  undo step.
- Import Data Sets reads CSV or JSON. In a CSV the header row names the variables (a name that matches an existing
  variable uses it; a new name makes an unbound variable, a Linked File one when its values are image paths or a
  header starts with @), each row is a data set, and a column called Data Set names them. Image values are absolute
  paths the engine can read or web addresses. A graph value is spreadsheet text with rows split by | (or JSON
  {series, categories, values}). JSON is an array of objects keyed by variable name, or {"dataSets": [...]}.
- Export Variations writes one PNG, SVG or PDF per data set (optionally a .fpth too), named from the data set or a
  text variable, into a folder through the engine or as a zip download; problems go into
  formpth-data-merge-errors.txt. Variables and data sets are saved in .fpth files.

## Actions, batch and history

- Actions (Window > Actions) keeps action sets in the engine's library (the Actions folder in your formpth data
  folder), one .fpaction file per set. New Action starts recording; menu commands are recorded with the values you
  give their dialogs (Move, Rotate, Scale, Offset Path, effects and every other dialog), and drags with the
  Selection, Rotate, Reflect, Scale and Shear tools, shapes you draw, fill and stroke changes, opacity and graphic
  styles are recorded as the operations they performed. Stop ends recording; Record adds more after the picked step.
- Each step has a check box to leave it out and, for steps with a dialog, a box that shows the dialog when the action
  plays so you can change the values. Double-click a step to edit its recorded values, an action or a set to rename
  it. Insert Stop adds a message that pauses playback (with or without Continue). Move Up, Move Down, Duplicate and
  Delete organise steps, actions and sets. Load and Save read and write .fpaction files. A Default Actions set comes
  with outline and expand, rotate, scale, reflect, move, opacity, drop shadow, simplify, type to outlines and
  grayscale.
- Play runs the picked action from the picked step. Transforms play about the centre of whatever is selected.
- Batch (in the Actions panel or File > Automate) plays an action on every .fpth, SVG and PDF file in a folder, or
  on each data set of the open document, and saves each result (as the source format, .fpth, SVG, PDF or PNG) into a
  folder through the engine or a zip download, with formpth-batch-log.txt listing what ran and what failed. Choose
  to stop at the first error or log it and go on.
- History (Window > History) jumps to any recent state. New Document (the page button, or File > Automate > New
  Document from History State) opens the current state as a new document; History Options sets how many undo steps
  are kept (also in Preferences > File Handling).

## Saving and exporting

- .fpth projects keep everything editable: artboards, layers, live shapes, effects, symbols, swatches, styles,
  brushes and the images inside (linked images keep their link and a cached preview).
- File > Export > Export As writes SVG, PDF, EPS, DXF, PNG, JPEG or WebP of the active artboard, every artboard, or the
  selection. Export for Screens writes chosen artboards at several scales and formats in one ZIP.
- Asset Export: File > Export > Collect for Export as Single Asset adds the selection as one asset, as Multiple
  Assets adds each selected object. The Asset Export panel (Window) shows them; double-click to rename, set scales,
  suffixes and formats (PNG, JPEG, WebP, SVG, PDF), and Export writes each asset cropped to its art in one ZIP.
- SVG export keeps gradients, patterns, clipping, masks, symbols (as symbol and use; an instance with overrides or
  9-slice scaling gets its own symbol) and type (as text or outlined), and can embed
  formpth's editing data so formpth reopens it fully editable. SVG import reads paths, shapes, transforms, CSS
  classes, gradients, clip paths, use and symbol, text and embedded images, with top-level groups becoming layers.
- PDF export writes every artboard as a page with real vector paths, gradients as smooth shadings, transparency and
  blend modes, outlined type and images; effects a PDF cannot express are rasterised at the document's resolution.
  It carries formpth's editing data, so formpth reopens its own PDFs fully editable.
- Opening any other PDF, or an .ai file saved with PDF compatibility, gives one artboard per page with its art as
  editable paths, gradients, clipping groups, images and point type. Type takes the installed font of the same name,
  or the nearest of Helvetica, Times New Roman and Courier New; a message lists the substitutions and anything left
  out (encrypted files, mesh shadings, tiling patterns and some scanned image formats do not come in).
- EPS: File > Export > EPS writes Level 3 PostScript with a bounding box and no preview, per artboard (All
  artboards gives a ZIP with one EPS each), in RGB or CMYK. Paths, gradients (as smooth shadings), clipping, type
  (as outlines) and images (with their transparency as a mask) are vector or image data; transparency, blend modes,
  masks, patterns and raster effects are flattened into an image of the object over what lies below it. With
  Preserve formpth editing on, the EPS carries the document and formpth reopens it fully editable. Opening any other
  EPS runs its PostScript in formpth's own interpreter and keeps the paths, fills, strokes, clipping, gradients and
  simple text; images inside it are left out and the message says so.
- DXF: File > Open (or Place) reads ASCII DXF from AutoCAD R12 to 2018. The DXF Import Options choose the layout
  (model space or a paper space layout), the scale (the drawing's units, one drawing unit as millimetres, inches and
  so on, times a scale factor, or fit to a Letter artboard) and whether to merge every layer into one. Lines,
  polylines with arcs, circles, arcs, ellipses, splines, text and MTEXT (as point type), hatches (as filled paths,
  gradient hatches as gradients), solids, leaders, dimensions and block inserts (with their attributes) come in on
  layers named after the DXF layers, with their colours, line weights and hidden state.
- File > Export > AutoCAD Interchange (DXF) writes AutoCAD 2000 (paths as lightweight polylines with arc bulges, or
  splines where they curve; fills as solid hatches; true colours and lineweights) or R12 (polylines with arcs, curves
  as short segments, no fills). Choose the units and the scale (drawing units per unit of art, so 100 writes a 1:100
  drawing at full size), type as TEXT objects or outlines, and whether lineweights scale with the drawing. Each layer
  stays a DXF layer.
- DWG is a closed binary format and formpth does not read or write it. Save the drawing as DXF in your CAD program
  and open the DXF.
- File > Send to NodeMode sends the active artboard as an image to a NodeMode canvas (Preferences > Plugins sets its
  address).

## Agents and the assistant

- Window > Terminal (Alt+Shift+Ctrl+T, Opt+Shift+Cmd+T on a Mac) opens the dock at the bottom of the window: real
  shells on this computer, one tab each. The agent button (Alt+Shift+Ctrl+C) starts Claude Code, your own sign-in,
  in a tab already connected to formpth's tools, so it can draw in the open document without asking you first. The
  speech bubble (Alt+Shift+Ctrl+H) opens Chat, which runs Claude Code behind a plain conversation; From Claude
  Code... brings a tab's conversation into Chat and Open in Claude Code moves a Chat conversation to a tab. The line
  under the dock sends a message to the active Chat or Claude Code tab with the document name and selection added.
  Claude Code must be installed (https://claude.com/claude-code) and signed in once.
- `./formpth cli list [word] [--group Object]`, `./formpth cli describe <id>` and `./formpth cli run <id> key=value`
  read and run the command catalogue (every menu command and tool) on the open window; agents use the same catalogue
  through `list_commands`, `describe_command`, `run_command` and `run_commands`.

- formpth runs an MCP server so agents (Claude Code, Claude Desktop, Codex, Cursor and others) can draw in the open
  window. Turn it on in Preferences > Plugins (Allow agents); the first call asks your permission. Connect with
  `./formpth mcp` (a stdio bridge) or the HTTP endpoint the engine prints at boot.
- Only the formpth window hands agent requests to your document. When it opens it gets a private session from the
  engine, which gives one only to formpth's own page, and every exchange between the window and the engine carries
  it; a web page or another program cannot pose as the window, answer the permission question or read the requests.
  If you open formpth in a second window or tab, the newest one takes the agents' requests; click back into an
  earlier one to hand them back to it.
- The tools cover everything here: reading the document (get_document, get_image, get_svg, get_object), drawing
  (draw_shape, draw_path, add_text, edit_anchors), paint (set_paint, set_stroke, set_appearance, add_swatch,
  graphic_style), structure (group, arrange, compound_path, attributes, clipping_mask, layers), transforms and align, Pathfinder
  and path operations, live effects, blends, envelopes, repeats, symbols, brushes, image trace, graphs (graph),
  variables and data merge (variables), actions and batch (actions), opening, saving and exporting, and run_command
  for any menu command. Every change is one undo step.
- The assistant (Window > Assistant) uses a language model you set in Preferences > Plugins (a local Ollama model or
  an OpenAI-compatible endpoint) with the same tools, and Undo This Turn reverses all of its changes at once.
- Generative Shape Fill (Object > Generative > Shape Fill), Generate Patterns (Object > Pattern) and Retype
  (Type > Retype) run on that same model; formpth calls no other service. When no model is set, their panels say so
  and the Generate buttons stay off. Turn on The model reads images in Preferences > Plugins when your model accepts
  images (Retype then reads text in pictures). The tools generative_shape_fill, generate_patterns and retype give
  agents the same features.

## Plugins

- Plugins add commands to the Plugins menu and can read the document, place SVG and call the same tools agents use.
  Plugins > Manage Plugins adds a plugin script (.js) and turns plugins on and off. A plugin runs in a sandbox and
  cannot open, save or export files on its own. It cannot reach the network either: requests, remote scripts,
  images and frames, peer connections and navigating away are all blocked, so it can read your document through the
  tools but has no way to send it anywhere.

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
