import { TrackEditorUI } from './TrackEditorUI.js';
import { TrackEditorViewport } from './TrackEditorViewport.js';
import {
  createDefaultTrackDocument,
  createPointAfter,
  loadTrackDocumentFromStorage,
  makeSwiftTrackSnippet,
  removePoint,
  sanitizeTrackDocument,
  saveTrackDocumentToStorage,
} from '../world/TrackDocument.js';
import { getRideUrl } from '../utils/routes.js';
import { freshReload } from '../utils/version.js';

export class TrackAuthoringApp {
  constructor(root) {
    this.root = root;
    this.document = loadTrackDocumentFromStorage() || createDefaultTrackDocument();
    this.selectedIndex = 0;
    this.settings = {
      viewMode: 'split',
      toolMode: 'edit',
      smoothHandles: true,
      snapOnDrag: false,
      showRails: true,
      showTerrain: true,
      rideSpeed: 1,
      rideShake: 0.28,
    };

    this.ui = new TrackEditorUI(root);
    this.viewport = new TrackEditorViewport(this.ui.viewportHost, this.document, this.settings);
    this.bind();
    this.syncUI();
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
    this.ui.on('optionChange', ({ key, value }) => {
      this.settings[key] = value;
      this.viewport.updateSetting(key, value);
    });
    this.ui.on('insertPoint', () => this.insertPoint());
    this.ui.on('deletePoint', () => this.deletePoint());
    this.ui.on('snapPoint', () => this.viewport.snapPoint(this.selectedIndex));
    this.ui.on('smoothPoint', () => this.viewport.smoothPoint(this.selectedIndex));
    this.ui.on('save', () => {
      const saved = saveTrackDocumentToStorage(this.document);
      this.ui.showToast(saved ? 'Saved in this browser' : 'Save failed');
      this.ui.showSaveResult(saved, saved ? `Saved ${currentTimeLabel()}` : 'Save failed');
    });
    this.ui.on('exportJSON', () => this.exportJSON());
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
    this.viewport.on('change', (document) => {
      this.document = sanitizeTrackDocument(document);
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

  commitDocument() {
    this.document = sanitizeTrackDocument(this.document);
    const saved = saveTrackDocumentToStorage(this.document);
    this.viewport.setDocument(this.document);
    this.viewport.setSelected(this.selectedIndex);
    this.syncUI();
    this.ui.showSaveResult(saved, saved ? `Auto-saved ${currentTimeLabel()}` : 'Auto-save failed');
  }

  syncUI() {
    const anchor = this.document.anchors[this.selectedIndex];
    this.ui.updateSelection(anchor, this.selectedIndex);
  }

  exportJSON() {
    const text = `${JSON.stringify(this.document, null, 2)}\n`;
    downloadText('yuri-coast-track.json', text, 'application/json');
    this.ui.showToast('JSON exported');
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
      this.commitDocument();
      this.ui.showToast('Track imported');
    } catch {
      this.ui.showToast('Could not import JSON');
    }
  }
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

function currentTimeLabel() {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}
