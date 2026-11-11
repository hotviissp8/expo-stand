/** Векторное описание поверхности в мм. Рисуется в canvas (3D-вид, PNG) и в SVG (печать). */

export interface FontSpec {
  family: string;
  weight: number;
  /** Кегль в мм */
  size: number;
  italic?: boolean;
  /** Трекинг: 1/1000 кегля между символами */
  tracking?: number;
}

/** [доля 0..1, цвет, непрозрачность 0..1 (по умолчанию 1)] */
export type GradientStop = [number, string] | [number, string, number];

/** Горизонтальный градиент в координатах поверхности. */
export interface LinearPaint {
  kind: 'linear';
  id: string;
  x0: number;
  x1: number;
  stops: GradientStop[];
}

/** Заливка картинкой (canvas), растянутой на прямоугольник поверхности. */
export interface ImagePaint {
  kind: 'image';
  id: string;
  source: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Paint = string | LinearPaint | ImagePaint;

export interface RectOp {
  t: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill: Paint;
}

export interface TextOp {
  t: 'text';
  x: number;
  /** Базовая линия */
  y: number;
  text: string;
  font: FontSpec;
  fill: Paint;
}

export interface ImageOp {
  t: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  source: CanvasImageSource;
  href: string | (() => string);
  opacity: number;
  /** Закрасить цветом: файл служит маской по прозрачности */
  tint?: string;
}

export type DrawOp = RectOp | TextOp | ImageOp;

export interface DrawList {
  width: number;
  height: number;
  ops: DrawOp[];
}

/** Добавка между символами, мм */
export function letterSpacing(font: FontSpec): number {
  return ((font.tracking ?? 0) * font.size) / 1000;
}

export function fontCss(font: FontSpec, scale = 1): string {
  return `${font.italic ? 'italic ' : ''}${font.weight} ${font.size * scale}px "${font.family}"`;
}
