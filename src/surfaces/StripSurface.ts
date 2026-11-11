import type { ConfigSection, StandConfig, StripText } from '../config/types';
import type { DrawList, DrawOp, FontSpec } from '../draw/ops';
import { RichText, type RichTheme } from '../layout/RichText';
import type { AssetKey, LoadedImage } from '../state/AssetStore';
import { Surface, type SurfaceContext } from './Surface';

export type StripSide = 'left' | 'front';

/** Верхняя полоса: текст слева, логотип справа. */
export class StripSurface extends Surface {
  readonly id;
  readonly title;
  readonly sections: ConfigSection[] = ['strips'];
  readonly assets: AssetKey[];

  constructor(readonly side: StripSide) {
    super();
    this.id = side === 'left' ? ('stripLeft' as const) : ('stripFront' as const);
    this.title = side === 'left' ? 'Полоса слева' : 'Полоса фронт';
    this.assets = ['logo', side === 'left' ? 'logoLeft' : 'logoFront'];
  }

  size(config: StandConfig) {
    const length = this.side === 'left' ? config.stand.sideWidth : config.stand.mainWidth;
    return { width: length, height: config.stand.stripHeight };
  }

  private text(config: StandConfig): StripText {
    return config.strips[this.side];
  }

  private logo(ctx: SurfaceContext): LoadedImage | null {
    const own = this.side === 'left' ? 'logoLeft' : 'logoFront';
    return ctx.assets.image(ctx.config.strips.separateLogos ? own : 'logo');
  }

  private theme(ctx: SurfaceContext): RichTheme {
    const s = ctx.config.strips;
    return { family: Surface.family(ctx, s.family), size: s.fontSize, weight: s.weight, boldWeight: s.boldWeight, color: s.color, accent: s.accent };
  }

  protected fonts(ctx: SurfaceContext): FontSpec[] {
    const t = this.theme(ctx);
    return [t.weight, t.boldWeight].flatMap((weight) => [false, true].map((italic) => ({ family: t.family, weight, size: t.size, italic })));
  }

  protected sample(ctx: SurfaceContext): string {
    return this.text(ctx.config).text + 'H';
  }

  protected layout(ctx: SurfaceContext): DrawList {
    const { config, measurer } = ctx;
    const s = config.strips;
    const { width, height } = this.size(config);
    const ops: DrawOp[] = [{ t: 'rect', x: 0, y: 0, w: width, h: height, fill: s.background }];

    const theme = this.theme(ctx);
    const cap = measurer.capHeight({ family: theme.family, weight: theme.weight, size: theme.size });
    const baseline = Surface.alignTop(s.textAlign, s.textOffset, cap, height) + cap;
    const lines = RichText.wrap(this.text(config).text.replace(/\n/g, ' '), theme, Number.POSITIVE_INFINITY, measurer);
    for (const run of lines[0]?.runs ?? []) {
      ops.push({ t: 'text', x: s.padLeft + run.dx, y: baseline, text: run.text, font: run.font, fill: run.color });
    }

    const logo = this.logo(ctx);
    if (logo) {
      const h = s.logoHeight;
      const w = h * (logo.element.naturalWidth / Math.max(1, logo.element.naturalHeight));
      const y = Surface.alignTop(s.logoAlign, s.logoOffset, h, height);
      ops.push({ t: 'image', x: width - s.padRight - w, y, w, h, source: logo.element, href: logo.dataUrl, opacity: 1, tint: this.text(config).logoTint ? this.text(config).logoColor : undefined });
    }
    this.info = `${width} × ${height}`;
    return { width, height, ops };
  }
}
