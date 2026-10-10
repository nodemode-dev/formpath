# formpth tools

Generated from the engine's catalogue by `./formpth agents sync`; do not edit by hand.

## Contents

- Look: `get_document`, `get_image`, `get_svg`, `get_object`
- Files and documents: `new_document`, `open_file`, `save_project`, `export_file`, `switch_document`, `place_image`, `document_setup`
- Selecting: `select`, `select_same`, `select_similar`
- Drawing: `draw_path`, `draw_shape`, `edit_shape`, `add_text`, `edit_anchors`
- Paint and appearance: `set_paint`, `set_stroke`, `set_appearance`, `add_swatch`, `color_harmony`, `graphic_style`
- Objects and layers: `set_object`, `arrange`, `group`, `compound_path`, `attributes`, `clipping_mask`, `opacity_mask`, `delete_objects`, `duplicate_objects`, `add_layer`, `set_layer`, `delete_layer`, `move_to_layer`
- Transform and align: `transform`, `align`
- Path operations: `pathfinder`, `path_operation`, `shape_builder`
- Effects and live objects: `apply_effect`, `three_d`, `expand`, `make_blend`, `envelope`, `repeat`, `symbol`, `apply_brush`, `image_trace`, `live_paint`, `gradient_mesh`, `symbolism`, `make_pattern`, `edit_pattern`, `recolor`
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

Sets the fill and or stroke of the objects (their first fill and first stroke): a colour, none, a swatch name or a gradient; a fill can also be a freeform gradient. Without ids it also sets the paint new art gets.

- `ids`: array; Object ids from get_document; the selection when left out.
- `fill`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}. Or a freeform gradient {type: freeform, mode: points|lines, points: [{x, y, color, spread}]} with x, y and spread as fractions 0..1 of each object's bounds (absolute true for document points), or {type: freeform, colors: [...]} to place the points automatically.
- `stroke`: string or object; A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}.

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

3D and Materials: give the objects depth as a live effect, change it, or remove it. kind extrude (depth, cap, bevel none, classic or rounded with bevel_height), revolve (the art is a profile turned around its left or right edge: angle, offset, from), inflate (a puffed surface: depth, volume, and rx, ry, rz to tilt it) or plane (the flat art turned in space). Turn it with position (off_axis_front, front, left, right, top, isometric_left, isometric_right and others) or rx, ry, rz in degrees, and perspective 0 to 160. material plastic, matte, metal, wireframe or flat (plane); light top_left, top, top_right, left, front, right, bottom_left, bottom, bottom_right with intensity, ambient and highlight in percent and shading_color. map_symbol wraps a symbol (by name; make one with the symbol tool) onto the front face of an extrude or plane, sized by map_scale percent and moved by map_x, map_y points, shaded with the surface unless shade_art is false; an empty map_symbol clears it. shadow true casts a soft shadow (not for inflate): shadow_position behind or below, shadow_distance and shadow_softness in points, shadow_opacity in percent. Leave kind out to change only the parameters you pass; remove true takes 3D off. Type and groups extrude as one object; expand turns the result into plain shaded paths.

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
- `material`: string (plastic | matte | metal | wireframe | flat)
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

Traces a placed image into a live tracing object (the paths are its children, the image stays inside so the options can change), with a preset (high_fidelity_photo, low_fidelity_photo, 3_colors, 6_colors, 16_colors, shades_of_gray, black_and_white_logo, sketched_art, silhouettes, line_art, technical_drawing) or explicit settings. Pass a tracing object's id to trace it again with new settings; action expand turns it into ordinary paths, release brings back the image; expand true traces and expands in one call; view sets what the canvas shows.

- `id`: string; A placed image or an image tracing object.
- `action`: string (trace | expand | release); default "trace"
- `preset`: string
- `mode`: string (color | gray | bw)
- `colors`: integer
- `threshold`: integer
- `paths`: number
- `ignore_white`: boolean
- `smooth`: boolean
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
