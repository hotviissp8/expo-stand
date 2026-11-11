import type { MosaicConfig } from '../config/types';
import { Gradient } from './Gradient';
import { PhotoProcessor } from './PhotoProcessor';

/** Разрешение слоя фото, мм на пиксель (3000 мм → 3000 px). */
const LAYER_MM_PER_PX = 1;

/**
 * Фото поверх слов: та же обработка, что у карты цвета букв, прозрачность нарастает по переходу
 * mosaic.pixels. При pixelSize > 0 фото собирается из квадратов этого размера.
 */
export class PhotoLayer {
  readonly canvas = document.createElement('canvas');
  private processor = new PhotoProcessor();
  private key = '';

  update(photo: HTMLImageElement | null, photoName: string, cfg: MosaicConfig, widthMm: number, heightMm: number): void {
    const blocky = cfg.pixelSize > 0;
    const changed = this.processor.update(photo, photoName, cfg, widthMm, heightMm, blocky ? cfg.pixelSize : LAYER_MM_PER_PX);
    const key = JSON.stringify([cfg.pixels, blocky]);
    if (!changed && key === this.key) return;
    this.key = key;

    const w = Math.max(1, Math.round(widthMm / LAYER_MM_PER_PX));
    const h = Math.max(1, Math.round(heightMm / LAYER_MM_PER_PX));
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = !blocky;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.processor.canvas, 0, 0, w, h);

    const ramp = cfg.pixels;
    const g = ctx.createLinearGradient(ramp.start / LAYER_MM_PER_PX, 0, Math.max(ramp.end, ramp.start + 0.01) / LAYER_MM_PER_PX, 0);
    for (const [t, k] of Gradient.curve(ramp)) g.addColorStop(t, `rgba(0,0,0,${k})`);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
}
