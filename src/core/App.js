import { Clock } from 'three';
import { SceneManager } from './SceneManager.js';
import { TerrainManager } from '../world/TerrainManager.js';
import { TrackManager } from '../world/TrackManager.js';
import { AssetManager } from '../assets/AssetManager.js';
import { PhysicsMotion } from '../ride/PhysicsMotion.js';
import { CameraRig } from '../ride/CameraRig.js';
import { InputManager } from '../input/InputManager.js';
import { DebugUI } from '../debug/DebugUI.js';
import { RideMusic } from '../audio/RideMusic.js';
import { getEditorUrl } from '../utils/routes.js';
import { freshReload } from '../utils/version.js';
import {
  applySavedLandscapeToTerrain,
  clearLocalLandscapeImage,
  loadLandscapeImageFromFile,
} from '../world/LandscapeImageStore.js';

export class App {
  constructor(root) {
    this.root = root;
    this.clock = new Clock();
    this.settings = {
      speedScale: 1,
      fovBoost: 1,
      vibration: 0.45,
      trackVisible: true,
      music: true,
      paused: false,
    };

    this.sceneManager = new SceneManager(root);
    this.terrainManager = new TerrainManager(this.sceneManager.scene);
    this.trackManager = new TrackManager(this.sceneManager.scene, this.terrainManager);
    this.assetManager = new AssetManager(this.sceneManager.scene, this.terrainManager);
    this.inputManager = new InputManager(window);
    this.motion = new PhysicsMotion(this.trackManager);
    this.rideMusic = new RideMusic(this.settings);
    this.cameraRig = new CameraRig(
      this.sceneManager.camera,
      this.trackManager,
      this.motion,
    );
    this.debugUI = new DebugUI(root, this.settings, {
      onOpenEditor: () => {
        window.location.href = getEditorUrl();
      },
      onFreshReload: () => {
        freshReload();
      },
      onLoadLandscape: async (file) => {
        try {
          const landscape = await loadLandscapeImageFromFile(file);
          await this.terrainManager.setLandscapeImage(landscape.dataUrl);
        } catch {
          this.terrainManager.clearLandscapeImage();
        }
      },
      onClearLandscape: async () => {
        clearLocalLandscapeImage();
        this.terrainManager.clearLandscapeImage();
        await applySavedLandscapeToTerrain(this.terrainManager);
      },
    });

    this.frame = this.frame.bind(this);
  }

  start() {
    this.terrainManager.build();
    applySavedLandscapeToTerrain(this.terrainManager);
    this.trackManager.build();
    this.assetManager.populate();
    this.sceneManager.add(this.terrainManager.group);
    this.sceneManager.add(this.trackManager.group);
    this.sceneManager.add(this.assetManager.group);

    this.debugUI.onChange(() => {
      this.trackManager.setVisible(this.settings.trackVisible);
      if (this.settings.music) {
        this.rideMusic.unlock();
      }
    });
    this.trackManager.setVisible(this.settings.trackVisible);
    this.rideMusic.attach(window);

    this.sceneManager.renderer.setAnimationLoop(this.frame);
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    const rideDt = this.settings.paused ? 0 : dt;

    this.inputManager.update();
    this.motion.update(rideDt, this.inputManager.state, this.settings);
    this.cameraRig.update(dt, this.settings);
    this.assetManager.update(dt);
    this.rideMusic.update(dt, this.motion.snapshot, this.settings);
    this.sceneManager.update(dt);
    this.debugUI.update(this.motion.snapshot, this.settings);
    this.sceneManager.render();
  }
}
