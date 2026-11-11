import type { GradientConfig } from '../config/types';
import type { GradientStop, LinearPaint } from '../draw/ops';

const STOPS = 24;

const parse = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Горизонтальный градиент с кривой перехода (линейно / медленно в начале / в конце / S-образно). */
export class Gradient {
  static ease(cfg: GradientConfig, t: number): number {
    const p = Math.max(0.05, cfg.power);
    switch (cfg.curve) {
      case 'easeIn': return Math.pow(t, p);
      case 'easeOut': return 1 - Math.pow(1 - t, p);
      case 'smooth': return t < 0.5 ? Math.pow(2 * t, p) / 2 : 1 - Math.pow(2 * (1 - t), p) / 2;
      default: return t;
    }
  }

  /** Доля перехода 0..1 в точке v (мм): 0 до start, 1 после end. */
  static at(cfg: GradientConfig, v: number): number {
    if (cfg.end === cfg.start) return v < cfg.start ? 0 : 1;
    const t = Math.min(1, Math.max(0, (v - cfg.start) / (cfg.end - cfg.start)));
    return Gradient.ease(cfg, t);
  }

  static mix(from: string, to: string, k: number): string {
    const a = parse(from), b = parse(to);
    return toHex(a.map((v, i) => v + (b[i] - v) * k));
  }

  /** Точки кривой: [доля 0..1 между start и end, значение перехода 0..1]. */
  static curve(cfg: GradientConfig): [number, number][] {
    const n = cfg.curve === 'linear' ? 1 : STOPS;
    return Array.from({ length: n + 1 }, (_, i) => [i / n, Gradient.ease(cfg, i / n)]);
  }

  static paint(id: string, cfg: GradientConfig, from: string, to: string): LinearPaint {
    const stops: GradientStop[] = Gradient.curve(cfg).map(([t, k]) => [t, Gradient.mix(from, to, k)]);
    return { kind: 'linear', id, x0: cfg.start, x1: cfg.end, stops };
  }

  /** Один цвет с прозрачностью from → to по кривой. */
  static fade(id: string, cfg: GradientConfig, color: string, from: number, to: number): LinearPaint {
    const stops: GradientStop[] = Gradient.curve(cfg).map(([t, k]) => [t, color, from + (to - from) * k]);
    return { kind: 'linear', id, x0: cfg.start, x1: cfg.end, stops };
  }

  static rgba(hex: string, opacity: number): string {
    const [r, g, b] = parse(hex);
    return `rgba(${r},${g},${b},${opacity})`;
  }
}
