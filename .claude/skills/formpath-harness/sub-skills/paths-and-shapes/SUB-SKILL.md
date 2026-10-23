---
name: paths-and-shapes
description: Drawing and reshaping vector geometry in formpath through MCP. Owns draw_shape live shapes and edit_shape to change their size, corners, sides and points later, draw_path curves from SVG path data or points, edit_anchors, pathfinder, path_operation (offset, outline stroke, simplify, join, divide, split into grid), shape_builder, shaper (sketched shapes and scribbles), compound paths, clipping masks, puppet_warp, add_dimension and perspective (grid and art on its planes). Load for any shape-building or path-editing step.
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
5. **Holes without merging.** `compound_path` make: it keeps the bottom path's fill rule (nonzero by default) and turns the paths above it the other way, so they cut holes where they overlap it. `attributes` fill_rule evenodd makes every other nested area a hole whatever the direction (also for one self-intersecting path, such as a star drawn in one stroke); under nonzero, `attributes` reverse with the id of one path inside the compound turns its hole into a fill or back.
6. **Masks.** Put the clipping shape on top, select it with the art, `clipping_mask` make.
7. **Path commands.** `path_operation`: offset (outline at a distance, joins), outline_stroke (a stroke becomes a filled shape), simplify (precision), smooth, join (two open ends), average, reverse, add_anchors, remove_anchors, divide_objects_below, split_into_grid, clean_up.
8. **Shape Crafter.** `shape_builder` with points inside the regions to merge, or delete true to remove them.
9. **Bend a figure.** `puppet_warp` with pins on the art: a pin with no to_x, to_y holds that spot, a moved pin drags the art there and the rest bends as rigidly as it can (no shear, no collapse). Pin the parts that must stay (two or three pins), then move one; rotate twists the art around a pin. Paths, groups and compound paths stay paths; type and images go into an envelope mesh.
10. **Dimensions.** `add_dimension` linear (two points, orientation horizontal, vertical or aligned, offset to the dimension line), angular (vertex, then a point on each arm; offset is the arc radius) or radial (circle with a circle's id, or centre and rim points, or from three_points). Units default to the document's; precision, scale (100 for 1:100), arrow, font, size, text_position, color and weight style it. The dimension stays live (moving it keeps it measuring); `add_dimension` with ids and no points restyles existing ones; `expand` turns it into paths and type.
11. **Sketch shapes.** `shaper` draw with a rough outline as points (a few dozen along a rectangle, circle, ellipse, triangle, polygon or a near-straight line) returns the live shape it recognised. `shaper` scribble with a zigzag of points: inside one overlap it punches the overlap out, across several regions it merges them, over one shape alone it deletes that shape; overlapping shapes become a Shaper Group whose faces recompute when its shapes change. `shaper` fill colours one face at x, y; expand makes plain paths.
12. **Perspective.** `perspective` grid with preset two_point (or one_point, three_point) sets up and shows the grid; get reports each plane's extent in plane coordinates (x along the plane, y down, the corner at 0, 0) and the vanishing points. draw puts a rectangle, ellipse, polygon, star, line or grid on a plane at x, y, width, height in those coordinates; place brings existing art (type too, which stays editable with set_text) onto a plane centred at x, y; move slides it along its plane (dx, dy) or perpendicular to it (dn), with copy for a duplicate; scale resizes it in plane space. Changing the grid later re-projects everything attached; release makes it plain art.

## Gate

Each shape exists with the intended bounds (check `get_document` bounds or `get_image`) and Pathfinder results have been re-read.

## Hands back

Ids and names of the shapes, and which ones were replaced.
