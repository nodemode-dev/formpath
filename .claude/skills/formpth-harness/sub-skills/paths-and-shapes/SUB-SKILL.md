---
name: paths-and-shapes
description: Drawing and reshaping vector geometry in formpth through MCP. Owns draw_shape live shapes and edit_shape to change their size, corners, sides and points later, draw_path curves from SVG path data or points, edit_anchors, pathfinder, path_operation (offset, outline stroke, simplify, join, divide, split into grid), shape_builder, compound paths and clipping masks. Load for any shape-building or path-editing step.
---

# paths-and-shapes

## Purpose

Build clean geometry with the fewest anchors and keep it editable as long as possible. Hands back the ids of the shapes made.

## Preconditions

The plan gives positions and sizes in points.

## Procedure

1. **Prefer live shapes.** `draw_shape` rectangle, rounded_rectangle (corner_radius), ellipse, polygon (sides), star (points, inner_ratio), line and arc (x2, y2), spiral (turns), flare, rectangular_grid and polar_grid (rows, columns). They stay editable: `edit_shape` changes width and height (the top-left stays put), corner_radius or per-corner radii and corner_type, an ellipse's pie_start and pie_end, a polygon's sides and radius, a star's points and radii, a line's length and angle, without redrawing; `get_object` reports them under `shape`.
2. **Curves.** `draw_path` with an SVG `d` string when the curve is known exactly (C for cubic Beziers, A for arcs); with `points` and `smooth` true for a hand-drawn feel. Set `closed` for shapes.
3. **Reshape.** `get_object` returns the anchors with their handles; `edit_anchors` moves, inserts (segment and t), deletes, or converts to smooth or corner. Indices count across subpaths.
4. **Combine.** Select the shapes, then `pathfinder`: unite (merge), minus_front (cut the top shapes out of the bottom one), intersect, exclude (overlaps become holes), divide (every region its own piece), trim, merge, crop, outline, minus_back. The results are new curved paths with new ids: re-read `get_document`.
5. **Holes without merging.** `compound_path` make with rule evenodd.
6. **Masks.** Put the clipping shape on top, select it with the art, `clipping_mask` make.
7. **Path commands.** `path_operation`: offset (outline at a distance, joins), outline_stroke (a stroke becomes a filled shape), simplify (precision), smooth, join (two open ends), average, reverse, add_anchors, remove_anchors, divide_objects_below, split_into_grid, clean_up.
8. **Shape Builder.** `shape_builder` with points inside the regions to merge, or delete true to remove them.

## Gate

Each shape exists with the intended bounds (check `get_document` bounds or `get_image`) and Pathfinder results have been re-read.

## Hands back

Ids and names of the shapes, and which ones were replaced.
