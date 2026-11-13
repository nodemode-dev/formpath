# formpath demo: Icons and a logo

The second of formpath's three offline demo pages (the others are `demo/` and `demos/pattern/`). It runs in a browser with no engine, no desktop shell and no network: double-click `index.html`, or serve the repository with a static server and open `/demos/icons/`. Its fonts are the ones stored once in `demo/assets`, loaded by relative path, so keep `demo/` beside `demos/`.

## What it shows

The real formpath window, which opens the Icons and a logo demo as Home > Demos does in the app (`frontend/src/demos/icons.ts`). "Brightwater Icons" has thirteen artboards. Twelve 96 px icons sit on their own artboards, each drawn on a 24-unit grid and built from live shapes with Pathfinder (Unite and Minus Front), compound paths, Outline Stroke and, for the heart, Shape Crafter in its merge mode with the regions to merge given as points; each icon is centred on its artboard with Align. The Logo artboard holds a petal with a gradient made into a live radial Repeat of nine, a centre dot and the "brightwater" wordmark. Select an icon's artboard with the Artboard tool, or select the repeat to change its options.

## How the page works and how to rebuild it

See `demo/README.md`: the three pages share `demo/src` and `frontend/vite.demo.config.ts`, and `npm run demo` in `frontend/` rebuilds all three. Credits are in `CREDITS.md`.
