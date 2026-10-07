---
name: ui-verification
description: The throttled browser verification every formpth UI change passes before hand-back. Use after touching any DOM, CSS, stage, panel, dialog or reveal code, when checking for flashes, font reflow, layout shift, blank canvas frames or rebuilt rows, or when asked whether a UI change was verified.
---

# ui-verification

Flashes and layout jumps are transients a fast machine hides, so verification runs slow and records.

## Procedure

1. Build (`./formpth build`) and serve from the engine (`./formpth serve`), or run the dev pair (`./formpth boot`).
2. Drive Chromium with Playwright. Over the DevTools protocol set `Emulation.setCPUThrottlingRate` to 4 or more, `Network.emulateNetworkConditions` to a slow profile, and disable the cache.
3. Install two observers before load: a `layout-shift` PerformanceObserver, and a MutationObserver counting keyed nodes (`data-key`) removed and replaced within one batch. A moved node is not a rebuild.
4. Hard reload and exercise every touched path with real input: new document, draw each shape, pen path, type, select, move, scale, Layers rows (visibility, lock, rename, drag), panels (Color, Gradient stops, Appearance), menus and dialogs, undo and redo, save, export, theme switch, resize.
5. Pass means: layout shift 0, rebuilt keyed nodes 0, page and console errors 0, no blank stage frames while a document is open.

Report exactly one of: verified under throttling, verified without throttling (with the reason), or not verified.

## Keep in mind

- The harness is scratch code outside the repository: the repository carries no self-authored tests.
- `networkidle` never settles while the agent bridge long-polls; wait for `load` and the reveal instead.
- A dialog left open darkens a stage sample; close dialogs before trusting frame checks.
