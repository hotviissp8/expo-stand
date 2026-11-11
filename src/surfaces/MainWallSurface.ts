import type { ConfigSection, StandConfig } from '../config/types';
import type { DrawList, DrawOp, FontSpec } from '../draw/ops';
import { Gradient } from '../layout/Gradient';
import { Random } from '../layout/Random';
import { RichText, type RichLine } from '../layout/RichText';
import { NameStream, RowComposer } from '../layout/RowComposer';
import type { AssetKey } from '../state/AssetStore';
import { Surface, type SurfaceContext } from './Surface';

interface Obstacle {
  x: number;
  line: RichLine;
}

/** Главная стена: поток названий с точками, фразы, переход в белый к углу. */
export class MainWallSurface extends Surface {
  readonly id = 'main' as const;
  readonly title = 'Главная стена';
  readonly sections: ConfigSection[] = ['main', 'materials'];
  readonly assets: AssetKey[] = [];

  size(config: StandConfig) {
    return { width: config.stand.mainWidth, height: config.stand.height };
  }

  rowCount(config: StandConfig): number {
    const { marginTop, marginBottom, lineHeight } = config.main;
    return Math.max(0, Math.floor((config.stand.height - marginTop - marginBottom) / lineHeight));
  }

  protected fonts(ctx: SurfaceContext): FontSpec[] {
    const m = ctx.config.main;
    const family = Surface.family(ctx, m.family);
    const weights = new Set([m.weight, ...m.phrases.flatMap((p) => [p.weight, p.boldWeight])]);
    const sizes = [m.fontSize, m.boldSize];
    return [...weights].flatMap((weight) => sizes.flatMap((size) => [false, true].map((italic) => ({ family, weight, size, italic }))));
  }

  protected sample(ctx: SurfaceContext): string {
    return ctx.config.materials.join('') + ctx.config.main.phrases.map((p) => p.text).join('');
  }

  protected layout(ctx: SurfaceContext): DrawList {
    const { config, measurer } = ctx;
    const m = config.main;
    const { width, height } = this.size(config);
    const font: FontSpec = { family: Surface.family(ctx, m.family), weight: m.weight, size: m.fontSize };
    const rows = this.rowCount(config);
    const follow = m.phraseFlow === 'follow';

    const textGradient = m.textGradientLinked ? m.gradient : m.textGradient;
    const bgPaint = Gradient.paint('bg', m.gradient, m.background, config.stand.cornerColor);
    const textPaint = Gradient.paint('tx', textGradient, m.textColor, m.textInverse);
    const dotPaint = Gradient.paint('dt', textGradient, m.dotColor, m.dotInverse);
    const ops: DrawOp[] = [{ t: 'rect', x: 0, y: 0, w: width, h: height, fill: bgPaint }];

    const obstacles = this.obstacles(ctx, rows);
    const stream = new NameStream(config.materials, font, measurer, m.shuffle, m.seed);
    const composer = new RowComposer({ minGap: m.minGap, justify: m.justify, fillGaps: m.fillGaps });
    const ragged = new Random(m.seed * 31 + 1);
    const dotShift = measurer.inkCenter(m.separator, font);
    const baselineShift = measurer.capHeight(font);

    const emit = (result: ReturnType<RowComposer['fill']>, baseline: number) => {
      for (const name of result.names) ops.push({ t: 'text', x: name.x, y: baseline, text: name.text, font, fill: textPaint });
      for (const dot of result.dots) ops.push({ t: 'text', x: dot - dotShift, y: baseline, text: m.separator, font, fill: dotPaint });
    };

    for (let row = 0; row < rows; row++) {
      const rowTop = m.marginTop + row * m.lineHeight;
      const baseline = Surface.baseline(rowTop, m.lineHeight, baselineShift);
      const rowEnd = m.textEnd - ragged.next() * m.ragged;
      let cursor = m.marginLeft;
      let sepLeft = false;
      for (const ob of obstacles.get(row) ?? []) {
        if (ob.x < cursor) continue;
        let start = ob.x;
        if (cursor < rowEnd) {
          const inside = ob.x <= rowEnd;
          const result = composer.fill({ left: cursor, right: Math.min(ob.x, rowEnd), sepLeft, sepRight: inside }, stream, follow && inside);
          emit(result, baseline);
          if (follow && inside) start = Math.min(ob.x, result.end);
        }
        for (const run of ob.line.runs) {
          ops.push({ t: 'text', x: start + run.dx, y: baseline, text: run.text, font: run.font, fill: run.color });
        }
        cursor = start + ob.line.width;
        sepLeft = true;
      }
      if (cursor < rowEnd) emit(composer.fill({ left: cursor, right: rowEnd, sepLeft, sepRight: false }, stream, follow && sepLeft), baseline);
    }

    this.info = `строк: ${rows}`;
    return { width, height, ops };
  }

  /** Строки фраз по номерам рядов, отсортированы по x. */
  private obstacles(ctx: SurfaceContext, rows: number): Map<number, Obstacle[]> {
    const { config, measurer } = ctx;
    const m = config.main;
    const family = Surface.family(ctx, m.family);
    const map = new Map<number, Obstacle[]>();
    for (const phrase of m.phrases) {
      if (!phrase.enabled || !phrase.text.trim()) continue;
      const lines = RichText.wrap(
        phrase.text,
        { family, size: m.fontSize, boldSize: m.boldSize, weight: phrase.weight, boldWeight: phrase.boldWeight, color: phrase.color, accent: phrase.accent },
        phrase.width,
        measurer,
      );
      const stretch = phrase.justify === 'on' || (phrase.justify !== 'off' && m.justifyPhrases);
      lines.forEach((source, k) => {
        const line = stretch ? RichText.justify(source, phrase.width) : source;
        const row = phrase.row - 1 + k;
        if (row < 0 || row >= rows) return;
        const list = map.get(row) ?? [];
        list.push({ x: phrase.x, line });
        map.set(row, list);
      });
    }
    map.forEach((list) => list.sort((a, b) => a.x - b.x));
    return map;
  }
}
