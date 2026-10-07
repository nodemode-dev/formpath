---
name: effects-and-live-objects
description: Live effects and live objects in formpth through MCP. Owns apply_effect (warps, roughen, zig zag, pucker and bloat, twist, transform, drop shadow, glows, feather, round corners, scribble, offset path, gaussian blur, convert to shape), expand, make_blend, envelope, repeat radial, grid and mirror, symbol, apply_brush, make_pattern and image_trace. Load when the art needs depth, distortion, repetition or a traced image.
---

# effects-and-live-objects

## Purpose

Add depth and repetition that stay editable until the person decides to expand them. Hands back which objects carry live effects or are live objects.

## Preconditions

The base shapes exist and are painted.

## Procedure

1. **Discover parameters.** `apply_effect` with list true returns every effect id with its parameters and defaults; pass only the parameters to change in `params`.
2. **Depth.** stylize.drop_shadow (opacity 30 to 50, blur 6 to 12, offsets 4 to 8 points) and stylize.outer_glow; stylize.inner_glow for embossed looks; blur.gaussian for soft backgrounds.
3. **Character.** distort.roughen for hand-made edges, distort.zig_zag for waves, distort.pucker_bloat for flowers, stylize.round_corners to soften polygons, warp.arc, warp.flag and the other warps for banners and type.
4. **Envelopes** reshape groups and type: `envelope` warp with a style and bend, mesh with rows and columns, or top_object to pour the art into the top shape.
5. **Blends** make in-between steps: select two shapes, `make_blend` with steps, or spacing smooth for colour gradients between shapes.
6. **Repeats**: `repeat` radial (instances, radius) for flowers, dials and mandalas; grid (rows, columns, spacing) for patterns; mirror for symmetry.
7. **Symbols**: `symbol` create from art, then place instances; editing the symbol updates every instance.
8. **Brushes**: `apply_brush` with list true to see the brushes; calligraphic for pen-like strokes, art brushes to stretch art along a path.
9. **Patterns**: `make_pattern` to turn a motif into a fill.
10. **Image trace**: `place_image` then `image_trace` with a preset (black_and_white, colors_6, silhouettes, line_art, high_fidelity_photo) and ignore_white for logos on white.
11. **Expand** only when asked or when a format needs plain paths: `expand` what appearance or object.

## Gate

`get_image` shows the effect at the intended strength; nothing is expanded the person did not ask to expand.

## Hands back

The objects with live effects or live objects, and anything expanded.
