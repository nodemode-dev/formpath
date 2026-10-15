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
4. **Strokes.** `set_stroke`: width, cap round and join round for friendly line art, align inside for strokes that must not grow the shape, `dash` for dashed lines, `start_arrow` and `end_arrow` for connectors, `profile` for tapered brush-like lines. A gradient stroke (`set_paint` stroke `{type: linear, stops}`) takes `gradient_mode`: along runs the colours from the path's start to its end round every curve (a fading trail, a rainbow ribbon), across runs them from one edge of the stroke to the other (a tube or a bevel).
5. **Stacking appearance.** `set_appearance` add_fill or add_stroke puts another fill or stroke on top: an outline outside a fill, a double stroke for a badge. `items` replaces the whole stack bottom to top. `opacity` and `blend_mode` (multiply for shadows, screen for light).
   - An effect can sit on one fill or stroke: `apply_effect` with `item` (the index in `get_object`'s ap.items, 0 at the bottom) roughens only the fill, blurs only a glow stroke under a sharp one, or offsets only an outline stroke.
   - Groups and layers have their own stack: `set_appearance` with a group's or layer's id adds fills and strokes that draw over its contents.
   - Transparency: `set_object` `knockout` on for a group whose see-through parts should not show each other (overlapping 50 percent shapes then show only the top one where they overlap); `knockout_shape` on a member makes it knock out only as much as it is opaque; `isolate` keeps blend modes inside the group. `opacity_mask` make uses the top object as a luminance mask of the others; options sets clip, invert, disabled and linked.
6. **Reuse.** `graphic_style` create from a styled object (it stays linked), then apply to others; redefine with `ids` of a restyled object updates every object still linked; break_link ends the link. `graphic_style` libraries lists the built-in libraries (shadows, buttons, outlines, textures, scribbles) and apply with `library` and `name` adds one of their styles and applies it.
7. **Recolour.** `recolor` action map with `{from: to}` hex pairs, palette to fit a list of colours, grayscale, invert, cmyk, saturate with amount. `colors` reduces busy art to that many colours (tints kept), `group` recolours with a document colour group or a swatch library (`seasons:Autumn`), `harmony` with `base` applies a harmony rule. To recolour every object of roughly one colour, `select_similar` with `fill_tolerance` (about 20 for near matches) first, then `set_paint` without ids.
8. **Libraries and groups.** `swatch_library` list shows the built-in palettes (brights, pastels, skin_tones, earth_tones, metals, web, grayscale, spectrums, sky_water, fades, lines, dots, seasons, spot_inks); load brings one (or a group, or some names) into the Swatches panel. `swatch_group` makes, moves, renames and ungroups colour groups. For print, `add_swatch` with `spot` true makes a spot colour (its own plate in PDF) and `tint_of` with `tint` makes its tints.
9. **Colour management.** `list_color_profiles` first for exact names. `set_color_settings` with `cmyk_profile` (for example formpth Generic CMYK) makes CMYK colours display and convert through that ICC profile; none returns to the simple formula. `convert_to_profile` changes the numbers of every colour while keeping the look, as one undo step; `set_color_settings` only changes how the numbers are read. `proof_colors` on shows a soft proof in the window only; exports and `get_image` are unaffected.

## Gate

`get_image` shows the intended colours; no object that should be painted shows the default white fill and black stroke.

## Hands back

The swatch names, any graphic style names, and the objects painted.
