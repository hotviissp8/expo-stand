import type { GradientConfig, ScatterConfig } from '../config/types';
import { Gradient } from './Gradient';
import { Random } from './Random';

export interface Offset {
  dx: number;
  dy: number;
}

/**
 * Разброс элементов по стене: сила 1 у start оси, 0 у end, переход по кривой.
 * На каждый элемент всегда тратится одинаковое число случайных чисел —
 * при смене силы/кривой рисунок разброса не перетасовывается.
 */
export class Scatter {
  private random: Random;

  constructor(private readonly cfg: ScatterConfig) {
    this.random = new Random(cfg.seed);
  }

  get unit() {
    return this.cfg.unit;
  }

  /** Сила разброса 0..1 в точке (мм). */
  amount(x: number, y: number): number {
    const c = this.cfg;
    if (!c.enabled) return 0;
    const sx = Scatter.along(c.x, x);
    const sy = Scatter.along(c.y, y);
    const s = c.axis === 'x' ? sx : c.axis === 'y' ? sy : c.combine === 'max' ? Math.max(sx, sy) : sx * sy;
    return Math.min(1, Math.max(0, s * c.strength));
  }

  /** Смещение элемента с центром в (x, y); null — элемент выкинут. */
  displace(x: number, y: number): Offset | null {
    const r0 = this.random.next(), r1 = this.random.next(), r2 = this.random.next();
    const s = this.amount(x, y);
    if (s <= 0) return { dx: 0, dy: 0 };
    if (r0 < s * this.cfg.drop) return null;
    return { dx: (r1 * 2 - 1) * this.cfg.jitterX * s, dy: (r2 * 2 - 1) * this.cfg.jitterY * s };
  }

  private static along(g: GradientConfig, v: number): number {
    return 1 - Gradient.at(g, v);
  }
}
