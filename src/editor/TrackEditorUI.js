export class TrackEditorUI {
  constructor(root) {
    this.root = root;
    this.handlers = new Map();
    this.inputs = {};
    this.metricValues = {};

    this.shell = document.createElement('section');
    this.shell.className = 'editor-shell';
    this.shell.setAttribute('aria-label', 'Coaster path editor');

    this.toolbar = document.createElement('header');
    this.toolbar.className = 'editor-toolbar';

    this.viewportHost = document.createElement('div');
    this.viewportHost.className = 'editor-viewport-host';

    this.panel = document.createElement('aside');
    this.panel.className = 'editor-panel';
    this.panel.setAttribute('aria-label', 'Track inspector');

    this.toast = document.createElement('div');
    this.toast.className = 'editor-toast';
    this.toast.setAttribute('role', 'status');

    this.buildToolbar();
    this.buildPanel();
    this.shell.append(this.toolbar, this.viewportHost, this.panel, this.toast);
    root.replaceChildren(this.shell);
  }

  on(action, handler) {
    this.handlers.set(action, handler);
  }

  emit(action, payload) {
    this.handlers.get(action)?.(payload);
  }

  buildToolbar() {
    const title = document.createElement('div');
    title.className = 'editor-title';
    title.innerHTML = '<strong>Yuri Coast Path</strong><span>Bezier authoring</span>';

    const modes = document.createElement('div');
    modes.className = 'editor-segment';
    modes.setAttribute('aria-label', 'View mode');
    [
      ['split', 'Split'],
      ['orbit', '3D'],
      ['plan', 'Plan'],
      ['elevation', 'Height'],
      ['ride', 'Ride'],
    ].forEach(([value, label], index) => {
      const button = this.makeButton(label, () => this.emit('viewMode', value));
      button.dataset.mode = value;
      button.classList.toggle('is-active', index === 0);
      modes.append(button);
    });
    this.modeButtons = modes.querySelectorAll('button');

    const tools = document.createElement('div');
    tools.className = 'editor-segment editor-tool-segment';
    tools.setAttribute('aria-label', 'Tool mode');
    [
      ['edit', 'Edit'],
      ['move', 'Move'],
    ].forEach(([value, label], index) => {
      const button = this.makeButton(label, () => this.emit('toolMode', value));
      button.dataset.tool = value;
      button.classList.toggle('is-active', index === 0);
      tools.append(button);
    });
    this.toolButtons = tools.querySelectorAll('button');

    const actions = document.createElement('div');
    actions.className = 'editor-actions';
    actions.append(
      this.makeButton('Save', () => this.emit('save')),
      this.makeButton('Export JSON', () => this.emit('exportJSON')),
      this.makeButton('Copy Swift', () => this.emit('copySwift')),
      this.makeButton('Ride App', () => this.emit('openRide')),
    );

    this.importInput = document.createElement('input');
    this.importInput.type = 'file';
    this.importInput.accept = 'application/json,.json';
    this.importInput.hidden = true;
    this.importInput.addEventListener('change', () => {
      const [file] = this.importInput.files;
      if (file) {
        this.emit('importJSON', file);
      }
      this.importInput.value = '';
    });
    actions.append(this.makeButton('Import', () => this.importInput.click()), this.importInput);

    this.toolbar.append(title, modes, tools, actions);
  }

  buildPanel() {
    const selected = document.createElement('section');
    selected.className = 'editor-panel-section';
    selected.innerHTML = '<h2>Selected point</h2>';

    this.selectedName = document.createElement('div');
    this.selectedName.className = 'editor-selected-name';
    this.selectedName.textContent = 'Point 1';
    selected.append(this.selectedName);

    const grid = document.createElement('div');
    grid.className = 'editor-field-grid';
    [
      ['x', 'X', -480, 480, 0.1],
      ['y', 'Y', 2, 160, 0.1],
      ['z', 'Z', -480, 480, 0.1],
      ['bank', 'Bank', -1.2, 1.2, 0.01],
      ['speed', 'Speed', 0.45, 1.8, 0.01],
    ].forEach(([key, label, min, max, step]) => {
      grid.append(this.makeNumberField(key, label, min, max, step));
    });
    selected.append(grid);

    const pointActions = document.createElement('div');
    pointActions.className = 'editor-button-grid';
    pointActions.append(
      this.makeButton('Insert', () => this.emit('insertPoint')),
      this.makeButton('Delete', () => this.emit('deletePoint')),
      this.makeButton('Snap', () => this.emit('snapPoint')),
      this.makeButton('Smooth', () => this.emit('smoothPoint')),
    );
    selected.append(pointActions);

    const options = document.createElement('section');
    options.className = 'editor-panel-section';
    options.innerHTML = '<h2>Edit options</h2>';
    options.append(
      this.makeCheckbox('smoothHandles', 'Mirror handles', true),
      this.makeCheckbox('snapOnDrag', 'Ground follow', false),
      this.makeCheckbox('showRails', 'Rails', true),
      this.makeCheckbox('showTerrain', 'Terrain', true),
    );

    const ride = document.createElement('section');
    ride.className = 'editor-panel-section';
    ride.innerHTML = '<h2>Ride preview</h2>';
    ride.append(
      this.makeRange('rideSpeed', 'Speed', 0.4, 1.8, 0.01, 1),
      this.makeRange('rideShake', 'Shake', 0, 1, 0.01, 0.28),
    );

    const metrics = document.createElement('div');
    metrics.className = 'editor-metrics';
    [
      ['length', 'Length'],
      ['speed', 'Speed'],
      ['grade', 'Grade'],
    ].forEach(([key, label]) => {
      const metric = document.createElement('div');
      metric.innerHTML = `<span>${label}</span><strong>0</strong>`;
      this.metricValues[key] = metric.querySelector('strong');
      metrics.append(metric);
    });
    ride.append(metrics);

    this.panel.append(selected, options, ride);
  }

  makeButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-button';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  makeNumberField(key, label, min, max, step) {
    const wrap = document.createElement('label');
    wrap.className = 'editor-field';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener('input', () => {
      this.emit('fieldChange', { key, value: Number(input.value) });
    });

    this.inputs[key] = input;
    wrap.append(label, input);
    return wrap;
  }

  makeCheckbox(key, label, checked) {
    const wrap = document.createElement('label');
    wrap.className = 'editor-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => this.emit('optionChange', { key, value: input.checked }));
    this.inputs[key] = input;
    wrap.append(label, input);
    return wrap;
  }

  makeRange(key, label, min, max, step, value) {
    const wrap = document.createElement('label');
    wrap.className = 'editor-range';
    const output = document.createElement('output');
    output.textContent = Number(value).toFixed(2);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const next = Number(input.value);
      output.textContent = next.toFixed(2);
      this.emit('optionChange', { key, value: next });
    });
    this.inputs[key] = input;
    wrap.append(label, input, output);
    return wrap;
  }

  updateSelection(anchor, index) {
    this.selectedName.textContent = `Point ${index + 1}`;
    this.setInputValue('x', anchor.position[0], 1);
    this.setInputValue('y', anchor.position[1], 1);
    this.setInputValue('z', anchor.position[2], 1);
    this.setInputValue('bank', anchor.bank, 2);
    this.setInputValue('speed', anchor.speed, 2);
  }

  updateMetrics({ length, speed, grade }) {
    this.metricValues.length.textContent = `${Math.round(length)} m`;
    this.metricValues.speed.textContent = `${Math.round(speed)} m/s`;
    this.metricValues.grade.textContent = `${Math.round(grade * 100)}%`;
  }

  setViewMode(mode) {
    this.modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === mode);
    });
  }

  setToolMode(mode) {
    this.toolButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tool === mode);
    });
  }

  setInputValue(key, value, decimals) {
    const input = this.inputs[key];
    if (!input || document.activeElement === input) {
      return;
    }

    input.value = Number(value).toFixed(decimals);
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('is-visible');
    }, 1800);
  }
}
