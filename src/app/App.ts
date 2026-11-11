import type { StandConfig } from '../config/types';
import { FontLibrary } from '../fonts/FontLibrary';
import { AssetStore } from '../state/AssetStore';
import { ConfigStore, type ConfigChange } from '../state/ConfigStore';
import type { SurfaceId } from '../surfaces/Surface';
import { StandView } from '../three/StandView';
import { Controls } from '../ui/Controls';
import { download, pickFile } from '../ui/download';
import { Panel } from '../ui/Panel';
import { SurfaceRegistry } from './SurfaceRegistry';

const FILE_PREFIX = 'stand';

/** Пути вида, после которых нужна пересборка 3D-геометрии. */
const GEOMETRY_PATHS = ['view.background', 'view.groundColor', 'view.lit', 'view.light', 'view.shadows', 'view.human', 'strips.background', 'strips.innerContent', 'strips.innerBackground'];
/** Пути, после которых меняются списки начертаний в панели. */
const FONT_PATHS = ['font.family', 'main.family', 'mosaic.family', 'strips.family'];

export class App {
  private store = new ConfigStore();
  private assets = new AssetStore();
  private library = new FontLibrary();
  private view!: StandView;
  private surfaces!: SurfaceRegistry;
  private panel!: Panel;
  private status = Controls.el('div', 'status');

  constructor(private readonly root: HTMLElement) {}

  async start(): Promise<void> {
    const stage = Controls.el('main', 'stage');
    this.root.append(stage);
    this.view = new StandView(stage, this.store.value);
    this.surfaces = new SurfaceRegistry(this.store, this.assets, () => this.view.maxTextureSize);
    this.surfaces.onPainted((id, canvas) => this.view.setTexture(id, canvas));

    await Promise.all([
      this.assets.restore().catch((e) => console.error('assets', e)),
      this.library.restore().catch((e) => console.error('fonts', e)),
    ]);

    this.panel = new Panel(this.store, this.assets, this.library, {
      preset: (name) => this.view.preset(name),
      screenshot: () => download(this.view.screenshot(2), `${FILE_PREFIX}-view.png`),
      exportPng: (id) => this.exportPng(id),
      exportSvg: (id) => this.exportSvg(id),
      saveConfig: () => download(new Blob([this.store.toJSON()], { type: 'application/json' }), `${FILE_PREFIX}-config.json`),
      loadConfig: () => this.loadConfig(),
      surfaces: () => this.surfaces.all.map((s) => ({ id: s.id, title: s.title, info: s.info })),
    });
    this.surfaces.onInfo(() => this.panel.updateInfo());
    this.root.append(this.panel.el, this.panel.toggleButton, this.status);

    this.store.subscribe((change) => this.onConfig(change));
    this.assets.subscribe((key) => this.surfaces.invalidateAsset(key));
    this.library.subscribe(() => {
      this.panel.refresh();
      this.surfaces.invalidateFonts();
    });
    this.surfaces.invalidateAll();
  }

  private onConfig(change: ConfigChange): void {
    const config: StandConfig = this.store.value;
    if (change.section === '*') {
      this.view.rebuild(config);
      this.panel.refresh();
      this.surfaces.invalidateAll();
      return;
    }
    if (change.section === 'stand' || GEOMETRY_PATHS.includes(change.path)) this.view.rebuild(config);
    if (FONT_PATHS.includes(change.path)) this.panel.refresh();
    if (change.path === 'view.pxPerMm') this.surfaces.invalidateAll();
    else if (change.section !== 'view') this.surfaces.invalidateSection(change.section);
  }

  private async busy<T>(label: string, task: () => Promise<T>): Promise<T | undefined> {
    this.status.textContent = label;
    this.status.classList.add('status-visible');
    try {
      return await task();
    } catch (e) {
      console.error(e);
      alert(String(e));
      return undefined;
    } finally {
      this.status.classList.remove('status-visible');
    }
  }

  private async exportPng(id: SurfaceId): Promise<void> {
    const out = await this.busy('PNG…', () => this.surfaces.exportPng(id));
    if (out) download(out.blob, `${FILE_PREFIX}-${id}-${out.width}x${out.height}.png`);
  }

  private async exportSvg(id: SurfaceId): Promise<void> {
    const blob = await this.busy('SVG…', () => this.surfaces.exportSvg(id));
    if (blob) download(blob, `${FILE_PREFIX}-${id}.svg`);
  }

  private async loadConfig(): Promise<void> {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    try {
      this.store.replace(JSON.parse(await file.text()));
    } catch (e) {
      alert(String(e));
    }
  }
}
