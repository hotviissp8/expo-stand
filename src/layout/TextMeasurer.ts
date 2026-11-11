import { fontCss, letterSpacing, type FontSpec } from '../draw/ops';

const REF_SIZE = 100;

interface Metrics {
  width: number;
  /** Середина видимой части глифов относительно x */
  inkCenter: number;
  /** Высота прописной «H» */
  capHeight: number;
}

/** Метрики текста в мм (замер на 100px, масштаб по кеглю). Кэш по шрифту+тексту. */
export class TextMeasurer {
  private ctx = document.createElement('canvas').getContext('2d')!;
  private cache = new Map<string, Metrics>();

  private metrics(text: string, font: FontSpec): Metrics {
    const key = `${font.family}|${font.weight}|${font.italic ? 'i' : 'n'}|${text}`;
    let m = this.cache.get(key);
    if (!m) {
      this.ctx.font = fontCss({ ...font, size: REF_SIZE });
      const t = this.ctx.measureText(text);
      const cap = this.ctx.measureText('H').actualBoundingBoxAscent;
      m = { width: t.width, inkCenter: (t.actualBoundingBoxRight - t.actualBoundingBoxLeft) / 2, capHeight: cap };
      this.cache.set(key, m);
    }
    return m;
  }

  width(text: string, font: FontSpec): number {
    return (this.metrics(text, font).width * font.size) / REF_SIZE + [...text].length * letterSpacing(font);
  }

  inkCenter(text: string, font: FontSpec): number {
    return (this.metrics(text, font).inkCenter * font.size) / REF_SIZE;
  }

  capHeight(font: FontSpec): number {
    return (this.metrics('H', font).capHeight * font.size) / REF_SIZE;
  }

  /** Сбрасывается после загрузки шрифтов: метрики меняются. */
  clear(): void {
    this.cache.clear();
  }

  /** Дождаться загрузки начертаний, нужных поверхности. */
  async ensure(fonts: FontSpec[], sample: string): Promise<void> {
    const css = [...new Set(fonts.map((f) => fontCss({ ...f, size: REF_SIZE })))];
    if (css.every((c) => document.fonts.check(c, sample))) return;
    await Promise.all(css.map((c) => document.fonts.load(c, sample).catch(() => [])));
    this.clear();
  }
}
