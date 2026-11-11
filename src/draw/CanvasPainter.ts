import { Gradient } from '../layout/Gradient';
import { fontCss, letterSpacing, type DrawList, type ImageOp, type Paint } from './ops';

/** Пределы canvas в Chromium. */
export const CANVAS_MAX_SIDE = 32767;
export const CANVAS_MAX_AREA = 268_000_000;

/** Растеризует DrawList в canvas с заданным разрешением px/мм. */
export class CanvasPainter {
  /** Максимальное px/мм, при котором поверхность влезает в лимиты. */
  static clampScale(list: Pick<DrawList, 'width' | 'height'>, pxPerMm: number, maxSide = CANVAS_MAX_SIDE): number {
    const bySide = maxSide / Math.max(list.width, list.height);
    const byArea = Math.sqrt(CANVAS_MAX_AREA / (list.width * list.height));
    return Math.min(pxPerMm, bySide, byArea);
  }

  paint(list: DrawList, canvas: HTMLCanvasElement, pxPerMm: number): void {
    const w = Math.max(1, Math.round(list.width * pxPerMm));
    const h = Math.max(1, Math.round(list.height * pxPerMm));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(w / list.width, 0, 0, h / list.height, 0, 0);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    const styles = new Map<Paint, string | CanvasGradient | CanvasPattern>();
    const style = (paint: Paint) => {
      let s = styles.get(paint);
      if (!s) {
        s = this.makeStyle(ctx, paint);
        styles.set(paint, s);
      }
      return s;
    };

    let currentFont = '';
    let currentSpacing = 0;
    let currentFill: Paint | null = null;
    for (const op of list.ops) {
      if (op.t === 'rect') {
        ctx.fillStyle = style(op.fill);
        currentFill = op.fill;
        ctx.fillRect(op.x, op.y, op.w, op.h);
      } else if (op.t === 'text') {
        const font = fontCss(op.font);
        if (font !== currentFont) {
          ctx.font = font;
          currentFont = font;
        }
        if (op.fill !== currentFill) {
          ctx.fillStyle = style(op.fill);
          currentFill = op.fill;
        }
        const spacing = letterSpacing(op.font);
        if (spacing !== currentSpacing) {
          ctx.letterSpacing = `${spacing}px`;
          currentSpacing = spacing;
        }
        ctx.fillText(op.text, op.x, op.y);
      } else {
        ctx.globalAlpha = op.opacity;
        ctx.drawImage(op.tint ? this.tinted(op, w / list.width, h / list.height) : op.source, op.x, op.y, op.w, op.h);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Картинка op, закрашенная op.tint с сохранением прозрачности, в разрешении холста. */
  private tinted(op: ImageOp, kx: number, ky: number): HTMLCanvasElement {
    const layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(op.w * kx));
    layer.height = Math.max(1, Math.round(op.h * ky));
    const ctx = layer.getContext('2d')!;
    ctx.drawImage(op.source, 0, 0, layer.width, layer.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = op.tint!;
    ctx.fillRect(0, 0, layer.width, layer.height);
    return layer;
  }

  private makeStyle(ctx: CanvasRenderingContext2D, paint: Paint): string | CanvasGradient | CanvasPattern {
    if (typeof paint === 'string') return paint;
    if (paint.kind === 'linear') {
      const g = ctx.createLinearGradient(paint.x0, 0, Math.max(paint.x1, paint.x0 + 0.01), 0);
      for (const [offset, color, opacity = 1] of paint.stops) g.addColorStop(offset, opacity < 1 ? Gradient.rgba(color, opacity) : color);
      return g;
    }
    const pattern = ctx.createPattern(paint.source, 'no-repeat')!;
    pattern.setTransform(
      new DOMMatrix().translate(paint.x, paint.y).scale(paint.w / paint.source.width, paint.h / paint.source.height),
    );
    return pattern;
  }
}
