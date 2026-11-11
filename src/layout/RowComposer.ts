import type { FontSpec } from '../draw/ops';
import { Random } from './Random';
import type { TextMeasurer } from './TextMeasurer';

export interface StreamItem {
  text: string;
  width: number;
}

/** Бесконечный поток названий: по кругу, при shuffle каждый круг перемешан заново. */
export class NameStream {
  private order: string[] = [];
  private index = 0;
  private random: Random;
  private catalog: StreamItem[] | null = null;
  /** Последнее выданное название (по порядку или вставкой) */
  previous: string | undefined;

  constructor(
    private readonly names: readonly string[],
    private readonly font: FontSpec,
    private readonly measurer: TextMeasurer,
    private readonly shuffle: boolean,
    seed: number,
  ) {
    this.random = new Random(seed);
    this.refill();
  }

  get empty(): boolean {
    return this.names.length === 0;
  }

  peek(): StreamItem {
    const text = this.order[this.index];
    return { text, width: this.measurer.width(text, this.font) };
  }

  advance(): void {
    this.previous = this.order[this.index];
    this.index++;
    if (this.index >= this.order.length) this.refill();
  }

  /**
   * Вставка вне порядка: самое широкое название, которое влезает в maxWidth и не равно предыдущему.
   * Порядок потока не сдвигается. Названия из avoid берутся, только если других нет.
   */
  filler(maxWidth: number, avoid: ReadonlySet<string>): StreamItem | null {
    this.catalog ??= [...new Set(this.names)]
      .map((text) => ({ text, width: this.measurer.width(text, this.font) }))
      .sort((a, b) => b.width - a.width);
    const fits = this.catalog.filter((i) => i.width <= maxWidth && i.text !== this.previous);
    const pick = fits.find((i) => !avoid.has(i.text)) ?? fits[0] ?? null;
    if (pick) this.previous = pick.text;
    return pick;
  }

  private refill(): void {
    const previousLast = this.order[this.order.length - 1];
    this.order = this.shuffle ? this.random.shuffle(this.names) : [...this.names];
    if (this.order.length > 1 && this.order[0] === previousLast) this.order.push(this.order.shift()!);
    this.index = 0;
  }
}

export interface Segment {
  left: number;
  right: number;
  /** Нужна точка между краем и первым/последним названием (край — фраза) */
  sepLeft: boolean;
  sepRight: boolean;
}

export interface PlacedName {
  text: string;
  x: number;
  width: number;
}

export interface SegmentResult {
  names: PlacedName[];
  /** Центры точек-разделителей */
  dots: number[];
  /** Где может начаться следующий элемент (фраза) — для режима follow */
  end: number;
}

export interface FillOptions {
  minGap: number;
  justify: boolean;
  /** Если перед фразой осталось место — вставить подходящее по ширине название вне порядка */
  fillGaps?: boolean;
}

/** Заполняет отрезок строки целыми названиями; точки ставятся в серединах промежутков. */
export class RowComposer {
  constructor(private readonly options: FillOptions) {}

  /**
   * follow — названия прижаты влево с минимальным промежутком, точка сразу за последним,
   * а следующий элемент начинается в result.end (пустое место уходит вправо).
   */
  fill(segment: Segment, stream: NameStream, follow = false): SegmentResult {
    const { minGap } = this.options;
    const justify = this.options.justify && !follow;
    const avail = segment.right - segment.left;
    const edgeSeps = (segment.sepLeft ? 1 : 0) + (segment.sepRight ? 1 : 0);
    const taken: StreamItem[] = [];
    let sum = 0;
    if (!stream.empty && avail > 0) {
      for (;;) {
        const item = stream.peek();
        const gaps = taken.length + edgeSeps;
        if (sum + item.width + gaps * minGap > avail) {
          if (!taken.length && !edgeSeps && item.width > avail) stream.advance();
          break;
        }
        taken.push(item);
        sum += item.width;
        stream.advance();
      }
      if (this.options.fillGaps && segment.sepRight && !follow) {
        const used = new Set(taken.map((t) => t.text));
        for (;;) {
          const room = avail - sum - (taken.length + edgeSeps) * minGap;
          const item = room > 0 ? stream.filler(room, used) : null;
          if (!item) break;
          taken.push(item);
          used.add(item.text);
          sum += item.width;
        }
      }
    }

    const dots: number[] = [];
    if (!taken.length) {
      if (avail <= 0) return { names: [], dots, end: segment.left };
      if (follow) {
        if (!segment.sepRight) return { names: [], dots, end: segment.left };
        dots.push(segment.left + minGap / 2);
        return { names: [], dots, end: segment.left + minGap };
      }
      if (segment.sepLeft && segment.sepRight) dots.push((segment.left + segment.right) / 2);
      else if (segment.sepLeft) dots.push(segment.left + minGap / 2);
      else if (segment.sepRight) dots.push(segment.right - minGap / 2);
      return { names: [], dots, end: segment.right };
    }

    const gapCount = taken.length - 1 + edgeSeps;
    const gap = justify && gapCount > 0 ? (avail - sum) / gapCount : minGap;
    const names: PlacedName[] = [];
    let x = segment.left;
    if (segment.sepLeft) {
      dots.push(x + gap / 2);
      x += gap;
    }
    taken.forEach((item, i) => {
      if (i > 0) {
        dots.push(x + gap / 2);
        x += gap;
      }
      names.push({ text: item.text, x, width: item.width });
      x += item.width;
    });
    if (segment.sepRight) dots.push(justify || follow ? x + gap / 2 : segment.right - minGap / 2);
    return { names, dots, end: follow ? x + (segment.sepRight ? gap : 0) : segment.right };
  }
}
