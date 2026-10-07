# formpth tools

Generated from the engine's catalogue by `./formpth agents sync`; do not edit by hand.

## Contents

- Look: `get_document`, `get_image`, `get_svg`, `get_object`
- Files and documents: `new_document`, `open_file`, `save_project`, `export_file`, `switch_document`, `place_image`, `document_setup`
- Selecting: `select`, `select_same`, `select_similar`
- Drawing: `draw_path`, `draw_shape`, `edit_shape`, `add_text`, `edit_anchors`
- Paint and appearance: `set_paint`, `set_stroke`, `set_appearance`, `add_swatch`, `color_harmony`, `graphic_style`
- Objects and layers: `set_object`, `arrange`, `group`, `compound_path`, `clipping_mask`, `delete_objects`, `duplicate_objects`, `add_layer`, `set_layer`, `delete_layer`, `move_to_layer`
- Transform and align: `transform`, `align`
- Path operations: `pathfinder`, `path_operation`, `shape_builder`
- Effects and live objects: `apply_effect`, `expand`, `make_blend`, `envelope`, `repeat`, `symbol`, `apply_brush`, `image_trace`, `make_pattern`, `recolor`
- Artboards: `artboard`
- Type: `set_text`, `text_flow`, `text_style`, `find_font`, `create_outlines`
- Commands: `list_commands`, `run_command`
- History: `undo`, `redo`

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

Opens a file at an absolute path: a formpth project (.fpth), SVG, PDF or a PDF-compatible .ai, or an image (PNG, JPEG, WebP, GIF) as a new document.

- `path`: string; required

## save_project

Saves the document as a formpth project (.fpth) at an absolute path; everything stays editable.

- `path`: string; required

## export_file

Exports the art to an absolute path; the extension chooses the format: .svg, .pdf (every artboard a page), .png, .jpg or .webp.

- `path`: string; required
- `scope`: string (artboard | document | selection | all_artboards); default "artboard"
- `artboard`: integer; default 0
- `scale`: number; default 1
- `quality`: number; default 0.92
- `transparent`: boolean; default false
- `outline_text`: boolean; default false

## switch_document

Makes another open document the active one, by its index or name from get_document.

- `index`: integer
- `name`: string

## place_image

Places an image file (absolute path: PNG, JPEG, WebP, GIF or SVG) into the document at x, y, embedded; width scales it in proportion.

- `path`: string; required
- `x`: number
- `y`: number
- `width`: number

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

Changes a live shape after drawing, keeping its kind: a rectangle's width, height, corner radius (all, or radii top-left, top-right, bottom-right, bottom-left) and corner type; an ellipse's width, height and pie angles (degrees counter-clockwise from three o'clock); a polygon's radius, sides and corner radius; a star's points and outer and inner radius; a line's length and angle. get_object shows a shape's current values.

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

Sets the fill and or stroke of the objects (their first fill and first stroke): a colour, none, a swatch name or a gradient; a fill can also be a freeform gradient. Without ids it also sets the paint new art gets.

- `ids`: array; Object ids from get_document; the selection when left out.
- `fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}. Or a freeform gradient {type: freeform, mode: points|lines, points: [{x, y, color, spread}]} with x, y and spread as fractions 0..1 of each object's bounds (absolute true for document points), or {type: freeform, colors: [...]} to place the points automatically.
- `stroke`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.

## set_stroke

Sets stroke attributes of the objects' first stroke: weight, caps, joins, miter limit, alignment, dashes, arrowheads and width profile.

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

## set_appearance

Edits the appearance stack: object opacity and blend mode, an added fill or stroke on top, every item replaced, cleared, or reduced to one fill and one stroke.

- `ids`: array; Object ids from get_document; the selection when left out.
- `opacity`: number
- `blend_mode`: string (normal | darken | multiply | color_burn | lighten | screen | color_dodge | overlay | soft_light | hard_light | difference | exclusion | hue | saturation | color | luminosity)
- `add_fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `add_stroke`: object
- `items`: array; The whole stack bottom to top: {kind: fill|stroke, color, width, opacity, blend_mode, visible, dash, cap, join, align}.
- `clear`: boolean
- `reduce_to_basic`: boolean

## add_swatch

Adds a swatch to the document: a colour or gradient, optionally global (editing it recolours every use) or spot.

- `name`: string; required
- `color`: string or object; required; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `global`: boolean; default false
- `spot`: boolean; default false
- `group`: string

## color_harmony

The Color Guide: five colours in a harmony rule around a base colour, with tints and shades, warm and cool, or vivid and muted variations of each; optionally saved to the swatches as a group.

- `color`: string; The base colour, #rrggbb; the current fill colour when left out.
- `rule`: string (complementary | split_complementary | left_complement | right_complement | analogous | monochromatic | shades | triad | tetrad | compound | high_contrast | pentagram); default "complementary"
- `variation`: string (none | tints_shades | warm_cool | vivid_muted); default "none"
- `save_group`: string; Save the five colours as a swatch group with this name.

## graphic_style

Graphic styles: create one from an object's appearance, apply one to objects, or list them.

- `action`: string (create | apply | list | delete); required
- `name`: string
- `id`: string; An object id from get_document.
- `ids`: array; Object ids from get_document; the selection when left out.

## set_object

Changes objects' names, visibility, lock, opacity or blend mode.

- `ids`: array; Object ids from get_document; the selection when left out.
- `name`: string
- `visible`: boolean
- `locked`: boolean
- `opacity`: number
- `blend_mode`: string (normal | darken | multiply | color_burn | lighten | screen | color_dodge | overlay | soft_light | hard_light | difference | exclusion | hue | saturation | color | luminosity)

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

## clipping_mask

Clips the objects with the topmost one among them, or releases clipping groups.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (make | release); default "make"

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

Transforms the objects: move by dx, dy or to x, y; rotate by degrees; scale in percent (uniform or per axis); reflect; shear in degrees; set width or height; about an origin; as copies; or each about its own centre.

- `ids`: array; Object ids from get_document; the selection when left out.
- `dx`: number
- `dy`: number
- `x`: number
- `y`: number
- `rotate`: number
- `scale`: number
- `scale_x`: number
- `scale_y`: number
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

Adds a live effect to the objects (it stays editable in the Appearance panel), or lists the effects and their parameters with list true. Ids include warp.arc, warp.flag, warp.bulge (15 warps), distort.roughen, distort.zig_zag, distort.pucker_bloat, distort.twist, distort.transform, distort.tweak, stylize.drop_shadow, stylize.outer_glow, stylize.inner_glow, stylize.feather, stylize.round_corners, stylize.scribble, path.offset, path.outline_stroke, blur.gaussian, convert.rectangle, convert.rounded_rectangle, convert.ellipse.

- `ids`: array; Object ids from get_document; the selection when left out.
- `effect`: string
- `params`: object
- `list`: boolean; default false

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

Envelope Distort: warp the objects with one of the 15 warp styles, a mesh grid, or the topmost object's shape; or release or expand an envelope.

- `ids`: array; Object ids from get_document; the selection when left out.
- `action`: string (warp | mesh | top_object | release | expand); required
- `style`: string (arc | arc_lower | arc_upper | arch | bulge | shell_lower | shell_upper | flag | wave | fish | rise | fisheye | inflate | squeeze | twist)
- `bend`: number; default 50
- `horizontal`: number; default 0
- `vertical`: number; default 0
- `vertical_orientation`: boolean; default false
- `rows`: integer; default 4
- `columns`: integer; default 4

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

Symbols: create one from the objects, place an instance, list them, break an instance's link, or replace instances with another symbol.

- `action`: string (create | place | list | break_link | replace | delete); required
- `name`: string
- `ids`: array; Object ids from get_document; the selection when left out.
- `x`: number
- `y`: number
- `scale`: number

## apply_brush

Applies a brush to the strokes of the objects (calligraphic, scatter, art or pattern), removes it with brush none, or lists the brushes with list true.

- `ids`: array; Object ids from get_document; the selection when left out.
- `brush`: string
- `list`: boolean; default false

## image_trace

Traces a placed image into vector paths with a preset (high_fidelity_photo, low_fidelity_photo, colors_3, colors_6, colors_16, shades_of_gray, black_and_white, outline, line_art, sketched_art, silhouettes, technical_drawing) or explicit settings, expanded to paths.

- `id`: string; An object id from get_document.
- `preset`: string
- `colors`: integer
- `threshold`: integer
- `paths`: number
- `corners`: number
- `noise`: integer
- `ignore_white`: boolean; default false

## make_pattern

Makes a pattern swatch from the objects, tiled as a grid, brick or hex, and optionally fills other objects with it.

- `ids`: array; Object ids from get_document; the selection when left out.
- `name`: string; required
- `tile`: string (grid | brick_by_row | brick_by_column | hex_by_column | hex_by_row); default "grid"
- `h_spacing`: number
- `v_spacing`: number
- `apply_to`: array; Object ids from get_document; the selection when left out.

## recolor

Recolours the objects: map colours to new ones, fit them to a palette, or invert, convert to grayscale, CMYK or RGB, or saturate by amount (-100..100).

- `ids`: array; Object ids from get_document; the selection when left out.
- `map`: object; From colour to colour, both #rrggbb.
- `palette`: array
- `action`: string (map | palette | invert | grayscale | cmyk | rgb | saturate); default "map"
- `amount`: number

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

Changes a type object: its words, and its font, style, size, colour, leading, tracking, alignment, case and OpenType features, for all of it or the characters from start to end.

- `id`: string; required; An object id from get_document.
- `text`: string
- `font`: string
- `style`: string
- `size`: number
- `color`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.
- `leading`: number
- `tracking`: number
- `align`: string (left | center | right | justify)
- `start`: integer
- `end`: integer
- `caps`: string (none | all | small)
- `features`: array; OpenType feature tags to turn on, replacing the current list: liga, dlig, frac, ordn, tnum, pnum, lnum, onum, zero, case, sups, subs, numr, dnom, swsh, salt, titl, smcp, ss01..ss20. Features the font lacks do nothing; find_font lists the fonts in use.

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

## list_commands

Every menu command formpth has: its id, label, menu, shortcut and whether it can run now. Filter by a word.

- `filter`: string

Note: read-only.

## run_command

Runs any menu command by its id (see list_commands), on the selection, as the menu would.

- `command`: string; required

## undo

Steps back through the history.

- `steps`: integer; default 1

## redo

Steps forward through the history.

- `steps`: integer; default 1
