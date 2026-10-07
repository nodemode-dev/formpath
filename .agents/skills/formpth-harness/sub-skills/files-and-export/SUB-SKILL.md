---
name: files-and-export
description: Files in formpth through MCP. Owns open_file for .fpth, SVG, formpth PDFs and images, place_image, save_project, export_file to SVG, PDF, PNG, JPEG and WebP with scopes, scale, quality, transparency and outlined text, switch_document and document_setup. Load whenever a file is read, placed, saved or delivered.
---

# files-and-export

## Purpose

Read and write files reliably and deliver exactly the formats asked for. Hands back the list of paths written.

## Preconditions

Paths are absolute, and the folder exists. When the person names a folder like Desktop or Downloads, expand it to the absolute home path.

## Procedure

1. **Open**: `open_file` with a .fpth, .svg, .svgz, a PDF or .ai saved by formpth, or an image (which opens as a new document). Other PDFs and .ai files are not readable yet; say so and suggest exporting SVG from the other app.
2. **Place**: `place_image` with x, y and width to put a PNG, JPEG, WebP, GIF or SVG into the open document.
3. **Save editable**: `save_project` to a .fpth path; everything stays editable. Do this before outlining type or expanding.
4. **Export**: `export_file`; the extension picks the format.
   - .svg: scope artboard, document or selection; outline_text true when fonts may be missing where it goes.
   - .pdf: every artboard a page with scope all_artboards; vectors, gradients and transparency kept; formpth reopens it editable.
   - .png: scale 2 for crisp screens, transparent true for a cut-out; .jpg with quality; .webp for the web.
5. **Several documents**: `switch_document` by index or name from `get_document`.
6. **Document settings**: `document_setup` units, colour_mode rgb or cmyk (cmyk for print), title.

## Gate

Each export call reported a path and a size in bytes, and the reply lists them.

## Hands back

Every file path written, with its format.
