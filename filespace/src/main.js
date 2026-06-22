import { el } from './util/dom.js';
import { Viewport } from './core/Viewport.js';
import { Scene } from './core/Scene.js';
import { Grid } from './core/Grid.js';
import { GestureController } from './input/GestureController.js';
import { AddButton } from './ui/AddButton.js';

/**
 * Entry point. Builds the DOM scaffold and wires the modules together:
 *
 *   surface (gestures) ── viewport (camera) ── world (scaled layer)
 *                              │                     │
 *                            grid                  scene (items)
 *                              │
 *                          add button / hud (screen-space UI)
 *
 * Each module has one job and talks to its neighbours through small interfaces,
 * so new item types, tools or persistence can slot in without rewrites.
 */
function boot() {
  const app = document.getElementById('app');

  const world = el('div', { class: 'world' });
  const surface = el('div', { class: 'surface' }, world);
  const hud = el('div', { class: 'hud' }, '100%');
  app.append(surface, hud);

  const viewport = new Viewport(world);
  const scene = new Scene(world);

  new Grid(surface, viewport);
  new GestureController(surface, viewport);

  const addButton = new AddButton({ viewport, scene });
  addButton.mount(app);

  viewport.onChange((vp) => {
    hud.textContent = `${Math.round(vp.scale * 100)}%`;
  });

  // Start with the world origin at the center of the screen, then apply once so
  // every subscriber (grid, hud) renders its initial state.
  viewport.tx = window.innerWidth / 2;
  viewport.ty = window.innerHeight / 2;
  viewport.apply();

  window.addEventListener('resize', () => viewport.apply());
}

boot();
