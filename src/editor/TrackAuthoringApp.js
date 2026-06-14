import { TrackEditorUI } from './TrackEditorUI.js';
import { TrackEditorViewport } from './TrackEditorViewport.js';
import {
  createTwist,
  createDefaultTrackDocument,
  createPointAfter,
  loadTrackDocumentFromStorage,
  makeSwiftTrackSnippet,
  removePoint,
  removeTwist,
  sanitizeTrackDocument,
  saveTrackDocumentToStorage,
} from '../world/TrackDocument.js';
import { getRideUrl } from '../utils/routes.js';
import { freshReload } from '../utils/version.js';
import {
  clearLocalLandscapeImage,
  loadLandscapeImageFromFile,
  loadLocalLandscapeImage,
  loadPublishedLandscapeImage,
} from '../world/LandscapeImageStore.js';

export class TrackAuthoringApp {
  constructor(root) {
    this.root = root;
    this.document = loadTrackDocumentFromStorage() || createDefaultTrackDocument();
    this.selectedIndex = 0;
    this.selectedTwistIndex = 0;
    this.landscapeDocument = loadLocalLandscapeImage();
    this.settings = {
      viewMode: 'split',
      toolMode: 'edit',
      smoothHandles: true,
      snapOnDrag: false,
      showRails: true,
      showTerrain: true,
      showEditGuides: true,
      rideSpeed: 1,
      rideShake: 0.28,
    };

    this.ui = new TrackEditorUI(root);
    this.viewport = new TrackEditorViewport(this.ui.viewportHost, this.document, this.settings);
    this.bind();
    this.syncUI();
    this.syncLandscapeUI();
  }

  start() {}

  bind() {
    this.ui.on('viewMode', (mode) => {
      this.settings.viewMode = mode;
      this.ui.setViewMode(mode);
      this.viewport.setViewMode(mode);
    });
    this.ui.on('toolMode', (mode) => {
      this.settings.toolMode = mode;
      this.ui.setToolMode(mode);
      this.viewport.updateSetting('toolMode', mode);
    });

    this.ui.on('fieldChange', ({ key, value }) => this.updateSelectedField(key, value));
    this.ui.on('twistChange', ({ key, value }) => this.updateSelectedTwistField(key, value));
    this.ui.on('optionChange', ({ key, value }) => {
      this.settings[key] = value;
      this.viewport.updateSetting(key, value);
    });
    this.ui.on('insertPoint', () => this.insertPoint());
    this.ui.on('deletePoint', () => this.deletePoint());
    this.ui.on('addTwist', () => this.addTwist());
    this.ui.on('removeTwist', () => this.removeTwist());
    this.ui.on('previousTwist', () => this.stepTwist(-1));
    this.ui.on('nextTwist', () => this.stepTwist(1));
    this.ui.on('snapPoint', () => this.viewport.snapPoint(this.selectedIndex));
    this.ui.on('smoothPoint', () => this.viewport.smoothPoint(this.selectedIndex));
    this.ui.on('save', () => {
      const saved = saveTrackDocumentToStorage(this.document);
      this.ui.showToast(saved ? 'Saved in this browser' : 'Save failed');
      this.ui.showSaveResult(saved, saved ? `Saved ${currentTimeLabel()}` : 'Save failed');
    });
    this.ui.on('exportJSON', () => this.exportJSON());
    this.ui.on('loadLandscapeImage', (file) => this.loadLandscapeImage(file));
    this.ui.on('clearLandscapeImage', () => this.clearLandscapeImage());
    this.ui.on('exportLandscapeImage', () => this.exportLandscapeImage());
    this.ui.on('copySwift', () => this.copySwift());
    this.ui.on('freshReload', () => freshReload());
    this.ui.on('importJSON', (file) => this.importJSON(file));
    this.ui.on('openRide', () => {
      saveTrackDocumentToStorage(this.document);
      window.location.href = getRideUrl();
    });

    this.viewport.on('select', (index) => {
      this.selectedIndex = index;
      this.syncUI();
    });
    this.viewport.on('selectTwist', (index) => {
      this.selectedTwistIndex = index;
      this.syncUI();
    });
    this.viewport.on('change', (document) => {
      this.document = sanitizeTrackDocument(document);
      this.clampSelections();
      const saved = saveTrackDocumentToStorage(this.document);
      this.ui.showSaveResult(saved, saved ? `Auto-saved ${currentTimeLabel()}` : 'Auto-save failed');
      this.syncUI();
    });
    this.viewport.on('metrics', (metrics) => {
      this.ui.updateMetrics(metrics);
    });
  }

  updateSelectedField(key, value) {
    if (!Number.isFinite(value)) {
      return;
    }

    const anchor = this.document.anchors[this.selectedIndex];
    if (key === 'x') {
      anchor.position[0] = value;
    } else if (key === 'y') {
      anchor.position[1] = value;
    } else if (key === 'z') {
      anchor.position[2] = value;
    } else if (key === 'bank') {
      anchor.bank = value;
    } else if (key === 'speed') {
      anchor.speed = value;
    }

    this.commitDocument();
  }

  updateSelectedTwistField(key, value) {
    if (!Number.isFinite(value)) {
      return;
    }

    const twist = this.getSelectedTwist();
    if (!twist) {
      return;
    }

    if (key === 'center') {
      twist.center = wrap01(value);
    } else if (key === 'length') {
      twist.length = clampNumber(value, 0.02, 0.65);
    } else if (key === 'roll') {
      twist.roll = value * Math.PI / 180;
    }

    this.commitDocument();
  }

  insertPoint() {
    this.document = createPointAfter(this.document, this.selectedIndex);
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.document.anchors.length - 1);
    this.commitDocument();
  }

  deletePoint() {
    this.document = removePoint(this.document, this.selectedIndex);
    this.selectedIndex = Math.min(this.selectedIndex, this.document.anchors.length - 1);
    this.commitDocument();
  }

  addTwist() {
    const selectedTwist = this.getSelectedTwist();
    const center = selectedTwist
      ? wrap01(selectedTwist.center + selectedTwist.length + 0.04)
      : this.getSelectedAnchorProgress();
    this.document = createTwist(this.document, center);
    this.selectedTwistIndex = this.document.twists.length - 1;
    this.commitDocument();
    this.ui.showToast('Twist added');
  }

  removeTwist() {
    if (!this.document.twists?.length) {
      this.ui.showToast('No twist selected');
      return;
    }

    this.document = removeTwist(this.document, this.selectedTwistIndex);
    this.selectedTwistIndex = Math.max(0, this.selectedTwistIndex - 1);
    this.commitDocument();
    this.ui.showToast('Twist removed');
  }

  stepTwist(direction) {
    const count = this.document.twists?.length || 0;
    if (!count) {
      this.ui.showToast('No twists yet');
      return;
    }

    this.selectedTwistIndex = (this.selectedTwistIndex + direction + count) % count;
    this.syncUI();
  }

  commitDocument() {
    this.document = sanitizeTrackDocument(this.document);
    this.clampSelections();
    const saved = saveTrackDocumentToStorage(this.document);
    this.viewport.setDocument(this.document);
    this.viewport.setSelected(this.selectedIndex);
    this.viewport.setSelectedTwist(this.selectedTwistIndex);
    this.syncUI();
    this.ui.showSaveResult(saved, saved ? `Auto-saved ${currentTimeLabel()}` : 'Auto-save failed');
  }

  syncUI() {
    this.clampSelections();
    const anchor = this.document.anchors[this.selectedIndex];
    this.ui.updateSelection(anchor, this.selectedIndex);
    this.ui.updateTwist(
      this.getSelectedTwist(),
      this.selectedTwistIndex,
      this.document.twists?.length || 0,
    );
    this.viewport.setSelectedTwist(this.selectedTwistIndex);
  }

  clampSelections() {
    this.selectedIndex = clampIndex(this.selectedIndex, this.document.anchors.length);
    this.selectedTwistIndex = clampIndex(this.selectedTwistIndex, this.document.twists?.length || 0);
  }

  getSelectedTwist() {
    return this.document.twists?.[this.selectedTwistIndex] || null;
  }

  getSelectedAnchorProgress() {
    return this.document.anchors.length > 0 ? this.selectedIndex / this.document.anchors.length : 0.25;
  }

  async syncLandscapeUI() {
    const local = loadLocalLandscapeImage();
    if (local) {
      this.landscapeDocument = local;
      this.ui.updateLandscape(local.name, 'local');
      return;
    }

    const published = await loadPublishedLandscapeImage();
    this.landscapeDocument = null;
    if (published) {
      this.ui.updateLandscape(published.name, 'published');
      return;
    }

    this.ui.updateLandscape('', 'generated');
  }

  exportJSON() {
    const text = `${JSON.stringify(this.document, null, 2)}\n`;
    downloadText('yuri-coast-track.json', text, 'application/json');
    this.ui.showToast('JSON exported');
  }

  async loadLandscapeImage(file) {
    try {
      const landscape = await loadLandscapeImageFromFile(file);
      this.landscapeDocument = landscape;
      await this.viewport.setLandscapeImage(landscape.dataUrl);
      this.ui.updateLandscape(landscape.name, 'local');
      this.ui.showToast(landscape.saved ? 'Landscape loaded' : 'Landscape loaded for this session');
    } catch {
      this.ui.showToast('Could not load photo');
    }
  }

  async clearLandscapeImage() {
    clearLocalLandscapeImage();
    this.landscapeDocument = null;
    await this.viewport.reloadLandscapeImage();
    await this.syncLandscapeUI();
    this.ui.showToast('Landscape cleared');
  }

  exportLandscapeImage() {
    const landscape = this.landscapeDocument || loadLocalLandscapeImage();
    if (!landscape?.dataUrl) {
      this.ui.showToast('No local photo');
      return;
    }

    downloadDataUrl(makeSafeLandscapeFilename(landscape.name, landscape.dataUrl), landscape.dataUrl);
    this.ui.showToast('Landscape exported');
  }

  async copySwift() {
    const snippet = makeSwiftTrackSnippet(this.document);
    try {
      await navigator.clipboard.writeText(snippet);
      this.ui.showToast('Swift copied');
    } catch {
      downloadText('AuthoredTrack.swift', `${snippet}\n`, 'text/plain');
      this.ui.showToast('Swift downloaded');
    }
  }

  async importJSON(file) {
    try {
      const text = await file.text();
      this.document = sanitizeTrackDocument(JSON.parse(text));
      this.selectedIndex = 0;
      this.selectedTwistIndex = 0;
      this.commitDocument();
      this.ui.showToast('Track imported');
    } catch {
      this.ui.showToast('Could not import JSON');
    }
  }
}

function clampIndex(index, count) {
  if (count <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, index), count - 1);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename, dataUrl) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function makeSafeLandscapeFilename(name, dataUrl) {
  const base = String(name || 'yuri-landscape')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'yuri-landscape';
  const extension = dataUrl?.startsWith('data:image/png') ? 'png' : 'jpg';
  return `${base}.${extension}`;
}

function currentTimeLabel() {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}
