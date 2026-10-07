import asyncio
import base64
import collections
import itertools
import json
import os
import time
import urllib.parse
from pathlib import Path

from fastapi import APIRouter, Request, Response

from app import __version__
from app.core import config

router = APIRouter()
VERSIONS = ["2026-07-28", "2025-11-25"]
INSTRUCTIONS = ("formpth is a vector illustration editor (an Illustrator alternative) running on this computer; these tools draw "
                "and edit what is open in its window. Coordinates are document points (1/72 inch), x to the right and y down, "
                "origin at the first artboard's top-left corner. Start with get_document (artboards, layers, object ids) and "
                "get_image (to see the art); check your work with get_image after each change. Every change is one undoable step. "
                "Most tools act on the ids you pass, else on the selection. open_file, save_project, export_file and place_image "
                "take absolute paths. run_command reaches any menu command by id (list_commands lists them). "
                "For the decision tree, get the draw_strategy prompt.")

STRATEGY = """How to make vector art in formpth with these tools.

1. Look first. get_document gives the artboards (their x, y, width, height in points), the layers and every object with its id, kind, bounds and paint. get_image shows the art; call it after each change to check before going on.
2. Plan in points. A US Letter artboard is 612 by 792, A4 is 595 by 842, a 1080 px square is 1080 by 1080 when the document's units are px. Place things relative to the artboard's x and y.
3. Draw shapes with draw_shape (rectangle, rounded_rectangle, ellipse, polygon, star, line, arc, spiral, grids); they stay live, so their corners and sides can change later. Draw free curves with draw_path: an SVG path d string gives exact Beziers, a list of points with smooth true gives a fitted curve.
4. Paint with set_paint: a colour (#rrggbb, rgb(), cmyk(), a swatch name), none, or a gradient {type, angle, stops}. Strokes take set_stroke for width, caps, joins, dashes, arrowheads and width profiles. set_appearance stacks several fills and strokes on one object and sets opacity and blend mode.
5. Combine shapes: pathfinder unites, subtracts, intersects, excludes, divides, trims, merges or crops the selected shapes into curves; compound_path makes holes; clipping_mask clips the objects below with the topmost one; shape_builder merges the regions under given points.
6. Type: add_text for point, area or on-path type, set_text to change its words and style, create_outlines to turn it into paths.
7. Arrange: group, arrange (stacking order), align (to the selection, the artboard or a key object), transform (move, rotate, scale, reflect, shear, with copy and each), add_layer and move_to_layer.
8. Live looks: apply_effect adds an editable effect (warp.arc, distort.roughen, stylize.drop_shadow and the rest; call it with list true for the catalogue); make_blend, envelope, repeat, symbol and apply_brush make live objects; expand bakes any of them into plain paths.
9. Deliver: save_project writes a .fpth that keeps everything editable; export_file writes SVG, PDF, PNG, JPEG or WebP of an artboard, the whole document or the selection. Paths are absolute and the folder must exist.
10. Mistakes: undo steps back one change at a time. If a tool fails, its message says what to do next: follow it and retry.
"""
PROMPTS = [{"name": "draw_strategy", "title": "How to draw in formpth", "description": "The decision tree for formpth's tools: looking, planning in points, shapes and curves, paint, Pathfinder, type, arranging, live effects and delivery.", "arguments": []}]


def _tool(name: str, description: str, props: dict, required: list[str] | None = None, **hints: bool) -> dict:
    return {"name": name, "description": description, "inputSchema": {"type": "object", "properties": props, "required": required or [], "additionalProperties": False},
            "annotations": {"readOnlyHint": hints.get("read", False), "destructiveHint": hints.get("destructive", False), "idempotentHint": hints.get("idempotent", False), "openWorldHint": hints.get("open", False)}}


_ID = {"type": "string", "description": "An object id from get_document."}
_IDS = {"type": "array", "items": {"type": "string"}, "description": "Object ids from get_document; the selection when left out."}
_NUM = {"type": "number"}
_COLOR = {"type": ["string", "object"], "description": "A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, stops: [{offset 0..1, color, opacity}]}."}
_BLEND = {"type": "string", "enum": ["normal", "darken", "multiply", "color_burn", "lighten", "screen", "color_dodge", "overlay", "soft_light", "hard_light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"]}
_SHAPES = ["rectangle", "rounded_rectangle", "ellipse", "polygon", "star", "line", "arc", "spiral", "flare", "rectangular_grid", "polar_grid"]
_PF = ["unite", "minus_front", "intersect", "exclude", "divide", "trim", "merge", "crop", "outline", "minus_back"]
_PATHOPS = ["offset", "outline_stroke", "simplify", "smooth", "join", "average", "reverse", "add_anchors", "remove_anchors", "divide_objects_below", "split_into_grid", "clean_up", "close", "open"]

TOOLS = [
    _tool("get_document", "The open document: name, units, colour mode, the artboards (index, name, x, y, width, height in points), the layers and every object in them bottom to top (id, name, kind, bounds, fill, stroke, opacity, visible, locked, text), the selection, the swatches, symbols, graphic styles and brushes, and the other open documents.", {"depth": {"type": "integer", "minimum": 1, "maximum": 32, "default": 8, "description": "How deep groups are listed."}}, read=True, idempotent=True),
    _tool("get_image", "The art as it looks, as a PNG image: one artboard (default the first), the whole document, or the selection, its longer side at most max_size pixels.", {"scope": {"type": "string", "enum": ["artboard", "document", "selection"], "default": "artboard"}, "artboard": {"type": "integer", "minimum": 0, "default": 0}, "max_size": {"type": "integer", "minimum": 64, "maximum": 2048, "default": 1024}, "outline": {"type": "boolean", "default": False, "description": "Outline view: paths only, no paint."}}, read=True, idempotent=True),
    _tool("get_svg", "SVG markup of an artboard, the whole document, or the given objects.", {"scope": {"type": "string", "enum": ["artboard", "document", "selection"], "default": "artboard"}, "artboard": {"type": "integer", "minimum": 0, "default": 0}, "ids": _IDS}, read=True, idempotent=True),
    _tool("get_object", "One object in full: its kind, geometry (anchors with their handles for paths), appearance stack (fills, strokes, effects), transform, text and children.", {"id": _ID}, ["id"], read=True, idempotent=True),
    _tool("new_document", "Opens a new document with one or more artboards.", {"width": {"type": "number", "minimum": 1}, "height": {"type": "number", "minimum": 1}, "units": {"type": "string", "enum": ["pt", "px", "mm", "cm", "in", "pc"], "default": "pt"},
          "name": {"type": "string", "maxLength": 120}, "color_mode": {"type": "string", "enum": ["rgb", "cmyk"], "default": "rgb"}, "artboards": {"type": "integer", "minimum": 1, "maximum": 100, "default": 1}}, ["width", "height"]),
    _tool("open_file", "Opens a file at an absolute path: a formpth project (.fpth), SVG, PDF or a PDF-compatible .ai, or an image (PNG, JPEG, WebP, GIF) as a new document.", {"path": {"type": "string"}}, ["path"]),
    _tool("save_project", "Saves the document as a formpth project (.fpth) at an absolute path; everything stays editable.", {"path": {"type": "string"}}, ["path"]),
    _tool("export_file", "Exports the art to an absolute path; the extension chooses the format: .svg, .pdf (every artboard a page), .png, .jpg or .webp.", {"path": {"type": "string"}, "scope": {"type": "string", "enum": ["artboard", "document", "selection", "all_artboards"], "default": "artboard"},
          "artboard": {"type": "integer", "minimum": 0, "default": 0}, "scale": {"type": "number", "minimum": 0.1, "maximum": 16, "default": 1}, "quality": {"type": "number", "minimum": 0.1, "maximum": 1, "default": 0.92}, "transparent": {"type": "boolean", "default": False}, "outline_text": {"type": "boolean", "default": False}}, ["path"]),
    _tool("switch_document", "Makes another open document the active one, by its index or name from get_document.", {"index": {"type": "integer", "minimum": 0}, "name": {"type": "string"}}),
    _tool("place_image", "Places an image file (absolute path: PNG, JPEG, WebP, GIF or SVG) into the document at x, y, embedded; width scales it in proportion.", {"path": {"type": "string"}, "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 1}}, ["path"]),
    _tool("document_setup", "Changes the document: its units, colour mode (rgb or cmyk) and title.", {"units": {"type": "string", "enum": ["pt", "px", "mm", "cm", "in", "pc"]}, "color_mode": {"type": "string", "enum": ["rgb", "cmyk"]}, "title": {"type": "string", "maxLength": 120}}),
    _tool("select", "Changes the selection: these ids, everything, nothing, the inverse, or every object touching a rectangle; mode combines with the current selection.", {"ids": _IDS, "all": {"type": "boolean"}, "none": {"type": "boolean"}, "inverse": {"type": "boolean"},
          "rect": {"type": "object", "properties": {"x": _NUM, "y": _NUM, "width": _NUM, "height": _NUM}, "required": ["x", "y", "width", "height"]}, "mode": {"type": "string", "enum": ["replace", "add", "subtract", "toggle"], "default": "replace"}}),
    _tool("select_same", "Selects every object sharing an attribute with the given object (or the first selected one).", {"attribute": {"type": "string", "enum": ["fill_color", "stroke_color", "stroke_weight", "fill_and_stroke", "opacity", "blending_mode", "appearance", "graphic_style", "shape", "font_family", "font_size", "symbol_instance"]}, "id": _ID}, ["attribute"]),
    _tool("draw_path", "Draws a path from an SVG path d string (M, L, H, V, C, S, Q, T, A, Z, absolute or relative), or from points (each [x, y]) joined by straight lines or, with smooth true, by a fitted curve.", {"d": {"type": "string"}, "points": {"type": "array", "items": {"type": "array", "items": _NUM, "minItems": 2, "maxItems": 2}},
          "smooth": {"type": "boolean", "default": False}, "closed": {"type": "boolean", "default": False}, "fill": _COLOR, "stroke": _COLOR, "stroke_width": {"type": "number", "minimum": 0}, "name": {"type": "string"}, "layer": {"type": "string", "description": "A layer id; the active layer when left out."}}),
    _tool("draw_shape", "Draws a live shape: x and y are the top-left of its bounds (for line and arc the start point, with x2 and y2 the end). Shapes keep their kind, so corners, sides and points can change later.", {"shape": {"type": "string", "enum": _SHAPES}, "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 0}, "height": {"type": "number", "minimum": 0}, "x2": _NUM, "y2": _NUM,
          "corner_radius": {"type": "number", "minimum": 0}, "sides": {"type": "integer", "minimum": 3, "maximum": 1000}, "points": {"type": "integer", "minimum": 3, "maximum": 1000}, "inner_ratio": {"type": "number", "minimum": 0.01, "maximum": 1, "description": "A star's inner radius over its outer radius."},
          "turns": {"type": "number", "minimum": 0.5, "maximum": 100}, "rows": {"type": "integer", "minimum": 0, "maximum": 200}, "columns": {"type": "integer", "minimum": 0, "maximum": 200}, "rotation": _NUM, "fill": _COLOR, "stroke": _COLOR, "stroke_width": {"type": "number", "minimum": 0}, "name": {"type": "string"}, "layer": {"type": "string"}}, ["shape", "x", "y"]),
    _tool("add_text", "Adds type: point type at x, y (the first baseline), area type filling a width by height frame, or type on the path given by path_id. The type is black unless color is given.", {"text": {"type": "string", "maxLength": 20000}, "x": _NUM, "y": _NUM, "mode": {"type": "string", "enum": ["point", "area", "path"], "default": "point"}, "width": {"type": "number", "minimum": 1}, "height": {"type": "number", "minimum": 1},
          "path_id": _ID, "font": {"type": "string", "description": "A font family, such as Inter."}, "style": {"type": "string", "description": "Regular, Bold, Italic, Bold Italic, or a weight such as 600."}, "size": {"type": "number", "minimum": 0.1, "maximum": 1296, "default": 24}, "color": _COLOR,
          "align": {"type": "string", "enum": ["left", "center", "right", "justify"], "default": "left"}, "leading": {"type": "number", "minimum": 0}, "tracking": {"type": "number", "description": "In thousandths of an em."}, "name": {"type": "string"}, "layer": {"type": "string"}}, ["text", "x", "y"]),
    _tool("edit_anchors", "Edits a path's anchor points: move some by dx, dy; replace them all; insert one at a position along a segment; delete some; or convert some to smooth or corner points. Indices count anchors across subpaths in order.", {"id": _ID, "action": {"type": "string", "enum": ["move", "replace", "insert", "delete", "smooth", "corner"]},
          "indices": {"type": "array", "items": {"type": "integer", "minimum": 0}}, "dx": _NUM, "dy": _NUM, "segment": {"type": "integer", "minimum": 0}, "t": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.5},
          "anchors": {"type": "array", "items": {"type": "object", "properties": {"x": _NUM, "y": _NUM, "in": {"type": "array", "items": _NUM}, "out": {"type": "array", "items": _NUM}}, "required": ["x", "y"]}, "description": "For replace: the new anchors, in and out handles absolute."}, "closed": {"type": "boolean"}}, ["id", "action"]),
    _tool("set_paint", "Sets the fill and or stroke of the objects (their first fill and first stroke): a colour, none, a swatch name or a gradient. Without ids it also sets the paint new art gets.", {"ids": _IDS, "fill": _COLOR, "stroke": _COLOR}),
    _tool("set_stroke", "Sets stroke attributes of the objects' first stroke: weight, caps, joins, miter limit, alignment, dashes, arrowheads and width profile.", {"ids": _IDS, "width": {"type": "number", "minimum": 0}, "cap": {"type": "string", "enum": ["butt", "round", "square"]}, "join": {"type": "string", "enum": ["miter", "round", "bevel"]}, "miter_limit": {"type": "number", "minimum": 1, "maximum": 500},
          "align": {"type": "string", "enum": ["center", "inside", "outside"]}, "dash": {"type": "array", "items": {"type": "number", "minimum": 0}, "maxItems": 6, "description": "Dash and gap lengths; empty for a solid stroke."}, "dash_offset": _NUM, "dash_align_corners": {"type": "boolean"},
          "start_arrow": {"type": "string", "description": "none, triangle, triangle_open, arrow, arrow_open, circle, circle_open, square, square_open, diamond, bar, barbed, half_arrow, feather, tail."}, "end_arrow": {"type": "string"}, "arrow_scale": {"type": "number", "minimum": 0.1, "maximum": 10},
          "profile": {"type": "string", "enum": ["uniform", "lens", "taper_start", "taper_end", "taper_both", "pinch", "teardrop", "wave"]}}),
    _tool("set_appearance", "Edits the appearance stack: object opacity and blend mode, an added fill or stroke on top, every item replaced, cleared, or reduced to one fill and one stroke.", {"ids": _IDS, "opacity": {"type": "number", "minimum": 0, "maximum": 1}, "blend_mode": _BLEND, "add_fill": _COLOR,
          "add_stroke": {"type": "object", "properties": {"color": _COLOR, "width": {"type": "number", "minimum": 0}}}, "items": {"type": "array", "items": {"type": "object"}, "description": "The whole stack bottom to top: {kind: fill|stroke, color, width, opacity, blend_mode, visible, dash, cap, join, align}."},
          "clear": {"type": "boolean"}, "reduce_to_basic": {"type": "boolean"}}),
    _tool("add_swatch", "Adds a swatch to the document: a colour or gradient, optionally global (editing it recolours every use) or spot.", {"name": {"type": "string", "maxLength": 120}, "color": _COLOR, "global": {"type": "boolean", "default": False}, "spot": {"type": "boolean", "default": False}, "group": {"type": "string"}}, ["name", "color"]),
    _tool("graphic_style", "Graphic styles: create one from an object's appearance, apply one to objects, or list them.", {"action": {"type": "string", "enum": ["create", "apply", "list", "delete"]}, "name": {"type": "string"}, "id": _ID, "ids": _IDS}, ["action"]),
    _tool("set_object", "Changes objects' names, visibility, lock, opacity or blend mode.", {"ids": _IDS, "name": {"type": "string", "maxLength": 200}, "visible": {"type": "boolean"}, "locked": {"type": "boolean"}, "opacity": {"type": "number", "minimum": 0, "maximum": 1}, "blend_mode": _BLEND}),
    _tool("arrange", "Changes the stacking order of the objects within their layer or group.", {"ids": _IDS, "order": {"type": "string", "enum": ["bring_to_front", "bring_forward", "send_backward", "send_to_back"]}}, ["order"]),
    _tool("group", "Groups the objects, or ungroups the groups among them.", {"ids": _IDS, "action": {"type": "string", "enum": ["group", "ungroup"], "default": "group"}}),
    _tool("compound_path", "Makes the paths one compound path (overlaps become holes by the fill rule), or releases compound paths.", {"ids": _IDS, "action": {"type": "string", "enum": ["make", "release"], "default": "make"}, "rule": {"type": "string", "enum": ["nonzero", "evenodd"]}}),
    _tool("clipping_mask", "Clips the objects with the topmost one among them, or releases clipping groups.", {"ids": _IDS, "action": {"type": "string", "enum": ["make", "release"], "default": "make"}}),
    _tool("delete_objects", "Deletes the objects.", {"ids": _IDS}, destructive=True),
    _tool("duplicate_objects", "Duplicates the objects, offset by dx, dy; the copies become the selection.", {"ids": _IDS, "dx": {"type": "number", "default": 0}, "dy": {"type": "number", "default": 0}}),
    _tool("add_layer", "Adds a layer at the top (or above another layer) and makes it active.", {"name": {"type": "string", "maxLength": 120}, "above": {"type": "string", "description": "A layer id."}, "sublayer_of": {"type": "string", "description": "A layer id to nest the new layer in."}}),
    _tool("set_layer", "Changes a layer: name, visibility, lock, whether it prints, template, and whether it is the active layer new art goes on.", {"id": _ID, "name": {"type": "string", "maxLength": 120}, "visible": {"type": "boolean"}, "locked": {"type": "boolean"}, "printable": {"type": "boolean"}, "template": {"type": "boolean"}, "active": {"type": "boolean"}}, ["id"]),
    _tool("delete_layer", "Deletes a layer and everything on it.", {"id": _ID}, ["id"], destructive=True),
    _tool("move_to_layer", "Moves the objects to the top of a layer.", {"ids": _IDS, "layer": {"type": "string", "description": "A layer id."}}, ["layer"]),
    _tool("transform", "Transforms the objects: move by dx, dy or to x, y; rotate by degrees; scale in percent (uniform or per axis); reflect; shear in degrees; set width or height; about an origin; as copies; or each about its own centre.", {"ids": _IDS, "dx": _NUM, "dy": _NUM, "x": _NUM, "y": _NUM, "rotate": _NUM, "scale": {"type": "number", "minimum": 0.01}, "scale_x": {"type": "number", "minimum": 0.01}, "scale_y": {"type": "number", "minimum": 0.01},
          "width": {"type": "number", "minimum": 0.01}, "height": {"type": "number", "minimum": 0.01}, "reflect": {"type": "string", "enum": ["horizontal", "vertical"]}, "shear": _NUM, "shear_axis": {"type": "string", "enum": ["horizontal", "vertical"], "default": "horizontal"},
          "origin": {"type": ["string", "array"], "description": "center (default), top_left, top, top_right, left, right, bottom_left, bottom, bottom_right, or [x, y]."}, "copy": {"type": "boolean", "default": False}, "each": {"type": "boolean", "default": False}, "scale_strokes": {"type": "boolean", "default": True}}),
    _tool("align", "Aligns or distributes the objects, relative to the selection's bounds, the artboard, or a key object; distribute_spacing uses spacing in points.", {"ids": _IDS, "action": {"type": "string", "enum": ["left", "horizontal_center", "right", "top", "vertical_center", "bottom", "distribute_left", "distribute_horizontal_center", "distribute_right", "distribute_top", "distribute_vertical_center", "distribute_bottom", "distribute_horizontal_space", "distribute_vertical_space"]},
          "to": {"type": "string", "enum": ["selection", "artboard", "key"], "default": "selection"}, "key": _ID, "spacing": _NUM}, ["action"]),
    _tool("pathfinder", "Combines the selected shapes into new curved paths, as Illustrator's Pathfinder: unite, minus_front, intersect, exclude, divide, trim, merge, crop, outline or minus_back.", {"ids": _IDS, "operation": {"type": "string", "enum": _PF}}, ["operation"]),
    _tool("path_operation", "A path command on the objects: offset (by offset points, joins), outline_stroke, simplify (precision 0..100), smooth, join, average (axis), reverse, add_anchors, remove_anchors, divide_objects_below, split_into_grid (rows, columns, gutter), clean_up, close or open.", {"ids": _IDS, "operation": {"type": "string", "enum": _PATHOPS},
          "offset": _NUM, "joins": {"type": "string", "enum": ["miter", "round", "bevel"], "default": "miter"}, "miter_limit": {"type": "number", "default": 4}, "precision": {"type": "number", "minimum": 0, "maximum": 100, "default": 50}, "axis": {"type": "string", "enum": ["horizontal", "vertical", "both"], "default": "both"},
          "rows": {"type": "integer", "minimum": 1, "maximum": 100}, "columns": {"type": "integer", "minimum": 1, "maximum": 100}, "gutter": {"type": "number", "minimum": 0}}, ["operation"]),
    _tool("shape_builder", "Shape Builder: merges the regions of the selected shapes under the given points into one shape, or deletes them.", {"ids": _IDS, "points": {"type": "array", "items": {"type": "array", "items": _NUM, "minItems": 2, "maxItems": 2}, "minItems": 1}, "delete": {"type": "boolean", "default": False}}, ["points"]),
    _tool("apply_effect", "Adds a live effect to the objects (it stays editable in the Appearance panel), or lists the effects and their parameters with list true. Ids include warp.arc, warp.flag, warp.bulge (15 warps), distort.roughen, distort.zig_zag, distort.pucker_bloat, distort.twist, distort.transform, distort.tweak, stylize.drop_shadow, stylize.outer_glow, stylize.inner_glow, stylize.feather, stylize.round_corners, stylize.scribble, path.offset, path.outline_stroke, blur.gaussian, convert.rectangle, convert.rounded_rectangle, convert.ellipse.",
          {"ids": _IDS, "effect": {"type": "string"}, "params": {"type": "object"}, "list": {"type": "boolean", "default": False}}),
    _tool("expand", "Expands the objects into plain paths: appearance (effects, strokes, multiple fills), or the object (live shapes, type, blends, symbols, envelopes, repeats), or both.", {"ids": _IDS, "what": {"type": "string", "enum": ["appearance", "object", "all"], "default": "all"}}),
    _tool("make_blend", "Blends between the selected objects (shape and colour), or releases or expands a blend. spacing smooth chooses steps from the colours.", {"ids": _IDS, "action": {"type": "string", "enum": ["make", "release", "expand", "options"], "default": "make"}, "spacing": {"type": "string", "enum": ["smooth", "steps", "distance"], "default": "steps"},
          "steps": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 8}, "distance": {"type": "number", "minimum": 0.1}, "align_to_path": {"type": "boolean"}}),
    _tool("envelope", "Envelope Distort: warp the objects with one of the 15 warp styles, a mesh grid, or the topmost object's shape; or release or expand an envelope.", {"ids": _IDS, "action": {"type": "string", "enum": ["warp", "mesh", "top_object", "release", "expand"]}, "style": {"type": "string", "enum": ["arc", "arc_lower", "arc_upper", "arch", "bulge", "shell_lower", "shell_upper", "flag", "wave", "fish", "rise", "fisheye", "inflate", "squeeze", "twist"]},
          "bend": {"type": "number", "minimum": -100, "maximum": 100, "default": 50}, "horizontal": {"type": "number", "minimum": -100, "maximum": 100, "default": 0}, "vertical": {"type": "number", "minimum": -100, "maximum": 100, "default": 0}, "vertical_orientation": {"type": "boolean", "default": False},
          "rows": {"type": "integer", "minimum": 1, "maximum": 50, "default": 4}, "columns": {"type": "integer", "minimum": 1, "maximum": 50, "default": 4}}, ["action"]),
    _tool("repeat", "Repeat: makes the objects a live radial, grid or mirror repeat, changes its options, or releases or expands it.", {"ids": _IDS, "kind": {"type": "string", "enum": ["radial", "grid", "mirror", "release", "expand"]}, "instances": {"type": "integer", "minimum": 2, "maximum": 400}, "radius": {"type": "number", "minimum": 0},
          "rows": {"type": "integer", "minimum": 1, "maximum": 100}, "columns": {"type": "integer", "minimum": 1, "maximum": 100}, "h_spacing": _NUM, "v_spacing": _NUM, "angle": _NUM}, ["kind"]),
    _tool("symbol", "Symbols: create one from the objects, place an instance, list them, break an instance's link, or replace instances with another symbol.", {"action": {"type": "string", "enum": ["create", "place", "list", "break_link", "replace", "delete"]}, "name": {"type": "string", "maxLength": 120}, "ids": _IDS, "x": _NUM, "y": _NUM, "scale": {"type": "number", "minimum": 0.01}}, ["action"]),
    _tool("apply_brush", "Applies a brush to the strokes of the objects (calligraphic, scatter, art or pattern), removes it with brush none, or lists the brushes with list true.", {"ids": _IDS, "brush": {"type": "string"}, "list": {"type": "boolean", "default": False}}),
    _tool("image_trace", "Traces a placed image into vector paths with a preset (high_fidelity_photo, low_fidelity_photo, colors_3, colors_6, colors_16, shades_of_gray, black_and_white, outline, line_art, sketched_art, silhouettes, technical_drawing) or explicit settings, expanded to paths.", {"id": _ID, "preset": {"type": "string"}, "colors": {"type": "integer", "minimum": 2, "maximum": 64},
          "threshold": {"type": "integer", "minimum": 0, "maximum": 255}, "paths": {"type": "number", "minimum": 0, "maximum": 100}, "corners": {"type": "number", "minimum": 0, "maximum": 100}, "noise": {"type": "integer", "minimum": 1, "maximum": 100}, "ignore_white": {"type": "boolean", "default": False}}),
    _tool("make_pattern", "Makes a pattern swatch from the objects, tiled as a grid, brick or hex, and optionally fills other objects with it.", {"ids": _IDS, "name": {"type": "string", "maxLength": 120}, "tile": {"type": "string", "enum": ["grid", "brick_by_row", "brick_by_column", "hex_by_column", "hex_by_row"], "default": "grid"}, "h_spacing": _NUM, "v_spacing": _NUM, "apply_to": _IDS}, ["name"]),
    _tool("recolor", "Recolours the objects: map colours to new ones, fit them to a palette, or invert, convert to grayscale, CMYK or RGB, or saturate by amount (-100..100).", {"ids": _IDS, "map": {"type": "object", "additionalProperties": {"type": "string"}, "description": "From colour to colour, both #rrggbb."}, "palette": {"type": "array", "items": {"type": "string"}},
          "action": {"type": "string", "enum": ["map", "palette", "invert", "grayscale", "cmyk", "rgb", "saturate"], "default": "map"}, "amount": _NUM}),
    _tool("artboard", "Artboards: add one, change one (name, x, y, width, height), delete one, fit one to the art or the selection, rearrange them in columns, or list them.", {"action": {"type": "string", "enum": ["add", "set", "delete", "fit_to_art", "fit_to_selection", "rearrange", "list", "activate"]}, "index": {"type": "integer", "minimum": 0}, "name": {"type": "string", "maxLength": 120},
          "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 1}, "height": {"type": "number", "minimum": 1}, "columns": {"type": "integer", "minimum": 1, "maximum": 100}, "spacing": {"type": "number", "minimum": 0}}, ["action"]),
    _tool("set_text", "Changes a type object: its words, and its font, style, size, colour, leading, tracking and alignment, for all of it or the characters from start to end.", {"id": _ID, "text": {"type": "string", "maxLength": 20000}, "font": {"type": "string"}, "style": {"type": "string"}, "size": {"type": "number", "minimum": 0.1, "maximum": 1296}, "color": _COLOR,
          "leading": {"type": "number", "minimum": 0}, "tracking": _NUM, "align": {"type": "string", "enum": ["left", "center", "right", "justify"]}, "start": {"type": "integer", "minimum": 0}, "end": {"type": "integer", "minimum": 0}}, ["id"]),
    _tool("create_outlines", "Turns type objects into compound paths of their glyph outlines, in their colours.", {"ids": _IDS}),
    _tool("list_commands", "Every menu command formpth has: its id, label, menu, shortcut and whether it can run now. Filter by a word.", {"filter": {"type": "string"}}, read=True, idempotent=True),
    _tool("run_command", "Runs any menu command by its id (see list_commands), on the selection, as the menu would.", {"command": {"type": "string"}}, ["command"]),
    _tool("undo", "Steps back through the history.", {"steps": {"type": "integer", "minimum": 1, "maximum": 100, "default": 1}}),
    _tool("redo", "Steps forward through the history.", {"steps": {"type": "integer", "minimum": 1, "maximum": 100, "default": 1}}),
]
NAMES = {t["name"] for t in TOOLS}

_pending: collections.deque = collections.deque()
_ready: asyncio.Event | None = None
_waiting: dict[str, asyncio.Future] = {}
_ids = itertools.count(1)
_seen = 0.0
LIVE = 30.0
_allowed = False
_declined_until = 0.0
_opened_at = 0.0


def _event() -> asyncio.Event:
    global _ready
    if _ready is None:
        _ready = asyncio.Event()
    return _ready


def _put(item: dict, front: bool = False) -> None:
    (_pending.appendleft if front else _pending.append)(item)
    _event().set()


def _local_origin(origin: str | None) -> bool:
    if not origin:
        return True
    host = urllib.parse.urlparse(origin).hostname or ""
    return host in ("localhost", "127.0.0.1", "::1", "tauri.localhost") or origin.startswith("tauri://")


def _ok(req_id, result: dict, modern: bool) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": {**result, **({"resultType": "complete"} if modern else {})}}


def _err(req_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _live() -> bool:
    return time.monotonic() - _seen <= LIVE


def _fail(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": True}


def _open_window() -> bool:
    global _opened_at
    if os.environ.get("FORMPTH_OPEN_WINDOW", "1") == "0" or config.is_desktop() or time.monotonic() - _opened_at < 60:
        return False
    _opened_at = time.monotonic()
    import webbrowser
    url = f"http://127.0.0.1:{config.port()}/" if config.dist_dir() else f"http://localhost:{config.FRONTEND_PORT}/"
    try:
        return bool(webbrowser.open(url))
    except Exception:
        return False


async def _ask(name: str, args: dict, timeout: float) -> dict | None:
    rid = str(next(_ids))
    fut = asyncio.get_running_loop().create_future()
    _waiting[rid] = fut
    _put({"id": rid, "name": name, "arguments": args})
    try:
        return await asyncio.wait_for(fut, timeout=timeout)
    except asyncio.TimeoutError:
        return None
    finally:
        _waiting.pop(rid, None)


_OPENABLE = {".fpth", ".svg", ".svgz", ".pdf", ".ai", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
_PLACEABLE = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"}
_EXPORTS = {".svg": "svg", ".pdf": "pdf", ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp"}
_MAX_OPEN = 512 * 1024 * 1024


def _path(raw, kinds: set, reading: bool) -> Path:
    path = Path(os.path.expanduser(str(raw or "").strip()))
    if not str(raw or "").strip() or not path.is_absolute():
        raise ValueError("Give an absolute path, for example /Users/you/Documents/poster.svg (~ works too).")
    if path.suffix.lower() not in kinds:
        raise ValueError(f"{path.name}: formpth takes {', '.join(sorted(kinds))} here.")
    if reading and not path.is_file():
        raise ValueError(f"There is no file at {path}.")
    if not reading and not path.parent.is_dir():
        raise ValueError(f"The folder {path.parent} does not exist: create it first, or choose another.")
    return path


async def _write(path: Path, out: dict) -> dict:
    data = (out.get("structuredContent") or {}).get("data") if not out.get("isError") else None
    if not data:
        return out if out.get("isError") else _fail("formpth gave nothing to write.")
    blob = base64.b64decode(data)
    await asyncio.to_thread(path.write_bytes, blob)
    return {"content": [{"type": "text", "text": f"Wrote {path} ({len(blob):,} bytes)."}], "structuredContent": {"path": str(path), "bytes": len(blob)}}


async def _run(name: str, args: dict) -> dict:
    try:
        if name in ("open_file", "place_image"):
            path = _path(args.get("path"), _OPENABLE if name == "open_file" else _PLACEABLE, True)
            if path.stat().st_size > _MAX_OPEN:
                return _fail(f"{path.name} is larger than 512 MB.")
            data = base64.b64encode(await asyncio.to_thread(path.read_bytes)).decode()
            rest = {k: v for k, v in args.items() if k != "path"}
            return await _call("__open" if name == "open_file" else "__place", {"name": path.name, "data": data, **rest})
        if name == "save_project":
            path = _path(args.get("path"), {".fpth"}, False)
            return await _write(path, await _call("__project", {}))
        if name == "export_file":
            path = _path(args.get("path"), set(_EXPORTS), False)
            rest = {k: v for k, v in args.items() if k != "path"}
            return await _write(path, await _call("__export", {"format": _EXPORTS[path.suffix.lower()], **rest}))
    except ValueError as exc:
        return _fail(str(exc))
    except OSError as exc:
        return _fail(f"Could not {'read' if name in ('open_file', 'place_image') else 'write'} the file: {exc.strerror or exc}.")
    return await _call(name, args)


async def _call(name: str, args: dict) -> dict:
    global _allowed, _declined_until
    if not _live() and _seen and time.monotonic() - _seen < 300:
        for _ in range(80):
            await asyncio.sleep(0.25)
            if _live():
                break
    if not _live():
        if _open_window():
            for _ in range(90):
                await asyncio.sleep(0.5)
                if _live():
                    break
        if not _live():
            return _fail("formpth is not open. Start it with ./formpth boot (or open the formpth app), then retry.")
    if not _allowed:
        if time.monotonic() < _declined_until:
            return _fail("The person chose not to allow outside agents in formpth just now. Ask them to turn on Allow outside agents (Preferences > Plugins), then retry.")
        answer = await _ask("__consent__", {}, 180)
        if not (answer or {}).get("allowed"):
            _declined_until = time.monotonic() + 600
            return _fail("The person did not allow outside agents in formpth. Ask them to allow it (the question in the formpth window, or Preferences > Plugins), then retry.")
        _allowed = True
    out = await _ask(name, args, 600)
    return out if out is not None else _fail("formpth did not answer in time: it may be busy with a long task. Check the formpth window, then retry.")


@router.post("/mcp")
async def mcp(request: Request) -> Response:
    if not _local_origin(request.headers.get("origin")):
        return Response(status_code=403, content=json.dumps(_err(None, -32600, "Origin not allowed")), media_type="application/json")
    try:
        msg = json.loads(await request.body())
    except ValueError:
        return Response(content=json.dumps(_err(None, -32700, "Parse error")), media_type="application/json", status_code=400)
    if isinstance(msg, list):
        return Response(content=json.dumps(_err(None, -32600, "Batches are not supported")), media_type="application/json", status_code=400)
    req_id, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
    if req_id is None:
        return Response(status_code=202)
    meta = params.get("_meta") or {}
    version = meta.get("io.modelcontextprotocol/protocolVersion") or request.headers.get("mcp-protocol-version") or "2025-11-25"
    modern = version == "2026-07-28"
    server = {"name": "formpth", "version": __version__}
    if version not in VERSIONS and method != "initialize":
        out = _err(req_id, -32602, f"Unsupported protocol version {version}; supported: {', '.join(VERSIONS)}")
    elif method == "server/discover":
        out = _ok(req_id, {"supportedVersions": VERSIONS, "capabilities": {"tools": {}, "prompts": {}}, "_meta": {"io.modelcontextprotocol/serverInfo": server}, "instructions": INSTRUCTIONS}, True)
    elif method == "initialize":
        asked = params.get("protocolVersion")
        out = _ok(req_id, {"protocolVersion": asked if asked in VERSIONS else "2025-11-25", "capabilities": {"tools": {}, "prompts": {}}, "serverInfo": server, "instructions": INSTRUCTIONS}, False)
    elif method == "ping":
        out = _ok(req_id, {}, modern)
    elif method == "prompts/list":
        out = _ok(req_id, {"prompts": PROMPTS}, modern)
    elif method == "prompts/get":
        out = _ok(req_id, {"description": PROMPTS[0]["description"], "messages": [{"role": "user", "content": {"type": "text", "text": STRATEGY}}]}, modern) if params.get("name") == "draw_strategy" else _err(req_id, -32602, f"No prompt named {params.get('name')}")
    elif method == "tools/list":
        out = _ok(req_id, {"tools": TOOLS}, modern)
    elif method == "tools/call":
        name, args = params.get("name"), params.get("arguments") or {}
        out = _ok(req_id, await _run(name, args), modern) if name in NAMES and isinstance(args, dict) else _err(req_id, -32602, f"No tool named {name}")
    else:
        out = _err(req_id, -32601, f"Method not found: {method}")
    return Response(content=json.dumps(out), media_type="application/json")


@router.get("/api/mcp/bridge/next")
async def bridge_next(request: Request) -> Response:
    global _seen, _allowed, _declined_until
    allowed = request.query_params.get("allowed", "1") != "0"
    if allowed and not _allowed:
        _declined_until = 0.0
    _allowed = allowed
    deadline = time.monotonic() + 20
    eligible = lambda it: allowed or it.get("name") == "__consent__"
    while time.monotonic() < deadline:
        _seen = time.monotonic()
        if await request.is_disconnected():
            return Response(status_code=204)
        if not any(eligible(it) for it in _pending):
            _event().clear()
            try:
                await asyncio.wait_for(_event().wait(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
        found = next((it for it in _pending if eligible(it)), None)
        if found is None:
            continue
        _pending.remove(found)
        if await request.is_disconnected():
            _put(found, front=True)
            return Response(status_code=204)
        return Response(content=json.dumps(found), media_type="application/json")
    return Response(status_code=204)


@router.post("/api/mcp/bridge/result")
async def bridge_result(request: Request) -> dict:
    body = await request.json()
    fut = _waiting.get(str(body.get("id")))
    if fut and not fut.done():
        fut.set_result(body.get("result") or {"content": [{"type": "text", "text": "formpth gave no result."}], "isError": True})
    return {"ok": True}


@router.post("/api/mcp/bridge/stop")
async def bridge_stop() -> dict:
    global _allowed, _declined_until
    _allowed = False
    _declined_until = time.monotonic() + 600
    while _pending:
        item = _pending.popleft()
        fut = _waiting.get(item["id"])
        if fut and not fut.done():
            fut.set_result(_fail("Outside agents were turned off in formpth. Ask the person to turn on Allow outside agents (Preferences > Plugins), then retry."))
    return {"ok": True}


@router.get("/api/mcp/status")
def status(request: Request) -> dict:
    return {"live": _live(), "allowed": _allowed, "endpoint": f"http://127.0.0.1:{request.url.port or config.port()}/mcp", "tools": len(TOOLS)}
