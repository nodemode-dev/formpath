---
name: type-and-layout
description: Type and layout in formpth through MCP. Owns add_text point, area and path type with fonts, sizes, leading, tracking and alignment, set_text for words and ranges, create_outlines, align and distribute to the selection, the artboard or a key object, transform move, rotate, scale, reflect and shear, arrange stacking order, group, layers with add_layer, set_layer and move_to_layer, and artboards. Load for any typesetting or positioning step.
---

# type-and-layout

## Purpose

Set type that reads well and place everything exactly where the plan says. Hands back the type ids and the final arrangement.

## Preconditions

Positions and type sizes are in the plan.

## Procedure

1. **Point type** for titles and labels: `add_text` with x and the baseline y, `font` (Inter is always present), `style` (Regular, Bold, or a weight such as 600), `size` in points, `color` (black when omitted), `align`.
2. **Area type** for paragraphs: `mode` area with x, y, width, height; text wraps in the frame.
3. **Type on a path**: draw the path, then `add_text` mode path with `path_id`.
4. **Edit**: `set_text` changes the words or styles a range (`start`, `end`), for example one word in a different colour.
5. **Spacing**: `tracking` in thousandths of an em (50 to 200 for spaced capitals), `leading` in points (about 1.2 times the size).
6. **Outlines**: `create_outlines` when the file must not depend on fonts; outlined type is no longer editable as text, so save an editable copy first.
7. **Align**: `align` with `to` artboard for centring on the page; `to` key with `key` to align to one object; distribute_horizontal_space or distribute_vertical_space with `spacing` for even gaps.
8. **Transform**: `transform` dx, dy or x, y to move; rotate (positive is counter-clockwise), scale in percent, reflect, shear; `origin` a keyword or [x, y]; `copy` true to transform a copy; `each` true for each about its own centre.
9. **Order and structure**: `arrange` bring_to_front and send_to_back; `group`; `add_layer` for parts that should be locked or hidden together; `move_to_layer`.
10. **Artboards**: `artboard` add, set, fit_to_art, rearrange for multi-page work.

## Gate

`get_image` shows the type legible, inside the margins, and aligned as planned.

## Hands back

Type ids, whether they are outlined, and the layer structure.
