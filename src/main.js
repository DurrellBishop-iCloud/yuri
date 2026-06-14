import './styles.css';
import { App } from './core/App.js';
import { TrackAuthoringApp } from './editor/TrackAuthoringApp.js';
import { isEditorRoute } from './utils/routes.js';

const root = document.querySelector('#app');
const app = isEditorRoute() ? new TrackAuthoringApp(root) : new App(root);
app.start();

if (import.meta.env.DEV) {
  window.__ROLLER_COASTER_APP__ = app;
}
