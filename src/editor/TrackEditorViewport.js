import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TerrainManager } from '../world/TerrainManager.js';
import { TrackManager } from '../world/TrackManager.js';
import { PhysicsMotion } from '../ride/PhysicsMotion.js';
import { CameraRig } from '../ride/CameraRig.js';
import { clamp } from '../utils/math.js';
import { applyAutoHandles, cloneTrackDocument, vectorFromArray, vectorToArray } from '../world/TrackDocument.js';
import { applySavedLandscapeToTerrain } from '../world/LandscapeImageStore.js';

const PICK_ANCHOR_RADIUS = 5.2;
const PICK_HANDLE_RADIUS = 3.1;
const PICK_TWIST_RADIUS = 4.4;
const TERRAIN_CLEARANCE = 10;

export class TrackEditorViewport {
  constructor(host, trackDocument, settings) {
    this.host = host;
    this.document = cloneTrackDocument(trackDocument);
    this.settings = settings;
    this.handlers = new Map();
    this.clockTime = performance.now() / 1000;
    this.selected = { index: 0, part: 'anchor' };
    this.pointer = new Vector2();
    this.raycaster = new Raycaster();
    this.dragPlane = new Plane();
    this.dragWorld = new Vector3();
    this.pickables = [];
    this.viewRects = [];
    this.needsTrackRebuild = false;
    this.viewPan = null;
    this.selectedTwistIndex = 0;

    this.canvas = window.document.createElement('canvas');
    this.canvas.className = 'editor-canvas';
    this.host.dataset.toolMode = this.settings.toolMode;
    this.host.append(this.canvas);

    this.labels = new Map();
    ['3D', 'Plan', 'Height', 'Ride'].forEach((label) => {
      const badge = window.document.createElement('span');
      badge.className = 'editor-view-badge';
      badge.textContent = label;
      this.host.append(badge);
      this.labels.set(label, badge);
    });

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setScissorTest(true);

    this.scene = new Scene();
    this.scene.background = new Color(0x9cc2d4);
    this.scene.fog = new Fog(0x9cc2d4, 220, 720);

    this.terrain = new TerrainManager();
    this.terrain.build();
    applySavedLandscapeToTerrain(this.terrain);
    this.scene.add(this.terrain.group);

    this.trackManager = new TrackManager(this.scene, this.terrain, { trackDocument: this.document });
    this.trackManager.build();
    this.scene.add(this.trackManager.group);

    this.overlayGroup = new Group();
    this.scene.add(this.overlayGroup);

    this.addLights();
    this.setupCameras();
    this.setupRidePreview();
    this.rebuildOverlay();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();

    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('wheel', (event) => this.onWheel(event), { capture: true, passive: false });
    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event), { capture: true });
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    window.addEventListener('pointerup', (event) => this.onPointerUp(event));
    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);
  }

  on(action, handler) {
    this.handlers.set(action, handler);
  }

  emit(action, payload) {
    this.handlers.get(action)?.(payload);
  }

  setDocument(document) {
    this.document = cloneTrackDocument(document);
    this.trackManager.rebuildFromDocument(this.document);
    this.motion.track = this.trackManager;
    this.rebuildOverlay();
  }

  setSelected(index, part = 'anchor') {
    this.selected = { index, part };
    this.rebuildOverlay();
  }

  setSelectedTwist(index) {
    if (this.selectedTwistIndex === index) {
      return;
    }

    this.selectedTwistIndex = index;
    this.rebuildOverlay();
  }

  setViewMode(mode) {
    this.settings.viewMode = mode;
    this.resize();
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    this.trackManager.setVisible(this.settings.showRails);
    this.terrain.group.visible = this.settings.showTerrain;
    if (key === 'toolMode') {
      this.host.dataset.toolMode = value;
    }
  }

  async setLandscapeImage(source) {
    await this.terrain.setLandscapeImage(source);
  }

  async reloadLandscapeImage() {
    this.terrain.clearLandscapeImage();
    await applySavedLandscapeToTerrain(this.terrain);
  }

  addLights() {
    const ambient = new AmbientLight(0xd8ecff, 1.2);
    this.scene.add(ambient);

    const sun = new DirectionalLight(0xffefc0, 3.5);
    sun.position.set(-180, 260, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -360;
    sun.shadow.camera.right = 360;
    sun.shadow.camera.top = 360;
    sun.shadow.camera.bottom = -360;
    this.scene.add(sun);
  }

  setupCameras() {
    this.orbitCamera = new PerspectiveCamera(58, 1, 0.1, 1400);
    this.orbitCamera.position.set(210, 150, 230);
    this.orbitCamera.lookAt(0, 34, 0);

    this.orbitControls = new OrbitControls(this.orbitCamera, this.canvas);
    this.orbitControls.target.set(0, 34, 0);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.maxDistance = 760;
    this.orbitControls.minDistance = 28;

    this.planCamera = new OrthographicCamera(-260, 260, 260, -260, 0.1, 1200);
    this.planCamera.position.set(0, 720, 0);
    this.planCamera.up.set(0, 0, -1);
    this.planCamera.lookAt(0, 0, 0);

    this.elevationCamera = new OrthographicCamera(-270, 270, 170, -40, 0.1, 1200);
    this.elevationCamera.position.set(0, 55, 720);
    this.elevationCamera.lookAt(0, 55, 0);

    this.rideCamera = new PerspectiveCamera(82, 1, 0.1, 1200);
  }

  setupRidePreview() {
    this.motion = new PhysicsMotion(this.trackManager);
    this.cameraRig = new CameraRig(this.rideCamera, this.trackManager, this.motion);
    this.rideInput = { speedMultiplier: 1, boost: 0 };
    this.rideSettings = {
      speedScale: this.settings.rideSpeed,
      fovBoost: 1,
      vibration: this.settings.rideShake,
      paused: false,
    };
  }

  rebuildOverlay() {
    disposeObject(this.overlayGroup);
    this.scene.remove(this.overlayGroup);
    this.overlayGroup = new Group();
    this.overlayGroup.name = 'Track edit handles';
    this.pickables = [];

    this.addCurveLine();
    this.addTwistMarkers();
    this.addControlHandles();
    this.scene.add(this.overlayGroup);
  }

  addCurveLine() {
    const points = [];
    for (let index = 0; index <= 520; index += 1) {
      points.push(this.trackManager.curve.getPointAt(index / 520));
    }

    const line = new Line(
      new BufferGeometry().setFromPoints(points),
      new LineBasicMaterial({ color: 0xffdd57, linewidth: 2 }),
    );
    line.renderOrder = 50;
    this.overlayGroup.add(line);
  }

  addTwistMarkers() {
    const twists = this.document.twists || [];
    if (!twists.length) {
      return;
    }

    const selectedLineMaterial = new LineBasicMaterial({
      color: 0xffebff,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
    });
    const lineMaterial = new LineBasicMaterial({
      color: 0xaa66ff,
      transparent: true,
      opacity: 0.64,
      depthTest: false,
    });
    const selectedCenterMaterial = new MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    const centerMaterial = new MeshBasicMaterial({ color: 0xd06bff, depthTest: false });
    const capMaterial = new MeshBasicMaterial({ color: 0x6feaff, depthTest: false });
    const centerGeometry = new OctahedronGeometry(PICK_TWIST_RADIUS * 1.08, 0);
    const capGeometry = new OctahedronGeometry(3.1, 0);
    const frame = {
      position: new Vector3(),
      tangent: new Vector3(),
      normal: new Vector3(),
      binormal: new Vector3(),
    };

    twists.forEach((twist, index) => {
      const isSelected = index === this.selectedTwistIndex;
      const sampleCount = Math.max(12, Math.ceil(twist.length * 340));
      const start = twist.center - twist.length * 0.5;
      const points = [];

      for (let sample = 0; sample <= sampleCount; sample += 1) {
        const progress = wrap01(start + twist.length * (sample / sampleCount));
        points.push(this.getOffsetCurvePoint(progress, frame, 3.2));
      }

      const line = new Line(
        new BufferGeometry().setFromPoints(points),
        isSelected ? selectedLineMaterial : lineMaterial,
      );
      line.renderOrder = isSelected ? 78 : 68;
      this.overlayGroup.add(line);

      this.addTwistPickMesh(index, 'center', twist.center, centerGeometry, isSelected ? selectedCenterMaterial : centerMaterial, 88);
      this.addTwistPickMesh(index, 'start', start, capGeometry, capMaterial, 86);
      this.addTwistPickMesh(index, 'end', twist.center + twist.length * 0.5, capGeometry, capMaterial, 86);
    });
  }

  addTwistPickMesh(index, part, progress, geometry, material, renderOrder) {
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(this.getOffsetCurvePoint(progress, undefined, 4.2));
    mesh.renderOrder = renderOrder;
    mesh.userData.pick = { type: 'twist', index, part };
    this.pickables.push(mesh);
    this.overlayGroup.add(mesh);
  }

  getOffsetCurvePoint(progress, reusableFrame, offset) {
    const frame = reusableFrame || {
      position: new Vector3(),
      tangent: new Vector3(),
      normal: new Vector3(),
      binormal: new Vector3(),
    };
    this.trackManager.curve.getFrameAt(progress, frame);
    return frame.position.clone().add(frame.normal.clone().multiplyScalar(offset));
  }

  addControlHandles() {
    const anchorMaterial = new MeshBasicMaterial({ color: 0xff2c55, depthTest: false });
    const selectedMaterial = new MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    const inMaterial = new MeshBasicMaterial({ color: 0x42d9ff, depthTest: false });
    const outMaterial = new MeshBasicMaterial({ color: 0xf5a623, depthTest: false });
    const lineMaterial = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.48, depthTest: false });
    const anchorGeometry = new SphereGeometry(PICK_ANCHOR_RADIUS, 18, 12);
    const handleGeometry = new SphereGeometry(PICK_HANDLE_RADIUS, 14, 10);
    const handleLinePoints = [];

    this.document.anchors.forEach((anchor, index) => {
      const position = vectorFromArray(anchor.position);
      const inPosition = position.clone().add(vectorFromArray(anchor.in));
      const outPosition = position.clone().add(vectorFromArray(anchor.out));
      const isAnchorSelected = this.selected.index === index && this.selected.part === 'anchor';

      const anchorMesh = new Mesh(anchorGeometry, isAnchorSelected ? selectedMaterial : anchorMaterial);
      anchorMesh.position.copy(position);
      anchorMesh.renderOrder = 80;
      anchorMesh.userData.pick = { type: 'point', index, part: 'anchor' };
      this.pickables.push(anchorMesh);
      this.overlayGroup.add(anchorMesh);

      [
        ['in', inPosition, inMaterial],
        ['out', outPosition, outMaterial],
      ].forEach(([part, handlePosition, material]) => {
        const handleMesh = new Mesh(
          handleGeometry,
          this.selected.index === index && this.selected.part === part ? selectedMaterial : material,
        );
        handleMesh.position.copy(handlePosition);
        handleMesh.renderOrder = 80;
        handleMesh.userData.pick = { type: 'point', index, part };
        this.pickables.push(handleMesh);
        this.overlayGroup.add(handleMesh);
        handleLinePoints.push(position, handlePosition);
      });
    });

    const handleLines = new LineSegments(
      new BufferGeometry().setFromPoints(handleLinePoints),
      lineMaterial,
    );
    handleLines.renderOrder = 70;
    this.overlayGroup.add(handleLines);
  }

  onPointerDown(event) {
    const view = this.getViewAtEvent(event);
    if (!view || view.type === 'ride') {
      return;
    }

    if (this.shouldNavigate(event)) {
      if (this.canPanView(view)) {
        this.startViewPan(event, view);
      }
      return;
    }

    if (!this.canEditCurve(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const pick = this.pick(event, view);
    if (!pick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const picked = pick.object.userData.pick;
    this.canvas.setPointerCapture(event.pointerId);

    if (picked.type === 'twist') {
      if (this.selectedTwistIndex !== picked.index) {
        this.selectedTwistIndex = picked.index;
        this.rebuildOverlay();
      }
      this.emit('selectTwist', picked.index);
      this.drag = {
        type: 'twist',
        view,
        index: picked.index,
        part: picked.part,
      };
      this.host.classList.add('is-dragging');
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    this.selected = { index: picked.index, part: picked.part };
    this.emit('select', this.selected.index);
    this.drag = {
      type: 'point',
      view,
      index: this.selected.index,
      part: this.selected.part,
    };
    this.host.classList.add('is-dragging');
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  onPointerMove(event) {
    if (this.viewPan) {
      this.panView(event);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (!this.drag) {
      return;
    }

    const world = this.intersectDragPlane(event, this.drag);
    if (!world) {
      return;
    }

    if (this.drag.type === 'twist') {
      this.applyTwistWorldPosition(this.drag.index, this.drag.part, world);
    } else {
      this.applyWorldPosition(this.drag.index, this.drag.part, world);
    }
    this.emit('change', this.document);
    this.queueTrackRebuild();
    this.rebuildOverlay();
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  onPointerUp(event) {
    this.drag = null;
    this.viewPan = null;
    this.host.classList.remove('is-dragging');
    if (event?.pointerId !== undefined && this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  }

  onWheel(event) {
    const view = this.getViewAtEvent(event);
    if (!view || !this.canPanView(view)) {
      return;
    }

    this.zoomView(view, event.deltaY);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  pick(event, view) {
    if (!this.settings.showEditGuides) {
      return null;
    }

    this.setPointerFromEvent(event, view);
    this.raycaster.setFromCamera(this.pointer, view.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    return hits[0] || null;
  }

  intersectDragPlane(event, drag) {
    this.setPointerFromEvent(event, drag.view);
    this.raycaster.setFromCamera(this.pointer, drag.view.camera);

    const current = drag.type === 'twist'
      ? this.getWorldPositionForTwist(drag.index, drag.part)
      : this.getWorldPositionForPart(drag.index, drag.part);
    if (drag.view.type === 'plan') {
      this.dragPlane.setFromNormalAndCoplanarPoint(new Vector3(0, 1, 0), current);
    } else if (drag.view.type === 'elevation') {
      this.dragPlane.setFromNormalAndCoplanarPoint(new Vector3(0, 0, 1), current);
    } else {
      const normal = drag.view.camera.getWorldDirection(new Vector3());
      this.dragPlane.setFromNormalAndCoplanarPoint(normal, current);
    }

    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.dragWorld)) {
      return null;
    }

    if (drag.type !== 'twist' && drag.part === 'anchor') {
      const terrainY = this.terrain.getHeightAt(this.dragWorld.x, this.dragWorld.z);
      if (this.settings.snapOnDrag && drag.view.type !== 'elevation') {
        this.dragWorld.y = terrainY + TERRAIN_CLEARANCE;
      } else {
        this.dragWorld.y = Math.max(this.dragWorld.y, terrainY + 3);
      }
    }

    return this.dragWorld.clone();
  }

  applyTwistWorldPosition(index, part, world) {
    const twist = this.document.twists?.[index];
    if (!twist) {
      return;
    }

    const progress = this.findNearestProgress(world, twist.center);
    if (part === 'center') {
      twist.center = progress;
      return;
    }

    const distance = Math.abs(shortestLoopDistance(progress, twist.center));
    twist.length = clamp(distance * 2, 0.02, 0.65);
  }

  applyWorldPosition(index, part, world) {
    const anchor = this.document.anchors[index];
    const position = vectorFromArray(anchor.position);

    if (part === 'anchor') {
      anchor.position = vectorToArray(world);
      return;
    }

    const relative = world.clone().sub(position);
    anchor[part] = vectorToArray(relative);

    if (this.settings.smoothHandles) {
      anchor[part === 'in' ? 'out' : 'in'] = vectorToArray(relative.clone().multiplyScalar(-1));
    }
  }

  snapPoint(index) {
    const anchor = this.document.anchors[index];
    const position = vectorFromArray(anchor.position);
    position.y = this.terrain.getHeightAt(position.x, position.z) + TERRAIN_CLEARANCE;
    anchor.position = vectorToArray(position);
    this.queueTrackRebuild();
    this.rebuildOverlay();
    this.emit('change', this.document);
  }

  smoothPoint(index) {
    const clone = cloneTrackDocument(this.document);
    applyAutoHandles(clone.anchors, 0.16);
    this.document.anchors[index].in = clone.anchors[index].in;
    this.document.anchors[index].out = clone.anchors[index].out;
    this.queueTrackRebuild();
    this.rebuildOverlay();
    this.emit('change', this.document);
  }

  queueTrackRebuild() {
    if (this.needsTrackRebuild) {
      return;
    }

    this.needsTrackRebuild = true;
    requestAnimationFrame(() => {
      this.needsTrackRebuild = false;
      this.trackManager.rebuildFromDocument(this.document);
      this.motion.track = this.trackManager;
    });
  }

  getWorldPositionForPart(index, part) {
    const anchor = this.document.anchors[index];
    const position = vectorFromArray(anchor.position);
    if (part === 'anchor') {
      return position;
    }

    return position.add(vectorFromArray(anchor[part]));
  }

  getWorldPositionForTwist(index, part) {
    const twist = this.document.twists?.[index];
    if (!twist) {
      return new Vector3();
    }

    let progress = twist.center;
    if (part === 'start') {
      progress = twist.center - twist.length * 0.5;
    } else if (part === 'end') {
      progress = twist.center + twist.length * 0.5;
    }

    return this.getOffsetCurvePoint(progress, undefined, 4.2);
  }

  findNearestProgress(world, preferredProgress) {
    let bestProgress = wrap01(preferredProgress);
    let bestDistance = Infinity;
    const coarseSamples = 360;

    for (let index = 0; index < coarseSamples; index += 1) {
      const progress = index / coarseSamples;
      const distance = this.trackManager.curve.getPointAt(progress).distanceToSquared(world);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestProgress = progress;
      }
    }

    const refinementStep = 1 / coarseSamples;
    for (let index = -8; index <= 8; index += 1) {
      const progress = wrap01(bestProgress + index * refinementStep / 8);
      const distance = this.trackManager.curve.getPointAt(progress).distanceToSquared(world);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestProgress = progress;
      }
    }

    return bestProgress;
  }

  setPointerFromEvent(event, view) {
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left - view.x;
    const y = event.clientY - bounds.top - view.y;
    this.pointer.x = (x / view.width) * 2 - 1;
    this.pointer.y = -(y / view.height) * 2 + 1;
  }

  getViewAtEvent(event) {
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    return this.viewRects.find((view) => (
      x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height
    ));
  }

  shouldNavigate(event) {
    return (
      event.button === 0
      || event.ctrlKey
      || event.metaKey
      || event.altKey
    );
  }

  canEditCurve(event) {
    return event.button === 2 && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  canPanView(view) {
    return view.type === 'plan' || view.type === 'elevation';
  }

  startViewPan(event, view) {
    this.viewPan = {
      view,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    this.canvas.setPointerCapture(event.pointerId);
    this.host.classList.add('is-dragging');
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  panView(event) {
    const dx = event.clientX - this.viewPan.lastX;
    const dy = event.clientY - this.viewPan.lastY;
    this.viewPan.lastX = event.clientX;
    this.viewPan.lastY = event.clientY;

    const { view } = this.viewPan;
    const camera = view.camera;
    const worldX = (camera.right - camera.left) / Math.max(1, view.width);
    const worldY = (camera.top - camera.bottom) / Math.max(1, view.height);

    if (view.type === 'plan') {
      camera.position.x -= dx * worldX;
      camera.position.z -= dy * worldY;
    } else if (view.type === 'elevation') {
      camera.position.x -= dx * worldX;
      camera.position.y += dy * worldY;
    }

    camera.updateProjectionMatrix();
  }

  zoomView(view, deltaY) {
    const camera = view.camera;
    const height = camera.top - camera.bottom;
    const width = camera.right - camera.left;
    const zoomFactor = Math.exp(deltaY * 0.0012);
    const nextHeight = clamp(height * zoomFactor, 38, 820);
    const scale = nextHeight / Math.max(0.0001, height);
    const nextWidth = width * scale;
    const centerX = (camera.left + camera.right) * 0.5;
    const centerY = (camera.top + camera.bottom) * 0.5;

    camera.left = centerX - nextWidth * 0.5;
    camera.right = centerX + nextWidth * 0.5;
    camera.top = centerY + nextHeight * 0.5;
    camera.bottom = centerY - nextHeight * 0.5;
    camera.updateProjectionMatrix();
  }

  animate() {
    const now = performance.now() / 1000;
    const dt = Math.min(now - this.clockTime, 1 / 30);
    this.clockTime = now;
    this.rideSettings.speedScale = this.settings.rideSpeed;
    this.rideSettings.vibration = this.settings.rideShake;
    this.motion.update(dt, this.rideInput, this.rideSettings);
    this.cameraRig.update(dt, this.rideSettings);
    this.orbitControls.update();
    this.render();
    this.emit('metrics', {
      length: this.trackManager.curve.getLength(),
      speed: this.motion.snapshot.speed,
      grade: this.motion.snapshot.gradient,
    });
  }

  render() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.viewRects = this.getViewRects(width, height);
    this.renderer.setClearColor(0x9cc2d4, 1);
    this.renderer.clear();

    for (const view of this.viewRects) {
      const bottom = height - view.y - view.height;
      this.renderer.setViewport(view.x, bottom, view.width, view.height);
      this.renderer.setScissor(view.x, bottom, view.width, view.height);
      view.camera.aspect = view.width / Math.max(1, view.height);
      if (view.camera.isPerspectiveCamera) {
        view.camera.updateProjectionMatrix();
      }
      this.overlayGroup.visible = Boolean(this.settings.showEditGuides) && view.type !== 'ride';
      this.renderer.render(this.scene, view.camera);
    }
    this.overlayGroup.visible = Boolean(this.settings.showEditGuides);

    this.positionLabels();
  }

  getViewRects(width, height) {
    const mode = this.settings.viewMode;
    const make = (type, label, x, y, w, h, camera) => ({
      type,
      label,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      camera,
    });

    if (mode === 'orbit') {
      return [make('orbit', '3D', 0, 0, width, height, this.orbitCamera)];
    }
    if (mode === 'plan') {
      return [make('plan', 'Plan', 0, 0, width, height, this.planCamera)];
    }
    if (mode === 'elevation') {
      return [make('elevation', 'Height', 0, 0, width, height, this.elevationCamera)];
    }
    if (mode === 'ride') {
      return [make('ride', 'Ride', 0, 0, width, height, this.rideCamera)];
    }

    const mainWidth = width * 0.68;
    const sideWidth = width - mainWidth;
    return [
      make('orbit', '3D', 0, 0, mainWidth, height, this.orbitCamera),
      make('plan', 'Plan', mainWidth, 0, sideWidth, height * 0.42, this.planCamera),
      make('elevation', 'Height', mainWidth, height * 0.42, sideWidth, height * 0.29, this.elevationCamera),
      make('ride', 'Ride', mainWidth, height * 0.71, sideWidth, height * 0.29, this.rideCamera),
    ];
  }

  positionLabels() {
    this.labels.forEach((badge) => {
      badge.hidden = true;
    });

    for (const view of this.viewRects) {
      const badge = this.labels.get(view.label);
      if (!badge) {
        continue;
      }
      badge.hidden = false;
      badge.style.left = `${view.x + 12}px`;
      badge.style.top = `${view.y + 12}px`;
    }
  }

  resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
  }
}

function disposeObject(object) {
  object.traverse?.((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function shortestLoopDistance(a, b) {
  let delta = wrap01(a) - wrap01(b);
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return delta;
}
