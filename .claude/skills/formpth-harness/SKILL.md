---
name: formpth-harness
description: Draws and edits vector artwork in formpth, the Illustrator-style editor, through its MCP server. Use whenever someone asks to make a poster, flyer, logo, icon, badge, sticker, diagram, infographic, pattern or illustration; to combine, recolour, outline type or apply effects to vector shapes; or to open, save or export SVG, PDF, PNG or .fpth files in formpth, even when they never name formpth or MCP. Covers get_document, get_image, draw_shape, draw_path, add_text, set_paint, pathfinder, apply_effect, export_file and 56 more tools.
---

# formpth-harness

formpth is a vector illustration editor that runs on this computer; its MCP server lets an agent draw in the open window with the same engine a person uses. Tool access alone produces improvised, unchecked art. This pack is the knowledge layer: how to look before drawing, plan in points, build with live shapes and Pathfinder, paint and type well, check every step by looking at it, and deliver files that stay editable.

## How this pack is laid out

```
formpth-harness/
  SKILL.md                         you are here, the orchestrator
  references/tools.md              every tool and parameter (generated, never edit)
  references/coordinates-and-paint.md   points, artboards, colours, gradients, ids
  evals/evals.json                 evaluations and trigger tests for this pack
  sub-skills/
    harness-director/              intake, the session ledger, phase gates
    illustration-workflows/        recipes: poster, logo, icon set, diagram, pattern, badge
    paths-and-shapes/              live shapes, paths, anchors, Pathfinder, compound, clipping
    paint-and-appearance/          fills, strokes, gradients, swatches, appearance, recolour
    type-and-layout/               type, outlines, align, transform, layers, artboards
    effects-and-live-objects/      effects, blends, envelopes, repeats, symbols, brushes, live paint, mesh, trace
    files-and-export/              open, place, save, export, scopes and formats
    troubleshooting/               consent, engine offline, stale ids, recovery
    tool-catalog-author/           keeping this pack in step with the tool catalogue
```

A path inside a `SUB-SKILL.md` resolves against that specialist's own folder; a sibling resolves under `sub-skills/[name]/SUB-SKILL.md`; the two pack-wide references resolve from the pack root.

## Routing

| If the request is about | Load |
| --- | --- |
| Any drawing request, a brief, anything unscoped | `harness-director`, which loads the rest |
| A poster, flyer, logo, icon set, badge, diagram, pattern, social post | `illustration-workflows` |
| Shapes, curves, anchors, combining or cutting shapes, holes, masks | `paths-and-shapes` |
| Colours, gradients, strokes, dashes, arrows, opacity, swatches, recolouring | `paint-and-appearance` |
| Words on the art, fonts, outlines, alignment, moving and rotating, layers, artboards | `type-and-layout` |
| Shadows, glows, warps, roughen, blends, repeats, symbols, brushes, patterns, colouring line art, soft mesh colour, tracing an image | `effects-and-live-objects` |
| Opening, placing, saving, exporting, file formats, sizes for screens | `files-and-export` |
| A tool error, no answer, the window asking permission, wrong ids | `troubleshooting` |
| The tool catalogue changed, this pack is out of date | `tool-catalog-author` |

## Phase order

1. **Look.** `get_document` then `get_image`. Gate: the artboard sizes and the ids of anything to keep are known.
2. **Plan.** Decide the artboard, the grid of positions in points, the palette and the type sizes before the first draw call. Gate: the plan is written as numbers.
3. **Build.** Draw back to front; pass `fill` and `stroke` inline; name objects that matter. Gate: each call returned ok and its id is recorded.
4. **Check.** `get_image` after every few changes and before delivering; fix what looks wrong. Gate: the last image matches the plan.
5. **Deliver.** `save_project` for an editable copy, `export_file` for each requested format, at absolute paths. Gate: every path the tool reported exists in the reply.

Phases 1 and 4 are never skipped: drawing blind is the failure this pack exists to prevent.

## Hard rules

- Coordinates are points (1/72 inch), x right, y down, origin at the first artboard's top-left. `draw_shape` x and y are the top-left of the bounds; `add_text` y is the baseline.
- Positive `rotate` turns counter-clockwise. Gradient `angle` 0 runs left to right, 90 runs bottom to top.
- Ids come only from `get_document` or a tool's reply; never invent one, and re-read after Pathfinder, expand, outlines or undo, which replace objects.
- Every call is one undo step; `undo` reverses mistakes, never `delete_objects` of art the person made.
- File tools take absolute paths in folders that exist.
- The first call may wait while the window asks the person to allow agents; tell them to answer in formpth.

## Verification bar

Do not report a drawing as done without: the final `get_image` looked at and described in one sentence, the list of files written with their paths, and any request left undone named with the reason. The pack's own evaluations live in `evals/evals.json`.

## What good usage looks like

> Make a 1080 by 1080 px social post for a jazz night on Friday: deep blue gradient background, a gold saxophone-like curve, the title in bold, and export it as PNG and SVG to my Desktop.
