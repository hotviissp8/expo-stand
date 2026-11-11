import type { MosaicConfig } from '../config/types';

/** Разрешение карты цвета по умолчанию: мм на пиксель. Буква всё равно берёт среднее по своей ячейке. */
const MM_PER_PX = 2;

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);

/**
 * Готовит карту цвета букв для фото-стены: фото вписано «cover» в поверхность,
 * применены яркость/контраст/насыщенность/гамма, для монохрома — смешение фон→чернила по яркости.
 */
export class PhotoProcessor {
  readonly canvas = document.createElement('canvas');
  private data: ImageData | null = null;
  private key = '';
  private widthMm = 1;
  private heightMm = 1;

  /** Пересобирает карту при изменении входа; true — карта новая. */
  update(photo: HTMLImageElement | null, photoName: string, cfg: MosaicConfig, widthMm: number, heightMm: number, mmPerPx = MM_PER_PX): boolean {
    const key = JSON.stringify([photoName, widthMm, heightMm, mmPerPx, cfg.mode, cfg.background, cfg.ink, cfg.invert, cfg.zoom, cfg.offsetX, cfg.offsetY, cfg.brightness, cfg.contrast, cfg.saturation, cfg.gamma]);
    if (key === this.key && this.data) return false;
    this.key = key;
    this.widthMm = widthMm;
    this.heightMm = heightMm;
    const w = Math.max(1, Math.round(widthMm / mmPerPx));
    const h = Math.max(1, Math.round(heightMm / mmPerPx));
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = 'high';
    if (photo) {
      const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight) * Math.max(0.01, cfg.zoom);
      const dw = photo.naturalWidth * scale;
      const dh = photo.naturalHeight * scale;
      const dx = (w - dw) / 2 + (cfg.offsetX / 100) * w;
      const dy = (h - dh) / 2 + (cfg.offsetY / 100) * h;
      ctx.fillStyle = cfg.background;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(photo, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
    }
    const image = ctx.getImageData(0, 0, w, h);
    this.transform(image.data, cfg);
    ctx.putImageData(image, 0, 0);
    this.data = image;
    return true;
  }

  /** Средний цвет прямоугольника в мм. */
  sample(x0: number, y0: number, x1: number, y1: number): string {
    const img = this.data!;
    const sx = img.width / this.widthMm;
    const sy = img.height / this.heightMm;
    const ax = Math.max(0, Math.min(img.width - 1, Math.floor(x0 * sx)));
    const bx = Math.max(ax + 1, Math.min(img.width, Math.ceil(x1 * sx)));
    const ay = Math.max(0, Math.min(img.height - 1, Math.floor(y0 * sy)));
    const by = Math.max(ay + 1, Math.min(img.height, Math.ceil(y1 * sy)));
    let r = 0, g = 0, b = 0, n = 0;
    const d = img.data;
    for (let y = ay; y < by; y++) {
      for (let x = ax; x < bx; x++) {
        const i = (y * img.width + x) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
    }
    return rgbToHex(Math.round(r / n), Math.round(g / n), Math.round(b / n));
  }

  private transform(d: Uint8ClampedArray, cfg: MosaicConfig): void {
    const bg = hexToRgb(cfg.background);
    const ink = hexToRgb(cfg.ink);
    const contrast = 1 + cfg.contrast / 100;
    const saturation = 1 + cfg.saturation / 100;
    const brightness = cfg.brightness / 100;
    const gamma = 1 / Math.max(0.05, cfg.gamma);
    const adjust = (v: number) => {
      v = (v - 0.5) * contrast + 0.5 + brightness;
      v = Math.min(1, Math.max(0, v));
      return Math.pow(v, gamma);
    };
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;
      r = adjust(r);
      g = adjust(g);
      b = adjust(b);
      if (cfg.invert) {
        r = 1 - r;
        g = 1 - g;
        b = 1 - b;
      }
      if (cfg.mode === 'mono') {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        d[i] = bg[0] + (ink[0] - bg[0]) * l;
        d[i + 1] = bg[1] + (ink[1] - bg[1]) * l;
        d[i + 2] = bg[2] + (ink[2] - bg[2]) * l;
      } else {
        d[i] = r * 255;
        d[i + 1] = g * 255;
        d[i + 2] = b * 255;
      }
      d[i + 3] = 255;
    }
  }
}
