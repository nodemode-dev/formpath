---
name: paint-and-appearance
description: Colour and appearance in formpth through MCP. Owns set_paint fills and strokes with colours, swatches, linear or radial gradients and freeform gradients, color_harmony palettes from the Color Guide, select_similar by colour, set_stroke weight, caps, joins, dashes, arrowheads and width profiles, set_appearance multiple fills and strokes, opacity and blend modes, add_swatch with global and spot colours, graphic_style, and recolor maps and palettes. Load for any paint step.
---

# paint-and-appearance

## Purpose

Give every object the paint the plan calls for, consistently, and make palettes reusable. Hands back the palette as swatches when the art will be edited again.

## Preconditions

The palette is decided as hex values (or CMYK for print).

## Procedure

1. **Palette first.** For a palette used more than twice, `add_swatch` each colour with `global` true; then paint by swatch name, and one swatch edit recolours everything. When only a base colour is decided, `color_harmony` with a `rule` (analogous for calm, complementary or split_complementary for contrast, triad for playful) returns five related colours and can `save_group` them as swatches.
2. **Paint inline.** Pass `fill` and `stroke` on `draw_shape` and `draw_path`; use `set_paint` with `ids` to change existing art. `set_paint` without ids also changes the paint new art gets.
3. **Gradients.** `{type, angle, stops}`: angle 0 left to right, 90 bottom to top. Two or three stops read better than many. Radial for glows and spheres. For soft multi-colour fields (backgrounds, blobs, skies) use a freeform fill: `{type: freeform, points: [{x, y, color, spread}]}` with x, y and spread as fractions of the object (0.5, 0.5 is its centre), or just `{type: freeform, colors: [...]}`; `mode` lines blends the colours along a path through the points.
4. **Strokes.** `set_stroke`: width, cap round and join round for friendly line art, align inside for strokes that must not grow the shape, `dash` for dashed lines, `start_arrow` and `end_arrow` for connectors, `profile` for tapered brush-like lines.
5. **Stacking appearance.** `set_appearance` add_fill or add_stroke puts another fill or stroke on top: an outline outside a fill, a double stroke for a badge. `items` replaces the whole stack bottom to top. `opacity` and `blend_mode` (multiply for shadows, screen for light).
6. **Reuse.** `graphic_style` create from a styled object, then apply to others.
7. **Recolour.** `recolor` action map with `{from: to}` hex pairs, palette to fit a list of colours, grayscale, invert, cmyk, saturate with amount. To recolour every object of roughly one colour, `select_similar` with `fill_tolerance` (about 20 for near matches) first, then `set_paint` without ids.

## Gate

`get_image` shows the intended colours; no object that should be painted shows the default white fill and black stroke.

## Hands back

The swatch names, any graphic style names, and the objects painted.
