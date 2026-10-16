import asyncio
import base64
import collections
import contextvars
import itertools
import json
import os
import secrets
import time
import urllib.parse
from pathlib import Path

from fastapi import APIRouter, Request, Response

from app import __version__
from app.core import config
from app.services import claude_code

_inapp: contextvars.ContextVar[bool] = contextvars.ContextVar("formpth_inapp", default=False)

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
7. Arrange: group, arrange (stacking order), align (to the selection, the artboard or a key object), transform (move, rotate, scale, reflect, shear, with copy and each), add_layer, move_to_layer and layer_action (duplicate, merge, flatten, release to layers, reverse order, collect).
8. Live looks: apply_effect adds an editable effect (warp.arc, distort.roughen, stylize.drop_shadow, the Effect Gallery's gallery.watercolor and the rest; call it with list true for the catalogue); three_d extrudes, revolves, inflates or turns art in 3D with materials and lighting; make_blend, envelope, repeat, symbol and apply_brush make live objects; expand bakes any of them into plain paths.
9. Deliver: save_project writes a .fpth that keeps everything editable; export_file writes SVG, PDF, EPS, DXF, DWG, PNG, GIF, BMP, PSD, TIFF, JPEG or WebP of an artboard, the whole document or the selection. Paths are absolute and the folder must exist.
10. Mistakes: undo steps back one change at a time. If a tool fails, its message says what to do next: follow it and retry.
"""
PROMPTS = [{"name": "draw_strategy", "title": "How to draw in formpth", "description": "The decision tree for formpth's tools: looking, planning in points, shapes and curves, paint, Pathfinder, type, arranging, live effects and delivery.", "arguments": []}]


def _tool(name: str, description: str, props: dict, required: list[str] | None = None, **hints: bool) -> dict:
    return {"name": name, "description": description, "inputSchema": {"type": "object", "properties": props, "required": required or [], "additionalProperties": False},
            "annotations": {"readOnlyHint": hints.get("read", False), "destructiveHint": hints.get("destructive", False), "idempotentHint": hints.get("idempotent", False), "openWorldHint": hints.get("open", False)}}


_ID = {"type": "string", "description": "An object id from get_document."}
_IDS = {"type": "array", "items": {"type": "string"}, "description": "Object ids from get_document; the selection when left out."}
_NUM = {"type": "number"}
_COLOR = {"type": ["string", "object"], "description": "A colour (#rrggbb, rgb(r,g,b), cmyk(c,m,y,k) in percent, gray(k), a swatch name), none, or a gradient {type: linear|radial, angle, method: classic|perceptual, stops: [{offset 0..1, color, opacity}]}. method is the Gradient panel's Method: classic (the default) mixes each stop pair in the colour's own space, perceptual mixes in OKLab for smoother, more natural transitions (exports to SVG, PDF, EPS and .ai approximate it with extra stops)."}
_FILL = {"type": ["string", "object"], "description": _COLOR["description"] + " Or a freeform gradient {type: freeform, mode: points|lines, points: [{x, y, color, spread}]} with x, y and spread as fractions 0..1 of each object's bounds (absolute true for document points), or {type: freeform, colors: [...]} to place the points automatically."}
_BLEND = {"type": "string", "enum": ["normal", "darken", "multiply", "color_burn", "lighten", "screen", "color_dodge", "overlay", "soft_light", "hard_light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"]}
_SHAPES = ["rectangle", "rounded_rectangle", "ellipse", "polygon", "star", "line", "arc", "spiral", "flare", "rectangular_grid", "polar_grid"]
_PF = ["unite", "minus_front", "intersect", "exclude", "divide", "trim", "merge", "crop", "outline", "minus_back"]
_GEN_DETAIL = {"type": ["string", "integer"], "minimum": 1, "maximum": 10, "default": "medium", "description": "Detail 1 (minimal) to 10 (richly detailed), or low (3), medium (5), high (8). It sets the prompt and hard limits on element count, gradients, strokes and compound shapes: elements beyond the limit are dropped smallest first, extra gradients become solid colours."}
_GEN = {
    "style_preset": {"type": "string", "enum": ["flat", "line_art", "isometric", "hand_drawn", "gradient", "retro", "minimal"], "description": "A style preset sent to the model as drawing rules; flat, isometric, retro and minimal allow no gradients, line_art allows strokes only."},
    "style_reference": {"type": "string", "description": "The id of artwork (a path, group or several via a group) or a placed image whose look the result should match. Artwork gives its palette, stroke widths, corner style, gradient use and a reduced SVG outline of its structure; an image gives a palette and tonal summary read from its pixels, and is also sent to the model when the model is marked as reading images."},
    "effects": {"type": "array", "items": {"type": "string", "enum": ["halftone", "grain", "glow", "shadow"]}, "maxItems": 4, "description": "Live effects added to the result as editable appearance effects."},
    "color_tone": {"type": "string", "enum": ["pastel", "vibrant", "monochrome", "black_and_white", "warm", "cool", "earth", "forest", "ocean", "reference"], "description": "A colour and tone preset. After generation every colour (fills, strokes, gradient stops) is remapped into the preset's palette by the Recolor engine, so the result honours it even if the model drifts. reference uses the style_reference colours."},
    "palette": {"type": "array", "items": {"type": "string"}, "maxItems": 8, "description": "A custom palette of up to 8 colours (#rrggbb and the like, for example document swatch colours); it wins over color_tone and is enforced the same way."},
}
_PATHOPS = ["offset", "outline_stroke", "simplify", "smooth", "join", "average", "reverse", "add_anchors", "remove_anchors", "divide_objects_below", "split_into_grid", "clean_up", "close", "open"]

TOOLS = [
    _tool("get_document", "The open document: name, units, colour mode, the artboards (index, name, x, y, width, height in points), the layers and every object in them bottom to top (id, name, kind, bounds, fill, stroke, opacity, visible, locked, text), the selection, the swatches, symbols, graphic styles and brushes, and the other open documents.", {"depth": {"type": "integer", "minimum": 1, "maximum": 32, "default": 8, "description": "How deep groups are listed."}}, read=True, idempotent=True),
    _tool("get_image", "The art as it looks, as a PNG image: one artboard (default the first), the whole document, or the selection, its longer side at most max_size pixels.", {"scope": {"type": "string", "enum": ["artboard", "document", "selection"], "default": "artboard"}, "artboard": {"type": "integer", "minimum": 0, "default": 0}, "max_size": {"type": "integer", "minimum": 64, "maximum": 2048, "default": 1024}, "outline": {"type": "boolean", "default": False, "description": "Outline view: paths only, no paint."}}, read=True, idempotent=True),
    _tool("get_svg", "SVG markup of an artboard, the whole document, or the given objects.", {"scope": {"type": "string", "enum": ["artboard", "document", "selection"], "default": "artboard"}, "artboard": {"type": "integer", "minimum": 0, "default": 0}, "ids": _IDS}, read=True, idempotent=True),
    _tool("get_object", "One object in full: its kind, geometry (anchors with their handles for paths), appearance stack (fills, strokes, effects), transform, text and children.", {"id": _ID}, ["id"], read=True, idempotent=True),
    _tool("new_document", "Opens a new document with one or more artboards.", {"width": {"type": "number", "minimum": 1}, "height": {"type": "number", "minimum": 1}, "units": {"type": "string", "enum": ["pt", "px", "mm", "cm", "in", "pc"], "default": "pt"},
          "name": {"type": "string", "maxLength": 120}, "color_mode": {"type": "string", "enum": ["rgb", "cmyk"], "default": "rgb"}, "artboards": {"type": "integer", "minimum": 1, "maximum": 100, "default": 1}}, ["width", "height"]),
    _tool("open_file", "Opens a file at an absolute path: a formpth project (.fpth), SVG, PDF or a PDF-compatible .ai, EPS (formpth EPS reopens fully editable; other EPS is read by running its PostScript paths), an AutoCAD DXF (ASCII, R12 to 2018), or an image (PNG, JPEG, WebP, GIF, TIFF, or a Photoshop PSD with its layers as objects) as a new document sized from the image at its resolution, or a 3D model (.obj with its .mtl and textures from the same folder, .glb or .gltf) as a new document holding an editable 3D object (see three_d). DWG (R2000, R2004, R2010, R2013 and R2018) is read by formpth itself; other DWG versions open through a DWG converter on this computer (ODA File Converter or LibreDWG dwg2dxf), and without one the call says how to get it.",
          {"path": {"type": "string"}, "units": {"type": "string", "enum": ["mm", "cm", "m", "km", "in", "ft", "yd", "mi", "pt", "px"], "description": "DXF only: what one drawing unit is; default the file's own units, else mm for metric drawings and in otherwise."},
           "drawing_scale": {"type": "number", "exclusiveMinimum": 0, "default": 1, "description": "DXF only: multiplies the drawing (0.01 opens a 1:100 plan at one hundredth size)."}, "layout": {"type": "string", "default": "Model", "description": "DXF only: Model, or the name of a paper space layout."},
           "merge_layers": {"type": "boolean", "default": False, "description": "DXF only: put every DXF layer into one layer."}, "fit_artboard": {"type": "boolean", "default": False, "description": "DXF only: scale the drawing to fit a Letter artboard instead of using its units."},
           "password": {"type": "string", "description": "PDF only: the password of an encrypted PDF. The empty user password is tried automatically; without a password the window asks for one."}}, ["path"]),
    _tool("save_project", "Saves the document as a formpth project (.fpth) at an absolute path; everything stays editable.", {"path": {"type": "string"}}, ["path"]),
    _tool("export_file", "Exports the art to an absolute path; the extension chooses the format: .svg, .pdf (every artboard a page), .ai (PDF-compatible Illustrator file, every artboard a page, reopens fully editable in formpth), .eps (Level 3 PostScript; all_artboards gives a zip of one EPS per artboard), .dxf (AutoCAD 2000 or R12, layers kept), .dwg (AutoCAD 2000 binary drawing, layers kept, written natively), .png (with colors it writes an indexed PNG-8), .jpg, .webp, .gif (2 to 256 colors, transparency with a matte, optional interlace), .bmp (24-bit or 32-bit with alpha), .psd (flattened composite plus one pixel layer per top-level layer, RGB or CMYK) or .tiff. Every raster format takes ppi (any resolution) and anti_aliasing.", {"path": {"type": "string"}, "scope": {"type": "string", "enum": ["artboard", "document", "selection", "all_artboards"], "default": "artboard"},
          "artboard": {"type": "integer", "minimum": 0, "default": 0}, "scale": {"type": "number", "minimum": 0.1, "maximum": 16, "default": 1}, "quality": {"type": "number", "minimum": 0.1, "maximum": 1, "default": 0.92}, "transparent": {"type": "boolean", "default": False}, "outline_text": {"type": "boolean", "default": False, "description": "SVG, DXF and DWG: type as outlines (DXF and DWG write TEXT otherwise)."}, "live_text": {"type": "boolean", "default": True, "description": "PDF only: write type as selectable, searchable text with the fonts embedded (default). Type with gradients, effects, 3D or an unavailable font is outlined either way; false outlines all type."},
          "pdf_standard": {"type": "string", "enum": ["none", "x1a", "x3", "x4", "a2b"], "default": "none", "description": "PDF only: x4 writes PDF/X-4 with the document CMYK profile (set_color_settings) as the output intent, XMP metadata and a document ID, and leaves out formpth editing data. x1a writes PDF/X-1a:2001 (version 1.3, CMYK and spot colours only, transparency flattened into pictures) and x3 writes PDF/X-3:2002 (version 1.3, flattened, RGB stays tagged); both fail with a message naming what could not be flattened. a2b writes PDF/A-2b (sRGB output intent, fonts embedded, XMP identification). The standards cannot be combined with passwords or permissions, and x1a and x3 cannot have layers."},
          "pdf_layers": {"type": "boolean", "default": False, "description": "PDF only: Create Acrobat Layers from Top-Level Layers. Each layer becomes an optional content group in the Layers panel (hidden layers start off); needs pdf_standard none, x4 or a2b."},
          "open_password": {"type": "string", "description": "PDF only: password asked when the file is opened (AES-256, revision 6). Cannot be combined with a PDF/X or PDF/A standard."},
          "permissions_password": {"type": "string", "description": "PDF only: password that unlocks the permissions; required when permissions restricts anything. The file also opens with it."},
          "permissions": {"type": "object", "description": "PDF only: what a reader may do, applied with permissions_password. Defaults allow everything.", "properties": {"printing": {"type": "string", "enum": ["none", "low", "high"], "default": "high"}, "changes": {"type": "string", "enum": ["none", "insert", "fill", "comment", "any"], "default": "any", "description": "insert: page assembly; fill: form fields and signing; comment: annotations plus form fields; any: everything except extracting pages."}, "copy": {"type": "boolean", "default": True}, "accessibility": {"type": "boolean", "default": True}}},
          "image_compression": {"type": "string", "enum": ["auto", "zip", "jpeg"], "default": "auto", "description": "PDF only: auto keeps JPEG pictures as they are and writes the rest with ZIP (Flate); zip is lossless for all; jpeg recompresses every picture with jpeg_quality."},
          "jpeg_quality": {"type": "number", "minimum": 0.05, "maximum": 1, "default": 0.8, "description": "PDF only: JPEG quality when image_compression is jpeg."},
          "downsample_ppi": {"type": "number", "minimum": 0, "default": 0, "description": "PDF only: resample pictures to this many pixels per inch; 0 keeps them as they are."},
          "downsample_above_ppi": {"type": "number", "minimum": 0, "default": 0, "description": "PDF only: only pictures above this resolution are resampled; 0 means 1.5 times downsample_ppi."},
          "compress_line_art": {"type": "boolean", "default": True, "description": "PDF only: Flate-compress page content and line art; false writes it readable."},
          "color": {"type": "string", "enum": ["rgb", "cmyk"], "description": "EPS only: colour model; default the document's colour mode."}, "dxf_version": {"type": "string", "enum": ["2000", "R12"], "default": "2000", "description": "DXF only: 2000 writes splines, solid hatches for fills, true colours and lineweights; R12 writes polylines with arcs."},
          "units": {"type": "string", "enum": ["mm", "cm", "m", "km", "in", "ft", "yd", "mi", "pt", "px"], "default": "mm", "description": "DXF and DWG only: the drawing units."}, "drawing_scale": {"type": "number", "exclusiveMinimum": 0, "default": 1, "description": "DXF and DWG only: drawing units per unit of art (100 writes a 1:100 drawing at full size)."},
          "scale_lineweights": {"type": "boolean", "default": False, "description": "DXF and DWG only: scale lineweights with drawing_scale."},
          "ppi": {"type": "number", "minimum": 1, "maximum": 2400, "description": "Raster formats: resolution in pixels per inch (72 ppi is 1 pixel per point); takes the place of scale. 300 makes an artboard 4.17 times as wide in pixels as in points."},
          "anti_aliasing": {"type": "string", "enum": ["art", "none", "type"], "default": "art", "description": "Raster formats: art smooths shape edges (default); none draws hard edges only, no smoothing; type also sharpens plain type."},
          "colors": {"type": "integer", "minimum": 2, "maximum": 256, "description": "Palette size, 2 to 256. Given with a .png path it writes an indexed PNG-8; .gif always uses it (default 256). One entry is the transparent color when transparent is true."},
          "palette": {"type": "string", "enum": ["perceptual", "selective", "adaptive"], "default": "perceptual", "description": "GIF and PNG-8: how the palette is chosen. selective favors broad areas and Web-safe colors, perceptual the colors the eye is most sensitive to, adaptive the most frequent ones."},
          "dither": {"type": "string", "enum": ["diffusion", "none"], "default": "diffusion", "description": "GIF and PNG-8: error-diffusion dither, used only when the art has more colors than the palette."},
          "dither_amount": {"type": "number", "minimum": 0, "maximum": 100, "default": 88, "description": "GIF and PNG-8: dither strength in percent."},
          "matte": {"type": "string", "description": "GIF and PNG-8: hex color (such as #ffffff, the default) that partly transparent edge pixels blend into; it also fills the background when transparent is false."},
          "interlaced": {"type": "boolean", "default": False, "description": "GIF only: write the rows interlaced."},
          "bmp_bits": {"type": "integer", "enum": [24, 32], "default": 24, "description": "BMP only: 24 writes RGB, 32 writes RGBA (alpha when transparent is true)."},
          "psd_layers": {"type": "boolean", "default": True, "description": "PSD only: write one pixel layer per top-level layer (name, visibility and opacity kept) under the flattened composite; false writes the composite only. The color parameter (rgb or cmyk) chooses 8-bit RGB or CMYK."}}, ["path"]),
    _tool("switch_document", "Makes another open document the active one, by its index or name from get_document.", {"index": {"type": "integer", "minimum": 0}, "name": {"type": "string"}}),
    _tool("place_image", "Places an image file (absolute path: PNG, JPEG, WebP, GIF, or SVG, EPS and DXF as editable vector groups) into the document at x, y, embedded; width scales it in proportion. A 3D model (.obj, with the .mtl and texture images beside it, .glb or .gltf) is placed as a live 3D object, width points across, that three_d turns, lights and ray traces and that exports to SVG and PDF as vector faces. A PDF or an Illustrator file (.pdf, .ai) places one page (page, 1-based, default 1) cropped to the crop box (bounding, art, crop, trim, bleed or media; default bounding, the bounds of the page's art): embedded it becomes an editable group of paths, type and images, width points across; with link true it stays a linked high-resolution picture of the page, not vector. A Photoshop file (.psd) places flattened (psd_import flatten) or with each pixel layer as an image object in groups (psd_import objects, the default, with names, opacity, visibility and blend modes); a TIFF (.tif, .tiff; page picks one of several) is placed at its resolution. With link true (raster images, PDF, AI, PSD and TIFF) the image stays linked to its file: formpth reads it again when it changes (see the links tool).", {"path": {"type": "string"}, "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 1}, "link": {"type": "boolean", "default": False}, "page": {"type": "integer", "minimum": 1, "description": "PDF, AI or TIFF page, 1-based."}, "crop": {"type": "string", "enum": ["bounding", "art", "crop", "trim", "bleed", "media"], "description": "PDF or AI Crop To box; default bounding."}, "psd_import": {"type": "string", "enum": ["objects", "flatten"], "description": "PSD: layers as objects (default) or one flattened image."}}, ["path"]),
    _tool("links", "Placed images and their files, as in the Links panel. list gives every placed image with its state (linked, modified when the file changed on disk, missing, embedded) and path. relink points the image in id at another file (path; all true relinks every image sharing its link); relink_folder relinks every missing link to the file of the same name in folder; update reads a modified file again (id, or all true); embed copies a linked image into the document; unembed writes an embedded image to a file next to the project and links it.", {
          "action": {"type": "string", "enum": ["list", "relink", "relink_folder", "update", "embed", "unembed"], "default": "list"}, "id": {"type": "string", "description": "A placed image."}, "path": {"type": "string", "description": "Absolute path of an image file (relink)."},
          "folder": {"type": "string", "description": "Absolute folder path (relink_folder)."}, "all": {"type": "boolean", "default": False}}),
    _tool("document_setup", "Changes the document: its units, colour mode (rgb or cmyk) and title.", {"units": {"type": "string", "enum": ["pt", "px", "mm", "cm", "in", "pc"]}, "color_mode": {"type": "string", "enum": ["rgb", "cmyk"]}, "title": {"type": "string", "maxLength": 120}}),
    _tool("select", "Changes the selection: these ids, everything, nothing, the inverse, or every object touching a rectangle; mode combines with the current selection.", {"ids": _IDS, "all": {"type": "boolean"}, "none": {"type": "boolean"}, "inverse": {"type": "boolean"},
          "rect": {"type": "object", "properties": {"x": _NUM, "y": _NUM, "width": _NUM, "height": _NUM}, "required": ["x", "y", "width", "height"]}, "mode": {"type": "string", "enum": ["replace", "add", "subtract", "toggle"], "default": "replace"}}),
    _tool("select_same", "Selects every object sharing an attribute with the given object (or the first selected one).", {"attribute": {"type": "string", "enum": ["fill_color", "stroke_color", "stroke_weight", "fill_and_stroke", "opacity", "blending_mode", "appearance", "graphic_style", "shape", "font_family", "font_size", "symbol_instance"]}, "id": _ID}, ["attribute"]),
    _tool("select_similar", "The Magic Wand: selects every object whose chosen attributes are within tolerance of the given object (or the first selected one). Give a tolerance to use an attribute: fill and stroke colour 0..255 per RGB channel, stroke weight in points, opacity in percent; blend true also requires the same blending mode.", {"id": _ID, "fill_tolerance": {"type": "number", "minimum": 0, "maximum": 255}, "stroke_tolerance": {"type": "number", "minimum": 0, "maximum": 255},
          "weight_tolerance": {"type": "number", "minimum": 0, "maximum": 1000}, "opacity_tolerance": {"type": "number", "minimum": 0, "maximum": 100}, "blend": {"type": "boolean", "default": False}, "mode": {"type": "string", "enum": ["replace", "add", "subtract"], "default": "replace"}}),
    _tool("draw_path", "Draws a path from an SVG path d string (M, L, H, V, C, S, Q, T, A, Z, absolute or relative), or from points (each [x, y]) joined by straight lines or, with smooth true, by a fitted curve.", {"d": {"type": "string"}, "points": {"type": "array", "items": {"type": "array", "items": _NUM, "minItems": 2, "maxItems": 2}},
          "smooth": {"type": "boolean", "default": False}, "closed": {"type": "boolean", "default": False}, "fill": _COLOR, "stroke": _COLOR, "stroke_width": {"type": "number", "minimum": 0}, "name": {"type": "string"}, "layer": {"type": "string", "description": "A layer id; the active layer when left out."}}),
    _tool("draw_shape", "Draws a live shape: x and y are the top-left of its bounds (for line and arc the start point, with x2 and y2 the end). Shapes keep their kind, so corners, sides and points can change later.", {"shape": {"type": "string", "enum": _SHAPES}, "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 0}, "height": {"type": "number", "minimum": 0}, "x2": _NUM, "y2": _NUM,
          "corner_radius": {"type": "number", "minimum": 0}, "sides": {"type": "integer", "minimum": 3, "maximum": 1000}, "points": {"type": "integer", "minimum": 3, "maximum": 1000}, "inner_ratio": {"type": "number", "minimum": 0.01, "maximum": 1, "description": "A star's inner radius over its outer radius."},
          "turns": {"type": "number", "minimum": 0.5, "maximum": 100}, "rows": {"type": "integer", "minimum": 0, "maximum": 200}, "columns": {"type": "integer", "minimum": 0, "maximum": 200}, "rotation": _NUM, "fill": _COLOR, "stroke": _COLOR, "stroke_width": {"type": "number", "minimum": 0}, "name": {"type": "string"}, "layer": {"type": "string"}}, ["shape", "x", "y"]),
    _tool("edit_shape", "Changes a live shape after drawing, keeping its kind: a rectangle's width, height, corner radius (all, or radii top-left, top-right, bottom-right, bottom-left) and corner type; an ellipse's width, height and pie angles (degrees counter-clockwise from three o'clock); a polygon's radius, sides, corner radius and corner type; a star's points, outer and inner radius, corner radius and corner type (one radius and type for every corner, kept live); a line's length and angle. convert_to turns a live shape into another live kind (rectangle, rounded_rectangle, ellipse, polygon with 6 sides, star with 5 points) keeping its bounds and paint, in one undo step, and other fields in the same call apply after the conversion. get_object shows a shape's current values.",{"ids": _IDS, "width": {"type": "number", "minimum": 0.01}, "height": {"type": "number", "minimum": 0.01},
          "corner_radius": {"type": "number", "minimum": 0}, "radii": {"type": "array", "items": {"type": "number", "minimum": 0}, "minItems": 4, "maxItems": 4}, "corner_type": {"type": "string", "enum": ["round", "inverted", "chamfer"]}, "pie_start": _NUM, "pie_end": _NUM,
          "radius": {"type": "number", "minimum": 0.01}, "sides": {"type": "integer", "minimum": 3, "maximum": 1000}, "points": {"type": "integer", "minimum": 3, "maximum": 1000}, "outer_radius": {"type": "number", "minimum": 0.01}, "inner_radius": {"type": "number", "minimum": 0.01}, "length": {"type": "number", "minimum": 0.01}, "angle": _NUM,
          "convert_to": {"type": "string", "enum": ["rectangle", "rounded_rectangle", "ellipse", "polygon", "star"]}}),
    _tool("add_text", "Adds type: point type at x, y (the first baseline), area type filling a width by height frame, or type on the path given by path_id. The type is black unless color is given.", {"text": {"type": "string", "maxLength": 20000}, "x": _NUM, "y": _NUM, "mode": {"type": "string", "enum": ["point", "area", "path"], "default": "point"}, "width": {"type": "number", "minimum": 1}, "height": {"type": "number", "minimum": 1},
          "path_id": _ID, "font": {"type": "string", "description": "A font family, such as Inter."}, "style": {"type": "string", "description": "Regular, Bold, Italic, Bold Italic, or a weight such as 600."}, "size": {"type": "number", "minimum": 0.1, "maximum": 1296, "default": 24}, "color": _COLOR,
          "align": {"type": "string", "enum": ["left", "center", "right", "justify"], "default": "left"}, "leading": {"type": "number", "minimum": 0}, "tracking": {"type": "number", "description": "In thousandths of an em."}, "name": {"type": "string"}, "layer": {"type": "string"},
          "orientation": {"type": "string", "enum": ["horizontal", "vertical"], "default": "horizontal", "description": "vertical sets characters top to bottom in columns that advance right to left; CJK stands upright and Latin turns 90 degrees clockwise. For vertical point type, x, y is the top of the first column's centre line."}}, ["text", "x", "y"]),
    _tool("edit_anchors", "Edits a path's anchor points: move some by dx, dy; replace them all; insert one at a position along a segment; delete some; or convert some to smooth or corner points. Indices count anchors across subpaths in order.", {"id": _ID, "action": {"type": "string", "enum": ["move", "replace", "insert", "delete", "smooth", "corner"]},
          "indices": {"type": "array", "items": {"type": "integer", "minimum": 0}}, "dx": _NUM, "dy": _NUM, "segment": {"type": "integer", "minimum": 0}, "t": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.5},
          "anchors": {"type": "array", "items": {"type": "object", "properties": {"x": _NUM, "y": _NUM, "in": {"type": "array", "items": _NUM}, "out": {"type": "array", "items": _NUM}}, "required": ["x", "y"]}, "description": "For replace: the new anchors, in and out handles absolute."}, "closed": {"type": "boolean"}}, ["id", "action"]),
    _tool("set_paint", "Sets the fill and or stroke of the objects (their first fill and first stroke): a colour, none, a swatch name or a gradient; a fill can also be a freeform gradient. Without ids it also sets the paint new art gets. overprint_fill and overprint_stroke mark the first fill or stroke to overprint (previewed with Overprint Preview, written to PDF).", {"ids": _IDS, "fill": _FILL, "stroke": _COLOR, "overprint_fill": {"type": "boolean"}, "overprint_stroke": {"type": "boolean"}}),
    _tool("set_stroke", "Sets stroke attributes of the objects' first stroke: weight, caps, joins, miter limit, alignment, dashes, arrowheads, width profile (a preset, a saved custom_profile, or explicit width_points with separate left and right widths; flip_along and flip_across mirror it; save_profile_as keeps it) and how a gradient runs on it.", {"ids": _IDS, "width": {"type": "number", "minimum": 0}, "cap": {"type": "string", "enum": ["butt", "round", "square"]}, "join": {"type": "string", "enum": ["miter", "round", "bevel"]}, "miter_limit": {"type": "number", "minimum": 1, "maximum": 500},
          "align": {"type": "string", "enum": ["center", "inside", "outside"]}, "dash": {"type": "array", "items": {"type": "number", "minimum": 0}, "maxItems": 6, "description": "Dash and gap lengths; empty for a solid stroke."}, "dash_offset": _NUM, "dash_align_corners": {"type": "boolean"},
          "start_arrow": {"type": "string", "description": "none, triangle, triangle_open, arrow, arrow_open, circle, circle_open, square, square_open, diamond, bar, barbed, half_arrow, feather, tail."}, "end_arrow": {"type": "string"}, "arrow_scale": {"type": "number", "minimum": 0.1, "maximum": 10},
          "profile": {"type": "string", "enum": ["uniform", "lens", "taper_start", "taper_end", "taper_both", "pinch", "teardrop", "wave"]},
          "custom_profile": {"type": "string", "description": "The name of a width profile saved with save_profile_as or Add to Profiles in the Stroke panel."},
          "width_points": {"type": "array", "maxItems": 64, "items": {"type": "object", "properties": {"offset": {"type": "number", "minimum": 0, "maximum": 1, "description": "Position along the path by length, 0 start to 1 end."}, "left": {"type": "number", "minimum": 0, "description": "Side 1 width as a multiple of half the stroke weight (1 is the plain width)."}, "right": {"type": "number", "minimum": 0, "description": "Side 2 width, same unit; leave out for a symmetric point."}}, "required": ["offset", "left"]}, "description": "Explicit width points replacing the profile, like the Width tool makes: unequal left and right give an asymmetric width, and two points at the same offset make a discontinuous width point (a step)."},
          "flip_along": {"type": "boolean", "description": "Mirror the width profile from end to end (Flip Along); applied after profile or width_points."}, "flip_across": {"type": "boolean", "description": "Swap the two sides of the width profile (Flip Across)."},
          "save_profile_as": {"type": "string", "maxLength": 60, "description": "Save the stroke's width points as a custom profile with this name (kept in the app's preferences); apply it later with custom_profile."},
          "gradient_mode": {"type": "string", "enum": ["within", "along", "across"], "description": "For a linear or radial gradient stroke (set it with set_paint first): within paints the gradient over the object's box, along runs it from the path's start to its end following every curve and corner, across runs it from one edge of the stroke to the other."}}),
    _tool("set_appearance", "Edits the appearance stack: object opacity and blend mode, an added fill or stroke on top, every item replaced, cleared, or reduced to one fill and one stroke. Groups and layers (pass a layer id) have their own stack: their fills and strokes draw over their contents.",{"ids": _IDS, "opacity": {"type": "number", "minimum": 0, "maximum": 1}, "blend_mode": _BLEND, "add_fill": _COLOR,
          "add_stroke": {"type": "object", "properties": {"color": _COLOR, "width": {"type": "number", "minimum": 0}}}, "items": {"type": "array", "items": {"type": "object"}, "description": "The whole stack bottom to top: {kind: fill|stroke, color, width, opacity, blend_mode, visible, dash, cap, join, align}."},
          "clear": {"type": "boolean"}, "reduce_to_basic": {"type": "boolean"}}),
    _tool("add_swatch", "Adds a swatch to the document: a colour or gradient, optionally global (editing it recolours every use) or spot (its own plate: PDF writes it as a Separation colour space), into a colour group; or a tint of a global or spot swatch with tint_of and tint.", {"name": {"type": "string", "maxLength": 120}, "color": _COLOR, "global": {"type": "boolean", "default": False}, "spot": {"type": "boolean", "default": False}, "group": {"type": "string"},
          "tint_of": {"type": "string", "description": "The name of a global or spot swatch; makes a tint swatch of it (color is then not needed)."}, "tint": {"type": "number", "minimum": 0, "maximum": 100, "default": 50, "description": "Tint percent for tint_of."}}, ["name"]),
    _tool("swatch_library", "Swatch libraries, as Window > Swatch Libraries: list the built-in libraries (colour themes, skin tones, earth tones, metals, web, grayscale, gradients, patterns, seasons, spot inks) and the person's saved ones with their groups; or load a library (or one of its groups, or some swatches by name) into the document's Swatches panel, keeping its colour groups, and optionally fill objects with one of them.", {"action": {"type": "string", "enum": ["list", "load"], "default": "list"},
          "library": {"type": "string", "description": "Library id or name from list."}, "group": {"type": "string", "description": "Load only this colour group of the library."}, "names": {"type": "array", "items": {"type": "string"}, "description": "Load only these swatches."}, "apply_to": {**_IDS, "description": "Fill these objects with the first loaded swatch."}}),
    _tool("swatch_group", "Colour groups in the Swatches panel: list them with their swatches; make one from swatch names or ids (or from colours, which become new swatches); move swatches into a group (or out with group none); rename, ungroup (keeps the swatches) or delete a group with its swatches.", {"action": {"type": "string", "enum": ["list", "make", "move", "rename", "ungroup", "delete"], "default": "list"},
          "name": {"type": "string", "maxLength": 120, "description": "The group's name (make, rename, ungroup, delete); the target group for move (none to take swatches out of their group)."}, "swatches": {"type": "array", "items": {"type": "string"}, "description": "Swatch names or ids (make, move)."}, "colors": {"type": "array", "items": {"type": "string"}, "description": "Colours that become new swatches in the group (make)."}, "new_name": {"type": "string", "maxLength": 120}}),
    _tool("color_harmony", "The Color Guide: five colours in a harmony rule around a base colour, with tints and shades, warm and cool, or vivid and muted variations of each; optionally saved to the swatches as a group.", {"color": {"type": "string", "description": "The base colour, #rrggbb; the current fill colour when left out."},
          "rule": {"type": "string", "enum": ["complementary", "split_complementary", "left_complement", "right_complement", "analogous", "monochromatic", "shades", "triad", "tetrad", "compound", "high_contrast", "pentagram"], "default": "complementary"},
          "variation": {"type": "string", "enum": ["none", "tints_shades", "warm_cool", "vivid_muted"], "default": "none"}, "save_group": {"type": "string", "maxLength": 120, "description": "Save the five colours as a swatch group with this name."}}),
    _tool("graphic_style", "Graphic styles: create one from an object's appearance (the object stays linked to it), apply one to objects, list them, delete one, redefine one from an object's appearance (every object still linked to it follows), break the link between objects and their style, list the built-in style libraries, or load a library into the document. apply with library adds that library style to the document and applies it.",
          {"action": {"type": "string", "enum": ["create", "apply", "list", "delete", "redefine", "break_link", "libraries", "load_library"]}, "name": {"type": "string", "description": "A style name (create, apply, delete, redefine)."}, "id": _ID, "ids": _IDS,
           "library": {"type": "string", "description": "A style library: shadows, buttons, outlines, textures or scribbles (or its full name)."}}, ["action"]),
    _tool("set_object", "Changes objects' names, visibility, lock, opacity or blend mode, and the Transparency panel's group options: isolate blending, knockout group and whether opacity and mask define the knockout shape.", {"ids": _IDS, "name": {"type": "string", "maxLength": 200}, "visible": {"type": "boolean"}, "locked": {"type": "boolean"}, "opacity": {"type": "number", "minimum": 0, "maximum": 1}, "blend_mode": _BLEND,
          "isolate": {"type": "boolean", "description": "Isolate Blending: blend modes inside the group blend only with the group's own objects."},
          "knockout": {"type": "string", "enum": ["on", "off", "inherit"], "description": "Knockout Group: on makes each object in the group composite against what is under the group instead of against the objects below it in the group, so a see-through object hides them where it overlaps; inherit takes the setting of the enclosing group."},
          "knockout_shape": {"type": "boolean", "description": "Opacity and Mask Define Knockout Shape, set on an object inside a knockout group: it knocks out only as much as it is opaque, so a 50 percent object leaves half of what is under it."}}),
    _tool("arrange", "Changes the stacking order of the objects within their layer or group.", {"ids": _IDS, "order": {"type": "string", "enum": ["bring_to_front", "bring_forward", "send_backward", "send_to_back"]}}, ["order"]),
    _tool("group", "Groups the objects, or ungroups the groups among them.", {"ids": _IDS, "action": {"type": "string", "enum": ["group", "ungroup"], "default": "group"}}),
    _tool("compound_path", "Makes the paths one compound path (overlaps become holes by the fill rule), or releases compound paths.", {"ids": _IDS, "action": {"type": "string", "enum": ["make", "release"], "default": "make"}, "rule": {"type": "string", "enum": ["nonzero", "evenodd"]}}),
    _tool("attributes", "The Attributes panel: sets the fill rule of paths and compound paths, reverses their path direction, or sets the note kept with objects. nonzero (the default) fills every enclosed area except where a subpath runs the opposite way; evenodd makes every other nested or overlapping area a hole, whatever the direction. Groups pass the fill rule to the paths inside. Answers with each object's fill rule and note.",
          {"ids": _IDS, "fill_rule": {"type": "string", "enum": ["nonzero", "evenodd"]}, "reverse": {"type": "boolean", "description": "Reverse the direction of every subpath of the objects; under nonzero this turns a hole into a filled area or back. Pass the id of one path inside a compound path to reverse only that one."},
           "note": {"type": "string", "maxLength": 4000, "description": "Replaces the objects' note; an empty string removes it."}}),
    _tool("clipping_mask", "Clips the objects with the topmost one among them, or releases clipping groups.", {"ids": _IDS, "action": {"type": "string", "enum": ["make", "release"], "default": "make"}}),
    _tool("opacity_mask", "Opacity masks, as in the Transparency panel: make uses the topmost of the objects as the mask of the others (light areas show, dark areas hide), release puts the mask art back as an ordinary object, options changes a mask's clip, invert, disabled and linked settings. New masks take clip and invert from the arguments, else from the New Opacity Masks Are Clipping and Inverted settings.",
          {"ids": _IDS, "action": {"type": "string", "enum": ["make", "release", "options"], "default": "make"}, "clip": {"type": "boolean", "description": "Hide the art outside the mask object."}, "invert": {"type": "boolean", "description": "Swap light and dark in the mask."},
           "disabled": {"type": "boolean", "description": "Turn the mask off without removing it."}, "linked": {"type": "boolean", "description": "The mask moves, scales and rotates with the art; false leaves it in place."}}),
    _tool("delete_objects", "Deletes the objects.", {"ids": _IDS}, destructive=True),
    _tool("duplicate_objects", "Duplicates the objects, offset by dx, dy; the copies become the selection.", {"ids": _IDS, "dx": {"type": "number", "default": 0}, "dy": {"type": "number", "default": 0}}),
    _tool("add_layer", "Adds a layer at the top (or above another layer) and makes it active.", {"name": {"type": "string", "maxLength": 120}, "above": {"type": "string", "description": "A layer id."}, "sublayer_of": {"type": "string", "description": "A layer id to nest the new layer in."}}),
    _tool("set_layer", "Changes a layer: name, visibility, lock, whether it prints, template, and whether it is the active layer new art goes on.", {"id": _ID, "name": {"type": "string", "maxLength": 120}, "visible": {"type": "boolean"}, "locked": {"type": "boolean"}, "printable": {"type": "boolean"}, "template": {"type": "boolean"}, "active": {"type": "boolean"}}, ["id"]),
    _tool("delete_layer", "Deletes a layer and everything on it.", {"id": _ID}, ["id"], destructive=True),
    _tool("move_to_layer", "Moves the objects to the top of a layer.", {"ids": _IDS, "layer": {"type": "string", "description": "A layer id."}}, ["layer"]),
    _tool("layer_action", "Layers panel menu commands, each one undo step. duplicate: deep copies of the layers (and their sublayers and objects, all with new ids) named '<name> copy' directly above each original. merge: the layers (two or more) merge into the topmost of them, objects keep their stacking order, the others are removed. flatten: every visible layer merges into one (the layer in id, else the active layer); hidden layers and hidden art are discarded when discard_hidden is true and kept when false. release_sequence: each child of the layer or group in id becomes the only content of its own new sublayer. release_build: like sequence but the sublayers accumulate (the first holds object 1, the next objects 1 and 2, and so on). reverse_order: reverses the stacking of the layers in ids, or of the objects in ids that share a parent. collect: moves the objects in ids into a new layer on top. Returns the ids of the layers made or kept; call get_document to see the result.",
          {"action": {"type": "string", "enum": ["duplicate", "merge", "flatten", "release_sequence", "release_build", "reverse_order", "collect"]},
           "ids": {"type": "array", "items": {"type": "string"}, "description": "Layer ids (duplicate, merge, reverse_order) or object ids (reverse_order, collect). Left out: the layers selected in the Layers panel, else the active layer or the selected objects."},
           "id": {"type": "string", "description": "A layer or group id for release_sequence and release_build, or the layer flatten keeps; the active layer when left out."},
           "discard_hidden": {"type": "boolean", "default": False, "description": "flatten only: discard hidden layers and hidden art instead of keeping hidden layers."}}, ["action"]),
    _tool("transform", "Transforms the objects: move by dx, dy or to x, y; rotate by degrees; scale in percent (uniform or per axis); reflect; shear in degrees; set width or height; about an origin; as copies; or each about its own centre. corners distorts the bounding box onto four points in perspective (Free Distort; type, images and symbols go into an envelope mesh), perspective pulls the top corners in (or out, if negative) by that many points for a symmetric Perspective Distort, and reset_bounding_box squares a rotated bounding box to the page again.", {"ids": _IDS, "dx": _NUM, "dy": _NUM, "x": _NUM, "y": _NUM, "rotate": _NUM, "scale": {"type": "number", "minimum": 0.01}, "scale_x": {"type": "number", "minimum": 0.01}, "scale_y": {"type": "number", "minimum": 0.01},
          "corners": {"type": "array", "minItems": 4, "maxItems": 4, "items": {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2}, "description": "Free Distort: where the bounding box's top-left, top-right, bottom-right and bottom-left corners go, as [x, y] in document points."},
          "perspective": {"type": "number", "description": "Perspective Distort: move the top corners toward each other by this many points each (negative spreads them)."}, "reset_bounding_box": {"type": "boolean"},
          "width": {"type": "number", "minimum": 0.01}, "height": {"type": "number", "minimum": 0.01}, "reflect": {"type": "string", "enum": ["horizontal", "vertical"]}, "shear": _NUM, "shear_axis": {"type": "string", "enum": ["horizontal", "vertical"], "default": "horizontal"},
          "origin": {"type": ["string", "array"], "description": "center (default), top_left, top, top_right, left, right, bottom_left, bottom, bottom_right, or [x, y]."}, "copy": {"type": "boolean", "default": False}, "each": {"type": "boolean", "default": False}, "scale_strokes": {"type": "boolean", "default": True}}),
    _tool("align", "Aligns or distributes the objects, relative to the selection's bounds, the artboard, or a key object; distribute_spacing uses spacing in points.", {"ids": _IDS, "action": {"type": "string", "enum": ["left", "horizontal_center", "right", "top", "vertical_center", "bottom", "distribute_left", "distribute_horizontal_center", "distribute_right", "distribute_top", "distribute_vertical_center", "distribute_bottom", "distribute_horizontal_space", "distribute_vertical_space"]},
          "to": {"type": "string", "enum": ["selection", "artboard", "key"], "default": "selection"}, "key": _ID, "spacing": _NUM}, ["action"]),
    _tool("puppet_warp", "Puppet Warp: bends the objects (paths, groups, compound paths; type, images and symbols go into an envelope mesh) as rigidly as possible so each pin lands on its target while the art between the pins bends without shearing. Give at least one pin; a pin with no move holds that spot in place, so pass three or more pins for a bend. rotate twists the art around a pin. The result is ordinary path geometry; get_image shows it.",
          {"ids": _IDS, "pins": {"type": "array", "minItems": 1, "maxItems": 64, "items": {"type": "object", "properties": {"x": _NUM, "y": _NUM, "to_x": _NUM, "to_y": _NUM, "rotate": {"type": "number", "description": "Degrees counter-clockwise to turn the art around this pin; leave out to let it turn freely."}}, "required": ["x", "y"]},
                    "description": "Pins on the art in document points; to_x, to_y is where each pin goes (it stays put when left out)."},
           "expand": {"type": "number", "minimum": 0, "maximum": 100, "default": 3, "description": "How far in points the deformation mesh reaches past the art's edges."}}, ["pins"]),
    _tool("add_dimension", "Adds a dimension annotation that stays live: linear (two points; horizontal, vertical or aligned), angular (the vertex, then a point on each arm) or radial (centre and a point on the rim, three points on a circle, or the id of a circle or ellipse). Its dimension line, extension lines, arrowheads and label regenerate when it moves or its settings change; expand turns it into plain paths and type. With ids and no points it changes the settings of those dimensions instead.",
          {"type": {"type": "string", "enum": ["linear", "angular", "radial"], "default": "linear"}, "points": {"type": "array", "items": {"type": "array", "items": _NUM, "minItems": 2, "maxItems": 2}, "maxItems": 3, "description": "Document points: linear [a, b]; angular [vertex, arm1, arm2]; radial [centre, rim] or three rim points with from three_points."},
           "circle": {"type": "string", "description": "radial: the id of a circle, ellipse or arc to measure."}, "from": {"type": "string", "enum": ["centre", "three_points"], "default": "centre"}, "ids": _IDS,
           "orientation": {"type": "string", "enum": ["horizontal", "vertical", "aligned"], "default": "aligned"}, "measure": {"type": "string", "enum": ["radius", "diameter"], "default": "radius"},
           "offset": {"type": "number", "description": "Linear: distance from the farther point to the dimension line (negative puts it on the other side). Angular: radius of the arc. Radial: how far the leader runs past the rim."},
           "units": {"type": "string", "enum": ["doc", "pt", "px", "mm", "cm", "in", "pc"], "default": "doc"}, "precision": {"type": "integer", "minimum": 0, "maximum": 6, "default": 2}, "scale": {"type": "number", "minimum": 0.0001, "default": 1, "description": "Drawing scale: the label shows the measured length times this (100 for 1:100)."},
           "show_units": {"type": "boolean", "default": True}, "arrow": {"type": "string", "enum": ["filled", "open", "tick", "dot", "none"], "default": "filled"}, "arrow_size": {"type": "number", "minimum": 1, "maximum": 72, "default": 6},
           "font": {"type": "string"}, "style": {"type": "string"}, "size": {"type": "number", "minimum": 1, "maximum": 288, "default": 9}, "text_position": {"type": "string", "enum": ["above", "center", "below"], "default": "above"},
           "color": {"type": "string", "description": "#rrggbb, default black."}, "weight": {"type": "number", "minimum": 0.05, "maximum": 20, "default": 0.75}}),
    _tool("pathfinder", "Combines the selected shapes into new curved paths, as Illustrator's Pathfinder: unite, minus_front, intersect, exclude, divide, trim, merge, crop, outline or minus_back. With live true, unite, minus_front, intersect and exclude instead make a live compound shape (Alt-click in the panel): a group whose parts stay editable and whose look is the boolean of the parts, each with its own shape mode, painted like the top part. compound expand turns a live compound shape into a path and compound release returns its parts. shape_mode sets the mode of the selected part (or of all parts of a selected compound shape). precision (points, default 0.028), remove_redundant_points and remove_unpainted (Divide and Outline drop unpainted pieces) set the Pathfinder Options used by every operation, live compound shape and Pathfinder effect (apply_effect pathfinder.add and the other pathfinder.* ids on a group).", {"ids": _IDS, "operation": {"type": "string", "enum": _PF}, "live": {"type": "boolean", "default": False, "description": "Make a live compound shape instead of a destructive result (unite, minus_front, intersect, exclude only)."}, "compound": {"type": "string", "enum": ["expand", "release"], "description": "Act on live compound shapes in ids or the selection instead of combining."}, "shape_mode": {"type": "string", "enum": ["add", "subtract", "intersect", "exclude"], "description": "Set the shape mode of the selected compound shape part."}, "precision": {"type": "number", "minimum": 0.001, "maximum": 100, "description": "Pathfinder Options precision in points."}, "remove_redundant_points": {"type": "boolean"}, "remove_unpainted": {"type": "boolean"}}),
    _tool("path_operation", "A path command on the objects: offset (by offset points, joins), outline_stroke, simplify (precision 0..100), smooth, join, average (axis), reverse, add_anchors, remove_anchors, divide_objects_below, split_into_grid (rows, columns, gutter), clean_up, close or open.", {"ids": _IDS, "operation": {"type": "string", "enum": _PATHOPS},
          "offset": _NUM, "joins": {"type": "string", "enum": ["miter", "round", "bevel"], "default": "miter"}, "miter_limit": {"type": "number", "default": 4}, "precision": {"type": "number", "minimum": 0, "maximum": 100, "default": 50}, "axis": {"type": "string", "enum": ["horizontal", "vertical", "both"], "default": "both"},
          "rows": {"type": "integer", "minimum": 1, "maximum": 100}, "columns": {"type": "integer", "minimum": 1, "maximum": 100}, "gutter": {"type": "number", "minimum": 0}}, ["operation"]),
    _tool("shape_builder", "Shape Builder: merges the regions of the selected shapes under the given points into one shape, or deletes them.", {"ids": _IDS, "points": {"type": "array", "items": {"type": "array", "items": _NUM, "minItems": 2, "maxItems": 2}, "minItems": 1}, "delete": {"type": "boolean", "default": False}}, ["points"]),
    _tool("apply_effect", "Adds a live effect to the objects (it stays editable in the Appearance panel), or lists the effects and their parameters with list true. Ids include warp.arc, warp.flag, warp.bulge (15 warps), distort.roughen, distort.zig_zag, distort.pucker_bloat, distort.twist, distort.transform, distort.tweak, stylize.drop_shadow, stylize.outer_glow, stylize.inner_glow, stylize.feather, stylize.round_corners, stylize.scribble, path.offset, path.outline_stroke, pathfinder.add, pathfinder.intersect, pathfinder.exclude, pathfinder.subtract, pathfinder.minus_back, pathfinder.divide, pathfinder.trim, pathfinder.merge, pathfinder.crop, pathfinder.outline, pathfinder.hard_mix, pathfinder.soft_mix, pathfinder.trap (these act on groups), convert.rectangle, convert.rounded_rectangle, convert.ellipse, rasterize.raster (resolution, background, around), and the Effect Gallery's raster effects: blur.gaussian, blur.radial, blur.smart and gallery.* (Artistic: gallery.watercolor, gallery.cutout, gallery.colored_pencil; Brush Strokes: gallery.crosshatch, gallery.spatter; Distort: gallery.glass, gallery.ocean_ripple; Pixelate: gallery.crystallize, gallery.color_halftone, gallery.pointillize; Sketch: gallery.charcoal, gallery.stamp, gallery.halftone_pattern; Stylize: gallery.glowing_edges; Texture: gallery.stained_glass, gallery.mosaic_tiles, gallery.texturizer; Video: gallery.ntsc_colors; 56 with Gaussian Blur). Raster effects export to SVG as images at the document's raster resolution.",
          {"ids": _IDS, "effect": {"type": "string"}, "params": {"type": "object"}, "list": {"type": "boolean", "default": False},
           "item": {"type": "integer", "minimum": 0, "description": "Apply the effect to one fill or stroke only: its index in the object's appearance items as get_object lists ap.items (0 is the bottom item). Without it the effect applies to the whole object. 3D effects always apply to the whole object."}}),
    _tool("three_d", "3D and Materials: give the objects depth as a live effect, change it, or remove it. kind extrude (depth, cap, bevel none, classic or rounded with bevel_height), revolve (the art is a profile turned around its left or right edge: angle, offset, from), inflate (a puffed surface: depth, volume, and rx, ry, rz to tilt it) or plane (the flat art turned in space). Turn it with position (off_axis_front, front, left, right, top, isometric_left, isometric_right and others) or rx, ry, rz in degrees, and perspective 0 to 160. material plastic, matte, metal, brushed_metal, wood, rough, wireframe or flat (plane); brushed_metal, wood and rough are textures that show only with ray_trace (vector mode falls back to metal or matte) and texture_scale sets their size in percent. light top_left, top, top_right, left, front, right, bottom_left, bottom, bottom_right with intensity, ambient and highlight in percent and shading_color. lighting standard, diffuse, top_left or right sets a lighting preset of several lights; lights replaces them with your own array (up to 8) of {color, intensity 0 to 200, rotation -180 to 180 degrees around the object, height 0 to 90 degrees, softness 0 to 100}, and the shading sums every light (omit lights and lighting to keep the single light above). ray_trace true renders the object per pixel with smooth normals, soft shadows from the lights, ambient occlusion and the ground shadow, at quality low, medium or high (high takes a second or two); inflate traces its height field the same way, and a map_symbol is drawn as a texture on the front face, lit with it unless shade_art is false; SVG and PDF export a ray-traced object as an image and expand appearance turns it into an image object. map_symbol wraps a symbol (by name; make one with the symbol tool) onto the front face of an extrude or plane, sized by map_scale percent and moved by map_x, map_y points, shaded with the surface unless shade_art is false; an empty map_symbol clears it. shadow true casts a soft shadow (not for inflate): shadow_position behind or below, shadow_distance and shadow_softness in points, shadow_opacity in percent. Leave kind out to change only the parameters you pass; remove true takes 3D off. A graphic material wraps a picture around every surface: texture is a symbol name, the key of an embedded image or the id of a placed image object (place_image first), empty to clear it; texture_scale (percent, 100 fits the object's longer side), texture_rotation (degrees) and texture_offset_x and texture_offset_y (points) place it. The picture is planar on front and back faces, runs along the outline and the depth on extruded sides, around the axis on revolved surfaces, and is projected from the front on an inflate; vector mode uses its average colour. roughness and metallic (0 to 1) set the highlight spread and the metal reflection of the surface in ray tracing for any material, texture or not; reset_surface true gives the material's own values back. Per-surface materials: pass surface (front, back, sides, bevel for extrude; outer, inner, caps for revolve; front for plane; g0, g1 and so on for an imported model's material groups) and the material, color (a hex colour), texture and its texture_ settings, roughness and metallic then change that surface only, so an extruded star can have a picture on its front and metal sides; surface all or no surface sets the whole object, each surface that has no value of its own follows it; reset_surface with surface clears that surface; vector mode paints each surface in its flat colour and ray tracing renders every one. Imported models (place_image or open_file with an .obj, .glb or .gltf file) are 3D objects of their own: turn them with rx, ry, rz and perspective, light them, ray_trace them, and use surface g0, g1 for their groups. Type and groups extrude as one object; expand turns the result into plain shaded paths.",
          {"ids": _IDS, "kind": {"type": "string", "enum": ["extrude", "revolve", "inflate", "plane"]}, "remove": {"type": "boolean"}, "position": {"type": "string"}, "rx": _NUM, "ry": _NUM, "rz": _NUM, "perspective": {"type": "number", "minimum": 0, "maximum": 160}, "depth": {"type": "number", "minimum": 0, "maximum": 2000}, "cap": {"type": "boolean"},
           "bevel": {"type": "string", "enum": ["none", "classic", "rounded"]}, "bevel_height": {"type": "number", "minimum": 0, "maximum": 100}, "angle": {"type": "number", "minimum": 1, "maximum": 360}, "offset": {"type": "number", "minimum": 0}, "from": {"type": "string", "enum": ["left", "right"]}, "volume": {"type": "number", "minimum": 10, "maximum": 100},
           "material": {"type": "string", "enum": ["plastic", "matte", "metal", "brushed_metal", "wood", "rough", "wireframe", "flat"]}, "texture_scale": {"type": "number", "minimum": 10, "maximum": 400}, "texture": {"type": "string", "maxLength": 160}, "texture_rotation": {"type": "number", "minimum": -180, "maximum": 180}, "texture_offset_x": {"type": "number", "minimum": -2000, "maximum": 2000}, "texture_offset_y": {"type": "number", "minimum": -2000, "maximum": 2000},
           "roughness": {"type": "number", "minimum": 0, "maximum": 1}, "metallic": {"type": "number", "minimum": 0, "maximum": 1}, "reset_surface": {"type": "boolean"}, "surface": {"type": "string", "description": "Which surface material, color, texture, texture_scale, texture_rotation, texture_offset_x, texture_offset_y, roughness, metallic and reset_surface change: all (the default), front, back, sides or bevel for extrude, outer, inner or caps for revolve, front for plane, and g0, g1 and so on (the model's material groups) for an imported model."}, "color": {"type": "string", "description": "A surface colour such as #c0392b, with surface; empty clears it."}, "ray_trace": {"type": "boolean"}, "quality": {"type": "string", "enum": ["low", "medium", "high"]},
           "lighting": {"type": "string", "enum": ["standard", "diffuse", "top_left", "right"]}, "lights": {"type": "array", "maxItems": 8, "items": {"type": "object", "properties": {"color": {"type": "string"}, "intensity": {"type": "number", "minimum": 0, "maximum": 200}, "rotation": {"type": "number", "minimum": -180, "maximum": 180}, "height": {"type": "number", "minimum": 0, "maximum": 90}, "softness": {"type": "number", "minimum": 0, "maximum": 100}}}}, "light": {"type": "string"}, "intensity": {"type": "number", "minimum": 0, "maximum": 200}, "ambient": {"type": "number", "minimum": 0, "maximum": 100}, "highlight": {"type": "number", "minimum": 0, "maximum": 100}, "shading_color": _COLOR,
           "map_symbol": {"type": "string", "maxLength": 120}, "map_scale": {"type": "number", "minimum": 5, "maximum": 400}, "map_x": _NUM, "map_y": _NUM, "shade_art": {"type": "boolean"},
           "shadow": {"type": "boolean"}, "shadow_position": {"type": "string", "enum": ["behind", "below"]}, "shadow_distance": {"type": "number", "minimum": 0, "maximum": 500}, "shadow_softness": {"type": "number", "minimum": 0, "maximum": 100}, "shadow_opacity": {"type": "number", "minimum": 0, "maximum": 100}}),
    _tool("expand", "Expands the objects into plain paths: appearance (effects, strokes, multiple fills), or the object (live shapes, type, blends, symbols, envelopes, repeats), or both.", {"ids": _IDS, "what": {"type": "string", "enum": ["appearance", "object", "all"], "default": "all"}}),
    _tool("make_blend", "Blends between the selected objects (shape and colour), or releases or expands a blend. spacing smooth chooses steps from the colours.", {"ids": _IDS, "action": {"type": "string", "enum": ["make", "release", "expand", "options"], "default": "make"}, "spacing": {"type": "string", "enum": ["smooth", "steps", "distance"], "default": "steps"},
          "steps": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 8}, "distance": {"type": "number", "minimum": 0.1}, "align_to_path": {"type": "boolean"}}),
    _tool("envelope", "Envelope Distort: warp the objects with one of the 15 warp styles, a mesh grid of rows by columns, or the topmost object's shape; or release or expand an envelope. On an envelope: info lists its mesh points (row-major, index = row * (columns + 1) + column) with their handles; move_point moves a mesh point (x, y or dx, dy) or, with handle, one of its handle ends to x, y; add_mesh_line adds a row and column through x, y; delete_mesh_point removes the lines through a point; reset_mesh and reset_warp replace the shape (a warp or top-object envelope turns into a mesh the first time a point moves); options sets fidelity, distort_appearance, distort_gradients, distort_patterns and anti_alias; edit_contents and edit_envelope switch between editing the art inside and the envelope. get_image shows the result.", {"ids": _IDS, "action": {"type": "string", "enum": ["warp", "mesh", "top_object", "release", "expand", "info", "move_point", "add_mesh_line", "delete_mesh_point", "reset_mesh", "reset_warp", "options", "edit_contents", "edit_envelope"]}, "style": {"type": "string", "enum": ["arc", "arc_lower", "arc_upper", "arch", "bulge", "shell_lower", "shell_upper", "flag", "wave", "fish", "rise", "fisheye", "inflate", "squeeze", "twist"]},
          "bend": {"type": "number", "minimum": -100, "maximum": 100, "default": 50}, "horizontal": {"type": "number", "minimum": -100, "maximum": 100, "default": 0}, "vertical": {"type": "number", "minimum": -100, "maximum": 100, "default": 0}, "vertical_orientation": {"type": "boolean", "default": False},
          "rows": {"type": "integer", "minimum": 1, "maximum": 50, "default": 4}, "columns": {"type": "integer", "minimum": 1, "maximum": 50, "default": 4},
          "point": {"type": "integer", "minimum": 0, "description": "move_point and delete_mesh_point: the mesh point index from info (or give row and column)."}, "row": {"type": "integer", "minimum": 0, "description": "Mesh row of the point, 0 at the top."}, "column": {"type": "integer", "minimum": 0, "description": "Mesh column of the point, 0 at the left."},
          "x": {"type": "number", "description": "Document points: the new position for move_point, or the place for add_mesh_line."}, "y": _NUM, "dx": {"type": "number", "description": "move_point: move by this much instead of to x, y."}, "dy": _NUM,
          "handle": {"type": "string", "enum": ["right", "left", "down", "up"], "description": "move_point: move this handle's end to x, y (or by dx, dy) instead of the point."}, "mirror": {"type": "boolean", "default": False, "description": "move_point with handle: turn the opposite handle to stay in line."},
          "maintain_shape": {"type": "boolean", "default": True, "description": "reset_mesh: keep the current envelope shape in the new mesh."},
          "fidelity": {"type": "number", "minimum": 0, "maximum": 100, "description": "options: how closely the art follows the envelope (50 by default)."}, "distort_appearance": {"type": "boolean", "description": "options: distort strokes and effects with the shape."}, "distort_gradients": {"type": "boolean", "description": "options: distort linear gradient fills."}, "distort_patterns": {"type": "boolean", "description": "options: distort pattern fills."}, "anti_alias": {"type": "boolean", "description": "options: smooth images drawn through the envelope."}}, ["action"]),
    _tool("repeat", "Repeat: makes the objects a live radial, grid or mirror repeat, changes its options, or releases or expands it.", {"ids": _IDS, "kind": {"type": "string", "enum": ["radial", "grid", "mirror", "release", "expand"]}, "instances": {"type": "integer", "minimum": 2, "maximum": 400}, "radius": {"type": "number", "minimum": 0},
          "rows": {"type": "integer", "minimum": 1, "maximum": 100}, "columns": {"type": "integer", "minimum": 1, "maximum": 100}, "h_spacing": _NUM, "v_spacing": _NUM, "angle": _NUM}, ["kind"]),
    _tool("symbol", "Symbols: create one from the objects (type dynamic or static, registration point, 9-slice scaling), place an instance (from the document, or from a symbol library with library), list them, break an instance's link, replace instances with another symbol, delete one. edit enters symbol editing mode on the symbol (or the instance in id): its art becomes an ordinary group you change with any tool while every instance follows; exit saves and leaves, cancel throws the changes away. redefine replaces the symbol's art with the objects in ids; duplicate copies it; options renames it (new_name), sets its type or turns 9-slice guides on or off (slice, or slice_guides [x1, y1, x2, y2] in the symbol's own coordinates, origin at the registration point). override recolours one part of a dynamic instance (id, part from get_document's parts list, fill, stroke, stroke_width, opacity in percent); reset_overrides clears them. libraries lists the symbol libraries (arrows, web icons, nature, shapes, flowchart and saved ones); load_library adds a library's symbols (all, or names) to the Symbols panel.", {
          "action": {"type": "string", "enum": ["create", "place", "list", "break_link", "replace", "delete", "edit", "exit", "cancel", "redefine", "duplicate", "options", "override", "reset_overrides", "libraries", "load_library"]}, "name": {"type": "string", "maxLength": 120}, "ids": _IDS, "x": _NUM, "y": _NUM, "scale": {"type": "number", "minimum": 0.01},
          "id": {"type": "string", "description": "A symbol instance (edit, override)."}, "type": {"type": "string", "enum": ["dynamic", "static"]}, "registration": {"type": "string", "enum": ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"], "default": "c"},
          "slice": {"type": "boolean", "description": "Turn 9-slice scaling guides on (corners keep their size when an instance scales) or off."}, "slice_guides": {"type": "array", "items": {"type": "number"}, "minItems": 4, "maxItems": 4}, "new_name": {"type": "string", "maxLength": 120},
          "part": {"type": "string"}, "fill": _COLOR, "stroke": _COLOR, "stroke_width": {"type": "number", "minimum": 0}, "opacity": {"type": "number", "minimum": 0, "maximum": 100},
          "library": {"type": "string", "description": "A symbol library id or name (place, load_library)."}, "names": {"type": "array", "items": {"type": "string"}}}, ["action"]),
    _tool("apply_brush", "Applies a brush to the strokes of the objects (calligraphic, scatter, art, bristle or pattern), removes it with brush none, or lists the brushes with list true. With library, the brush comes from a brush library (see brush_library) and joins the Brushes panel first.", {"ids": _IDS, "brush": {"type": "string"}, "list": {"type": "boolean", "default": False}, "library": {"type": "string", "description": "A brush library id or name; brush then names one of its brushes."}}),
    _tool("new_brush", "Makes a brush for the Brushes panel and optionally applies it. calligraphic (angle, roundness, size), bristle (shape, size, length, density, thickness, paint_opacity, stiffness: many thin semi-transparent bristle strokes), and from the art in ids: scatter (size, spacing, scatter, rotation), art (width, scale_mode with guides, flip, flip_along) or pattern (the art is the side tile; outer, inner, start and end tiles are pattern swatch names; fit, spacing).", {
          "kind": {"type": "string", "enum": ["calligraphic", "scatter", "art", "pattern", "bristle"]}, "name": {"type": "string", "maxLength": 120}, "ids": _IDS, "apply_to": {**_IDS, "description": "Objects to stroke with the new brush."},
          "angle": _NUM, "roundness": {"type": "number", "minimum": 1, "maximum": 100}, "size": {"type": "number", "description": "Calligraphic and bristle: points; scatter: percent."}, "spacing": {"type": "number", "description": "Percent."}, "scatter": _NUM, "rotation": _NUM, "relative": {"type": "boolean"},
          "width": {"type": "number", "description": "Art brush width, percent."}, "scale_mode": {"type": "string", "enum": ["proportional", "stretch", "guides"], "description": "Art brush: scale proportionately, stretch to the stroke length, or stretch only between the guides."}, "guides": {"type": "array", "items": {"type": "number"}, "description": "Art brush guides [start, end] as percent of the art's length."},
          "flip": {"type": "boolean"}, "flip_along": {"type": "boolean"}, "fit": {"type": "string", "enum": ["stretch", "space", "approximate"]}, "outer": {"type": "string"}, "inner": {"type": "string"}, "start": {"type": "string"}, "end": {"type": "string"},
          "shape": {"type": "string", "enum": ["round_point", "flat_point", "round_blunt", "flat_blunt", "round_curve", "flat_curve", "round_angle", "flat_angle", "fan"]}, "length": {"type": "number", "minimum": 25, "maximum": 300}, "density": {"type": "number", "minimum": 1, "maximum": 100}, "thickness": {"type": "number", "minimum": 1, "maximum": 100}, "paint_opacity": {"type": "number", "minimum": 1, "maximum": 100}, "stiffness": {"type": "number", "minimum": 1, "maximum": 100},
          "colorize": {"type": "string", "enum": ["none", "tints", "tints_shades", "hue_shift"], "default": "none"}}, ["kind"]),
    _tool("brush_library", "Brush libraries, as Window > Brush Libraries: list the built-in libraries (arrows, borders, decorative scatter, artistic ink, bristle brushes) and the person's saved ones, or load a library's brushes (all or some by name) into the Brushes panel.", {"action": {"type": "string", "enum": ["list", "load"], "default": "list"}, "library": {"type": "string"}, "names": {"type": "array", "items": {"type": "string"}}}),
    _tool("image_trace", "Traces a placed image into a live tracing object (the paths are its children, the image stays inside so the options can change), with a preset (high_fidelity_photo, low_fidelity_photo, 3_colors, 6_colors, 16_colors, shades_of_gray, black_and_white_logo, sketched_art, silhouettes, line_art, technical_drawing) or explicit settings. Pass a tracing object's id to trace it again with new settings; action expand turns it into ordinary paths, release brings back the image; expand true traces and expands in one call; view sets what the canvas shows.", {"id": {"type": "string", "description": "A placed image or an image tracing object."}, "action": {"type": "string", "enum": ["trace", "expand", "release"], "default": "trace"},
          "preset": {"type": "string", "description": "Also outline (black and white centreline strokes)."}, "mode": {"type": "string", "enum": ["color", "gray", "bw"]}, "colors": {"type": "integer", "minimum": 2, "maximum": 64}, "threshold": {"type": "integer", "minimum": 1, "maximum": 255}, "paths": {"type": "number", "minimum": 0, "maximum": 100, "description": "Path fidelity in percent."}, "ignore_white": {"type": "boolean"}, "smooth": {"type": "boolean"},
          "palette": {"type": "string", "enum": ["auto", "limited", "full", "library"], "description": "Colour and grayscale modes: automatic count, limited to colors, full tone, or the document's colour swatches."},
          "corners": {"type": "number", "minimum": 0, "maximum": 100, "description": "Percent: higher keeps more sharp corners."}, "noise": {"type": "integer", "minimum": 1, "maximum": 1000, "description": "Areas smaller than this many pixels merge into their neighbours."},
          "method": {"type": "string", "enum": ["abutting", "overlapping"], "description": "abutting cuts each colour out of the others; overlapping stacks the colours so there are no gaps."},
          "fills": {"type": "boolean"}, "strokes": {"type": "boolean", "description": "Black and white mode: trace thin lines along their centre (a one-pixel skeleton fitted with curves) as stroked paths."}, "stroke_width": {"type": "number", "minimum": 1, "maximum": 100, "description": "Pixels: lines up to this thick become strokes; thicker areas stay fills."}, "snap_lines": {"type": "boolean", "description": "Straighten nearly straight curves and snap lines near 0 or 90 degrees."},
          "view": {"type": "string", "enum": ["result", "result_outlines", "outlines", "outlines_source", "source"]}, "expand": {"type": "boolean", "default": False}}),
    _tool("live_paint", "Live Paint: make a Live Paint group from paths (their crossings divide the area into faces that keep their colour when the paths move), fill the face at a point, paint the stroke of the edge nearest a point, set gap detection in points (0 turns it off) so small openings still close a face, expand into ordinary filled faces and strokes, or release back to the paths.", {"action": {"type": "string", "enum": ["make", "fill", "edge", "gap", "expand", "release"]}, "ids": _IDS, "id": {"type": "string", "description": "The Live Paint group for fill, edge and gap."},
          "x": _NUM, "y": _NUM, "color": _COLOR, "width": {"type": "number", "minimum": 0, "maximum": 1000, "description": "Stroke width in points for edge; 0 hides the edge."}, "gap": {"type": "number", "minimum": 0, "maximum": 72}}, ["action"]),
    _tool("intertwine", "Intertwine: make an intertwine object from two or more overlapping objects (paths, groups, type) so they can weave over and under each other like chain links; flip the stacking inside the overlap at x, y (with three or more objects each flip brings the next one down to the top there); define an area freely by encircling it with points; release back to plain objects in their base order; or expand into plain clipped groups. get_document lists the intertwine's areas.",
          {"action": {"type": "string", "enum": ["make", "flip", "area", "release", "expand"]}, "ids": _IDS, "id": {"type": "string", "description": "The intertwine object for flip, area, release and expand (make returns it); defaults to the selected one."},
           "x": _NUM, "y": _NUM, "points": {"type": "array", "minItems": 3, "items": {"type": "array", "items": _NUM, "minItems": 2, "maxItems": 2}, "description": "area: a closed loop of [x, y] document points around part of an overlap."}}, ["action"]),
    _tool("shaper", "Shaper: turn rough drawn points into a live shape the way the Shaper tool recognises a gesture (rectangle or square, circle, ellipse, triangle, polygon or line; near-orthogonal rectangles snap square to the axes); scribble a zigzag over overlapping shapes to punch out the region it stays in, merge the regions it crosses, or delete a single shape it covers alone (overlapping shapes become an editable Shaper Group that recomputes when its shapes change); fill the face of a Shaper Group at x, y; or expand a Shaper Group into plain paths.",
          {"action": {"type": "string", "enum": ["draw", "scribble", "fill", "expand"]}, "points": {"type": "array", "minItems": 2, "items": {"type": "array", "items": _NUM, "minItems": 2, "maxItems": 2}, "description": "draw and scribble: the gesture as [x, y] document points in drawing order."},
           "id": {"type": "string", "description": "fill and expand: the Shaper Group (defaults to the selected one)."}, "x": _NUM, "y": _NUM, "color": _COLOR, "ids": _IDS}, ["action"]),
    _tool("gradient_mesh", "Gradient meshes: make one from each closed shape (rows, columns, flat or with a white highlight at the centre or the edge); list a mesh's points by row and column; set one point's colour, opacity or position (dx, dy moves it); add a mesh line through x, y in a colour; remove the lines through a point.", {"action": {"type": "string", "enum": ["make", "list", "point", "add_line", "remove_point"]}, "ids": _IDS, "id": {"type": "string", "description": "The mesh for list, point, add_line and remove_point."},
          "rows": {"type": "integer", "minimum": 1, "maximum": 30, "default": 4}, "columns": {"type": "integer", "minimum": 1, "maximum": 30, "default": 4}, "highlight": {"type": "string", "enum": ["flat", "center", "edge"], "default": "flat"}, "row": {"type": "integer", "minimum": 0}, "column": {"type": "integer", "minimum": 0},
          "color": {"type": "string"}, "opacity": {"type": "number", "minimum": 0, "maximum": 100}, "dx": _NUM, "dy": _NUM, "x": _NUM, "y": _NUM}, ["action"]),
    _tool("symbolism", "The symbolism tools on symbol instances (a sprayed symbol set or any group of instances): shift by dx, dy; scrunch together (reverse spreads apart); size up (reverse shrinks); spin by angle degrees or toward dx, dy; stain toward a colour (reverse removes the tint); screen more transparent (reverse more opaque); style with a graphic style (reverse removes it). With x, y and radius only the instances under that brush change, weighted toward its centre; without them every instance does. Intensity 1..10; method average pulls instances toward their mean, random scatters.", {"ids": _IDS, "op": {"type": "string", "enum": ["shift", "scrunch", "size", "spin", "stain", "screen", "style"]},
          "intensity": {"type": "number", "minimum": 1, "maximum": 10, "default": 5}, "method": {"type": "string", "enum": ["user", "average", "random"], "default": "user"}, "x": _NUM, "y": _NUM, "radius": {"type": "number", "minimum": 1}, "dx": _NUM, "dy": _NUM, "angle": _NUM, "color": {"type": "string"}, "style": {"type": "string", "description": "A graphic style name."}, "reverse": {"type": "boolean", "default": False}, "repeat": {"type": "integer", "minimum": 1, "maximum": 50, "default": 1}}, ["op"]),
    _tool("make_pattern", "Makes a pattern swatch from the objects, tiled as a grid, brick or hex, and optionally fills other objects with it.", {"ids": _IDS, "name": {"type": "string", "maxLength": 120}, "tile": {"type": "string", "enum": ["grid", "brick_by_row", "brick_by_column", "hex_by_column", "hex_by_row"], "default": "grid"}, "h_spacing": _NUM, "v_spacing": _NUM, "apply_to": _IDS}, ["name"]),
    _tool("generative_shape_fill", "Generative Shape Fill: asks the language model set for the Assistant (Preferences > Plugins) for vector art that fills a closed path, imports it as editable paths, fits it to the shape and clips it there. The result is a clipping group whose last child is the original shape, placed as one undo step. The model's SVG is validated and repaired like text_to_vector and the result lists what was dropped. shape_strength, detail, style_preset, style_reference, effects, color_tone and palette steer it; the palette is enforced after generation. Fails with a clear message when no model is set.",
          {"id": {"type": "string", "description": "A closed path or compound path; the selection when left out."}, "prompt": {"type": "string", "maxLength": 2000, "description": "What to draw; optional."}, "shape_strength": {"type": "number", "minimum": 0, "maximum": 100, "default": 50, "description": "Shape Strength, how strictly the art follows the outline: 0 asks the model to compose freely and the shape only clips it (clip only); 34 to 66 follows the outline loosely; 67 to 100 asks the model to fit the silhouette, stretches the art onto the shape's bounds and then clips. The result is always a clip group."},
           "detail": _GEN_DETAIL, "variations": {"type": "integer", "minimum": 1, "maximum": 3, "default": 1, "description": "How many to ask for; one is applied."}, "pick": {"type": "integer", "minimum": 0, "maximum": 2, "description": "Which variation to apply; default the first that worked."}, **_GEN}, open=True),
    _tool("generate_patterns", "Text to Pattern: asks the language model set for the Assistant for seamless vector pattern tiles from a prompt and saves each as a pattern swatch made by formpth's pattern engine (editable with edit_pattern). tile_size sets the tile, seamless repeats motifs that cross a tile edge and checks the edges, layout, h_spacing and v_spacing go to the pattern swatch, and detail, style_preset, style_reference, effects, color_tone and palette steer the art (the palette is enforced afterwards; colors and preset still work). Fails with a clear message when no model is set.",
          {"prompt": {"type": "string", "maxLength": 2000}, "colors": {"type": "array", "items": {"type": "string"}, "maxItems": 12, "description": "Up to 12 colours (#rrggbb and the like); the tiles use only these."}, "preset": {"type": "string", "enum": ["any", "warm", "cool", "pastel", "earth", "vivid", "mono", "forest", "ocean", "document"], "description": "A colour preset when colors is left out; document takes the document's colour swatches."},
           "density": {"type": "integer", "minimum": 1, "maximum": 5, "default": 3, "description": "1 very sparse to 5 packed."}, "variations": {"type": "integer", "minimum": 1, "maximum": 4, "default": 2}, "tile_size": {"type": "number", "minimum": 12, "maximum": 720, "default": 96, "description": "Tile width and height in points."},
           "name": {"type": "string", "maxLength": 60, "description": "Base name of the swatches."}, "fill_selection": {"type": "boolean", "default": False, "description": "Fill the objects in ids (or the selection) with the first pattern."}, "ids": _IDS,
           "detail": _GEN_DETAIL, "seamless": {"type": "boolean", "default": True, "description": "Seamless check: motifs that cross a tile edge are repeated on the opposite side, and the tile's edges are compared after a render (the result reports a mismatch)."},
           "layout": {"type": "string", "enum": ["grid", "brick_by_row", "brick_by_column", "hex_by_column", "hex_by_row"], "default": "grid", "description": "The pattern swatch's tile layout, as in make_pattern."}, "h_spacing": _NUM, "v_spacing": _NUM, **_GEN}, ["prompt"], open=True),
    _tool("text_to_vector", "Text to Vector Graphic: asks the language model set for the Assistant (Preferences > Plugins) for clean standalone SVG from a prompt, up to 3 variations, and places the picked one as editable groups and paths (not an image) fitted into the selected object's bounds, or the centre of the active artboard, as one undo step. The model's SVG may carry linear and radial gradients, strokes with caps and joins, evenodd compound paths, named groups, opacity and blend modes; it is validated and repaired (unsupported or broken elements dropped, open filled paths closed, runaway coordinates clamped) and the result lists what was dropped. type scene asks for Background, Midground and Foreground groups. detail, style_preset, style_reference, effects, color_tone and palette shape the prompt, and the palette is enforced afterwards. Fails with a clear message when no model is set or Show generative features is off.",
          {"prompt": {"type": "string", "maxLength": 2000, "description": "What to draw."}, "type": {"type": "string", "enum": ["subject", "scene", "icon", "pattern"], "default": "subject"},
           "detail": _GEN_DETAIL, "variations": {"type": "integer", "minimum": 1, "maximum": 3, "default": 1, "description": "How many to ask for; one is placed."},
           "pick": {"type": "integer", "minimum": 0, "maximum": 2, "description": "Which variation to place; default the first that worked."}, **_GEN}, ["prompt"], open=True),
    _tool("generative_recolor", "Generative Recolor: asks the language model set for the Assistant for colour palettes that match a prompt such as 'sunset over the ocean' and recolours the objects (or the selection) with one of them, mapping the artwork's colours to the palette by lightness, tints kept, as one undo step. Fails with a clear message when no model is set or Show generative features is off.",
          {"prompt": {"type": "string", "maxLength": 500, "description": "The mood or scene the colours should express."}, "count": {"type": "integer", "minimum": 1, "maximum": 4, "default": 1, "description": "How many palettes to ask for; one is applied."},
           "pick": {"type": "integer", "minimum": 0, "maximum": 3, "description": "Which palette to apply; default the first."}, "ids": _IDS}, ["prompt"], open=True),
    _tool("retype", "Retype: identifies the font of outlined type or of text in a placed image and lists the 10 closest installed fonts, compared by rendering the text in each and measuring shape overlap. A model that reads images (set in Preferences > Plugins) reads the text first; without one, outlined type is read by matching letter shapes and for images text must be given. apply true replaces the outlines (or covers the image) with live text in the chosen font, sized and placed to match.",
          {"ids": _IDS, "text": {"type": "string", "maxLength": 500, "description": "The words, when known; skips reading them."}, "region": {"type": "object", "properties": {"x": _NUM, "y": _NUM, "width": _NUM, "height": _NUM}, "description": "Images only: the part to read, in document points."},
           "apply": {"type": "boolean", "default": False}, "pick": {"type": "integer", "minimum": 0, "maximum": 9, "default": 0, "description": "Which listed match to apply."}, "font": {"type": "string", "description": "Apply this installed family instead of a listed match."}, "style": {"type": "string"}, "keep_image": {"type": "boolean", "default": True, "description": "Images: keep the image under the new text."}}, open=True),
    _tool("list_color_profiles", "Lists the ICC colour profiles formpth can use (the built-in sRGB, the generated formpth Generic CMYK, profiles loaded in Color Settings and those installed on this computer) with name, colour space (RGB, CMYK, GRAY), class and id, and the colour settings of the open document: working spaces, rendering intent, black point compensation and whether Proof Colors is on, plus the display profile Proof Colors uses as the monitor when this computer reports one. Call this before set_color_settings or convert_to_profile to get the exact names.", {}, read=True, idempotent=True),
    _tool("set_color_settings", "Color Settings for the open document, like Edit > Color Settings: the RGB working space, the CMYK working space (CMYK colours then display and convert through that ICC profile; none returns to the simple formula), the rendering intent and black point compensation. Colour numbers do not change; only how they are interpreted. One undo step. Only the fields given change.",
          {"rgb_profile": {"type": "string", "description": "A name or id from list_color_profiles."}, "cmyk_profile": {"type": "string", "description": "A name or id from list_color_profiles, or none for the formula."},
           "intent": {"type": "string", "enum": ["perceptual", "relative_colorimetric", "saturation", "absolute_colorimetric"], "description": "Default relative_colorimetric."}, "bpc": {"type": "boolean", "description": "Black point compensation; default true."}}, idempotent=True),
    _tool("convert_to_profile", "Edit > Convert to Profile: converts every fill, stroke, gradient stop, mesh point, swatch, symbol, graphic style and artboard colour in the open document to the destination profile, keeping the look, with the document's intent and black point setting, as one undo step. A CMYK profile makes the document CMYK; an RGB profile turns CMYK colours into RGB.",
          {"profile": {"type": "string", "description": "A name or id from list_color_profiles."}}, ["profile"], destructive=True),
    _tool("proof_colors", "View > Proof Colors: turns the on-screen soft proof on or off. The proof shows the art as the chosen CMYK device would print it, using the document's paper color and black ink settings. It affects the window only; exports and get_image are unchanged.",
          {"on": {"type": "boolean", "description": "true to turn the proof on, false to turn it off."}, "profile": {"type": "string", "description": "A CMYK profile name or id to simulate; kept in the document's Proof Setup."}}, ["on"], idempotent=True),
    _tool("edit_pattern","Changes a pattern swatch in place, and every object filled with it: name, tile type, spacing, the offset of brick rows or columns (0.5 is half a tile), the tile's width and height around its art, and which neighbour overlaps in front.", {"pattern": {"type": "string", "description": "The pattern's name or id."}, "name": {"type": "string", "maxLength": 120}, "tile": {"type": "string", "enum": ["grid", "brick_by_row", "brick_by_column", "hex_by_column", "hex_by_row"]},
          "h_spacing": _NUM, "v_spacing": _NUM, "brick_offset": {"type": "number", "minimum": 0.05, "maximum": 0.95}, "width": {"type": "number", "minimum": 1}, "height": {"type": "number", "minimum": 1}, "overlap_h": {"type": "string", "enum": ["left", "right"]}, "overlap_v": {"type": "string", "enum": ["top", "bottom"]}}, ["pattern"]),
    _tool("recolor", "Recolours the objects: map colours to new ones, fit them to a palette, or invert, convert to grayscale, CMYK or RGB, or saturate by amount (-100..100). As Recolor Artwork: colors reduces the artwork to that many colours (clustered in OKLab, tints kept), group recolours with a swatch group or library, harmony applies a colour harmony around the base colour.", {"ids": _IDS, "map": {"type": "object", "additionalProperties": {"type": "string"}, "description": "From colour to colour, both #rrggbb."}, "palette": {"type": "array", "items": {"type": "string"}},
          "action": {"type": "string", "enum": ["map", "palette", "invert", "grayscale", "cmyk", "rgb", "saturate", "reduce", "group", "harmony"], "default": "map"}, "amount": _NUM,
          "colors": {"type": "integer", "minimum": 1, "maximum": 64, "description": "Reduce to this many colours."}, "group": {"type": "string", "description": "A document swatch group name, or a swatch library id, or library:group."},
          "preserve_tints": {"type": "boolean", "default": True, "description": "Keep each merged colour's tint and shade relative to its row's new colour."}, "harmony": {"type": "string", "description": "A harmony rule (as color_harmony) around base."}, "base": {"type": "string", "description": "Base colour for harmony, #rrggbb; the most saturated artwork colour by default."}}),
    _tool("artboard", "Artboards: add one, change one (name, x, y, width, height), delete one, fit one to the art or the selection, rearrange them in columns, or list them.", {"action": {"type": "string", "enum": ["add", "set", "delete", "fit_to_art", "fit_to_selection", "rearrange", "list", "activate"]}, "index": {"type": "integer", "minimum": 0}, "name": {"type": "string", "maxLength": 120},
          "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 1}, "height": {"type": "number", "minimum": 1}, "columns": {"type": "integer", "minimum": 1, "maximum": 100}, "spacing": {"type": "number", "minimum": 0}}, ["action"]),
    _tool("set_text", "Changes a type object: its words, and its font, style, size, colour, leading, tracking, kerning, alignment, case, OpenType features, variable font axes and character rotation, for all of it or the characters from start to end; one character's Touch Type transform; paragraph hyphenation, justification, tab stops and bullets or numbering; its orientation (horizontal or vertical); type on a path's effect, flip, alignment, spacing and start and end; and area type's rows, columns, gutters, inset and first baseline.", {"id": _ID, "text": {"type": "string", "maxLength": 20000}, "font": {"type": "string"}, "style": {"type": "string"}, "size": {"type": "number", "minimum": 0.1, "maximum": 1296}, "color": _COLOR,
          "leading": {"type": "number", "minimum": 0}, "tracking": _NUM, "align": {"type": "string", "enum": ["left", "center", "right", "justify", "justify_center", "justify_right", "justify_all"]}, "start": {"type": "integer", "minimum": 0}, "end": {"type": "integer", "minimum": 0},
          "caps": {"type": "string", "enum": ["none", "all", "small"]}, "features": {"type": "array", "items": {"type": "string", "pattern": "^[a-z0-9]{4}$"}, "description": "OpenType feature tags to turn on, replacing the current list: liga, calt, dlig, frac, ordn, tnum, pnum, lnum, onum, zero, case, sups, subs, numr, dnom, swsh, salt, titl, smcp, ss01..ss20. Features the font lacks do nothing; find_font lists the fonts in use."},
          "orientation": {"type": "string", "enum": ["horizontal", "vertical"], "description": "Type Orientation: vertical sets columns right to left with CJK upright and Latin turned 90 degrees clockwise."},
          "upright_latin": {"type": "boolean", "description": "In vertical type, stand Latin letters and digits upright instead of turning them (for the characters from start to end, or all)."},
          "path_effect": {"type": "string", "enum": ["rainbow", "skew", "ribbon", "stair", "gravity"], "description": "Type on a path: rainbow (baselines tangent to the path), skew (glyphs stay vertical, sheared along the path), ribbon (3D Ribbon: horizontal edges stay horizontal, vertical edges perpendicular to the path), stair (Stair Step: upright glyphs, each baseline's left point on the path), gravity (each glyph's baseline centre on the path, turned toward the path's centre)."},
          "path_flip": {"type": "boolean", "description": "Type on a path: put the type on the other side of the path, reading the other way."},
          "path_align": {"type": "string", "enum": ["baseline", "ascender", "descender", "center"], "description": "Type on a path: which line of the type sits on the path."},
          "path_spacing": {"type": "number", "minimum": 0, "maximum": 1000, "description": "Type on a path: points of space removed between glyphs fanning out around tight curves. 0 leaves spacing as set."},
          "path_start": {"type": "number", "minimum": 0, "maximum": 1, "description": "Type on a path: where the start bracket sits, as a fraction of the path's length."},
          "path_end": {"type": "number", "minimum": 0, "maximum": 1, "description": "Type on a path: where the end bracket sits, as a fraction of the path's length."},
          "area_rows": {"type": "integer", "minimum": 1, "maximum": 100, "description": "Area type: number of rows."}, "area_row_gutter": {"type": "number", "minimum": 0, "description": "Area type: points between rows."},
          "area_columns": {"type": "integer", "minimum": 1, "maximum": 100, "description": "Area type: number of columns."}, "area_gutter": {"type": "number", "minimum": 0, "description": "Area type: points between columns."},
          "area_inset": {"type": "number", "minimum": 0, "description": "Area type: inset spacing in points."},
          "first_baseline": {"type": "string", "enum": ["ascent", "cap", "leading", "x", "em", "fixed", "legacy"], "description": "Area type: what sets the first baseline's distance from the top: ascent, cap height, leading, x height, em box height, fixed (the min value), or legacy (the font's ascender)."},
          "first_baseline_min": {"type": "number", "minimum": 0, "description": "Area type: the least distance in points from the top to the first baseline (the distance itself for fixed)."},
          "area_flow": {"type": "string", "enum": ["rows", "columns"], "description": "Area type: fill row by row or column by column."},
          "kerning": {"type": "string", "enum": ["auto", "optical", "none"], "description": "Kerning: auto uses the font's kerning pairs, optical spaces each pair from the glyph outlines, none turns kerning off."},
          "axes": {"type": "object", "additionalProperties": {"type": "number"}, "description": "Variable font axis values by tag for the characters from start to end, for example {\"wght\": 650, \"wdth\": 85, \"slnt\": -8}. Values clamp to the font's ranges; axes the font lacks do nothing; {} returns to the font's default instance. find_font lists the fonts in use."},
          "rotation": {"type": "number", "minimum": -360, "maximum": 360, "description": "Character rotation in degrees counter-clockwise, each character turned about its own centre (for the characters from start to end, or all)."},
          "touch": {"type": "object", "description": "Touch Type: transform one character on its own while the type stays editable. index is the character's position in the text; x and y move it in points (y down); h_scale and v_scale are percent; rotate is degrees counter-clockwise about its centre; reset true clears it.",
                    "properties": {"index": {"type": "integer", "minimum": 0}, "x": _NUM, "y": _NUM, "h_scale": {"type": "number", "minimum": 1, "maximum": 10000}, "v_scale": {"type": "number", "minimum": 1, "maximum": 10000}, "rotate": {"type": "number", "minimum": -360, "maximum": 360}, "reset": {"type": "boolean"}}, "required": ["index"]},
          "hyphenate": {"type": "boolean", "description": "Hyphenate words at line ends in area type (English rules)."},
          "hyphenation": {"type": "object", "description": "Hyphenation settings: min_word (words longer than, letters, default 6), after_first and before_last (letters, default 2), limit (hyphens in a row, 0 for no limit, default 2), zone (points, unjustified type only, default 0), capitalized (hyphenate capitalized words, default true). Setting this turns hyphenation on unless hyphenate is false.",
                          "properties": {"min_word": {"type": "integer", "minimum": 2, "maximum": 25}, "after_first": {"type": "integer", "minimum": 1, "maximum": 15}, "before_last": {"type": "integer", "minimum": 1, "maximum": 15}, "limit": {"type": "integer", "minimum": 0, "maximum": 25}, "zone": {"type": "number", "minimum": 0, "maximum": 720}, "capitalized": {"type": "boolean"}}},
          "justification": {"type": "object", "description": "Justification settings used by justified alignments: word_spacing, letter_spacing and glyph_scaling as [min, desired, max] percentages (defaults [80, 100, 133], [0, 0, 0], [100, 100, 100]; desired values apply to every alignment), and single_word for a line holding one word.",
                            "properties": {"word_spacing": {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3}, "letter_spacing": {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3}, "glyph_scaling": {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3}, "single_word": {"type": "string", "enum": ["justify", "left", "center", "right"]}}},
          "tabs": {"type": "array", "maxItems": 64, "description": "Tab stops, replacing the current ones ([] clears them; without stops tabs advance to every 36 points). position is points from the left of the text frame (from the type's origin for point type); align is left, center, right or decimal; leader is up to four characters repeated across the gap; align_on is a decimal tab's character (default '.').",
                   "items": {"type": "object", "properties": {"position": {"type": "number", "minimum": 0}, "align": {"type": "string", "enum": ["left", "center", "right", "decimal"], "default": "left"}, "leader": {"type": "string", "maxLength": 4}, "align_on": {"type": "string", "maxLength": 1}}, "required": ["position"]}},
          "list": {"type": "object", "description": "Bullets and numbering for every paragraph: type none, bullet or number; bullet is the character (default •); format is 1, 01, a, A, i or I; start is the first number; separator follows the number (default '.'). Pair with a negative first-line indent for a hanging list.",
                   "properties": {"type": {"type": "string", "enum": ["none", "bullet", "number"]}, "bullet": {"type": "string", "maxLength": 2}, "format": {"type": "string", "enum": ["1", "01", "a", "A", "i", "I"]}, "start": {"type": "integer", "minimum": 0, "maximum": 9999}, "separator": {"type": "string", "maxLength": 2}}}}, ["id"]),
    _tool("text_flow", "Threads area type through more frames, releases or unthreads frames, or wraps area type around objects. thread: ids in order, the first area type, the rest area type or closed paths (which become frames). release: the frames leave the thread and their text flows back. remove: every link breaks and each frame keeps its text. wrap: area type below these objects in their layer flows around them, offset points away (invert flows it inside them). unwrap: stop wrapping.", {"action": {"type": "string", "enum": ["thread", "release", "remove", "wrap", "unwrap"]}, "ids": _IDS, "offset": {"type": "number", "minimum": -500, "maximum": 500, "default": 6}, "invert": {"type": "boolean", "default": False}}, ["action"]),
    _tool("text_style", "Character and paragraph styles: list them, create one from the selected type (or ids) and apply it, apply one to type (character styles to the characters from start to end), redefine one from the selected type, or delete one. style is an id or a name.", {"action": {"type": "string", "enum": ["list", "create", "apply", "redefine", "delete"]}, "kind": {"type": "string", "enum": ["char", "para"], "default": "char"}, "name": {"type": "string", "maxLength": 120}, "style": {"type": "string"}, "ids": _IDS,
          "start": {"type": "integer", "minimum": 0}, "end": {"type": "integer", "minimum": 0}}, ["action"]),
    _tool("find_font", "Lists the fonts the document's type uses (family, style and the objects using each), or replaces one family (and optionally one style) with another everywhere.", {"action": {"type": "string", "enum": ["list", "replace"], "default": "list"}, "font": {"type": "string"}, "style": {"type": "string"}, "to_font": {"type": "string"}, "to_style": {"type": "string", "default": "Regular"}}),
    _tool("create_outlines", "Turns type objects into compound paths of their glyph outlines, in their colours.", {"ids": _IDS}),
    _tool("graph", "Creates or updates a live graph from data: column, stacked column, bar, stacked bar, line, area, scatter, pie or radar. The graph keeps its data table; its columns, lines, markers, wedges, axes, labels and legend are ordinary paths and type inside it, regenerated when the data or options change while keeping any colours you gave its parts (each series is a group: get returns the group ids, so set_paint on one recolours that series). x, y, width and height are the body of the graph in points; labels and the legend sit outside it. Data rows are categories (one pie each in pie graphs, one axis each in radar graphs) and columns are series; in scatter graphs each pair of columns is Y then X. series_types combines types (a column graph with one series as a line). make_design turns the selection into a design for column_design or marker_design. Ungroup or expand turns a graph into plain art.",
          {"action": {"type": "string", "enum": ["create", "update", "get", "make_design"], "description": "create (default without id), update (default with id), get the data and series group ids, or make_design from ids or the selection."}, "id": {"type": "string", "description": "The graph, or any part of it."},
           "type": {"type": "string", "enum": ["column", "stacked", "bar", "stackedBar", "line", "area", "scatter", "pie", "radar"], "default": "column"}, "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 4, "default": 240}, "height": {"type": "number", "minimum": 4, "default": 160},
           "data": {"type": "object", "description": "{series: [legend labels], categories: [row labels], values: [[row 1 numbers], [row 2 numbers], ...]}; null for an empty cell.", "properties": {"series": {"type": "array", "items": {"type": "string"}}, "categories": {"type": "array", "items": {"type": "string"}}, "values": {"type": "array", "items": {"type": "array", "items": {"type": ["number", "null"]}}}}},
           "table": {"type": "string", "description": "The data as spreadsheet text instead (tab-separated or CSV): a header row of legend labels and a first column of category labels are detected."},
           "transpose": {"type": "boolean", "default": False, "description": "Swap rows and columns of the data first."}, "switch_xy": {"type": "boolean", "default": False, "description": "Scatter: swap each pair of columns (X and Y)."},
           "legend": {"type": "string", "enum": ["right", "top", "none"], "default": "right"}, "value_axis": {"type": "string", "enum": ["left", "right", "both", "bottom", "top"], "description": "Where the value axis and its labels go (bar graphs: bottom, top or both)."},
           "min": _NUM, "max": _NUM, "divisions": {"type": "integer", "minimum": 1, "maximum": 100, "description": "Setting min, max or divisions overrides the calculated tick values."}, "auto": {"type": "boolean", "description": "true goes back to calculated tick values."},
           "ticks": {"type": "string", "enum": ["none", "short", "full"], "default": "short", "description": "Value axis tick marks; full draws gridlines."}, "category_ticks": {"type": "string", "enum": ["none", "short", "full"], "default": "short"}, "prefix": {"type": "string"}, "suffix": {"type": "string", "description": "Text after each value label, such as %."},
           "column_width": {"type": "number", "minimum": 1, "default": 90, "description": "Percent of the space each column may take."}, "cluster_width": {"type": "number", "minimum": 1, "default": 80, "description": "Percent of each category the cluster takes."},
           "mark_points": {"type": "boolean", "default": True}, "connect_points": {"type": "boolean", "default": True}, "edge_to_edge": {"type": "boolean", "default": False}, "fill_lines": {"type": "boolean", "default": False}, "line_width": {"type": "number", "minimum": 0.1, "default": 1}, "marker_size": {"type": "number", "minimum": 1, "default": 5},
           "pie_legend": {"type": "string", "enum": ["standard", "wedges", "none"], "default": "standard"}, "pie_sort": {"type": "string", "enum": ["none", "all", "first"], "default": "none"}, "pie_position": {"type": "string", "enum": ["ratio", "even", "stacked"], "default": "ratio"},
           "drop_shadow": {"type": "boolean", "default": False}, "font": {"type": "string", "default": "Inter"}, "size": {"type": "number", "minimum": 4, "maximum": 72, "default": 9, "description": "Label size in points."},
           "series_types": {"type": "object", "description": "Combined graphs: {series index: column | stacked | line | area | null}; works when the graph type is column, stacked, line or area."},
           "column_design": {"type": "object", "description": "{series: [indices] (all when left out), design: name or id (null removes), mode: vertical | uniform | repeat, per: units each repeated design stands for, fraction: chop | scale}."},
           "marker_design": {"type": "object", "description": "{series: [indices], design: name or id (null removes)}: the design replaces the square markers."},
           "name": {"type": "string", "description": "make_design: the design's name."}, "ids": _IDS}),
    _tool("variables", "Variables and data merge: list the variables and data sets; make a variable (text to type, image to a placed image, visibility to any object, graph to a graph's data) bound to an object; bind, unbind, rename or delete one; capture the artboard as a data set or update the shown one; import data sets from CSV (a header row names the variables, an image column holds file paths or URLs the engine can read) or JSON; show a data set (the art changes to it); export writes one PNG, SVG or PDF per data set (and .fpth with fpth) into a folder.",
          {"action": {"type": "string", "enum": ["list", "make", "bind", "unbind", "rename", "delete", "capture", "update", "import", "show", "export"], "default": "list"},
           "kind": {"type": "string", "enum": ["text", "image", "visibility", "graph"], "default": "text"}, "id": {"type": "string", "description": "make and bind: the object to bind."}, "variable": {"type": "string", "description": "A variable's name or id."}, "name": {"type": "string", "description": "make, rename and capture: the new name; show: a data set's name."},
           "data": {"type": ["string", "array", "object"], "description": "import: CSV text, or JSON (an array of objects whose keys are variable names, or {dataSets: [...]})."}, "format": {"type": "string", "enum": ["csv", "json", "png", "svg", "pdf"], "description": "import: csv or json; export: png (default), svg or pdf."},
           "index": {"type": "integer", "minimum": 0, "description": "show and update: the data set's index."}, "folder": {"type": "string", "description": "export: absolute path of the folder to write into (created if missing)."},
           "fpth": {"type": "boolean", "default": False}, "name_variable": {"type": "string", "description": "export: a text variable whose value names each file (the data set's name otherwise)."}, "artboard": {"type": "integer", "minimum": 0}, "scale": {"type": "number", "minimum": 0.1, "maximum": 8, "default": 1}, "data_sets": {"type": "array", "items": {"type": "integer"}, "description": "export: only these data sets."}}),
    _tool("perspective", "Perspective grid and art in perspective, as Illustrator's Perspective Grid and Perspective Selection tools. grid sets up the document's grid: preset one_point, two_point or three_point (laid out on the first artboard) or type 1, 2 or 3, then any of the Define Grid values (cell, viewing angle and distance, horizon height above the ground level, the third vanishing point's distance below the horizon, ground_x and ground_y, station, extents, plane offsets, plane colours and opacity), and show, lock, snap and active_plane; attached art is re-projected whenever the grid changes. Plane coordinates are points on the plane with x along it and y downward (left plane: x up to 0 at the corner; right plane: x from 0; horizontal plane: x up to 0, y up to 0 toward the back), and get reports each plane's extent. draw makes a shape (rectangle, rounded_rectangle, ellipse, polygon, star, line, rectangular_grid, polar_grid) at x, y, width, height in plane coordinates on a plane. place brings existing art onto a plane by a projective transform with its centre at x, y in plane coordinates (default: the plane point under where the art sits) at scale; attach attaches it to a plane where it already looks right; move slides attached art along its plane by dx, dy and dn perpendicular to it (copy duplicates); scale scales it in plane space by sx, sy about its plane-space centre; release keeps the look and detaches it; match_plane moves the grid's plane to the object; get reports the grid, its vanishing points and the attached objects. Type placed on a plane stays editable with set_text and is drawn through the projection.",
          {"action": {"type": "string", "enum": ["get", "grid", "draw", "place", "attach", "move", "scale", "release", "match_plane"], "default": "get"}, "ids": _IDS,
           "preset": {"type": "string", "enum": ["one_point", "two_point", "three_point"]}, "type": {"type": "integer", "enum": [1, 2, 3]},
           "cell": {"type": "number", "minimum": 1, "maximum": 2000, "description": "Gridline every this many points."}, "angle": {"type": "number", "minimum": 0.5, "maximum": 89.5, "description": "Viewing angle in degrees (two and three point)."}, "distance": {"type": "number", "minimum": 1, "description": "Viewing distance in points."},
           "horizon_height": {"type": "number", "description": "Horizon height above the ground level in points."}, "vp3": {"type": "number", "description": "Three point: the third vanishing point's distance below the horizon in points (negative is above); at least twice the viewing distance."},
           "ground_x": _NUM, "ground_y": {"type": "number", "description": "ground_x, ground_y: the grid's origin on the ground level, where the planes meet, in document points."}, "station": {"type": "number", "description": "Horizontal offset of the station point (the centre of vision) from the origin in points."},
           "extent_left": {"type": "number", "minimum": 1}, "extent_right": {"type": "number", "minimum": 1}, "extent_height": {"type": "number", "minimum": 1}, "offset_left": _NUM, "offset_right": _NUM, "offset_horizontal": {"type": "number", "description": "offset_*: move a grid plane parallel to itself, in points."},
           "left_color": {"type": "string", "description": "#rrggbb"}, "right_color": {"type": "string", "description": "#rrggbb"}, "horizontal_color": {"type": "string", "description": "#rrggbb"}, "opacity": {"type": "number", "minimum": 0, "maximum": 100, "description": "Grid opacity in percent."},
           "show": {"type": "boolean"}, "lock": {"type": "boolean"}, "snap": {"type": "boolean", "description": "Snap drawing on a plane to the gridlines."}, "active_plane": {"type": "string", "enum": ["left", "right", "horizontal", "none"]},
           "plane": {"type": "string", "enum": ["left", "right", "horizontal"], "description": "draw, place and attach: the plane (default the active plane)."}, "shape": {"type": "string", "enum": ["rectangle", "rounded_rectangle", "ellipse", "polygon", "star", "line", "rectangular_grid", "polar_grid"], "default": "rectangle"},
           "x": _NUM, "y": _NUM, "width": {"type": "number", "minimum": 0.01}, "height": {"type": "number", "minimum": 0.01}, "scale": {"type": "number", "minimum": 0.001, "default": 1}, "offset": {"type": "number", "description": "place and draw: the plane's offset (default the grid plane's)."},
           "dx": _NUM, "dy": _NUM, "dn": _NUM, "sx": {"type": "number", "description": "Scale factor, 1 keeps the size."}, "sy": _NUM, "copy": {"type": "boolean", "default": False}}),
    _tool("actions", "Actions: list the action sets and their recorded steps (menu commands with their dialog values, transforms, drawing and paint), play one on the open document, or batch it over every .fpth, SVG and PDF file in a folder (or over the document's data sets), saving each result into out with a log file formpth-batch-log.txt.",
          {"action": {"type": "string", "enum": ["list", "play", "batch"], "default": "list"}, "set": {"type": "string", "description": "The action set's name, when two sets have an action with the same name."}, "name": {"type": "string", "description": "The action's name."},
           "source": {"type": "string", "enum": ["folder", "data_sets"], "default": "folder"}, "folder": {"type": "string", "description": "batch: absolute path of the folder of files to process."}, "kinds": {"type": "array", "items": {"type": "string", "enum": ["fpth", "svg", "pdf", "ai"]}, "description": "batch: which files to take (default fpth, svg and pdf)."},
           "out": {"type": "string", "description": "batch: absolute path of the folder for the results and the log (created if missing)."}, "format": {"type": "string", "enum": ["same", "fpth", "svg", "pdf", "png"], "default": "same"}, "name_variable": {"type": "string", "description": "batch over data sets: a text variable that names each file."}, "stop_on_error": {"type": "boolean", "default": False}}),
    _tool("list_commands", "The command catalogue: every menu command and tool formpth has, with its id, menu path, shortcut, parameters, whether Undo can reverse it and whether it can run now. Filter by group (a menu name such as Object or Effect, or Tools) and by a word.",
          {"filter": {"type": "string", "description": "a word in the id, label or menu path"}, "group": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 400}}, read=True, idempotent=True),
    _tool("describe_command", "One catalogue entry in full: menu path, description, parameters and whether it can run now; suggests close ids when the id is unknown.", {"id": {"type": "string"}}, ["id"], read=True, idempotent=True),
    _tool("run_command", "Runs any menu command or tool by its id (see list_commands), on the selection, as the menu would. Ids starting tool. make that tool active.",
          {"command": {"type": "string"}, "id": {"type": "string", "description": "same as command"}, "params": {"type": "object", "description": "the command's parameters, when describe_command lists any"}}),
    _tool("run_commands", "Runs several catalogue commands in order as one undo step, stopping at the first that cannot run.",
          {"steps": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "params": {"type": "object"}}, "required": ["id"]}}}, ["steps"]),
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
_secret: str | None = None
_superseded: collections.deque = collections.deque(maxlen=64)
_delivered: dict[str, str] = {}
BRIDGE_HEADER = "x-formpth-bridge"


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


def _app_origin(request: Request) -> bool:
    origin = request.headers.get("origin") or ""
    if not origin:
        return False
    if origin in config.cors_origins():
        return True
    url = urllib.parse.urlparse(origin)
    if url.scheme != "http" or (url.hostname or "") not in ("localhost", "127.0.0.1", "::1") or url.path not in ("", "/"):
        return False
    ports = {config.FRONTEND_PORT, config.FRONTEND_PORT + 1}
    server = request.scope.get("server")
    if server and server[1]:
        ports.add(int(server[1]))
    try:
        return url.port in ports
    except ValueError:
        return False


def _refuse(status: int, text: str) -> Response:
    return Response(status_code=status, content=json.dumps({"detail": text}), media_type="application/json", headers={"Cache-Control": "no-store"})


def _bridge_refusal(request: Request, current: bool = True) -> Response | None:
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can use the agent bridge.")
    held = request.headers.get(BRIDGE_HEADER) or ""
    if not held or not _secret:
        return _refuse(403, "The agent bridge needs the window's session: reload the formpth window.")
    if current and not secrets.compare_digest(held, _secret):
        return _refuse(409 if held in _superseded else 403, "Another formpth window took over the agent bridge.")
    return None


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
    _put({"id": rid, "name": name, "arguments": args, **({"inapp": True} if _inapp.get() else {})})
    try:
        return await asyncio.wait_for(fut, timeout=timeout)
    except asyncio.TimeoutError:
        return None
    finally:
        _waiting.pop(rid, None)
        _delivered.pop(rid, None)


_OPENABLE = {".fpth", ".svg", ".svgz", ".pdf", ".ai", ".eps", ".epsf", ".ps", ".dxf", ".dwg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".psd", ".psb", ".tif", ".tiff", ".obj", ".glb", ".gltf"}
_PLACEABLE = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".eps", ".dxf", ".dwg", ".pdf", ".ai", ".psd", ".psb", ".tif", ".tiff", ".obj", ".glb", ".gltf"}
_MODELS = {".obj", ".glb", ".gltf"}
_MAX_PARTS = 64 * 1024 * 1024
_EXPORTS = {".svg": "svg", ".pdf": "pdf", ".ai": "ai", ".eps": "eps", ".dxf": "dxf", ".dwg": "dwg", ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp", ".gif": "gif", ".bmp": "bmp", ".psd": "psd", ".tif": "tiff", ".tiff": "tiff"}
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


def _model_parts(path: Path) -> list:
    """The files a model names (OBJ: mtllib and map_ images; glTF: buffers and images), read from its folder."""
    names: list = []
    try:
        if path.suffix.lower() == ".obj":
            head = path.read_bytes()[:1_000_000].decode("utf-8", "replace")
            for line in head.splitlines():
                bits = line.strip().split(None, 1)
                if len(bits) == 2 and bits[0] == "mtllib":
                    names.append(bits[1].strip())
            for mtl in list(names):
                mp = path.parent / Path(mtl.replace("\\", "/")).name
                if mp.is_file():
                    for line in mp.read_text("utf-8", "replace").splitlines():
                        bits = line.strip().split()
                        if len(bits) >= 2 and (bits[0].lower().startswith("map_") or bits[0].lower() == "bump"):
                            names.append(bits[-1])
        elif path.suffix.lower() == ".gltf":
            doc = json.loads(path.read_text("utf-8", "replace"))
            for key in ("buffers", "images"):
                for item in doc.get(key, []):
                    uri = item.get("uri")
                    if isinstance(uri, str) and not uri.startswith("data:"):
                        names.append(urllib.parse.unquote(uri))
    except (OSError, ValueError, AttributeError):
        return []
    out, seen, total = [], set(), 0
    for n in names:
        base = Path(n.replace("\\", "/")).name
        key = base.lower()
        p = path.parent / base
        if key in seen or not p.is_file():
            continue
        size = p.stat().st_size
        if total + size > _MAX_PARTS:
            continue
        total += size
        seen.add(key)
        out.append({"name": base, "data": base64.b64encode(p.read_bytes()).decode()})
    return out


async def _run(name: str, args: dict) -> dict:
    try:
        if name in ("open_file", "place_image"):
            path = _path(args.get("path"), _OPENABLE if name == "open_file" else _PLACEABLE, True)
            if path.stat().st_size > _MAX_OPEN:
                return _fail(f"{path.name} is larger than 512 MB.")
            if name == "place_image" and args.get("link") is True and path.suffix.lower() != ".svg":
                return await _call("__place", {**{k: v for k, v in args.items() if k != "path"}, "name": path.name, "path": str(path), "link": True})
            data = base64.b64encode(await asyncio.to_thread(path.read_bytes)).decode()
            rest = {k: v for k, v in args.items() if k not in ("path", "parts")}
            if path.suffix.lower() in _MODELS:
                rest["parts"] = await asyncio.to_thread(_model_parts, path)
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
    if not _allowed and not _inapp.get():
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
        _inapp.set(claude_code.is_inapp(request.headers.get(claude_code.INAPP_HEADER)))
        out = _ok(req_id, await _run(name, args), modern) if name in NAMES and isinstance(args, dict) else _err(req_id, -32602, f"No tool named {name}")
    else:
        out = _err(req_id, -32601, f"Method not found: {method}")
    return Response(content=json.dumps(out), media_type="application/json")


@router.post("/api/mcp/bridge/session")
async def bridge_session(request: Request) -> Response:
    global _secret
    if not _app_origin(request):
        return _refuse(403, "Only the formpth window can open the agent bridge.")
    if _secret:
        _superseded.append(_secret)
    _secret = secrets.token_urlsafe(32)
    return Response(content=json.dumps({"secret": _secret}), media_type="application/json", headers={"Cache-Control": "no-store"})


@router.get("/api/mcp/bridge/next")
async def bridge_next_get() -> Response:
    return _refuse(405, "The agent bridge takes POST requests from the formpth window only.")


async def _body(request: Request) -> dict:
    try:
        body = json.loads(await request.body() or b"{}")
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


@router.post("/api/mcp/bridge/next")
async def bridge_next(request: Request) -> Response:
    global _seen, _allowed, _declined_until
    held = request.headers.get(BRIDGE_HEADER) or ""
    if _app_origin(request) and held and held in _superseded:
        return Response(status_code=205)
    refused = _bridge_refusal(request)
    if refused:
        return refused
    allowed = (await _body(request)).get("allowed") is True
    if allowed and not _allowed:
        _declined_until = 0.0
    _allowed = allowed
    deadline = time.monotonic() + 20
    eligible = lambda it: allowed or it.get("name") == "__consent__" or it.get("inapp") is True
    while time.monotonic() < deadline:
        if _secret != held:
            return Response(status_code=205)
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
        if found is None or _secret != held:
            continue
        _pending.remove(found)
        if await request.is_disconnected():
            _put(found, front=True)
            return Response(status_code=204)
        _delivered[str(found["id"])] = held
        return Response(content=json.dumps(found), media_type="application/json", headers={"Cache-Control": "no-store"})
    return Response(status_code=204)


@router.post("/api/mcp/bridge/result")
async def bridge_result(request: Request) -> Response:
    refused = _bridge_refusal(request, current=False)
    if refused:
        return refused
    body = await _body(request)
    rid, held = str(body.get("id")), request.headers.get(BRIDGE_HEADER) or ""
    owner = _delivered.get(rid)
    if not owner or not secrets.compare_digest(owner, held):
        return _refuse(403, "That request was not handed to this window.")
    _delivered.pop(rid, None)
    fut = _waiting.get(rid)
    if fut and not fut.done():
        fut.set_result(body.get("result") or {"content": [{"type": "text", "text": "formpth gave no result."}], "isError": True})
    return Response(content=json.dumps({"ok": True}), media_type="application/json")


@router.post("/api/mcp/bridge/stop")
async def bridge_stop(request: Request) -> Response:
    refused = _bridge_refusal(request)
    if refused:
        return refused
    _stop()
    return Response(content=json.dumps({"ok": True}), media_type="application/json")


def _stop() -> None:
    global _allowed, _declined_until
    _allowed = False
    _declined_until = time.monotonic() + 600
    while _pending:
        item = _pending.popleft()
        fut = _waiting.get(item["id"])
        if fut and not fut.done():
            fut.set_result(_fail("Outside agents were turned off in formpth. Ask the person to turn on Allow outside agents (Preferences > Plugins), then retry."))


@router.get("/api/mcp/status")
def status(request: Request) -> dict:
    return {"live": _live(), "allowed": _allowed, "endpoint": f"http://127.0.0.1:{request.url.port or config.port()}/mcp", "tools": len(TOOLS)}
