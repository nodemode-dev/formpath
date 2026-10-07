# UI Shell

The shell is formvis's, renamed: `Commands` and menus, the rail with flyouts and Edit Toolbar, the options bar, document tabs, the dock of panel groups with drag and drop and workspaces, the Properties column, dialogs, toasts, themes and the pre-paint theme boot in `index.html`.

- `src/app.ts` is the composition root: panels, dock, stage, text editor, files, export, agents, plugins, about 270 menu commands plus one per tool, menus, keyboard, paste and drop, recovery.
- `ui/stage.ts` owns the two canvases: the scene (pasteboard, artboards, grid, art) and the overlay (rulers, guides, selection, handles, smart guides, the tool overlay).
- Panels are in `ui/panels/` and share the controls in `ui/panels/kit.ts`.
- Lists update with `patchList` (keyed, in place) and every write goes through a guarded setter in `ui/dom.ts`, so nothing rebuilds and nothing flashes.
- Every `z-index` is a token in `styles/tokens.css`; anything that escapes its container renders into `#overlay-root`.
