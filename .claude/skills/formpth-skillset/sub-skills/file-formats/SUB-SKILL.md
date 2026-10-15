---
name: file-formats
description: formpth file formats in frontend/src/io. Use for the .fpth project format and manifest, SVG import and export, PDF export, reading formpth PDFs and reading any PDF or .ai, PNG, JPEG and WebP export, Export for Screens, placed and linked images, image trace, bundled and installed fonts, and type outlines through opentype.js.
---

# file-formats

## .fpth (`io/project-io.ts`)

A zip of `manifest.json` (`format: com.nodemode.formpth`, `version: 1`, `app`, `document`, `view`) and `images/[key]`. Artboards also carry `rect: [x, y, w, h]`. Image keys are safe names (`img-xxxx.png`). Readers must accept older manifests: add fields, never rename them.

## SVG (`io/svg.ts`)

- Export: `exportSvg(project, { artboard, outlineText, preserve, precision, ids })`. Gradients in user space with midpoint stops expanded, patterns, filters for raster effects (objects with Effect Gallery or Rasterize effects are baked to an image at `rasterPpi`), clip paths, masks, symbols as `defs` and `use`, mesh as quads. With `preserve`, the manifest rides in a `metadata` element with the id `formpth-data` and images carry `data-formpth-src`, so formpth reopens it exactly.
- Import: `importSvg(text, title)` reads transforms, CSS classes, gradients with `href` chains, clip paths, `use` and `symbol`, text, data URI images; named top-level groups become layers.

## PDF (`io/pdf.ts`)

`exportPdf(project, { artboards, preserve, ppi })`: one page per artboard with a flipped page matrix; transparency and blend modes as ExtGState; gradients as shading patterns (Type 2 and 3 with stitching functions); images as DCT or Flate with an SMask; opacity masks are luminosity soft masks, meshes type 6 shadings (`io/pdf-shading.ts`), patterns tiling patterns, freeform gradients type 4 shadings; anything else a PDF cannot express (raster effects, unoutlined text, warped images) is rasterised at `ppi`. The editable document is embedded as `formpth-document.json`; `readPdfNative` finds it.

## PDF and .ai reading (`io/pdf-read.ts`)

`readPdfVector(data, title)` returns `{ doc, assets, pages, skipped, fonts }` for any PDF or PDF-compatible .ai that `readPdfNative` does not recognise. Objects are found by scanning for `n g obj`, object streams are unpacked, Flate (with PNG predictors), ASCIIHex, ASCII85 and DCT decode; encrypted files throw. The content interpreter maps paths, painting, dashes, ExtGState opacity and blend, clipping (as clip groups), colour spaces (gray, RGB and CMYK stay native; ICCBased, Indexed, Separation, DeviceN and Lab convert), axial and radial shadings (as gradients), form XObjects (as groups), images with SMask, and text (point type, ToUnicode or Differences, fonts matched through `FontNames`, runs tracked to the PDF's width by `fitRun`). Type 3 glyphs run as content. Anything left out goes into `skipped`, and font fallbacks into `fonts`, which the open flow reports.

## Raster (`io/raster.ts`)

`renderRegion` draws a region at any scale; `exportRaster` encodes PNG, JPEG or WebP; `exportForScreens` zips several scales and formats.

## Type and fonts (`io/fonts.ts`)

Inter and JetBrains Mono are bundled; installed fonts come from the engine service. `outlineText(node)` converts glyphs to paths with each glyph's transform; PDF and Create Outlines use it.

## Trace (`io/trace.ts`)

Quantize (k-means or threshold), follow region edges, simplify (RDP) and fit curves, and group by colour as even-odd compound paths.
