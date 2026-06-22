# Filespace

An experiment in replacing the folder metaphor with a **visual, spatial**
filesystem. Stage one is an infinitely zoomable canvas where you place icons.

This is a zero-build static web app — plain HTML, CSS and ES modules. Open
`index.html` with any static server and it runs.

## What works in stage one

- **Infinite pan & zoom canvas** with a world-anchored reference grid.
- **Custom pinch / pan / wheel** gestures (hand-rolled on Pointer Events, not the
  browser's built-in touch zoom, so it behaves the same everywhere and is easy
  to tune or replace).
- **`+` button**
  - _Tap_ → drops a square icon at the center of the screen.
  - _Press and drag_ → a ghost icon floats just above your finger so the drop
    target stays visible; release to place it there.
- **Fixed-size-on-creation icons.** A new icon always appears at the same screen
  size no matter the zoom, then scales with the canvas as you zoom in/out
  (icons live in world space; their world size is derived from the screen size
  at the moment of creation).

## Run locally

```bash
cd filesystem
python3 -m http.server 8000   # or: npx serve .
# open http://localhost:8000
```

## Architecture

Each module does one job and talks to its neighbours through small interfaces,
so new item types, tools, or persistence can be added without rewrites.

```
src/
  main.js                 entry point — builds the DOM and wires modules
  core/
    Viewport.js           camera: scale + translate, screen<->world mapping
    Scene.js              registry of world-space items and their DOM
    Item.js               IconItem model + view (a square in world units)
    Grid.js               world-anchored background grid
  input/
    GestureController.js   pan / pinch / wheel from raw pointer events
  ui/
    AddButton.js           tap-to-center + drag-to-place creation tool
  util/
    math.js, dom.js        small shared helpers
```

The single source of truth for the camera is `Viewport`. Everything else either
reads from it (`Scene` placement, `Grid`) or drives it (`GestureController`).

## Roadmap

Stage one is intentionally small. Natural next steps: selecting and dragging
existing icons, grouping/nesting as the spatial replacement for folders,
labels, and persistence.

## Deploy to GitHub Pages

This repo's Pages site is served from the `gh-pages` branch (the existing
roller-coaster site lives at its root). Filespace is published **alongside** it,
in a subfolder, so nothing is overwritten:

- **Live URL:** https://durrellbishop-icloud.github.io/yuri/filespace/

To publish a new build, copy this folder's files into `gh-pages` under
`filespace/` and push — Pages redeploys automatically:

```bash
git worktree add -B gh-pages /tmp/ghp origin/gh-pages
rm -rf /tmp/ghp/filespace && mkdir -p /tmp/ghp/filespace
cp -r index.html styles.css src /tmp/ghp/filespace/
( cd /tmp/ghp && git add filespace && git commit -m "Deploy Filespace" && git push origin gh-pages )
git worktree remove /tmp/ghp
```

> Note: a repo has only one Pages site. If you later want Filespace at the clean
> root URL instead of a subfolder, it would replace the roller-coaster site — say
> the word and that's a one-line change.
