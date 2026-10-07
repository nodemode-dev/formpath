---
name: tool-author
description: Adding or changing formpth tools in frontend/src/tools. Use for a new drawing, selection, transform, paint, type or view tool, its options in the options bar, its shortcut, cursor, rail slot and flyout, snapping and smart guides while dragging, and overlays such as handles, marquees and previews.
---

# tool-author

A tool is a self-registering module. The rail, its flyouts, the options bar, the cursor and the keyboard routing are built from its declaration, so a new tool changes no shell code.

## The Tool contract (`frontend/src/extensions/registry.ts`)

- Identity: `id`, `label`, `group` (the rail slot it shares), `order`, `shortcut` (for example `P`, `Shift+C`), `icon(engine)` returning an icon key, `hint(engine)` for the status bar, optional `cursor(ctx, p)` from `ui/cursors.ts`.
- Input: `down`, `move`, `up`, `hover`, `dblclick`, `keydown` (return true only for keys consumed; never consume Mod combinations), `cancel`, `activate`, `deactivate`.
- Output: `overlay(ctx, g)` draws in CSS pixels; colours come from `ctx.paint()` (`accent`, `layer`, `smart`, `handle` and more).
- Options: `options(engine)` returns `OptionSpec` entries (`title`, `segment`, `range`, `toggle`, `select`, `readout`, `color`, `number`, `button`), built once and refreshed in place.
- Context: `ctx.snap(p, exclude, { from })` snaps to points, the grid, smart alignment and angles and sets the smart guide overlay; `ctx.snapRect(r, exclude)` snaps a moving box; `ctx.typeAt(...)` starts the text editor.

## Adding a tool

1. Write it in the module of its family (`select`, `pen`, `draw`, `freehand`, `transform`, `paint`, `type`, `view`) or a new module imported from `tools/index.ts`; ids and shortcuts must be unique.
2. Change documents only through `Engine` methods; preview drags with `beginDrag` and `dragTo`, commit once on `up`.
3. Draw its icon in `ui/icons-vector.ts` (24 by 24, `currentColor`, the shared stroke width).
4. Update `.docs/wiki/Tools.md`, `.docs/wiki/Keyboard-Shortcuts.md` and `docs/MANUAL.md`, log it in `frontend/HASHOUT_LOG.md`, then run `ui-verification`.

## Illustrator conventions to keep

Shift constrains to 45 degrees and proportions, Alt draws from the centre or copies while dragging, a click without a drag opens the exact-values dialog, arrow keys during a shape drag change sides, points or grid lines, and Escape cancels the gesture without a history step.
