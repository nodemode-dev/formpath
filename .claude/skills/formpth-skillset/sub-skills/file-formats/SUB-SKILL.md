---
name: file-formats
description: formpth file formats in frontend/src/io. Use for the .fpth project format and manifest, SVG import and export, PDF export, reading formpth PDFs and reading any PDF or .ai, PNG, JPEG and WebP export, Export for Screens, placed and linked images, image trace, bundled and installed fonts, and type outlines through opentype.js.
---

# file-formats

## .fpth (`io/project-io.ts`)

A zip of `manifest.json` (`format: com.nodemode.formpth`, `version: 1`, `app`, `document`, `view`) and `images/[key]`. Artboards also carry `rect: [x, y, w, h]`. Image keys are safe names (`img-xxxx.png`). Readers must accept older manifests: add fields, never rename them.

## SVG (`io/svg.ts`)

- Export: `exportSvg(project, { artboard, outlineText, preserve, precision, ids })`. Gradients in user space with midpoint stops expanded, patterns, filters for raster effects (objects with Effect Gallery or Rasterize effects are baked to an image at `rasterPpi`), clip paths, masks, symbols as `defs` and `use`, mesh as quads. With `preserve`, the manifest rides in a `metadata` element with the id `formpth-data` and images carry `data-formpth-src`, so formpth reopens it exactly.
- Import: `importSvg(text, title)` reads transforms, CSS classes, gradients with `href` chains, `use` and `symbol`, data URI images; named top-level groups become layers. `io/svg-refs.ts` resolves `pattern` (to pattern swatches), `mask` (to opacity masks), `clipPath` and `marker` (to arrowheads when the art matches `ARROWHEADS`, else a group); `io/svg-filter.ts` maps blur, drop shadow and offset-blur-merge chains to live effects; `io/svg-text.ts` maps `text`, `tspan` and `textPath` to styled point text and type on a path. What cannot map (feColorMatrix, feTurbulence, feBlend, feMorphology) is returned in `SvgImport.leftOut` and shown in the open toast. The exporter's own `data-formpth-pattern`, `data-arrows` and `data-formpth-textpath` attributes let a file round-trip with `preserve` false.
- EPS foreign import (`io/ps-read.ts`, async): runs the PostScript, including `image`, `colorimage` and `imagemask` with ASCIIHex, ASCII85, RunLength, Flate and DCT filters (`io/ps-filters.ts`); images arrive as image nodes plus an `assets` map.

## PDF (`io/pdf.ts`)

`exportPdf(project, { artboards, preserve, ppi })`: one page per artboard with a flipped page matrix; transparency and blend modes as ExtGState; gradients as shading patterns (Type 2 and 3 with stitching functions); images as DCT or Flate with an SMask; opacity masks are luminosity soft masks, meshes type 6 shadings (`io/pdf-shading.ts`), patterns tiling patterns, freeform gradients type 4 shadings; anything else a PDF cannot express (raster effects, unoutlined text, warped images) is rasterised at `ppi`. The editable document is embedded as `formpth-document.json`; `readPdfNative` finds it.

## PDF and .ai reading (`io/pdf-read.ts`)

`readPdfVector(data, title, password?)` returns `{ doc, assets, pages, skipped, fonts }` for any PDF or PDF-compatible .ai that `readPdfNative` does not recognise. Objects are found by scanning for `n g obj`, object streams are unpacked, Flate (with PNG predictors), ASCIIHex, ASCII85 and DCT decode. Encrypted files (Standard handler, R2 to R6: RC4 40 and 128, AESV2, AESV3, in `io/pdf-crypt.ts`) open with the empty user password; otherwise it throws `PdfPasswordError` and the open flow asks (`askPassword`), or takes the MCP `open_file` `password`. The content interpreter maps paths, painting, dashes, ExtGState opacity and blend, soft masks (opacity masks on a group), clipping (as clip groups), colour spaces (gray, RGB and CMYK stay native; ICCBased, Indexed, Separation, DeviceN and Lab convert), axial and radial shadings (as gradients), mesh shadings types 4 to 7 (`io/pdf-mesh.ts`: gradient meshes for grids, else a picture of the region), tiling patterns (pattern definitions, coloured and uncoloured), form XObjects (as groups), images with SMask or Mask, and text (point type, ToUnicode or Differences, fonts matched through `FontNames`, runs tracked to the PDF's width by `fitRun`). Type 3 glyphs run as content. Anything left out goes into `skipped`, and font fallbacks into `fonts`, which the open flow reports.

## Place and Open for PDF, AI, PSD and TIFF (`io/place.ts`, `io/psd-read.ts`, `io/tiff-read.ts`, `ui/place-dialog.ts`)

`placeSpecial` is the one entry for Place, Place Linked, drops, `place_image` and Open of PSD and TIFF. With no options it asks through `askPlace` (page thumbnails drawn by `readPdfVector` with `PdfReadOpts`, Crop To, Place As, Photoshop layers); with options (the MCP path) it never asks. `probePdf` lists pages and their five boxes (clipped to the media box); `readPdfVector(..., { pages, box, session })` reads only the chosen page against one shared `PdfSession`. Embed wraps the page art in a group, clipped to the box except for Bounding Box. Link keeps a raster of the page (4x to 16x, 8192 px at most) as an image node whose `ImageLink` also holds `page`, `crop` and `layers`; `LinkManager.read` turns the raw file into that raster again through `displayBlob` whenever the file changes. `readPsdLayers` and `readPsdComposite` read PSD and PSB (8 and 16 bit, raw, RLE, ZIP; RGB, CMYK, Gray, Indexed, Lab, Bitmap); `decodeTiffPage` reads strips and tiles, None, PackBits, LZW, Deflate and JPEG with tables, predictor 2, 1 to 16 bit, planar or chunky. CMYK goes through the document's CMYK profile when one is set, else the plain formula. Neither writes anything; placing and opening are one undo step each.

## Raster (`io/raster.ts`)

`renderRegion` draws a region at any scale; `exportRaster` encodes PNG, JPEG or WebP; `exportForScreens` zips several scales and formats.

## Type and fonts (`io/fonts.ts`)

Inter and JetBrains Mono are bundled; installed fonts come from the engine service. `outlineText(node)` converts glyphs to paths with each glyph's transform; PDF and Create Outlines use it.

## Trace (`io/trace.ts`)

Quantize (k-means or threshold), follow region edges, simplify (RDP) and fit curves, and group by colour as even-odd compound paths.
