---
name: file-formats
description: formpth file formats in frontend/src/io. Use for the .fpth project format and manifest, SVG import and export, PDF export and reading formpth PDFs, PNG, JPEG and WebP export, Export for Screens, placed and linked images, image trace, bundled and installed fonts, and type outlines through opentype.js.
---

# file-formats

## .fpth (`io/project-io.ts`)

A zip of `manifest.json` (`format: com.nodemode.formpth`, `version: 1`, `app`, `document`, `view`) and `images/[key]`. Artboards also carry `rect: [x, y, w, h]`. Image keys are safe names (`img-xxxx.png`). Readers must accept older manifests: add fields, never rename them.

## SVG (`io/svg.ts`)

- Export: `exportSvg(project, { artboard, outlineText, preserve, precision, ids })`. Gradients in user space with midpoint stops expanded, patterns, filters for raster effects, clip paths, masks, symbols as `defs` and `use`, mesh as quads. With `preserve`, the manifest rides in a `metadata` element with the id `formpth-data` and images carry `data-formpth-src`, so formpth reopens it exactly.
- Import: `importSvg(text, title)` reads transforms, CSS classes, gradients with `href` chains, clip paths, `use` and `symbol`, text, data URI images; named top-level groups become layers.

## PDF (`io/pdf.ts`)

`exportPdf(project, { artboards, preserve, ppi })`: one page per artboard with a flipped page matrix; transparency and blend modes as ExtGState; gradients as shading patterns (Type 2 and 3 with stitching functions); images as DCT or Flate with an SMask; anything a PDF cannot express (raster effects, masks, meshes, unoutlined text) is rasterised at `ppi`. The editable document is embedded as `formpth-document.json`; `readPdfNative` finds it.

## Raster (`io/raster.ts`)

`renderRegion` draws a region at any scale; `exportRaster` encodes PNG, JPEG or WebP; `exportForScreens` zips several scales and formats.

## Type and fonts (`io/fonts.ts`)

Inter and JetBrains Mono are bundled; installed fonts come from the engine service. `outlineText(node)` converts glyphs to paths with each glyph's transform; PDF and Create Outlines use it.

## Trace (`io/trace.ts`)

Quantize (k-means or threshold), follow region edges, simplify (RDP) and fit curves, and group by colour as even-odd compound paths.
