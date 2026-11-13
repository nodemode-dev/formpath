# formpath demo: Poster and type

An offline demo of the formpath vector editor that runs in a browser with no engine, no desktop shell, no network and no CDN. There are three pages; the other two are `demos/icons` (Icons and a logo) and `demos/pattern` (Patterns and colour), and each page links to the others from the status bar.

## Open it

- Double-click `demo/index.html` (it works from `file://`), or
- serve the repository with any static server, for example `python3 -m http.server 8000`, and open `/demo/`.

Every script, style and font is local to the repository. The font files are stored once, in `demo/assets`, and the two pages under `demos/` load them from there with relative paths, so keep the three folders together. There are no pictures: the artwork is drawn when the page opens.

## What it shows

The page is the real formpath window, not a look-alike: `frontend/index.html` and the application's own entry (`frontend/src/main.ts`, then `app.ts` and every module under `ui/`, `tools/`, `engine/` and `io/`) are bundled as they are. When the window is ready the page opens the Poster and type demo exactly as Home > Demos does in the app, through the same builder (`frontend/src/demos/poster.ts`) and the app's own drawing tools, while `html[data-demo]` keeps the window hidden, then shows it once, complete.

"Harbour Lights Poster" has two artboards. Poster: a sky with a linear gradient, a moon made into a gradient mesh with a centre highlight, moonlight on the water as a blend of nine steps in Screen, a lighthouse and two beams with transparent gradients, the title with an extra stroke and an outer glow saved as the graphic style "Harbour Glow", type on a curved path, and a date badge whose appearance stack holds a fill, two strokes and a drop shadow (graphic style "Ticket Badge"). Programme: a rule stroked with the Brush Taper art brush from formpath's own Artistic Ink library, area type in two columns with bold headings, and a second badge with the same graphic style. Everything stays editable: select the title and look at the Appearance panel, or move the moon's mesh points with the Direct Selection tool.

## What stands in for the engine

- `src/shim/api.ts` answers every `/api` request inside the page with the app's own message that it needs the formpath engine (the project library, system fonts, file writes, the assistant and agents), and closes sockets to the engine quietly. The status bar reads "Engine offline", as the app does without its engine.
- The image trace worker is inlined as a Blob worker by `formpath-demo-inline-workers` in `frontend/vite.demo.config.ts`, because Chrome refuses module workers from `file://`.
- The Inter faces the canvas measures and outlines (Regular, Medium, Semibold, Bold and Black, Latin) are inlined into the script, because `file://` cannot fetch them.

## Rebuild

The built files in this folder are committed. After changing the app or `demo/src`:

```sh
cd frontend
npm ci
npm run demo
```

`npm run demo` runs `vite build --config vite.demo.config.ts` three times, with `--mode poster`, `icons` and `pattern`, writing `demo/`, `demos/icons/` and `demos/pattern/`. The three pages share `demo/src`; the mode only chooses the demo and the folder. Only the poster build writes font files; `formpath-demo-shared-fonts` and `renderBuiltUrl` in the config point the other two builds at `demo/assets`, so build `poster` first (`npm run demo` does). `npx tsc --noEmit -p ../demo` type-checks the page code.

## Licences

The bundle contains the app's own code (Apache-2.0), Inter and JetBrains Mono (OFL 1.1, via @fontsource), paper.js (MIT), opentype.js (MIT) and xterm.js (MIT), all already in `frontend/package-lock.json` and `NOTICE.md`. See `CREDITS.md`.
