# Coordinates, sizes and paint

## Space

- Units are points: 72 to the inch, about 2.835 to the millimetre. A document in px treats 1 px as 1 pt.
- x grows to the right and y grows downward. The origin is the first artboard's top-left corner; other artboards sit at their own x and y from `get_document`.
- `draw_shape` places the top-left of the shape's bounds at x, y; `line` and `arc` run from x, y to x2, y2. `add_text` point type puts the first baseline at y, so a 48 pt title whose top should sit at 100 goes at y about 135.
- `transform` origin defaults to the centre; `rotate` is degrees, positive counter-clockwise; `scale` is percent.

## Common artboards

| Use | Width by height |
| --- | --- |
| US Letter | 612 by 792 pt |
| A4 | 595 by 842 pt |
| A3 | 842 by 1191 pt |
| Square post | 1080 by 1080 px |
| Story | 1080 by 1920 px |
| Web | 1920 by 1080 px |
| App icon | 1024 by 1024 px |
| Favicon set | 512 by 512 px, exported at scale 1, 0.5 and 0.0625 |

## Colours

A colour is `#rrggbb`, `rgb(r,g,b)`, `cmyk(c,m,y,k)` in percent, `gray(k)`, a swatch name, or `none`. CMYK colours stay CMYK in a CMYK document and in its PDF.

## Gradients

```json
{ "type": "linear", "angle": 90, "stops": [{ "offset": 0, "color": "#1d2b64" }, { "offset": 1, "color": "#f8cdda", "opacity": 1 }] }
```

- `angle` 0 runs left to right, 90 runs bottom to top, 180 right to left, 270 top to bottom.
- `radial` gradients run from the centre outward; stop 0 is the centre.
- On strokes, a gradient is applied within the stroke by default, laid over the object's bounds like a fill.

## Ids and scopes

- Ids are short strings such as `pln2n16`. Layers have ids too; `add_layer` returns one.
- Most tools act on `ids` when given, otherwise on the selection; `select` changes the selection.
- `get_image` and `export_file` scopes: `artboard` (with `artboard` index), `document`, `selection`, and for export `all_artboards`.
