import { DEFAULT_FONT_FAMILY } from '../config/defaults';
import type { ConfigSection, StandConfig, VAlign } from '../config/types';
import type { DrawList, FontSpec } from '../draw/ops';
import type { TextMeasurer } from '../layout/TextMeasurer';
import type { AssetKey, AssetStore } from '../state/AssetStore';

export type SurfaceId = 'main' | 'photo' | 'stripLeft' | 'stripFront';

export interface SurfaceContext {
  config: StandConfig;
  assets: AssetStore;
  measurer: TextMeasurer;
}

/** Плоскость стенда, которую можно напечатать: стена или полоса. */
export abstract class Surface {
  abstract readonly id: SurfaceId;
  abstract readonly title: string;
  /** Секции конфига, при изменении которых поверхность пересобирается */
  abstract readonly sections: ConfigSection[];
  abstract readonly assets: AssetKey[];
  /** Короткая сводка для панели (строк и т. п.) */
  info = '';

  abstract size(config: StandConfig): { width: number; height: number };
  protected abstract fonts(ctx: SurfaceContext): FontSpec[];
  protected abstract sample(ctx: SurfaceContext): string;
  protected abstract layout(ctx: SurfaceContext): DrawList;

  async build(ctx: SurfaceContext): Promise<DrawList> {
    await ctx.measurer.ensure(this.fonts(ctx), this.sample(ctx));
    return this.layout(ctx);
  }

  dependsOn(section: ConfigSection | '*'): boolean {
    return section === '*' || section === 'font' || section === 'stand' || this.sections.includes(section);
  }

  /** Шрифт раздела; пусто — общий. */
  static family(ctx: SurfaceContext, own: string): string {
    return own || ctx.config.font.family || DEFAULT_FONT_FAMILY;
  }

  /** Базовая линия, при которой прописные стоят по центру строки. */
  static baseline(rowTop: number, rowHeight: number, capHeight: number): number {
    return rowTop + rowHeight / 2 + capHeight / 2;
  }

  /** Верх блока высотой size внутри полосы height по выравниванию и отступу. */
  static alignTop(align: VAlign, offset: number, size: number, height: number): number {
    if (align === 'top') return offset;
    if (align === 'bottom') return height - offset - size;
    return (height - size) / 2 + offset;
  }
}
