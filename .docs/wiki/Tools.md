# Tools

Tools live in `frontend/src/tools/`, one module per family, and register through `registerTool` in `frontend/src/extensions/registry.ts`. A tool is an object with an id, a label, a group (its rail slot), an order, a shortcut, an icon and handlers: `down`, `move`, `up`, `hover`, `dblclick`, `keydown`, `cancel`, `activate`, `deactivate`, `overlay` and `options`.

| Module | Tools |
| --- | --- |
| `select.ts` | Selection, Direct Selection, Group Selection, Magic Wand, Lasso |
| `pen.ts` | Pen, Add and Delete Anchor Point, Anchor Point, Curvature |
| `draw.ts` | Rectangle, Rounded Rectangle, Ellipse, Polygon, Star, Flare, Line Segment, Arc, Spiral, Rectangular and Polar Grid |
| `freehand.ts` | Pencil, Smooth, Path Eraser, Join, Paintbrush, Blob Brush, Eraser, Scissors, Knife |
| `transform.ts` | Rotate, Reflect, Scale, Shear, Free Transform, Reshape, Width, Warp, Twirl, Pucker, Bloat |
| `paint.ts` | Eyedropper, Gradient, Mesh, Live Paint Bucket, Live Paint Selection, Shape Builder, Blend, Symbol Sprayer, Measure |
| `puppet.ts` | Puppet Warp (pins over an as-rigid-as-possible mesh from `engine/puppet.ts`) |
| `shaper.ts` | Shaper (gesture recognition and scribbles into Shaper Groups from `engine/shaper.ts`), Intertwine (the editing mode of intertwine objects from `engine/intertwine.ts`) |
| `dimension.ts` | Dimension (linear, angular and radial dimension objects from `engine/dimension.ts`) |
| `graph.ts` | Column, Stacked Column, Bar, Stacked Bar, Line, Area, Scatter, Pie and Radar Graph (live graph groups from `engine/graph.ts`; the Graph Data window is `ui/panels/graph-data.ts`) |
| `type.ts` | Type, Area Type, Type on a Path, Vertical Type, Vertical Area Type, Vertical Type on a Path, Touch Type |
| `view.ts` | Hand, Rotate View, Zoom, Artboard |

The stage hands each tool a `ToolContext`: the engine, the view, the paint tokens, `snap` (point, grid, smart alignment and angle construction) and `snapRect`, `redraw`, `typeAt` and `invalidateTargets`.

A new tool is a new module that calls `registerTool`, imported once from `tools/index.ts`. Nothing else changes.
