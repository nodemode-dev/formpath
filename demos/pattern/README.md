# formpath demo: Patterns and colour

The third of formpath's three offline demo pages (the others are `demo/` and `demos/icons/`). It runs in a browser with no engine, no desktop shell and no network: double-click `index.html`, or serve the repository with a static server and open `/demos/pattern/`.

## What it shows

The real formpath window, which opens the Patterns and colour demo as Home > Demos does in the app (`frontend/src/demos/pattern.ts`). "Tide Pattern Studies" holds a pattern swatch made with Make Pattern from three motifs in a brick layout and filling a framed panel; a blend of ten steps from a teal circle to a coral square; "TIDE" in a gradient fill inside a Flag envelope; a hexagon extruded in 3D with a classic bevel and plastic material; and three colourways of one palette: the original, the "Coast" swatch group made by the Color Guide's analogous rule and applied with Recolor Art, and a triad harmony around coral. Open Window > Swatches to see the pattern and the Coast group, or select a colourway and open Recolor Art.

## How the page works and how to rebuild it

See `demo/README.md`: the three pages share `demo/src` and `frontend/vite.demo.config.ts`, and `npm run demo` in `frontend/` rebuilds all three. Credits are in `CREDITS.md`.
