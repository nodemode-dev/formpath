---
name: files-and-export
description: Files in formpth through MCP. Owns open_file for .fpth, SVG, any PDF or PDF-compatible .ai, EPS, AutoCAD DXF and DWG, and images, place_image, save_project, export_file to SVG, PDF, EPS, DXF, DWG, PNG, JPEG and WebP with scopes, scale, quality, transparency and outlined text, switch_document and document_setup, data merge (variables with action export) and batch processing of a folder (actions with action batch). Load whenever a file is read, placed, saved or delivered.
---

# files-and-export

## Purpose

Read and write files reliably and deliver exactly the formats asked for. Hands back the list of paths written.

## Preconditions

Paths are absolute, and the folder exists. When the person names a folder like Desktop or Downloads, expand it to the absolute home path.

## Procedure

1. **Open**: `open_file` with a .fpth, .svg, .svgz, any PDF or PDF-compatible .ai, or an image (which opens as a new document). A PDF saved by formpth reopens exactly; any other PDF arrives as one artboard per page with editable paths, gradients, clipping, images and point type, and fonts that are not installed are set in their nearest match. Then `get_document` to see what came in. Encrypted PDFs and .ai files saved without PDF compatibility do not open; say so and ask for an unencrypted or PDF-compatible copy.
   - **EPS**: an EPS written by formpth reopens fully editable; any other EPS is read by running its PostScript (paths, fills, strokes, clipping, gradients, simple text); embedded images are left out and the result says so.
   - **DXF** (ASCII, AutoCAD R12 to 2018): `units` says what one drawing unit is (the file's own units by default), `drawing_scale` multiplies it, `layout` picks Model or a paper space layout, `merge_layers` puts every DXF layer in one layer, `fit_artboard` scales the drawing onto a Letter artboard. DXF layers become layers with their colours and lineweights; blocks, hatches, splines, text and MTEXT come in editable.
   - **DWG** (R2000, R2004, R2007, R2010, R2013 and R2018) opens through `open_file` like a DXF, read by formpth itself, with the same `units`, `drawing_scale`, `layout`, `merge_layers` and `fit_artboard`. R13 and R14 need a DWG converter on the computer (ODA File Converter or LibreDWG dwg2dxf); without one, ask for a DXF saved from the CAD program. Proprietary objects (3D solids, surfaces, tables, add-on entities) are left out and the result lists them.
2. **Place**: `place_image` with x, y and width to put a PNG, JPEG, WebP, GIF, or SVG, EPS or DXF art into the open document. A PDF or .ai takes `page` and `crop` (bounding, art, crop, trim, bleed, media) and arrives as editable art, or with `link` true as a linked picture of the page; a PSD takes `psd_import` (objects or flatten); a TIFF takes `page`.
3. **Save editable**: `save_project` to a .fpth path; everything stays editable. Do this before outlining type or expanding.
4. **Export**: `export_file`; the extension picks the format.
   - .svg: scope artboard, document or selection; outline_text true when fonts may be missing where it goes.
   - .pdf: every artboard a page with scope all_artboards; vectors, gradients and transparency kept; formpth reopens it editable.
   - .eps: Level 3 PostScript of an artboard (all_artboards writes a zip with one EPS per artboard); `color` rgb or cmyk; transparency is flattened against what lies below; formpth reopens it editable.
   - .dxf: for CAD. `dxf_version` 2000 (splines, solid hatches for fills, true colours, lineweights) or R12 (polylines with arcs); `units` and `drawing_scale` (100 writes a 1:100 drawing at full size); `outline_text` writes type as outlines instead of TEXT; `scale_lineweights` scales them with the drawing.
   - .dwg: for CAD programs that want the native drawing. Written as an AutoCAD 2000 binary drawing (layers, lines, arcs, circles, ellipses, polylines, splines, text and hatches); `units`, `drawing_scale`, `outline_text` and `scale_lineweights` work as for .dxf, and `dxf_version` R12 is refused because DWG is only written as 2000.
   - .png: scale 2 for crisp screens, transparent true for a cut-out; .jpg with quality; .webp for the web.
5. **Several documents**: `switch_document` by index or name from `get_document`.
6. **Document settings**: `document_setup` units, colour_mode rgb or cmyk (cmyk for print), title.
7. **Data merge** (one design, many variations): `variables` with action make binds a text, image, visibility or graph variable to an object (id); action import takes CSV text whose header row names the variables (image columns hold absolute paths or URLs) or JSON; action show with an index previews one data set (check with `get_image`); action export with folder, format (png, svg or pdf), name_variable and fpth writes one file per data set and reports the paths.
8. **Batch**: `actions` with action list shows the recorded actions; action play runs one on the open document; action batch with name, folder (the .fpth, SVG and PDF files to process) and out (where results and formpth-batch-log.txt go) opens each file, plays the action and saves it in format (same, fpth, svg, pdf or png). source data_sets runs it over the open document's data sets instead.

## Gate

Each export call reported a path and a size in bytes, and the reply lists them.

## Hands back

Every file path written, with its format.
