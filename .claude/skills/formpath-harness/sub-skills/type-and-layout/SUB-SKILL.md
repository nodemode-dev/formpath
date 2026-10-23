---
name: type-and-layout
description: Type and layout in formpath through MCP. Owns add_text point, area and path type with fonts, sizes, leading, tracking and alignment, set_text for words, ranges, small caps and OpenType features, text_flow threading and text wrap, text_style character and paragraph styles, find_font, create_outlines, retype, align and distribute to the selection, the artboard or a key object, transform move, rotate, scale, reflect and shear, arrange stacking order, group, layers with add_layer, set_layer and move_to_layer, and artboards. Load for any typesetting or positioning step.
---

# type-and-layout

## Purpose

Set type that reads well and place everything exactly where the plan says. Hands back the type ids and the final arrangement.

## Preconditions

Positions and type sizes are in the plan.

## Procedure

1. **Point type** for titles and labels: `add_text` with x and the baseline y, `font` (Inter is always present), `style` (Regular, Bold, or a weight such as 600), `size` in points, `color` (black when omitted), `align`.
2. **Area type** for paragraphs: `mode` area with x, y, width, height; text wraps in the frame. `set_text` with `area_rows`, `area_columns`, `area_row_gutter`, `area_gutter`, `area_inset` and `area_flow` splits the frame into a grid; `first_baseline` (ascent, cap, leading, x, em, fixed, legacy) with `first_baseline_min` sets how far the first line sits below the top.
3. **Type on a path**: draw the path, then `add_text` mode path with `path_id`. `set_text` with `path_effect` (rainbow, skew, ribbon, stair, gravity), `path_flip`, `path_align` (baseline, ascender, descender, center), `path_spacing` and `path_start` / `path_end` (fractions of the path) shapes and places it.
   - **Vertical type** for Japanese, Chinese and Korean: `add_text` with `orientation` vertical (point, area or path); columns run right to left, CJK stands upright and Latin turns 90 degrees clockwise (`set_text` `upright_latin` true stands it upright). Use a CJK font such as Noto Sans CJK JP so outlines and PDF carry every glyph; `set_text` `orientation` switches an existing object.
4. **Edit**: `set_text` changes the words or styles a range (`start`, `end`), for example one word in a different colour. `caps` small gives small capitals; `features` turns on OpenType features (`frac` for fractions, `tnum` for tabular figures in tables, `liga`, `onum`, `ss01` and so on) where the font has them. `find_font` lists the fonts in use and replaces one everywhere.
5. **Spacing**: `tracking` in thousandths of an em (50 to 200 for spaced capitals), `leading` in points (about 1.2 times the size). `kerning` optical evens pairs from the letter shapes (good for display type and fonts with weak kerning).
   - **Variable fonts**: with an installed variable font (find_font lists fonts in use; the result of `set_text` notes when a font has no axes), `axes` sets values by tag for a range, for example {"wght": 650} or {"wdth": 85}; {} returns to the default instance. A named instance also works as `style` (SemiBold).
   - **Paragraphs**: `hyphenate` true (or a `hyphenation` object: min_word, after_first, before_last, limit, zone, capitalized) breaks long words in area type; `justification` sets [min, desired, max] word_spacing, letter_spacing and glyph_scaling for `align` justify, justify_center, justify_right or justify_all. `tabs` sets stops (position in points from the frame's left, align left, center, right or decimal, optional leader such as "."); separate columns in the text with \t. `list` type bullet or number (format 1, 01, a, A, i, I) adds markers to every paragraph.
   - **Single characters**: `rotation` turns each character of a range about its centre. `touch` with an `index` moves (x, y, y down), scales (h_scale, v_scale) or rotates one character on its own while the text stays editable; reset true clears it.
6. **Long copy**: when `get_object` or the result of `add_text` reports `overflow` true, the frame is too small. Make another frame (area type, or a closed path) and `text_flow` thread with the ids in reading order; the story flows on. `text_flow` wrap on an image or shape that sits above area type in the same layer makes the paragraphs run around it (`offset` in points).
7. **Consistency**: for a heading and body system, set one example, then `text_style` create (kind char for a run, para for the whole paragraph) and `text_style` apply to the rest by name; `redefine` after changing the example updates every use.
8. **Outlines**: `create_outlines` when the file must not depend on fonts; outlined type is no longer editable as text, so save an editable copy first.
9. **Font Match** (outlined type or text in a placed image back to live type): `retype` with the ids lists the 10 closest installed fonts and the text it read. Pass `text` when you know the words (required for images unless the person's model reads images). Then `retype` again with `apply` true and `pick` (or `font` and `style`) replaces the outlines with live text sized and placed to match; for an image the text goes on top and `keep_image` false removes the image. A `region` in points reads only part of an image.
9. **Align**: `align` with `to` artboard for centring on the page; `to` key with `key` to align to one object; distribute_horizontal_space or distribute_vertical_space with `spacing` for even gaps.
10. **Transform**: `transform` dx, dy or x, y to move; rotate (positive is counter-clockwise), scale in percent, reflect, shear; `origin` a keyword or [x, y]; `copy` true to transform a copy; `each` true for each about its own centre.
11. **Order and structure**: `arrange` bring_to_front and send_to_back; `group`; `add_layer` for parts that should be locked or hidden together; `move_to_layer`.
12. **Artboards**: `artboard` add, set, fit_to_art, rearrange for multi-page work.

## Gate

`get_image` shows the type legible, inside the margins, and aligned as planned, and no area type reports `overflow` true unless the plan cuts the copy.

## Hands back

Type ids, whether they are outlined, and the layer structure.
