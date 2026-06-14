import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

export class SceneManager {
  constructor(root) {
    this.root = root;
    this.shell = document.createElement('div');
    this.shell.className = 'world-shell';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'world-canvas';
    this.shell.append(this.canvas);
    root.append(this.shell);

    this.scene = new Scene();
    this.scene.background = new Color(0x8fb2cf);
    this.scene.fog = new Fog(0x8fb2cf, 180, 650);

    this.camera = new PerspectiveCamera(82, 1, 0.1, 1200);
    this.camera.position.set(0, 18, 60);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.setupLights();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(root);
    this.resize();
  }

  setupLights() {
    const hemi = new HemisphereLight(0xcfe8ff, 0x31412e, 1.5);
    this.scene.add(hemi);

    const sun = new DirectionalLight(0xfff1b8, 3.4);
    sun.position.set(-140, 240, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.near = 50;
    sun.shadow.camera.far = 520;
    this.scene.add(sun);
  }

  add(object) {
    this.scene.add(object);
  }

  update() {}

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
  }
}
