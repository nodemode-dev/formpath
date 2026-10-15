# formpth tools

Generated from the engine's catalogue by `./formpth agents sync`; do not edit by hand.

## Contents

- Look: `get_document`, `get_image`, `get_svg`, `get_object`
- Files and documents: `new_document`, `open_file`, `save_project`, `export_file`, `switch_document`, `place_image`, `links`, `document_setup`
- Selecting: `select`, `select_same`, `select_similar`
- Drawing: `draw_path`, `draw_shape`, `edit_shape`, `add_text`, `edit_anchors`, `add_dimension`, `perspective`
- Paint and appearance: `set_paint`, `set_stroke`, `set_appearance`, `add_swatch`, `swatch_library`, `swatch_group`, `color_harmony`, `graphic_style`
- Objects and layers: `set_object`, `arrange`, `group`, `compound_path`, `attributes`, `clipping_mask`, `opacity_mask`, `delete_objects`, `duplicate_objects`, `add_layer`, `set_layer`, `delete_layer`, `move_to_layer`
- Transform and align: `transform`, `align`, `puppet_warp`
- Path operations: `pathfinder`, `path_operation`, `shape_builder`, `shaper`
- Effects and live objects: `apply_effect`, `three_d`, `expand`, `make_blend`, `envelope`, `repeat`, `symbol`, `apply_brush`, `new_brush`, `brush_library`, `image_trace`, `live_paint`, `intertwine`, `gradient_mesh`, `symbolism`, `make_pattern`, `edit_pattern`, `recolor`
- Colour management: `list_color_profiles`, `set_color_settings`, `convert_to_profile`, `proof_colors`
- Artboards: `artboard`
- Type: `retype`, `set_text`, `text_flow`, `text_style`, `find_font`, `create_outlines`
- Generative: `generative_shape_fill`, `generate_patterns`, `text_to_vector`, `generative_recolor`
- Graphs and data: `graph`, `variables`
- Commands: `actions`, `list_commands`, `run_command`
- History: `undo`, `redo`
- Other: `describe_command`, `run_commands`

## get_document

The open document: name, units, colour mode, the artboards (index, name, x, y, width, height in points), the layers and every object in them bottom to top (id, name, kind, bounds, fill, stroke, opacity, visible, locked, text), the selection, the swatches, symbols, graphic styles and brushes, and the other open documents.

- `depth`: integer; default 8; How deep groups are listed.

Note: read-only.

## get_image

The art as it looks, as a PNG image: one artboard (default the first), the whole document, or the selection, its longer side at most max_size pixels.

- `scope`: string (artboard | document | selection); default "artboard"
- `artboard`: integer; default 0
- `max_size`: integer; default 1024
- `outline`: boolean; default false; Outline view: paths only, no paint.

Note: read-only.

## get_svg

SVG markup of an artboard, the whole document, or the given objects.

- `scope`: string (artboard | document | selection); default "artboard"
- `artboard`: integer; default 0
- `ids`: array; Object ids from get_document; the selection when left out.

Note: read-only.

## get_object

One object in full: its kind, geometry (anchors with their handles for paths), appearance stack (fills, strokes, effects), transform, text and children.

- `id`: string; required; An object id from get_document.

Note: read-only.

## new_document

Opens a new document with one or more artboards.

- `width`: number; required
- `height`: number; required
- `units`: string (pt | px | mm | cm | in | pc); default "pt"
- `name`: string
- `color_mode`: string (rgb | cmyk); default "rgb"
- `artboards`: integer; default 1

## open_file

Opens a file at an absolute path: a formpth project (.fpth), SVG, PDF or a PDF-compatible .ai, EPS (formpth EPS reopens fully editable; other EPS is read by running its PostScript paths), an AutoCAD DXF (ASCII, R12 to 2018), or an image (PNG, JPEG, WebP, GIF) as a new document. DWG (R2000, R2004, R2010, R2013 and R2018) is read by formpth itself; other DWG versions open through a DWG converter on this computer (ODA File Converter or LibreDWG dwg2dxf), and without one the call says how to get it.

- `path`: string; required
- `units`: string (mm | cm | m | km | in | ft | yd | mi | pt | px); DXF only: what one drawing unit is; default the file's own units, else mm for metric drawings and in otherwise.
- `drawing_scale`: number; default 1; DXF only: multiplies the drawing (0.01 opens a 1:100 plan at one hundredth size).
- `layout`: string; default "Model"; DXF only: Model, or the name of a paper space layout.
- `merge_layers`: boolean; default false; DXF only: put every DXF layer into one layer.
- `fit_artboard`: boolean; default false; DXF only: scale the drawing to fit a Letter artboard instead of using its units.
- `password`: string; PDF only: the password of an encrypted PDF. The empty user password is tried automatically; without a password the window asks for one.

## save_project

Saves the document as a formpth project (.fpth) at an absolute path; everything stays editable.

- `path`: string; required

## export_file

Exports the art to an absolute path; the extension chooses the format: .svg, .pdf (every artboard a page), .ai (PDF-compatible Illustrator file, every artboard a page, reopens fully editable in formpth), .eps (Level 3 PostScript; all_artboards gives a zip of one EPS per artboard), .dxf (AutoCAD 2000 or R12, layers kept), .png, .jpg or .webp.

- `path`: string; required
- `scope`: string (artboard | document | selection | all_artboards); default "artboard"
- `artboard`: integer; default 0
- `scale`: number; default 1
- `quality`: number; default 0.92
- `transparent`: boolean; default false
- `outline_text`: boolean; default false; SVG and DXF: type as outlines (DXF writes TEXT otherwise).
- `live_text`: boolean; default true; PDF only: write type as selectable, searchable text with the fonts embedded (default). Type with gradients, effects, 3D or an unavailable font is outlined either way; false outlines all type.
- `pdf_standard`: string (none | x4); default "none"; PDF only: x4 writes PDF/X-4 with the document CMYK profile (set_color_settings) as the output intent, XMP metadata and a document ID, and leaves out formpth editing data.
- `color`: string (rgb | cmyk); EPS only: colour model; default the document's colour mode.
- `dxf_version`: string (2000 | R12); default "2000"; DXF only: 2000 writes splines, solid hatches for fills, true colours and lineweights; R12 writes polylines with arcs.
- `units`: string (mm | cm | m | km | in | ft | yd | mi | pt | px); default "mm"; DXF only: the drawing units.
- `drawing_scale`: number; default 1; DXF only: drawing units per unit of art (100 writes a 1:100 drawing at full size).
- `scale_lineweights`: boolean; default false; DXF only: scale lineweights with drawing_scale.

## switch_document

Makes another open document the active one, by its index or name from get_document.

- `index`: integer
- `name`: string

## place_image

Places an image file (absolute path: PNG, JPEG, WebP, GIF, or SVG, EPS and DXF as editable vector groups) into the document at x, y, embedded; width scales it in proportion. With link true (raster images only) the image stays linked to its file: formpth reads it again when it changes (see the links tool).

- `path`: string; required
- `x`: number
- `y`: number
- `width`: number
- `link`: boolean; default false

## links

Placed images and their files, as in the Links panel. list gives every placed image with its state (linked, modified when the file changed on disk, missing, embedded) and path. relink points the image in id at another file (path; all true relinks every image sharing its link); relink_folder relinks every missing link to the file of the same name in folder; update reads a modified file again (id, or all true); embed copies a linked image into the document; unembed writes an embedded image to a file next to the project and links it.

- `action`: string (list | relink | relink_folder | update | embed | unembed); default "list"
- `id`: string; A placed image.
- `path`: string; Absolute path of an image file (relink).
- `folder`: string; Absolute folder path (relink_folder).
- `all`: boolean; default false

## document_setup

Changes the document: its units, colour mode (rgb or cmyk) and title.

- `units`: string (pt | px | mm | cm | in | pc)
- `color_mode`: string (rgb | cmyk)
- `title`: string

## select

Changes the selection: these ids, everything, nothing, the inverse, or every object touching a rectangle; mode combines with the current selection.

- `ids`: array; Object ids from get_document; the selection when left out.
- `all`: boolean
- `none`: boolean
- `inverse`: boolean
- `rect`: object
- `mode`: string (replace | add | subtract | toggle); default "replace"

## select_same

Selects every object sharing an attribute with the given object (or the first selected one).

- `attribute`: string (fill_color | stroke_color | stroke_weight | fill_and_stroke | opacity | blending_mode | appearance | graphic_style | shape | font_family | font_size | symbol_instance); required
- `id`: string; An object id from get_document.

## select_similar

The Magic Wand: selects every object whose chosen attributes are within tolerance of the given object (or the first selected one). Give a tolerance to use an attribute: fill and stroke colour 0..255 per RGB channel, stroke weight in points, opacity in percent; blend true also requires the same blending mode.

- `id`: string; An object id from get_document.
- `fill_tolerance`: number
- `stroke_tolerance`: number
- `weight_tolerance`: number
- `opacity_tolerance`: number
- `blend`: boolean; default false
- `mode`: string (replace | add | subtract); default "replace"

## draw_path

Draws a path from an SVG path d string (M, L, H, V, C, S, Q, T, A, Z, absolute or relative), or from points (each [x, y]) joined by straight lines or, with smooth true, by a fitted curve.

- `d`: string
- `points`: array
- `smooth`: boolean; default false
- `closed`: boolean; default false
- `fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `stroke`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `stroke_width`: number
- `name`: string
- `layer`: string; A layer id; the active layer when left out.

## draw_shape

Draws a live shape: x and y are the top-left of its bounds (for line and arc the start point, with x2 and y2 the end). Shapes keep their kind, so corners, sides and points can change later.

- `shape`: string (rectangle | rounded_rectangle | ellipse | polygon | star | line | arc | spiral | flare | rectangular_grid | polar_grid); required
- `x`: number; required
- `y`: number; required
- `width`: number
- `height`: number
- `x2`: number
- `y2`: number
- `corner_radius`: number
- `sides`: integer
- `points`: integer
- `inner_ratio`: number; A star's inner radius over its outer radius.
- `turns`: number
- `rows`: integer
- `columns`: integer
- `rotation`: number
- `fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `stroke`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `stroke_width`: number
- `name`: string
- `layer`: string

## edit_shape

Changes a live shape after drawing, keeping its kind: a rectangle's width, height, corner radius (all, or radii top-left, top-right, bottom-right, bottom-left) and corner type; an ellipse's width, height and pie angles (degrees counter-clockwise from three o'clock); a polygon's radius, sides and corner radius; a star's points, outer and inner radius and corner radius; a line's length and angle. get_object shows a shape's current values.

- `ids`: array; Object ids from get_document; the selection when left out.
- `width`: number
- `height`: number
- `corner_radius`: number
- `radii`: array
- `corner_type`: string (round | inverted | chamfer)
- `pie_start`: number
- `pie_end`: number
- `radius`: number
- `sides`: integer
- `points`: integer
- `outer_radius`: number
- `inner_radius`: number
- `length`: number
- `angle`: number

## add_text

Adds type: point type at x, y (the first baseline), area type filling a width by height frame, or type on the path given by path_id. The type is black unless color is given.

- `text`: string; required
- `x`: number; required
- `y`: number; required
- `mode`: string (point | area | path); default "point"
- `width`: number
- `height`: number
- `path_id`: string; An object id from get_document.
- `font`: string; A font family, such as Inter.
- `style`: string; Regular, Bold, Italic, Bold Italic, or a weight such as 600.
- `size`: number; default 24
- `color`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `align`: string (left | center | right | justify); default "left"
- `leading`: number
- `tracking`: number; In thousandths of an em.
- `name`: string
- `layer`: string
- `orientation`: string (horizontal | vertical); default "horizontal"; vertical sets characters top to bottom in columns that advance right to left; CJK stands upright and Latin turns 90 degrees clockwise. For vertical point type, x, y is the top of the first column's centre line.

## edit_anchors

Edits a path's anchor points: move some by dx, dy; replace them all; insert one at a position along a segment; delete some; or convert some to smooth or corner points. Indices count anchors across subpaths in order.

- `id`: string; required; An object id from get_document.
- `action`: string (move | replace | insert | delete | smooth | corner); required
- `indices`: array
- `dx`: number
- `dy`: number
- `segment`: integer
- `t`: number; default 0.5
- `anchors`: array; For replace: the new anchors, in and out handles absolute.
- `closed`: boolean

## set_paint

Sets the fill and or stroke of the objects (their first fill and first stroke): a colour, none, a swatch name or a gradient; a fill can also be a freeform gradient. Without ids it also sets the paint new art gets. overprint_fill and overprint_stroke mark the first fill or stroke to overprint (previewed with Overprint Preview, written to PDF).

- `ids`: array; Object ids from get_document; the selection when left out.
- `fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}. Or a freeform gradient {type: freeform, mode: points|lines, points: [{x, y, color, spread}]} with x, y and spread as fractions 0..1 of each object's bounds (absolute true for document points), or {type: freeform, colors: [...]} to place the points automatically.
- `stroke`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `overprint_fill`: boolean
- `overprint_stroke`: boolean

## set_stroke

Sets stroke attributes of the objects' first stroke: weight, caps, joins, miter limit, alignment, dashes, arrowheads, width profile and how a gradient runs on it.

- `ids`: array; Object ids from get_document; the selection when left out.
- `width`: number
- `cap`: string (butt | round | square)
- `join`: string (miter | round | bevel)
- `miter_limit`: number
- `align`: string (center | inside | outside)
- `dash`: array; Dash and gap lengths; empty for a solid stroke.
- `dash_offset`: number
- `dash_align_corners`: boolean
- `start_arrow`: string; none, triangle, triangle_open, arrow, arrow_open, circle, circle_open, square, square_open, diamond, bar, barbed, half_arrow, feather, tail.
- `end_arrow`: string
- `arrow_scale`: number
- `profile`: string (uniform | lens | taper_start | taper_end | taper_both | pinch | teardrop | wave)
- `gradient_mode`: string (within | along | across); For a linear or radial gradient stroke (set it with set_paint first): within paints the gradient over the object's box, along runs it from the path's start to its end following every curve and corner, across runs it from one edge of the stroke to the other.

## set_appearance

Edits the appearance stack: object opacity and blend mode, an added fill or stroke on top, every item replaced, cleared, or reduced to one fill and one stroke. Groups and layers (pass a layer id) have their own stack: their fills and strokes draw over their contents.

- `ids`: array; Object ids from get_document; the selection when left out.
- `opacity`: number
- `blend_mode`: string (normal | darken | multiply | color_burn | lighten | screen | color_dodge | overlay | soft_light | hard_light | difference | exclusion | hue | saturation | color | luminosity)
- `add_fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `add_stroke`: object
- `items`: array; The whole stack bottom to top: {kind: fill|stroke, color, width, opacity, blend_mode, visible, dash, cap, join, align}.
- `clear`: boolean
- `reduce_to_basic`: boolean

## add_swatch

Adds a swatch to the document: a colour or gradient, optionally global (editing it recolours every use) or spot (its own plate: PDF writes it as a Separation colour space), into a colour group; or a tint of a global or spot swatch with tint_of and tint.

- `name`: string; required
- `color`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `global`: boolean; default false
- `spot`: boolean; default false
- `group`: string
- `tint_of`: string; The name of a global or spot swatch; makes a tint swatch of it (color is then not needed).
- `tint`: number; default 50; Tint percent for tint_of.

## swatch_library

Swatch libraries, as Window > Swatch Libraries: list the built-in libraries (colour themes, skin tones, earth tones, metals, web, grayscale, gradients, patterns, seasons, spot inks) and the person's saved ones with their groups; or load a library (or one of its groups, or some swatches by name) into the document's Swatches panel, keeping its colour groups, and optionally fill objects with one of them.

- `action`: string (list | load); default "list"
- `library`: string; Library id or name from list.
- `group`: string; Load only this colour group of the library.
- `names`: array; Load only these swatches.
- `apply_to`: array; Fill these objects with the first loaded swatch.

## swatch_group

Colour groups in the Swatches panel: list them with their swatches; make one from swatch names or ids (or from colours, which become new swatches); move swatches into a group (or out with group none); rename, ungroup (keeps the swatches) or delete a group with its swatches.

- `action`: string (list | make | move | rename | ungroup | delete); default "list"
- `name`: string; The group's name (make, rename, ungroup, delete); the target group for move (none to take swatches out of their group).
- `swatches`: array; Swatch names or ids (make, move).
- `colors`: array; Colours that become new swatches in the group (make).
- `new_name`: string

## color_harmony

The Color Guide: five colours in a harmony rule around a base colour, with tints and shades, warm and cool, or vivid and muted variations of each; optionally saved to the swatches as a group.

- `color`: string; The base colour, #rrggbb; the current fill colour when left out.
- `rule`: string (complementary | split_complementary | left_complement | right_complement | analogous | monochromatic | shades | triad | tetrad | compound | high_contrast | pentagram); default "complementary"
- `variation`: string (none | tints_shades | warm_cool | vivid_muted); default "none"
- `save_group`: string; Save the five colours as a swatch group with this name.

## graphic_style

Graphic styles: create one from an object's appearance (the object stays linked to it), apply one to objects, list them, delete one, redefine one from an object's appearance (every object still linked to it follows), break the link between objects and their style, list the built-in style libraries, or load a library into the document. apply with library adds that library style to the document and applies it.

- `action`: string (create | apply | list | delete | redefine | break_link | libraries | load_library); required
- `name`: string; A style name (create, apply, delete, redefine).
- `id`: string; An object id from get_document.
- `ids`: array; Object ids from get_document; the selection when left out.
- `library`: string; A style library: shadows, buttons, outlines, textures or scribbles (or its full name).

## set_object

Changes objects' names, visibility, lock, opacity or blend mode, and the Transparency panel's group options: isolate blending, knockout group and whether opacity and mask define the knockout shape.

- `ids`: array; Object ids from get_document; the selection when left out.
- `name`: string
- `visible`: boolean
- `locked`: boolean
- `opacity`: number
- `blend_mode`: string (normal | darken | multiply | color_burn | lighten | screen | color_dodge | overlay | soft_light | hard_light | difference | exclusion | hue | saturation | color | luminosity)
- `isolate`: boolean; Isolate Blending: blend modes inside the group blend only with the group's own objects.
- `knockout`: string (on | off | inherit); Knockout Group: on makes each object in the group composite against what is under the group instead of against the objects below it in the group, so a see-through object hides them where it overlaps; inherit takes the setting of the enclosing group.
- `knockout_shape`: boolean; Opacity and Mask Define Knockout Shape, set on an object inside a knockout group: it knocks out only as much as it is opaque, so a 50 percent object leaves half of what is under it.

## arrange

Changes the stacking order of the objects within their layer or group.

- `ids`: array; Object ids from get_document; the selection when left out.
- `order`: string (bring_to_front | bring_forward | send_backward | send_to_back); required

## group

Groups the objects, or ungroups the groups among them.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (group | ungroup); default "group"

## compound_path

Makes the paths one compound path (overlaps become holes by the fill rule), or releases compound paths.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (make | release); default "make"
- `rule`: string (nonzero | evenodd)

## attributes

The Attributes panel: sets the fill rule of paths and compound paths, reverses their path direction, or sets the note kept with objects. nonzero (the default) fills every enclosed area except where a subpath runs the opposite way; evenodd makes every other nested or overlapping area a hole, whatever the direction. Groups pass the fill rule to the paths inside. Answers with each object's fill rule and note.

- `ids`: array; Object ids from get_document; the selection when left out.
- `fill_rule`: string (nonzero | evenodd)
- `reverse`: boolean; Reverse the direction of every subpath of the objects; under nonzero this turns a hole into a filled area or back. Pass the id of one path inside a compound path to reverse only that one.
- `note`: string; Replaces the objects' note; an empty string removes it.

## clipping_mask

Clips the objects with the topmost one among them, or releases clipping groups.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (make | release); default "make"

## opacity_mask

Opacity masks, as in the Transparency panel: make uses the topmost of the objects as the mask of the others (light areas show, dark areas hide), release puts the mask art back as an ordinary object, options changes a mask's clip, invert, disabled and linked settings. New masks take clip and invert from the arguments, else from the New Opacity Masks Are Clipping and Inverted settings.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (make | release | options); default "make"
- `clip`: boolean; Hide the art outside the mask object.
- `invert`: boolean; Swap light and dark in the mask.
- `disabled`: boolean; Turn the mask off without removing it.
- `linked`: boolean; The mask moves, scales and rotates with the art; false leaves it in place.

## delete_objects

Deletes the objects.

- `ids`: array; Object ids from get_document; the selection when left out.

Note: replaces or removes.

## duplicate_objects

Duplicates the objects, offset by dx, dy; the copies become the selection.

- `ids`: array; Object ids from get_document; the selection when left out.
- `dx`: number; default 0
- `dy`: number; default 0

## add_layer

Adds a layer at the top (or above another layer) and makes it active.

- `name`: string
- `above`: string; A layer id.
- `sublayer_of`: string; A layer id to nest the new layer in.

## set_layer

Changes a layer: name, visibility, lock, whether it prints, template, and whether it is the active layer new art goes on.

- `id`: string; required; An object id from get_document.
- `name`: string
- `visible`: boolean
- `locked`: boolean
- `printable`: boolean
- `template`: boolean
- `active`: boolean

## delete_layer

Deletes a layer and everything on it.

- `id`: string; required; An object id from get_document.

Note: replaces or removes.

## move_to_layer

Moves the objects to the top of a layer.

- `ids`: array; Object ids from get_document; the selection when left out.
- `layer`: string; required; A layer id.

## transform

Transforms the objects: move by dx, dy or to x, y; rotate by degrees; scale in percent (uniform or per axis); reflect; shear in degrees; set width or height; about an origin; as copies; or each about its own centre. corners distorts the bounding box onto four points in perspective (Free Distort; type, images and symbols go into an envelope mesh), perspective pulls the top corners in (or out, if negative) by that many points for a symmetric Perspective Distort, and reset_bounding_box squares a rotated bounding box to the page again.

- `ids`: array; Object ids from get_document; the selection when left out.
- `dx`: number
- `dy`: number
- `x`: number
- `y`: number
- `rotate`: number
- `scale`: number
- `scale_x`: number
- `scale_y`: number
- `corners`: array; Free Distort: where the bounding box's top-left, top-right, bottom-right and bottom-left corners go, as [x, y] in document points.
- `perspective`: number; Perspective Distort: move the top corners toward each other by this many points each (negative spreads them).
- `reset_bounding_box`: boolean
- `width`: number
- `height`: number
- `reflect`: string (horizontal | vertical)
- `shear`: number
- `shear_axis`: string (horizontal | vertical); default "horizontal"
- `origin`: string or array; center (default), top_left, top, top_right, left, right, bottom_left, bottom, bottom_right, or [x, y].
- `copy`: boolean; default false
- `each`: boolean; default false
- `scale_strokes`: boolean; default true

## align

Aligns or distributes the objects, relative to the selection's bounds, the artboard, or a key object; distribute_spacing uses spacing in points.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (left | horizontal_center | right | top | vertical_center | bottom | distribute_left | distribute_horizontal_center | distribute_right | distribute_top | distribute_vertical_center | distribute_bottom | distribute_horizontal_space | distribute_vertical_space); required
- `to`: string (selection | artboard | key); default "selection"
- `key`: string; An object id from get_document.
- `spacing`: number

## puppet_warp

Puppet Warp: bends the objects (paths, groups, compound paths; type, images and symbols go into an envelope mesh) as rigidly as possible so each pin lands on its target while the art between the pins bends without shearing. Give at least one pin; a pin with no move holds that spot in place, so pass three or more pins for a bend. rotate twists the art around a pin. The result is ordinary path geometry; get_image shows it.

- `ids`: array; Object ids from get_document; the selection when left out.
- `pins`: array; required; Pins on the art in document points; to_x, to_y is where each pin goes (it stays put when left out).
- `expand`: number; default 3; How far in points the deformation mesh reaches past the art's edges.

## add_dimension

Adds a dimension annotation that stays live: linear (two points; horizontal, vertical or aligned), angular (the vertex, then a point on each arm) or radial (centre and a point on the rim, three points on a circle, or the id of a circle or ellipse). Its dimension line, extension lines, arrowheads and label regenerate when it moves or its settings change; expand turns it into plain paths and type. With ids and no points it changes the settings of those dimensions instead.

- `type`: string (linear | angular | radial); default "linear"
- `points`: array; Document points: linear [a, b]; angular [vertex, arm1, arm2]; radial [centre, rim] or three rim points with from three_points.
- `circle`: string; radial: the id of a circle, ellipse or arc to measure.
- `from`: string (centre | three_points); default "centre"
- `ids`: array; Object ids from get_document; the selection when left out.
- `orientation`: string (horizontal | vertical | aligned); default "aligned"
- `measure`: string (radius | diameter); default "radius"
- `offset`: number; Linear: distance from the farther point to the dimension line (negative puts it on the other side). Angular: radius of the arc. Radial: how far the leader runs past the rim.
- `units`: string (doc | pt | px | mm | cm | in | pc); default "doc"
- `precision`: integer; default 2
- `scale`: number; default 1; Drawing scale: the label shows the measured length times this (100 for 1:100).
- `show_units`: boolean; default true
- `arrow`: string (filled | open | tick | dot | none); default "filled"
- `arrow_size`: number; default 6
- `font`: string
- `style`: string
- `size`: number; default 9
- `text_position`: string (above | center | below); default "above"
- `color`: string; #rrggbb, default black.
- `weight`: number; default 0.75

## pathfinder

Combines the selected shapes into new curved paths, as Illustrator's Pathfinder: unite, minus_front, intersect, exclude, divide, trim, merge, crop, outline or minus_back.

- `ids`: array; Object ids from get_document; the selection when left out.
- `operation`: string (unite | minus_front | intersect | exclude | divide | trim | merge | crop | outline | minus_back); required

## path_operation

A path command on the objects: offset (by offset points, joins), outline_stroke, simplify (precision 0..100), smooth, join, average (axis), reverse, add_anchors, remove_anchors, divide_objects_below, split_into_grid (rows, columns, gutter), clean_up, close or open.

- `ids`: array; Object ids from get_document; the selection when left out.
- `operation`: string (offset | outline_stroke | simplify | smooth | join | average | reverse | add_anchors | remove_anchors | divide_objects_below | split_into_grid | clean_up | close | open); required
- `offset`: number
- `joins`: string (miter | round | bevel); default "miter"
- `miter_limit`: number; default 4
- `precision`: number; default 50
- `axis`: string (horizontal | vertical | both); default "both"
- `rows`: integer
- `columns`: integer
- `gutter`: number

## shape_builder

Shape Builder: merges the regions of the selected shapes under the given points into one shape, or deletes them.

- `ids`: array; Object ids from get_document; the selection when left out.
- `points`: array; required
- `delete`: boolean; default false

## apply_effect

Adds a live effect to the objects (it stays editable in the Appearance panel), or lists the effects and their parameters with list true. Ids include warp.arc, warp.flag, warp.bulge (15 warps), distort.roughen, distort.zig_zag, distort.pucker_bloat, distort.twist, distort.transform, distort.tweak, stylize.drop_shadow, stylize.outer_glow, stylize.inner_glow, stylize.feather, stylize.round_corners, stylize.scribble, path.offset, path.outline_stroke, convert.rectangle, convert.rounded_rectangle, convert.ellipse, rasterize.raster (resolution, background, around), and the Effect Gallery's raster effects: blur.gaussian, blur.radial, blur.smart and gallery.* (Artistic: gallery.watercolor, gallery.cutout, gallery.colored_pencil; Brush Strokes: gallery.crosshatch, gallery.spatter; Distort: gallery.glass, gallery.ocean_ripple; Pixelate: gallery.crystallize, gallery.color_halftone, gallery.pointillize; Sketch: gallery.charcoal, gallery.stamp, gallery.halftone_pattern; Stylize: gallery.glowing_edges; Texture: gallery.stained_glass, gallery.mosaic_tiles, gallery.texturizer; Video: gallery.ntsc_colors; 56 with Gaussian Blur). Raster effects export to SVG as images at the document's raster resolution.

- `ids`: array; Object ids from get_document; the selection when left out.
- `effect`: string
- `params`: object
- `list`: boolean; default false
- `item`: integer; Apply the effect to one fill or stroke only: its index in the object's appearance items as get_object lists ap.items (0 is the bottom item). Without it the effect applies to the whole object. 3D effects always apply to the whole object.

## three_d

3D and Materials: give the objects depth as a live effect, change it, or remove it. kind extrude (depth, cap, bevel none, classic or rounded with bevel_height), revolve (the art is a profile turned around its left or right edge: angle, offset, from), inflate (a puffed surface: depth, volume, and rx, ry, rz to tilt it) or plane (the flat art turned in space). Turn it with position (off_axis_front, front, left, right, top, isometric_left, isometric_right and others) or rx, ry, rz in degrees, and perspective 0 to 160. material plastic, matte, metal, brushed_metal, wood, rough, wireframe or flat (plane); brushed_metal, wood and rough are textures that show only with ray_trace (vector mode falls back to metal or matte) and texture_scale sets their size in percent. light top_left, top, top_right, left, front, right, bottom_left, bottom, bottom_right with intensity, ambient and highlight in percent and shading_color. lighting standard, diffuse, top_left or right sets a lighting preset of several lights; lights replaces them with your own array (up to 8) of {color, intensity 0 to 200, rotation -180 to 180 degrees around the object, height 0 to 90 degrees, softness 0 to 100}, and the shading sums every light (omit lights and lighting to keep the single light above). ray_trace true renders the object per pixel with smooth normals, soft shadows from the lights, ambient occlusion and the ground shadow, at quality low, medium or high (high takes a second or two); inflate traces its height field the same way, and a map_symbol is drawn as a texture on the front face, lit with it unless shade_art is false; SVG and PDF export a ray-traced object as an image and expand appearance turns it into an image object. map_symbol wraps a symbol (by name; make one with the symbol tool) onto the front face of an extrude or plane, sized by map_scale percent and moved by map_x, map_y points, shaded with the surface unless shade_art is false; an empty map_symbol clears it. shadow true casts a soft shadow (not for inflate): shadow_position behind or below, shadow_distance and shadow_softness in points, shadow_opacity in percent. Leave kind out to change only the parameters you pass; remove true takes 3D off. A graphic material wraps a picture around every surface: texture is a symbol name, the key of an embedded image or the id of a placed image object (place_image first), empty to clear it; texture_scale (percent, 100 fits the object's longer side), texture_rotation (degrees) and texture_offset_x and texture_offset_y (points) place it. The picture is planar on front and back faces, runs along the outline and the depth on extruded sides, around the axis on revolved surfaces, and is projected from the front on an inflate; vector mode uses its average colour. roughness and metallic (0 to 1) set the highlight spread and the metal reflection of the surface in ray tracing for any material, texture or not; reset_surface true gives the material's own values back. Type and groups extrude as one object; expand turns the result into plain shaded paths.

- `ids`: array; Object ids from get_document; the selection when left out.
- `kind`: string (extrude | revolve | inflate | plane)
- `remove`: boolean
- `position`: string
- `rx`: number
- `ry`: number
- `rz`: number
- `perspective`: number
- `depth`: number
- `cap`: boolean
- `bevel`: string (none | classic | rounded)
- `bevel_height`: number
- `angle`: number
- `offset`: number
- `from`: string (left | right)
- `volume`: number
- `material`: string (plastic | matte | metal | brushed_metal | wood | rough | wireframe | flat)
- `texture_scale`: number
- `texture`: string
- `texture_rotation`: number
- `texture_offset_x`: number
- `texture_offset_y`: number
- `roughness`: number
- `metallic`: number
- `reset_surface`: boolean
- `ray_trace`: boolean
- `quality`: string (low | medium | high)
- `lighting`: string (standard | diffuse | top_left | right)
- `lights`: array
- `light`: string
- `intensity`: number
- `ambient`: number
- `highlight`: number
- `shading_color`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `map_symbol`: string
- `map_scale`: number
- `map_x`: number
- `map_y`: number
- `shade_art`: boolean
- `shadow`: boolean
- `shadow_position`: string (behind | below)
- `shadow_distance`: number
- `shadow_softness`: number
- `shadow_opacity`: number

## expand

Expands the objects into plain paths: appearance (effects, strokes, multiple fills), or the object (live shapes, type, blends, symbols, envelopes, repeats), or both.

- `ids`: array; Object ids from get_document; the selection when left out.
- `what`: string (appearance | object | all); default "all"

## make_blend

Blends between the selected objects (shape and colour), or releases or expands a blend. spacing smooth chooses steps from the colours.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (make | release | expand | options); default "make"
- `spacing`: string (smooth | steps | distance); default "steps"
- `steps`: integer; default 8
- `distance`: number
- `align_to_path`: boolean

## envelope

Envelope Distort: warp the objects with one of the 15 warp styles, a mesh grid of rows by columns, or the topmost object's shape; or release or expand an envelope. On an envelope: info lists its mesh points (row-major, index = row * (columns + 1) + column) with their handles; move_point moves a mesh point (x, y or dx, dy) or, with handle, one of its handle ends to x, y; add_mesh_line adds a row and column through x, y; delete_mesh_point removes the lines through a point; reset_mesh and reset_warp replace the shape (a warp or top-object envelope turns into a mesh the first time a point moves); options sets fidelity, distort_appearance, distort_gradients, distort_patterns and anti_alias; edit_contents and edit_envelope switch between editing the art inside and the envelope. get_image shows the result.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (warp | mesh | top_object | release | expand | info | move_point | add_mesh_line | delete_mesh_point | reset_mesh | reset_warp | options | edit_contents | edit_envelope); required
- `style`: string (arc | arc_lower | arc_upper | arch | bulge | shell_lower | shell_upper | flag | wave | fish | rise | fisheye | inflate | squeeze | twist)
- `bend`: number; default 50
- `horizontal`: number; default 0
- `vertical`: number; default 0
- `vertical_orientation`: boolean; default false
- `rows`: integer; default 4
- `columns`: integer; default 4
- `point`: integer; move_point and delete_mesh_point: the mesh point index from info (or give row and column).
- `row`: integer; Mesh row of the point, 0 at the top.
- `column`: integer; Mesh column of the point, 0 at the left.
- `x`: number; Document points: the new position for move_point, or the place for add_mesh_line.
- `y`: number
- `dx`: number; move_point: move by this much instead of to x, y.
- `dy`: number
- `handle`: string (right | left | down | up); move_point: move this handle's end to x, y (or by dx, dy) instead of the point.
- `mirror`: boolean; default false; move_point with handle: turn the opposite handle to stay in line.
- `maintain_shape`: boolean; default true; reset_mesh: keep the current envelope shape in the new mesh.
- `fidelity`: number; options: how closely the art follows the envelope (50 by default).
- `distort_appearance`: boolean; options: distort strokes and effects with the shape.
- `distort_gradients`: boolean; options: distort linear gradient fills.
- `distort_patterns`: boolean; options: distort pattern fills.
- `anti_alias`: boolean; options: smooth images drawn through the envelope.

## repeat

Repeat: makes the objects a live radial, grid or mirror repeat, changes its options, or releases or expands it.

- `ids`: array; Object ids from get_document; the selection when left out.
- `kind`: string (radial | grid | mirror | release | expand); required
- `instances`: integer
- `radius`: number
- `rows`: integer
- `columns`: integer
- `h_spacing`: number
- `v_spacing`: number
- `angle`: number

## symbol

Symbols: create one from the objects (type dynamic or static, registration point, 9-slice scaling), place an instance (from the document, or from a symbol library with library), list them, break an instance's link, replace instances with another symbol, delete one. edit enters symbol editing mode on the symbol (or the instance in id): its art becomes an ordinary group you change with any tool while every instance follows; exit saves and leaves, cancel throws the changes away. redefine replaces the symbol's art with the objects in ids; duplicate copies it; options renames it (new_name), sets its type or turns 9-slice guides on or off (slice, or slice_guides [x1, y1, x2, y2] in the symbol's own coordinates, origin at the registration point). override recolours one part of a dynamic instance (id, part from get_document's parts list, fill, stroke, stroke_width, opacity in percent); reset_overrides clears them. libraries lists the symbol libraries (arrows, web icons, nature, shapes, flowchart and saved ones); load_library adds a library's symbols (all, or names) to the Symbols panel.

- `action`: string (create | place | list | break_link | replace | delete | edit | exit | cancel | redefine | duplicate | options | override | reset_overrides | libraries | load_library); required
- `name`: string
- `ids`: array; Object ids from get_document; the selection when left out.
- `x`: number
- `y`: number
- `scale`: number
- `id`: string; A symbol instance (edit, override).
- `type`: string (dynamic | static)
- `registration`: string (tl | t | tr | l | c | r | bl | b | br); default "c"
- `slice`: boolean; Turn 9-slice scaling guides on (corners keep their size when an instance scales) or off.
- `slice_guides`: array
- `new_name`: string
- `part`: string
- `fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `stroke`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `stroke_width`: number
- `opacity`: number
- `library`: string; A symbol library id or name (place, load_library).
- `names`: array

## apply_brush

Applies a brush to the strokes of the objects (calligraphic, scatter, art, bristle or pattern), removes it with brush none, or lists the brushes with list true. With library, the brush comes from a brush library (see brush_library) and joins the Brushes panel first.

- `ids`: array; Object ids from get_document; the selection when left out.
- `brush`: string
- `list`: boolean; default false
- `library`: string; A brush library id or name; brush then names one of its brushes.

## new_brush

Makes a brush for the Brushes panel and optionally applies it. calligraphic (angle, roundness, size), bristle (shape, size, length, density, thickness, paint_opacity, stiffness: many thin semi-transparent bristle strokes), and from the art in ids: scatter (size, spacing, scatter, rotation), art (width, scale_mode with guides, flip, flip_along) or pattern (the art is the side tile; outer, inner, start and end tiles are pattern swatch names; fit, spacing).

- `kind`: string (calligraphic | scatter | art | pattern | bristle); required
- `name`: string
- `ids`: array; Object ids from get_document; the selection when left out.
- `apply_to`: array; Objects to stroke with the new brush.
- `angle`: number
- `roundness`: number
- `size`: number; Calligraphic and bristle: points; scatter: percent.
- `spacing`: number; Percent.
- `scatter`: number
- `rotation`: number
- `relative`: boolean
- `width`: number; Art brush width, percent.
- `scale_mode`: string (proportional | stretch | guides); Art brush: scale proportionately, stretch to the stroke length, or stretch only between the guides.
- `guides`: array; Art brush guides [start, end] as percent of the art's length.
- `flip`: boolean
- `flip_along`: boolean
- `fit`: string (stretch | space | approximate)
- `outer`: string
- `inner`: string
- `start`: string
- `end`: string
- `shape`: string (round_point | flat_point | round_blunt | flat_blunt | round_curve | flat_curve | round_angle | flat_angle | fan)
- `length`: number
- `density`: number
- `thickness`: number
- `paint_opacity`: number
- `stiffness`: number
- `colorize`: string (none | tints | tints_shades | hue_shift); default "none"

## brush_library

Brush libraries, as Window > Brush Libraries: list the built-in libraries (arrows, borders, decorative scatter, artistic ink, bristle brushes) and the person's saved ones, or load a library's brushes (all or some by name) into the Brushes panel.

- `action`: string (list | load); default "list"
- `library`: string
- `names`: array

## image_trace

Traces a placed image into a live tracing object (the paths are its children, the image stays inside so the options can change), with a preset (high_fidelity_photo, low_fidelity_photo, 3_colors, 6_colors, 16_colors, shades_of_gray, black_and_white_logo, sketched_art, silhouettes, line_art, technical_drawing) or explicit settings. Pass a tracing object's id to trace it again with new settings; action expand turns it into ordinary paths, release brings back the image; expand true traces and expands in one call; view sets what the canvas shows.

- `id`: string; A placed image or an image tracing object.
- `action`: string (trace | expand | release); default "trace"
- `preset`: string; Also outline (black and white centreline strokes).
- `mode`: string (color | gray | bw)
- `colors`: integer
- `threshold`: integer
- `paths`: number; Path fidelity in percent.
- `ignore_white`: boolean
- `smooth`: boolean
- `palette`: string (auto | limited | full | library); Colour and grayscale modes: automatic count, limited to colors, full tone, or the document's colour swatches.
- `corners`: number; Percent: higher keeps more sharp corners.
- `noise`: integer; Areas smaller than this many pixels merge into their neighbours.
- `method`: string (abutting | overlapping); abutting cuts each colour out of the others; overlapping stacks the colours so there are no gaps.
- `fills`: boolean
- `strokes`: boolean; Black and white mode: trace thin lines along their centre (a one-pixel skeleton fitted with curves) as stroked paths.
- `stroke_width`: number; Pixels: lines up to this thick become strokes; thicker areas stay fills.
- `snap_lines`: boolean; Straighten nearly straight curves and snap lines near 0 or 90 degrees.
- `view`: string (result | result_outlines | outlines | outlines_source | source)
- `expand`: boolean; default false

## live_paint

Live Paint: make a Live Paint group from paths (their crossings divide the area into faces that keep their colour when the paths move), fill the face at a point, paint the stroke of the edge nearest a point, set gap detection in points (0 turns it off) so small openings still close a face, expand into ordinary filled faces and strokes, or release back to the paths.

- `action`: string (make | fill | edge | gap | expand | release); required
- `ids`: array; Object ids from get_document; the selection when left out.
- `id`: string; The Live Paint group for fill, edge and gap.
- `x`: number
- `y`: number
- `color`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `width`: number; Stroke width in points for edge; 0 hides the edge.
- `gap`: number

## intertwine

Intertwine: make an intertwine object from two or more overlapping objects (paths, groups, type) so they can weave over and under each other like chain links; flip the stacking inside the overlap at x, y (with three or more objects each flip brings the next one down to the top there); define an area freely by encircling it with points; release back to plain objects in their base order; or expand into plain clipped groups. get_document lists the intertwine's areas.

- `action`: string (make | flip | area | release | expand); required
- `ids`: array; Object ids from get_document; the selection when left out.
- `id`: string; The intertwine object for flip, area, release and expand (make returns it); defaults to the selected one.
- `x`: number
- `y`: number
- `points`: array; area: a closed loop of [x, y] document points around part of an overlap.

## shaper

Shaper: turn rough drawn points into a live shape the way the Shaper tool recognises a gesture (rectangle or square, circle, ellipse, triangle, polygon or line; near-orthogonal rectangles snap square to the axes); scribble a zigzag over overlapping shapes to punch out the region it stays in, merge the regions it crosses, or delete a single shape it covers alone (overlapping shapes become an editable Shaper Group that recomputes when its shapes change); fill the face of a Shaper Group at x, y; or expand a Shaper Group into plain paths.

- `action`: string (draw | scribble | fill | expand); required
- `points`: array; draw and scribble: the gesture as [x, y] document points in drawing order.
- `id`: string; fill and expand: the Shaper Group (defaults to the selected one).
- `x`: number
- `y`: number
- `color`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `ids`: array; Object ids from get_document; the selection when left out.

## gradient_mesh

Gradient meshes: make one from each closed shape (rows, columns, flat or with a white highlight at the centre or the edge); list a mesh's points by row and column; set one point's colour, opacity or position (dx, dy moves it); add a mesh line through x, y in a colour; remove the lines through a point.

- `action`: string (make | list | point | add_line | remove_point); required
- `ids`: array; Object ids from get_document; the selection when left out.
- `id`: string; The mesh for list, point, add_line and remove_point.
- `rows`: integer; default 4
- `columns`: integer; default 4
- `highlight`: string (flat | center | edge); default "flat"
- `row`: integer
- `column`: integer
- `color`: string
- `opacity`: number
- `dx`: number
- `dy`: number
- `x`: number
- `y`: number

## symbolism

The symbolism tools on symbol instances (a sprayed symbol set or any group of instances): shift by dx, dy; scrunch together (reverse spreads apart); size up (reverse shrinks); spin by angle degrees or toward dx, dy; stain toward a colour (reverse removes the tint); screen more transparent (reverse more opaque); style with a graphic style (reverse removes it). With x, y and radius only the instances under that brush change, weighted toward its centre; without them every instance does. Intensity 1..10; method average pulls instances toward their mean, random scatters.

- `ids`: array; Object ids from get_document; the selection when left out.
- `op`: string (shift | scrunch | size | spin | stain | screen | style); required
- `intensity`: number; default 5
- `method`: string (user | average | random); default "user"
- `x`: number
- `y`: number
- `radius`: number
- `dx`: number
- `dy`: number
- `angle`: number
- `color`: string
- `style`: string; A graphic style name.
- `reverse`: boolean; default false
- `repeat`: integer; default 1

## make_pattern

Makes a pattern swatch from the objects, tiled as a grid, brick or hex, and optionally fills other objects with it.

- `ids`: array; Object ids from get_document; the selection when left out.
- `name`: string; required
- `tile`: string (grid | brick_by_row | brick_by_column | hex_by_column | hex_by_row); default "grid"
- `h_spacing`: number
- `v_spacing`: number
- `apply_to`: array; Object ids from get_document; the selection when left out.

## generative_shape_fill

Generative Shape Fill: asks the language model set for the Assistant (Preferences > Plugins) for vector art that fills a closed path, imports it as editable paths, fits it to the shape and clips it there. The result is a clipping group whose last child is the original shape. Fails with a clear message when no model is set.

- `id`: string; A closed path or compound path; the selection when left out.
- `prompt`: string; What to draw; optional.
- `shape_strength`: number; default 50; How closely the art follows the outline: 100 takes its silhouette, 0 composes freely and only crops.
- `detail`: string (low | medium | high); default "medium"
- `variations`: integer; default 1; How many to ask for; one is applied.
- `pick`: integer; Which variation to apply; default the first that worked.

Note: reaches outside this computer.

## generate_patterns

Text to Pattern: asks the language model set for the Assistant for seamless vector pattern tiles from a prompt and saves each as a pattern swatch made by formpth's pattern engine (editable with edit_pattern). Fails with a clear message when no model is set.

- `prompt`: string; required
- `colors`: array; Up to 12 colours (#rrggbb and the like); the tiles use only these.
- `preset`: string (any | warm | cool | pastel | earth | vivid | mono | forest | ocean | document); A colour preset when colors is left out; document takes the document's colour swatches.
- `density`: integer; default 3; 1 very sparse to 5 packed.
- `variations`: integer; default 2
- `tile_size`: number; default 96; Tile width and height in points.
- `name`: string; Base name of the swatches.
- `fill_selection`: boolean; default false; Fill the objects in ids (or the selection) with the first pattern.
- `ids`: array; Object ids from get_document; the selection when left out.

Note: reaches outside this computer.

## text_to_vector

Text to Vector Graphic: asks the language model set for the Assistant (Preferences > Plugins) for clean standalone SVG from a prompt, up to 3 variations, and places the picked one as editable groups and paths (not an image) fitted into the selected object's bounds, or the centre of the active artboard, as one undo step. Fails with a clear message when no model is set or Show generative features is off.

- `prompt`: string; required; What to draw.
- `type`: string (subject | scene | icon | pattern); default "subject"
- `detail`: string (low | medium | high); default "medium"
- `variations`: integer; default 1; How many to ask for; one is placed.
- `pick`: integer; Which variation to place; default the first that worked.

Note: reaches outside this computer.

## generative_recolor

Generative Recolor: asks the language model set for the Assistant for colour palettes that match a prompt such as 'sunset over the ocean' and recolours the objects (or the selection) with one of them, mapping the artwork's colours to the palette by lightness, tints kept, as one undo step. Fails with a clear message when no model is set or Show generative features is off.

- `prompt`: string; required; The mood or scene the colours should express.
- `count`: integer; default 1; How many palettes to ask for; one is applied.
- `pick`: integer; Which palette to apply; default the first.
- `ids`: array; Object ids from get_document; the selection when left out.

Note: reaches outside this computer.

## retype

Retype: identifies the font of outlined type or of text in a placed image and lists the 10 closest installed fonts, compared by rendering the text in each and measuring shape overlap. A model that reads images (set in Preferences > Plugins) reads the text first; without one, outlined type is read by matching letter shapes and for images text must be given. apply true replaces the outlines (or covers the image) with live text in the chosen font, sized and placed to match.

- `ids`: array; Object ids from get_document; the selection when left out.
- `text`: string; The words, when known; skips reading them.
- `region`: object; Images only: the part to read, in document points.
- `apply`: boolean; default false
- `pick`: integer; default 0; Which listed match to apply.
- `font`: string; Apply this installed family instead of a listed match.
- `style`: string
- `keep_image`: boolean; default true; Images: keep the image under the new text.

Note: reaches outside this computer.

## list_color_profiles

Lists the ICC colour profiles formpth can use (the built-in sRGB, the generated formpth Generic CMYK, profiles loaded in Color Settings and those installed on this computer) with name, colour space (RGB, CMYK, GRAY), class and id, and the colour settings of the open document: working spaces, rendering intent, black point compensation and whether Proof Colors is on, plus the display profile Proof Colors uses as the monitor when this computer reports one. Call this before set_color_settings or convert_to_profile to get the exact names.

- no parameters

Note: read-only.

## set_color_settings

Color Settings for the open document, like Edit > Color Settings: the RGB working space, the CMYK working space (CMYK colours then display and convert through that ICC profile; none returns to the simple formula), the rendering intent and black point compensation. Colour numbers do not change; only how they are interpreted. One undo step. Only the fields given change.

- `rgb_profile`: string; A name or id from list_color_profiles.
- `cmyk_profile`: string; A name or id from list_color_profiles, or none for the formula.
- `intent`: string (perceptual | relative_colorimetric | saturation | absolute_colorimetric); Default relative_colorimetric.
- `bpc`: boolean; Black point compensation; default true.

## convert_to_profile

Edit > Convert to Profile: converts every fill, stroke, gradient stop, mesh point, swatch, symbol, graphic style and artboard colour in the open document to the destination profile, keeping the look, with the document's intent and black point setting, as one undo step. A CMYK profile makes the document CMYK; an RGB profile turns CMYK colours into RGB.

- `profile`: string; required; A name or id from list_color_profiles.

Note: replaces or removes.

## proof_colors

View > Proof Colors: turns the on-screen soft proof on or off. The proof shows the art as the chosen CMYK device would print it, using the document's paper color and black ink settings. It affects the window only; exports and get_image are unchanged.

- `on`: boolean; required; true to turn the proof on, false to turn it off.
- `profile`: string; A CMYK profile name or id to simulate; kept in the document's Proof Setup.

## edit_pattern

Changes a pattern swatch in place, and every object filled with it: name, tile type, spacing, the offset of brick rows or columns (0.5 is half a tile), the tile's width and height around its art, and which neighbour overlaps in front.

- `pattern`: string; required; The pattern's name or id.
- `name`: string
- `tile`: string (grid | brick_by_row | brick_by_column | hex_by_column | hex_by_row)
- `h_spacing`: number
- `v_spacing`: number
- `brick_offset`: number
- `width`: number
- `height`: number
- `overlap_h`: string (left | right)
- `overlap_v`: string (top | bottom)

## recolor

Recolours the objects: map colours to new ones, fit them to a palette, or invert, convert to grayscale, CMYK or RGB, or saturate by amount (-100..100). As Recolor Artwork: colors reduces the artwork to that many colours (clustered in OKLab, tints kept), group recolours with a swatch group or library, harmony applies a colour harmony around the base colour.

- `ids`: array; Object ids from get_document; the selection when left out.
- `map`: object; From colour to colour, both #rrggbb.
- `palette`: array
- `action`: string (map | palette | invert | grayscale | cmyk | rgb | saturate | reduce | group | harmony); default "map"
- `amount`: number
- `colors`: integer; Reduce to this many colours.
- `group`: string; A document swatch group name, or a swatch library id, or library:group.
- `preserve_tints`: boolean; default true; Keep each merged colour's tint and shade relative to its row's new colour.
- `harmony`: string; A harmony rule (as color_harmony) around base.
- `base`: string; Base colour for harmony, #rrggbb; the most saturated artwork colour by default.

## artboard

Artboards: add one, change one (name, x, y, width, height), delete one, fit one to the art or the selection, rearrange them in columns, or list them.

- `action`: string (add | set | delete | fit_to_art | fit_to_selection | rearrange | list | activate); required
- `index`: integer
- `name`: string
- `x`: number
- `y`: number
- `width`: number
- `height`: number
- `columns`: integer
- `spacing`: number

## set_text

Changes a type object: its words, and its font, style, size, colour, leading, tracking, kerning, alignment, case, OpenType features, variable font axes and character rotation, for all of it or the characters from start to end; one character's Touch Type transform; paragraph hyphenation, justification, tab stops and bullets or numbering; its orientation (horizontal or vertical); type on a path's effect, flip, alignment, spacing and start and end; and area type's rows, columns, gutters, inset and first baseline.

- `id`: string; required; An object id from get_document.
- `text`: string
- `font`: string
- `style`: string
- `size`: number
- `color`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `leading`: number
- `tracking`: number
- `align`: string (left | center | right | justify | justify_center | justify_right | justify_all)
- `start`: integer
- `end`: integer
- `caps`: string (none | all | small)
- `features`: array; OpenType feature tags to turn on, replacing the current list: liga, calt, dlig, frac, ordn, tnum, pnum, lnum, onum, zero, case, sups, subs, numr, dnom, swsh, salt, titl, smcp, ss01..ss20. Features the font lacks do nothing; find_font lists the fonts in use.
- `orientation`: string (horizontal | vertical); Type Orientation: vertical sets columns right to left with CJK upright and Latin turned 90 degrees clockwise.
- `upright_latin`: boolean; In vertical type, stand Latin letters and digits upright instead of turning them (for the characters from start to end, or all).
- `path_effect`: string (rainbow | skew | ribbon | stair | gravity); Type on a path: rainbow (baselines tangent to the path), skew (glyphs stay vertical, sheared along the path), ribbon (3D Ribbon: horizontal edges stay horizontal, vertical edges perpendicular to the path), stair (Stair Step: upright glyphs, each baseline's left point on the path), gravity (each glyph's baseline centre on the path, turned toward the path's centre).
- `path_flip`: boolean; Type on a path: put the type on the other side of the path, reading the other way.
- `path_align`: string (baseline | ascender | descender | center); Type on a path: which line of the type sits on the path.
- `path_spacing`: number; Type on a path: points of space removed between glyphs fanning out around tight curves. 0 leaves spacing as set.
- `path_start`: number; Type on a path: where the start bracket sits, as a fraction of the path's length.
- `path_end`: number; Type on a path: where the end bracket sits, as a fraction of the path's length.
- `area_rows`: integer; Area type: number of rows.
- `area_row_gutter`: number; Area type: points between rows.
- `area_columns`: integer; Area type: number of columns.
- `area_gutter`: number; Area type: points between columns.
- `area_inset`: number; Area type: inset spacing in points.
- `first_baseline`: string (ascent | cap | leading | x | em | fixed | legacy); Area type: what sets the first baseline's distance from the top: ascent, cap height, leading, x height, em box height, fixed (the min value), or legacy (the font's ascender).
- `first_baseline_min`: number; Area type: the least distance in points from the top to the first baseline (the distance itself for fixed).
- `area_flow`: string (rows | columns); Area type: fill row by row or column by column.
- `kerning`: string (auto | optical | none); Kerning: auto uses the font's kerning pairs, optical spaces each pair from the glyph outlines, none turns kerning off.
- `axes`: object; Variable font axis values by tag for the characters from start to end, for example {"wght": 650, "wdth": 85, "slnt": -8}. Values clamp to the font's ranges; axes the font lacks do nothing; {} returns to the font's default instance. find_font lists the fonts in use.
- `rotation`: number; Character rotation in degrees counter-clockwise, each character turned about its own centre (for the characters from start to end, or all).
- `touch`: object; Touch Type: transform one character on its own while the type stays editable. index is the character's position in the text; x and y move it in points (y down); h_scale and v_scale are percent; rotate is degrees counter-clockwise about its centre; reset true clears it.
- `hyphenate`: boolean; Hyphenate words at line ends in area type (English rules).
- `hyphenation`: object; Hyphenation settings: min_word (words longer than, letters, default 6), after_first and before_last (letters, default 2), limit (hyphens in a row, 0 for no limit, default 2), zone (points, unjustified type only, default 0), capitalized (hyphenate capitalized words, default true). Setting this turns hyphenation on unless hyphenate is false.
- `justification`: object; Justification settings used by justified alignments: word_spacing, letter_spacing and glyph_scaling as [min, desired, max] percentages (defaults [80, 100, 133], [0, 0, 0], [100, 100, 100]; desired values apply to every alignment), and single_word for a line holding one word.
- `tabs`: array; Tab stops, replacing the current ones ([] clears them; without stops tabs advance to every 36 points). position is points from the left of the text frame (from the type's origin for point type); align is left, center, right or decimal; leader is up to four characters repeated across the gap; align_on is a decimal tab's character (default '.').
- `list`: object; Bullets and numbering for every paragraph: type none, bullet or number; bullet is the character (default •); format is 1, 01, a, A, i or I; start is the first number; separator follows the number (default '.'). Pair with a negative first-line indent for a hanging list.

## text_flow

Threads area type through more frames, releases or unthreads frames, or wraps area type around objects. thread: ids in order, the first area type, the rest area type or closed paths (which become frames). release: the frames leave the thread and their text flows back. remove: every link breaks and each frame keeps its text. wrap: area type below these objects in their layer flows around them, offset points away (invert flows it inside them). unwrap: stop wrapping.

- `action`: string (thread | release | remove | wrap | unwrap); required
- `ids`: array; Object ids from get_document; the selection when left out.
- `offset`: number; default 6
- `invert`: boolean; default false

## text_style

Character and paragraph styles: list them, create one from the selected type (or ids) and apply it, apply one to type (character styles to the characters from start to end), redefine one from the selected type, or delete one. style is an id or a name.

- `action`: string (list | create | apply | redefine | delete); required
- `kind`: string (char | para); default "char"
- `name`: string
- `style`: string
- `ids`: array; Object ids from get_document; the selection when left out.
- `start`: integer
- `end`: integer

## find_font

Lists the fonts the document's type uses (family, style and the objects using each), or replaces one family (and optionally one style) with another everywhere.

- `action`: string (list | replace); default "list"
- `font`: string
- `style`: string
- `to_font`: string
- `to_style`: string; default "Regular"

## create_outlines

Turns type objects into compound paths of their glyph outlines, in their colours.

- `ids`: array; Object ids from get_document; the selection when left out.

## graph

Creates or updates a live graph from data: column, stacked column, bar, stacked bar, line, area, scatter, pie or radar. The graph keeps its data table; its columns, lines, markers, wedges, axes, labels and legend are ordinary paths and type inside it, regenerated when the data or options change while keeping any colours you gave its parts (each series is a group: get returns the group ids, so set_paint on one recolours that series). x, y, width and height are the body of the graph in points; labels and the legend sit outside it. Data rows are categories (one pie each in pie graphs, one axis each in radar graphs) and columns are series; in scatter graphs each pair of columns is Y then X. series_types combines types (a column graph with one series as a line). make_design turns the selection into a design for column_design or marker_design. Ungroup or expand turns a graph into plain art.

- `action`: string (create | update | get | make_design); create (default without id), update (default with id), get the data and series group ids, or make_design from ids or the selection.
- `id`: string; The graph, or any part of it.
- `type`: string (column | stacked | bar | stackedBar | line | area | scatter | pie | radar); default "column"
- `x`: number
- `y`: number
- `width`: number; default 240
- `height`: number; default 160
- `data`: object; {series: [legend labels], categories: [row labels], values: [[row 1 numbers], [row 2 numbers], ...]}; null for an empty cell.
- `table`: string; The data as spreadsheet text instead (tab-separated or CSV): a header row of legend labels and a first column of category labels are detected.
- `transpose`: boolean; default false; Swap rows and columns of the data first.
- `switch_xy`: boolean; default false; Scatter: swap each pair of columns (X and Y).
- `legend`: string (right | top | none); default "right"
- `value_axis`: string (left | right | both | bottom | top); Where the value axis and its labels go (bar graphs: bottom, top or both).
- `min`: number
- `max`: number
- `divisions`: integer; Setting min, max or divisions overrides the calculated tick values.
- `auto`: boolean; true goes back to calculated tick values.
- `ticks`: string (none | short | full); default "short"; Value axis tick marks; full draws gridlines.
- `category_ticks`: string (none | short | full); default "short"
- `prefix`: string
- `suffix`: string; Text after each value label, such as %.
- `column_width`: number; default 90; Percent of the space each column may take.
- `cluster_width`: number; default 80; Percent of each category the cluster takes.
- `mark_points`: boolean; default true
- `connect_points`: boolean; default true
- `edge_to_edge`: boolean; default false
- `fill_lines`: boolean; default false
- `line_width`: number; default 1
- `marker_size`: number; default 5
- `pie_legend`: string (standard | wedges | none); default "standard"
- `pie_sort`: string (none | all | first); default "none"
- `pie_position`: string (ratio | even | stacked); default "ratio"
- `drop_shadow`: boolean; default false
- `font`: string; default "Inter"
- `size`: number; default 9; Label size in points.
- `series_types`: object; Combined graphs: {series index: column | stacked | line | area | null}; works when the graph type is column, stacked, line or area.
- `column_design`: object; {series: [indices] (all when left out), design: name or id (null removes), mode: vertical | uniform | repeat, per: units each repeated design stands for, fraction: chop | scale}.
- `marker_design`: object; {series: [indices], design: name or id (null removes)}: the design replaces the square markers.
- `name`: string; make_design: the design's name.
- `ids`: array; Object ids from get_document; the selection when left out.

## variables

Variables and data merge: list the variables and data sets; make a variable (text to type, image to a placed image, visibility to any object, graph to a graph's data) bound to an object; bind, unbind, rename or delete one; capture the artboard as a data set or update the shown one; import data sets from CSV (a header row names the variables, an image column holds file paths or URLs the engine can read) or JSON; show a data set (the art changes to it); export writes one PNG, SVG or PDF per data set (and .fpth with fpth) into a folder.

- `action`: string (list | make | bind | unbind | rename | delete | capture | update | import | show | export); default "list"
- `kind`: string (text | image | visibility | graph); default "text"
- `id`: string; make and bind: the object to bind.
- `variable`: string; A variable's name or id.
- `name`: string; make, rename and capture: the new name; show: a data set's name.
- `data`: string or array or object; import: CSV text, or JSON (an array of objects whose keys are variable names, or {dataSets: [...]}).
- `format`: string (csv | json | png | svg | pdf); import: csv or json; export: png (default), svg or pdf.
- `index`: integer; show and update: the data set's index.
- `folder`: string; export: absolute path of the folder to write into (created if missing).
- `fpth`: boolean; default false
- `name_variable`: string; export: a text variable whose value names each file (the data set's name otherwise).
- `artboard`: integer
- `scale`: number; default 1
- `data_sets`: array; export: only these data sets.

## perspective

Perspective grid and art in perspective, as Illustrator's Perspective Grid and Perspective Selection tools. grid sets up the document's grid: preset one_point, two_point or three_point (laid out on the first artboard) or type 1, 2 or 3, then any of the Define Grid values (cell, viewing angle and distance, horizon height above the ground level, the third vanishing point's distance below the horizon, ground_x and ground_y, station, extents, plane offsets, plane colours and opacity), and show, lock, snap and active_plane; attached art is re-projected whenever the grid changes. Plane coordinates are points on the plane with x along it and y downward (left plane: x up to 0 at the corner; right plane: x from 0; horizontal plane: x up to 0, y up to 0 toward the back), and get reports each plane's extent. draw makes a shape (rectangle, rounded_rectangle, ellipse, polygon, star, line, rectangular_grid, polar_grid) at x, y, width, height in plane coordinates on a plane. place brings existing art onto a plane by a projective transform with its centre at x, y in plane coordinates (default: the plane point under where the art sits) at scale; attach attaches it to a plane where it already looks right; move slides attached art along its plane by dx, dy and dn perpendicular to it (copy duplicates); scale scales it in plane space by sx, sy about its plane-space centre; release keeps the look and detaches it; match_plane moves the grid's plane to the object; get reports the grid, its vanishing points and the attached objects. Type placed on a plane stays editable with set_text and is drawn through the projection.

- `action`: string (get | grid | draw | place | attach | move | scale | release | match_plane); default "get"
- `ids`: array; Object ids from get_document; the selection when left out.
- `preset`: string (one_point | two_point | three_point)
- `type`: integer (1 | 2 | 3)
- `cell`: number; Gridline every this many points.
- `angle`: number; Viewing angle in degrees (two and three point).
- `distance`: number; Viewing distance in points.
- `horizon_height`: number; Horizon height above the ground level in points.
- `vp3`: number; Three point: the third vanishing point's distance below the horizon in points (negative is above); at least twice the viewing distance.
- `ground_x`: number
- `ground_y`: number; ground_x, ground_y: the grid's origin on the ground level, where the planes meet, in document points.
- `station`: number; Horizontal offset of the station point (the centre of vision) from the origin in points.
- `extent_left`: number
- `extent_right`: number
- `extent_height`: number
- `offset_left`: number
- `offset_right`: number
- `offset_horizontal`: number; offset_*: move a grid plane parallel to itself, in points.
- `left_color`: string; #rrggbb
- `right_color`: string; #rrggbb
- `horizontal_color`: string; #rrggbb
- `opacity`: number; Grid opacity in percent.
- `show`: boolean
- `lock`: boolean
- `snap`: boolean; Snap drawing on a plane to the gridlines.
- `active_plane`: string (left | right | horizontal | none)
- `plane`: string (left | right | horizontal); draw, place and attach: the plane (default the active plane).
- `shape`: string (rectangle | rounded_rectangle | ellipse | polygon | star | line | rectangular_grid | polar_grid); default "rectangle"
- `x`: number
- `y`: number
- `width`: number
- `height`: number
- `scale`: number; default 1
- `offset`: number; place and draw: the plane's offset (default the grid plane's).
- `dx`: number
- `dy`: number
- `dn`: number
- `sx`: number; Scale factor, 1 keeps the size.
- `sy`: number
- `copy`: boolean; default false

## actions

Actions: list the action sets and their recorded steps (menu commands with their dialog values, transforms, drawing and paint), play one on the open document, or batch it over every .fpth, SVG and PDF file in a folder (or over the document's data sets), saving each result into out with a log file formpth-batch-log.txt.

- `action`: string (list | play | batch); default "list"
- `set`: string; The action set's name, when two sets have an action with the same name.
- `name`: string; The action's name.
- `source`: string (folder | data_sets); default "folder"
- `folder`: string; batch: absolute path of the folder of files to process.
- `kinds`: array; batch: which files to take (default fpth, svg and pdf).
- `out`: string; batch: absolute path of the folder for the results and the log (created if missing).
- `format`: string (same | fpth | svg | pdf | png); default "same"
- `name_variable`: string; batch over data sets: a text variable that names each file.
- `stop_on_error`: boolean; default false

## list_commands

The command catalogue: every menu command and tool formpth has, with its id, menu path, shortcut, parameters, whether Undo can reverse it and whether it can run now. Filter by group (a menu name such as Object or Effect, or Tools) and by a word.

- `filter`: string; a word in the id, label or menu path
- `group`: string
- `limit`: integer; default 400

Note: read-only.

## describe_command

One catalogue entry in full: menu path, description, parameters and whether it can run now; suggests close ids when the id is unknown.

- `id`: string; required

Note: read-only.

## run_command

Runs any menu command or tool by its id (see list_commands), on the selection, as the menu would. Ids starting tool. make that tool active.

- `command`: string
- `id`: string; same as command
- `params`: object; the command's parameters, when describe_command lists any

## run_commands

Runs several catalogue commands in order as one undo step, stopping at the first that cannot run.

- `steps`: array; required

## undo

Steps back through the history.

- `steps`: integer; default 1

## redo

Steps forward through the history.

- `steps`: integer; default 1
