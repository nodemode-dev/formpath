# Connection gate

Run in order; stop at the first that fails and fix it before going on.

1. The client lists tools named `get_document`, `draw_shape` and `export_file`. If not, the server is not configured: `./formpth agents install`, then restart the client.
2. `get_document` returns within a few seconds. If it hangs, the formpth window may be asking for consent; the person answers there.
3. The engine answers at http://127.0.0.1:8230/api/health. If not, `./formpth boot`.
4. A formpth window is open at http://localhost:5230 or in the desktop app.
5. Preferences > Plugins in that window allows agents.
6. `get_image` returns a picture: the window is drawing.

When all six pass and a tool still fails, its error message names the fix; follow it literally.
