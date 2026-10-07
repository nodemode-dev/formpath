# Files and Formats

## .fpth projects

A zip with `manifest.json` and `images/`:

```json
{ "format": "com.nodemode.formpth", "version": 1, "app": "formpth", "document": { }, "view": { "activeArtboard": 0, "activeLayer": "..." } }
```

`document` is the engine's document as JSON; artboards also carry `rect: [x, y, w, h]`. Images are stored once under `images/<key>` and referenced by key.

## SVG

Export writes gradients (user space), patterns, clip paths, masks, filters for raster effects, symbols as `use`, and type as `text` or outlines. It can embed formpth's editing data in `<metadata id="formpth-data">`, so formpth reopens its own SVG fully editable. Import reads paths, shapes, transforms, CSS classes, gradients with `href` chains, clip paths, `use` and `symbol`, text and embedded images; top-level named groups become layers.

## PDF

Every artboard is a page. Paths are real vectors; gradients are smooth shadings; transparency and blend modes are graphics states; images are JPEG or Flate with a soft mask; type is outlined. Effects a PDF cannot express are rasterised at the document's resolution. The PDF embeds `formpth-document.json`, so formpth reopens its own PDFs editable.

Other PDFs and PDF-compatible `.ai` files are read by `io/pdf-read.ts`: each page becomes an artboard and a group of its art (paths, clip groups, gradients from axial and radial shadings, images, point type), colours stay gray, RGB or CMYK where the PDF used those spaces, and fonts resolve to installed faces by PostScript name. What has no faithful equivalent (mesh shadings, tiling patterns, soft-mask graphics states, CCITT and JBIG2 images) is reported when the file opens.

## Raster

PNG, JPEG and WebP of an artboard, every artboard, or the selection, at any scale; Export for Screens writes several scales and formats in one zip.
