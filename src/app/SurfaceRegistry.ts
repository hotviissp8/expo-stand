import type { ConfigSection } from '../config/types';
import { CanvasPainter } from '../draw/CanvasPainter';
import type { DrawList } from '../draw/ops';
import { SvgPainter } from '../draw/SvgPainter';
import { TextMeasurer } from '../layout/TextMeasurer';
import type { AssetKey, AssetStore } from '../state/AssetStore';
import type { ConfigStore } from '../state/ConfigStore';
import { MainWallSurface } from '../surfaces/MainWallSurface';
import { PhotoWallSurface } from '../surfaces/PhotoWallSurface';
import { StripSurface } from '../surfaces/StripSurface';
import type { Surface, SurfaceContext, SurfaceId } from '../surfaces/Surface';

const DEBOUNCE_MS = 120;

type Listener = (id: SurfaceId, canvas: HTMLCanvasElement) => void;

/** Держит поверхности, пересобирает изменённые и отдаёт картинки для 3D и экспорта. */
export class SurfaceRegistry {
  readonly main = new MainWallSurface();
  readonly photo = new PhotoWallSurface();
  readonly all: Surface[] = [this.main, this.photo, new StripSurface('left'), new StripSurface('front')];
  private measurer = new TextMeasurer();
  private painter = new CanvasPainter();
  private canvases = new Map<SurfaceId, HTMLCanvasElement>();
  private dirty = new Set<SurfaceId>();
  private timer = 0;
  private running: Promise<void> = Promise.resolve();
  private listeners = new Set<Listener>();
  private infoListeners = new Set<() => void>();

  constructor(
    private readonly store: ConfigStore,
    private readonly assets: AssetStore,
    private readonly maxTextureSize: () => number,
  ) {}

  onPainted(listener: Listener): void {
    this.listeners.add(listener);
  }

  onInfo(listener: () => void): void {
    this.infoListeners.add(listener);
  }

  get(id: SurfaceId): Surface {
    return this.all.find((s) => s.id === id)!;
  }

  private context(): SurfaceContext {
    return { config: this.store.value, assets: this.assets, measurer: this.measurer };
  }

  invalidateSection(section: ConfigSection | '*'): void {
    this.all.filter((s) => s.dependsOn(section)).forEach((s) => this.dirty.add(s.id));
    this.schedule();
  }

  invalidateAsset(key: AssetKey): void {
    this.all.filter((s) => s.assets.includes(key)).forEach((s) => this.dirty.add(s.id));
    this.schedule();
  }

  /** Набор шрифтов изменился: метрики устарели у всех поверхностей. */
  invalidateFonts(): void {
    this.measurer.clear();
    this.invalidateAll();
  }

  invalidateAll(): void {
    this.all.forEach((s) => this.dirty.add(s.id));
    this.schedule();
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.running = this.running.then(() => this.flush());
    }, DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    const ids = [...this.dirty];
    this.dirty.clear();
    for (const id of ids) {
      const surface = this.get(id);
      const list = await surface.build(this.context());
      const canvas = this.canvases.get(id) ?? document.createElement('canvas');
      this.canvases.set(id, canvas);
      const scale = CanvasPainter.clampScale(list, this.store.value.view.pxPerMm, this.maxTextureSize());
      this.painter.paint(list, canvas, scale);
      this.listeners.forEach((l) => l(id, canvas));
    }
    if (ids.length) this.infoListeners.forEach((l) => l());
  }

  async exportPng(id: SurfaceId): Promise<{ blob: Blob; width: number; height: number }> {
    const list = await this.get(id).build(this.context());
    const canvas = document.createElement('canvas');
    const scale = CanvasPainter.clampScale(list, this.store.value.view.exportPxPerMm);
    this.painter.paint(list, canvas, scale);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG не создан'))), 'image/png'),
    );
    const out = { blob, width: canvas.width, height: canvas.height };
    canvas.width = canvas.height = 0;
    return out;
  }

  async exportSvg(id: SurfaceId): Promise<Blob> {
    const list: DrawList = await this.get(id).build(this.context());
    return new Blob([new SvgPainter().paint(list)], { type: 'image/svg+xml' });
  }
}
