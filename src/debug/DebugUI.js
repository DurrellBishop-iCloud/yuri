import { shortVersion } from '../utils/version.js';

export class DebugUI {
  constructor(root, settings, options = {}) {
    this.settings = settings;
    this.options = options;
    this.changeHandlers = new Set();
    this.root = root;
    this.metrics = {};
    this.panel = document.createElement('section');
    this.panel.className = 'debug-panel';
    this.panel.setAttribute('aria-label', 'Ride controls');

    this.hud = document.createElement('section');
    this.hud.className = 'hud';
    this.hud.setAttribute('aria-label', 'Ride telemetry');
    this.createMetric('speed', 'Speed', '0');
    this.createMetric('force', 'Force', '0');
    this.createMetric('grade', 'Grade', '0');

    this.createRange('speedScale', 'Speed', 0.65, 1.8, 0.01);
    this.createRange('fovBoost', 'FOV', 0.2, 1.6, 0.01);
    this.createRange('vibration', 'Shake', 0, 1, 0.01);
    this.createToggle('trackVisible', 'Track');
    this.createToggle('music', 'Music');
    this.createToggle('paused', 'Pause');
    this.createAction('Editor', () => this.options.onOpenEditor?.());
    this.createAction('Fresh', () => this.options.onFreshReload?.());
    this.createVersion();

    root.append(this.hud, this.panel);
  }

  onChange(handler) {
    this.changeHandlers.add(handler);
  }

  emitChange() {
    for (const handler of this.changeHandlers) {
      handler(this.settings);
    }
  }

  createMetric(key, label, value) {
    const metric = document.createElement('div');
    metric.className = 'hud-metric';
    metric.innerHTML = `
      <span class="hud-label">${label}</span>
      <span class="hud-value">${value}</span>
    `;
    this.metrics[key] = metric.querySelector('.hud-value');
    this.hud.append(metric);
  }

  createRange(key, label, min, max, step) {
    const row = document.createElement('div');
    row.className = 'debug-row';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.settings[key]);

    const value = document.createElement('output');
    value.className = 'debug-value';
    value.textContent = Number(input.value).toFixed(2);

    input.addEventListener('input', () => {
      this.settings[key] = Number(input.value);
      value.textContent = this.settings[key].toFixed(2);
      this.emitChange();
    });

    row.append(labelElement, input, value);
    this.panel.append(row);
  }

  createToggle(key, label) {
    const row = document.createElement('div');
    row.className = 'debug-toggle';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.settings[key];

    input.addEventListener('change', () => {
      this.settings[key] = input.checked;
      this.emitChange();
    });

    row.append(labelElement, input);
    this.panel.append(row);
  }

  createAction(label, handler) {
    const row = document.createElement('div');
    row.className = 'debug-action';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', handler);

    row.append(button);
    this.panel.append(row);
  }

  createVersion() {
    const version = document.createElement('div');
    version.className = 'debug-version';
    version.textContent = shortVersion();
    this.panel.append(version);
  }

  update(snapshot, settings) {
    const displaySpeed = settings.paused ? 0 : snapshot.speed;
    this.metrics.speed.textContent = `${Math.round(displaySpeed)} m/s`;
    this.metrics.force.textContent = `${snapshot.acceleration >= 0 ? '+' : ''}${snapshot.acceleration.toFixed(1)}`;
    this.metrics.grade.textContent = `${Math.round(snapshot.gradient * 100)}%`;
  }
}
