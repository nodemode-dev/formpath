# Recipes

## Contents

- Poster or flyer
- Logo or wordmark
- Icon or icon set
- Badge or sticker
- Diagram or infographic
- Seamless pattern
- Social post

Each recipe is a sequence of tool calls; check with `get_image` where it says check.

## Poster or flyer

1. `new_document` at the print size (Letter 612 by 792, A4 595 by 842) or the screen size.
2. Background: `draw_shape` rectangle covering the artboard with a gradient `fill` and `stroke` none, `name` Background; then `set_object` locked true so later selections skip it.
3. Hero shape: live shapes and `draw_path` curves; combine with `pathfinder` unite or minus_front.
4. Title: `add_text` point type, bold, 8 to 12 percent of the width in size; `align` horizontal_center to the artboard.
5. Body and details: smaller `add_text`, area type for paragraphs (`mode` area with width and height).
6. Check.
7. Depth: `apply_effect` stylize.drop_shadow on the hero, low opacity.
8. Check, then `create_outlines` on the type only if the person asked for outlined files.
9. `save_project`, `export_file` pdf for print, png at scale 2 for screens.

## Logo or wordmark

1. `new_document` 1000 by 1000 pt.
2. Mark: build from live shapes (circles, rounded rectangles, polygons), then `pathfinder` unite, minus_front or intersect into one or two compound shapes. Keep strokes off; logos are fills.
3. Wordmark: `add_text`, then `set_text` tracking for spacing; `create_outlines` so the mark needs no font.
4. `align` mark and wordmark, `group` them.
5. Check at two sizes: `get_image` with max_size 1024 and 128; small sizes reveal thin parts.
6. Colour variants: `duplicate_objects` with dx, then `recolor` action map or grayscale.
7. `artboard` fit_to_art, `export_file` svg and png.

## Icon or icon set

1. `new_document` 512 by 512 px per icon, or several artboards (`artboards` count) for a set.
2. Keep a 32 px keyline margin; use a single stroke width (for example 32 on 512) with round caps and joins, `fill` none.
3. Draw with `draw_shape` and `draw_path`; snap numbers to whole pixels.
4. `path_operation` outline_stroke, then `pathfinder` unite, so the icon is filled shapes.
5. Check each artboard.
6. `export_file` with scope all_artboards to svg, and png at scales 1 and 0.5.

## Badge or sticker

1. Base: `draw_shape` star with many points (20 to 40) and inner_ratio 0.9 for a seal, or a circle.
2. Ring: `duplicate_objects`, `transform` scale 90 about the centre, stroke only.
3. Curved text: `draw_shape` ellipse as a path guide, `add_text` mode path with path_id.
4. Centre art and text; `group`.
5. Sticker edge: `path_operation` offset 12 on a copy of the outline, white fill, sent to back.
6. Check, export.

## Diagram or infographic

1. Grid: decide columns and row heights; draw boxes with `draw_shape` rounded_rectangle.
2. Labels: `add_text` centred in each box (`align` horizontal_center and vertical_center with `to` key and the box as key).
3. Connectors: `draw_shape` line or `draw_path`, then `set_stroke` end_arrow triangle.
4. `align` distribute_horizontal_space with spacing for even gaps.
5. Charts: `graph` with type (column, stacked, bar, stackedBar, line, area, scatter, pie, radar), x, y, width and height of the plot body and data {series, categories, values} or table text; labels and legend sit outside the body. The reply lists each series' group id: `set_paint` on that id recolours the series and survives later data edits (`graph` with id and new data). series_types {index: line} draws one series as a line over columns.
6. Check, export svg.

## Seamless pattern

1. Draw the motif inside a square tile area.
2. `make_pattern` with name and tile grid or brick_by_row; `apply_to` the shape to fill.
3. Check at two zooms (`get_image` of the selection and of the artboard).

## Social post

1. `new_document` 1080 by 1080 px (or 1080 by 1920 for a story) with units px.
2. Follow the poster recipe with type at least 64 px for the title.
3. `export_file` png at scale 1 and jpg with quality 0.9.
