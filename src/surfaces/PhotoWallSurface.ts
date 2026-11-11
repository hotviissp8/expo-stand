import type { ConfigSection, StandConfig } from '../config/types';
import type { DrawList, DrawOp, FontSpec, ImagePaint } from '../draw/ops';
import { Gradient } from '../layout/Gradient';
import { PhotoLayer } from '../layout/PhotoLayer';
import { PhotoProcessor } from '../layout/PhotoProcessor';
import { NameStream, RowComposer } from '../layout/RowComposer';
import { Scatter } from '../layout/Scatter';
import type { AssetKey } from '../state/AssetStore';
import { Surface, type SurfaceContext } from './Surface';

/** Слово не рисуется, если его закрывает слой на столько или больше. */
const HIDDEN = 0.999;

/**
 * Боковая стена: от угла — цвет угла переходит в фото из названий материалов (буква = «пиксель»),
 * дальше картинка из слов переходит в обычное фото.
 */
export class PhotoWallSurface extends Surface {
  readonly id = 'photo' as const;
  readonly title = 'Фото-стена';
  readonly sections: ConfigSection[] = ['mosaic', 'materials'];
  readonly assets: AssetKey[] = ['photo', 'photoLogo'];
  private processor = new PhotoProcessor();
  private layer = new PhotoLayer();

  size(config: StandConfig) {
    return { width: config.stand.sideWidth, height: config.stand.height };
  }

  protected fonts(ctx: SurfaceContext): FontSpec[] {
    const m = ctx.config.mosaic;
    return [{ family: Surface.family(ctx, m.family), weight: m.weight, size: m.fontSize }];
  }

  protected sample(ctx: SurfaceContext): string {
    return ctx.config.materials.join('');
  }

  protected layout(ctx: SurfaceContext): DrawList {
    const { config, measurer, assets } = ctx;
    const m = config.mosaic;
    const { width, height } = this.size(config);
    const font: FontSpec = { family: Surface.family(ctx, m.family), weight: m.weight, size: m.fontSize };
    const photo = assets.image('photo');
    this.processor.update(photo?.element ?? null, photo?.name ?? '', m, width, height);
    const processor = this.processor;

    const ops: DrawOp[] = [{ t: 'rect', x: 0, y: 0, w: width, h: height, fill: m.background }];
    if (m.underlay > 0) {
      ops.push({ t: 'image', x: 0, y: 0, w: width, h: height, source: processor.canvas, href: () => processor.canvas.toDataURL('image/png'), opacity: m.underlay });
    }
    const fade = m.fade.enabled ? m.fade : null;
    const pixels = m.pixels.enabled ? m.pixels : null;
    if (pixels) this.layer.update(photo?.element ?? null, photo?.name ?? '', m, width, height);
    const layer = this.layer;
    /** Слово в точке x (мм) полностью закрыто цветом угла или фото */
    const hidden = (x: number) => (fade !== null && 1 - Gradient.at(fade, x) >= HIDDEN) || (pixels !== null && Gradient.at(pixels, x) >= HIDDEN);

    const smooth: ImagePaint = { kind: 'image', id: 'photo', source: processor.canvas, x: 0, y: 0, w: width, h: height };

    const rows = Math.max(0, Math.floor((height - 2 * m.margin) / m.lineHeight));
    const stream = new NameStream(config.materials, font, measurer, m.shuffle, m.seed);
    const composer = new RowComposer({ minGap: m.minGap, justify: true });
    const dotWidth = measurer.width(m.separator, font);
    const dotShift = measurer.inkCenter(m.separator, font);
    const capHeight = measurer.capHeight(font);
    const scatter = new Scatter(m.scatter);
    const lh = m.lineHeight;
    let glyphs = 0;
    let dropped = 0;

    /** Один знак или целое название: цвет берётся там, где элемент оказался после разброса. */
    const emit = (text: string, x: number, w: number, top: number, baseline: number) => {
      if (hidden(x + w / 2)) return;
      const fill = m.sampling === 'smooth' ? smooth : processor.sample(x, top, x + w, top + lh);
      ops.push({ t: 'text', x, y: baseline, text, font, fill });
      glyphs += text.length;
    };

    const place = (text: string, x: number, width: number, rowTop: number, baseline: number) => {
      if (scatter.unit === 'name') {
        const d = scatter.displace(x + width / 2, rowTop + lh / 2);
        if (!d) {
          dropped++;
          return;
        }
        x += d.dx;
        rowTop += d.dy;
        baseline += d.dy;
        if (m.sampling === 'smooth') {
          emit(text, x, width, rowTop, baseline);
          return;
        }
      }
      const chars = [...text];
      const advances = chars.map((c) => measurer.width(c, font));
      const total = advances.reduce((a, b) => a + b, 0) || 1;
      const k = width / total;
      let cx = x;
      chars.forEach((c, i) => {
        const w = advances[i] * k;
        if (c.trim()) {
          if (scatter.unit === 'letter') {
            const d = scatter.displace(cx + w / 2, rowTop + lh / 2);
            if (d) emit(c, cx + d.dx, w, rowTop + d.dy, baseline + d.dy);
            else dropped++;
          } else {
            emit(c, cx, w, rowTop, baseline);
          }
        }
        cx += w;
      });
    };

    for (let row = 0; row < rows; row++) {
      const rowTop = m.margin + row * m.lineHeight;
      const baseline = Surface.baseline(rowTop, m.lineHeight, capHeight);
      const result = composer.fill({ left: m.margin, right: width - m.margin, sepLeft: false, sepRight: false }, stream);
      for (const name of result.names) place(name.text, name.x, name.width, rowTop, baseline);
      for (const dot of result.dots) place(m.separator, dot - dotShift, dotWidth, rowTop, baseline);
    }

    if (pixels) {
      ops.push({ t: 'image', x: 0, y: 0, w: width, h: height, source: layer.canvas, href: () => layer.canvas.toDataURL('image/png'), opacity: 1 });
    }
    if (fade) ops.push({ t: 'rect', x: 0, y: 0, w: width, h: height, fill: Gradient.fade('corner', fade, config.stand.cornerColor, 1, 0) });

    const logo = m.overlay.enabled ? assets.image('photoLogo') : null;
    if (logo) {
      const h = m.overlay.height;
      const w = h * (logo.element.naturalWidth / Math.max(1, logo.element.naturalHeight));
      ops.push({
        t: 'image', x: m.overlay.x - w / 2, y: m.overlay.y - h / 2, w, h,
        source: logo.element, href: logo.dataUrl, opacity: m.overlay.opacity, tint: m.overlay.tint ? m.overlay.color : undefined,
      });
    }

    this.info = `строк: ${rows}, знаков: ${glyphs}` + (dropped ? `, убрано: ${dropped}` : '');
    return { width, height, ops };
  }
}
