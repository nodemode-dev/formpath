---
name: ui-shell
description: The formpth interface shell. Use for panels (Layers, Properties, Color, Swatches, Gradient, Stroke, Transparency, Appearance, Symbols, Artboards, Character, Paragraph and the rest), menus and commands, keyboard shortcuts, dialogs, the dock and workspaces, the rail and its flyouts, the options bar, the stage overlay, styles, tokens and themes.
---

# ui-shell

## Where things are

- `src/app.ts`: the composition root. Panels and groups, the dock, the stage, the text editor, file open and save, export, agents, plugins, about 270 menu commands plus one per tool, the menus, the context menu, the keyboard dispatcher, paste and drop, recovery.
- `ui/stage.ts`: the scene canvas (pasteboard, artboards, grid, art, isolation veil) and the overlay canvas (rulers, guides, selection, handles, smart guides, tool overlay).
- `ui/panels/`: one module per panel family; `ui/panels/kit.ts` holds the shared controls (`numField` with arithmetic, `slider` wrapped in a gesture, `seg`, `selectCtl`, `check`, `iconButton`, `section`, `row`).
- `ui/properties.ts`, `ui/layers.ts`, `ui/rail.ts`, `ui/status.ts`, `ui/tabs.ts`, `ui/home.ts`, `ui/app-dialogs.ts`, `ui/form-dialog.ts`.
- Styles: `styles/tokens.css` (every colour, size and z-index), `shell.css`, `panels.css`, `dialogs.css`, `formpth.css`.

## Commands

A command is `{ id, label, keys?, enabled?, checked?, run }` in `app.ts`. Menus list ids; the keyboard dispatcher and native menus read the same table. Never rename an id: agents call them through `run_command`.

## Zero flash

- Build a panel's DOM once in its constructor; update with `patchList` (keyed rows, `create` must fully render the row) and the guarded setters (`setText`, `setClass`, `setStyleVar`, `setHtml` with a key, `setValue`, `setHidden`).
- Queue syncs to one animation frame per panel.
- Reserve widths for changing numbers (`tabular-nums`, `min-width`).
- New z-index needs go in `tokens.css`; popups render into `#overlay-root`.

Run `ui-verification` before hand-back.
