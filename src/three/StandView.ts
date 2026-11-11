import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StandConfig } from '../config/types';
import type { SurfaceId } from '../surfaces/Surface';

const MM = 0.001;
/** Зазор лицевой плоскости над корпусом, мм — чтобы не мерцало. */
const FACE_OFFSET = 2;
/** Подобрано так, чтобы стена анфас при «Свет = 1» давала цвет файла. */
const HEMI_INTENSITY = 2.7;
const SUN_INTENSITY = 1.2;

export type CameraPreset = 'corner' | 'front' | 'left' | 'top' | 'main' | 'photo';

interface FaceSlot {
  material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
  texture: THREE.CanvasTexture | null;
}

/**
 * 3D-вид стенда. Оси: x — вдоль главной стены (0 слева), z — от главной стены к проходу,
 * y — вверх. Главная стена в плоскости z=0, фото-стена в плоскости x=mainWidth.
 */
export class StandView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  private controls: OrbitControls;
  private standGroup = new THREE.Group();
  private faces = new Map<SurfaceId, FaceSlot>();
  private plainMaterials: THREE.Material[] = [];
  private config: StandConfig;
  private frame = 0;
  private resizeObserver: ResizeObserver;

  constructor(private readonly host: HTMLElement, config: StandConfig) {
    this.config = config;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = config.view.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'stage-canvas';
    host.appendChild(this.renderer.domElement);

    this.scene.add(this.standGroup);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 40;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener('change', () => this.requestRender());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.rebuild(config);
    this.preset('corner');
    this.resize();
  }

  get maxTextureSize(): number {
    return this.renderer.capabilities.maxTextureSize;
  }

  /** Полная пересборка геометрии (размеры, цвета, свет). Текстуры переносятся. */
  rebuild(config: StandConfig): void {
    this.config = config;
    const keepCanvases = new Map<SurfaceId, HTMLCanvasElement>();
    this.faces.forEach((slot, id) => {
      const img = slot.texture?.image as HTMLCanvasElement | undefined;
      if (img) keepCanvases.set(id, img);
      slot.texture?.dispose();
      slot.material.dispose();
    });
    this.faces.clear();
    this.plainMaterials.forEach((m) => m.dispose());
    this.plainMaterials = [];
    this.standGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.standGroup.clear();

    const { stand, view } = config;
    this.renderer.shadowMap.enabled = view.shadows;
    this.scene.background = new THREE.Color(view.background);
    const W = stand.mainWidth, D = stand.sideWidth, H = stand.height, T = stand.wallThickness;

    this.addLights(W, D, H);
    this.addGround(W, D);

    const wallMat = this.plain(stand.wallColor);
    // Главная стена: корпус за плоскостью z=0, по x до наружной грани фото-стены.
    this.box(wallMat, [0, -T, 0], [W + T, 0, H]);
    // Фото-стена: корпус за плоскостью x=W.
    this.box(wallMat, [W, 0, 0], [W + T, D, H]);
    this.box(this.plain(stand.floorColor), [0, 0, -20], [W, D, 0]);

    this.face('main', [W / 2, H / 2, FACE_OFFSET], 0, W, H, true);
    this.face('photo', [W - FACE_OFFSET, H / 2, D / 2], -Math.PI / 2, D, H, true);

    // Полосы: к противоположному (открытому) углу x=0, z=D. Висят внутри контура стенда,
    // наружная грань совпадает с краем стенда; корпус и торцы — цвета фона полос.
    const sh = stand.stripHeight, st = stand.stripThickness;
    const stripMat = this.plain(config.strips.background);
    this.box(stripMat, [0, 0, H - sh], [st, D, H], true);
    this.box(stripMat, [0, D - st, H - sh], [W, D, H], true);
    const yStrip = H - sh / 2;
    this.face('stripLeft', [-FACE_OFFSET, yStrip, D / 2], -Math.PI / 2, D, sh);
    this.face('stripFront', [W / 2, yStrip, D + FACE_OFFSET], 0, W, sh);
    const innerLeft = this.faceMesh(this.innerMaterial('stripLeft'), [st + FACE_OFFSET, yStrip, D / 2], Math.PI / 2, D, sh);
    const innerFront = this.faceMesh(this.innerMaterial('stripFront'), [W / 2, yStrip, D - st - FACE_OFFSET], Math.PI, W, sh);
    this.standGroup.add(innerLeft, innerFront);

    if (stand.cornerPost) {
      const p = stand.postSize;
      this.box(stripMat, [0, D - p, 0], [p, D, H - sh], true);
    }
    if (view.human) this.addHuman(W * 0.35, D * 0.75);

    keepCanvases.forEach((canvas, id) => this.setTexture(id, canvas));
    this.requestRender();
  }

  /** Новая картинка поверхности (тот же canvas — просто обновление). */
  setTexture(id: SurfaceId, canvas: HTMLCanvasElement): void {
    const slot = this.faces.get(id);
    if (!slot) return;
    if (slot.texture && slot.texture.image === canvas && slot.texture.image.width === canvas.width) {
      slot.texture.needsUpdate = true;
    } else {
      slot.texture?.dispose();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      slot.texture = texture;
      slot.material.map = texture;
      slot.material.color.set('#ffffff');
      slot.material.needsUpdate = true;
    }
    if (this.config.strips.innerContent) {
      const inner = this.innerSlots.get(id);
      if (inner) {
        inner.map = slot.texture;
        inner.color.set('#ffffff');
        inner.needsUpdate = true;
      }
    }
    this.requestRender();
  }

  preset(name: CameraPreset): void {
    const { mainWidth: W, sideWidth: D, height: H } = this.config.stand;
    const w = W * MM, d = D * MM, h = H * MM;
    const target = new THREE.Vector3(w / 2, h * 0.5, d / 2);
    const pos = new THREE.Vector3();
    switch (name) {
      case 'corner': pos.set(-w * 0.55, h * 0.62, d + w * 1.05); break;
      case 'front': pos.set(w / 2, h * 0.5, d + w * 1.45); break;
      case 'left': pos.set(-w * 1.6, h * 0.5, d / 2); target.set(w / 2, h * 0.5, d / 2); break;
      case 'top': pos.set(w / 2, h + w * 1.5, d / 2 + 0.001); break;
      case 'main': pos.set(w / 2, h / 2, w * 1.3); target.set(w / 2, h / 2, 0); break;
      case 'photo': pos.set(w - Math.max(d, h) * 1.45, h / 2, d / 2); target.set(w, h / 2, d / 2); break;
    }
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.update();
    this.requestRender();
  }

  screenshot(scale = 2): string {
    const size = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(scale * ratio);
    this.renderer.setSize(size.x, size.y, false);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(size.x, size.y, false);
    this.requestRender();
    return url;
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const moving = this.controls.update();
      this.renderer.render(this.scene, this.camera);
      if (moving) this.requestRender();
    });
  }

  private resize(): void {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private innerSlots = new Map<SurfaceId, THREE.MeshBasicMaterial | THREE.MeshLambertMaterial>();

  private innerMaterial(id: SurfaceId) {
    const m = this.faceMaterial(this.config.strips.innerBackground);
    this.innerSlots.set(id, m);
    this.plainMaterials.push(m);
    return m;
  }

  /** Матовый материал (печать на баннере/плёнке) — без бликов под острым углом. */
  private surfaceMaterial(color: string) {
    return this.config.view.lit ? new THREE.MeshLambertMaterial({ color }) : new THREE.MeshBasicMaterial({ color });
  }

  /** Лицевая плоскость: всегда рисуется поверх корпуса, без z-fighting на дальних ракурсах. */
  private faceMaterial(color: string) {
    const m = this.surfaceMaterial(color);
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -4;
    return m;
  }

  private plain(color: string): THREE.Material {
    const m = this.surfaceMaterial(color);
    this.plainMaterials.push(m);
    return m;
  }

  /** Коробка по двум углам в мм: [x, z, y]. Корпуса стен тень не отбрасывают — иначе затеняют свою же лицевую плоскость. */
  private box(material: THREE.Material, a: [number, number, number], b: [number, number, number], cast = false): void {
    const [x0, z0, y0] = a, [x1, z1, y1] = b;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) * MM, (y1 - y0) * MM, (z1 - z0) * MM), material);
    mesh.position.set(((x0 + x1) / 2) * MM, ((y0 + y1) / 2) * MM, ((z0 + z1) / 2) * MM);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    this.standGroup.add(mesh);
  }

  private face(id: SurfaceId, center: [number, number, number], rotY: number, w: number, h: number, receive = false): void {
    const material = this.faceMaterial('#808080');
    this.faces.set(id, { material, texture: null });
    this.standGroup.add(this.faceMesh(material, center, rotY, w, h, receive));
  }

  private faceMesh(material: THREE.Material, [x, y, z]: [number, number, number], rotY: number, w: number, h: number, receive = false): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * MM, h * MM), material);
    mesh.position.set(x * MM, y * MM, z * MM);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = receive;
    return mesh;
  }

  private addGround(W: number, D: number): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), this.plain(this.config.view.groundColor));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((W / 2) * MM, -0.021, (D / 2) * MM);
    ground.receiveShadow = true;
    this.standGroup.add(ground);
  }

  private addLights(W: number, D: number, H: number): void {
    if (!this.config.view.lit) return;
    const k = this.config.view.light;
    this.standGroup.add(new THREE.HemisphereLight('#ffffff', '#b4b4b4', HEMI_INTENSITY * k));
    const sun = new THREE.DirectionalLight('#ffffff', SUN_INTENSITY * k);
    sun.position.set(-W * MM, H * MM * 2.2, (D + W) * MM * 1.2);
    sun.target.position.set((W / 2) * MM, 0, (D / 2) * MM);
    sun.castShadow = this.config.view.shadows;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 6;
    const cam = sun.shadow.camera;
    cam.left = -6; cam.right = 6; cam.top = 6; cam.bottom = -6; cam.near = 0.5; cam.far = 30;
    this.standGroup.add(sun, sun.target);
  }

  private addHuman(x: number, z: number): void {
    const mat = this.plain('#9a9a9a');
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 1.05, 8, 16), mat);
    body.position.set(x * MM, 0.19 + 0.525 + 0.06, z * MM);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), mat);
    head.position.set(x * MM, 1.8 - 0.11, z * MM);
    [body, head].forEach((m) => { m.castShadow = true; });
    this.standGroup.add(body, head);
  }
}
