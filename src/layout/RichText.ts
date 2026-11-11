import type { FontSpec } from '../draw/ops';
import type { TextMeasurer } from './TextMeasurer';

export interface RichStyle {
  bold: boolean;
  accent: boolean;
  italic: boolean;
}

export interface RichRun extends RichStyle {
  text: string;
}

export interface RichTheme {
  family: string;
  size: number;
  /** Кегль **жирного**; нет — как size */
  boldSize?: number;
  weight: number;
  boldWeight: number;
  color: string;
  accent: string;
  /** Трекинг: 1/1000 кегля */
  tracking?: number;
}

export interface PlacedRun {
  text: string;
  /** Смещение от начала строки, мм */
  dx: number;
  width: number;
  font: FontSpec;
  color: string;
  /** Номер слова в строке — между словами растягивается пробел */
  word: number;
}

export interface RichLine {
  runs: PlacedRun[];
  width: number;
  /** Последняя строка абзаца (конец текста или принудительный перенос) — не растягивается */
  last: boolean;
}

/** Разметка фраз: **жирный**, ==выделенный==, __курсив__. */
export class RichText {
  static parse(source: string): RichRun[] {
    const runs: RichRun[] = [];
    const style: RichStyle = { bold: false, accent: false, italic: false };
    let buffer = '';
    const flush = () => {
      if (buffer) runs.push({ text: buffer, ...style });
      buffer = '';
    };
    for (let i = 0; i < source.length; i++) {
      const pair = source.slice(i, i + 2);
      if (pair === '**' || pair === '==' || pair === '__') {
        flush();
        if (pair === '**') style.bold = !style.bold;
        else if (pair === '==') style.accent = !style.accent;
        else style.italic = !style.italic;
        i++;
      } else {
        buffer += source[i];
      }
    }
    flush();
    return runs;
  }

  static font(theme: RichTheme, style: RichStyle): FontSpec {
    return { family: theme.family, size: style.bold ? (theme.boldSize ?? theme.size) : theme.size, weight: style.bold ? theme.boldWeight : theme.weight, italic: style.italic, tracking: theme.tracking };
  }

  /** Переносит по словам в заданную ширину; переводы строки в тексте — принудительные. */
  static wrap(source: string, theme: RichTheme, maxWidth: number, measurer: TextMeasurer): RichLine[] {
    interface Word {
      parts: RichRun[];
      breakBefore: boolean;
    }
    const words: Word[] = [];
    let current: Word = { parts: [], breakBefore: false };
    const pushWord = (breakNext: boolean) => {
      if (current.parts.length) words.push(current);
      current = { parts: [], breakBefore: breakNext || (!current.parts.length && current.breakBefore) };
    };
    for (const run of RichText.parse(source)) {
      for (const piece of run.text.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) pushWord(piece.includes('\n'));
        else current.parts.push({ ...run, text: piece });
      }
    }
    pushWord(false);

    const spaceFont = RichText.font(theme, { bold: false, accent: false, italic: false });
    const space = measurer.width(' ', spaceFont);
    const lines: RichLine[] = [];
    const empty = (): RichLine => ({ runs: [], width: 0, last: false });
    let line = empty();
    let wordIndex = 0;
    for (const word of words) {
      const wordWidth = word.parts.reduce((sum, p) => sum + measurer.width(p.text, RichText.font(theme, p)), 0);
      const needsSpace = line.runs.length > 0;
      if ((word.breakBefore && line.runs.length) || (needsSpace && line.width + space + wordWidth > maxWidth)) {
        line.last = word.breakBefore;
        lines.push(line);
        line = empty();
        wordIndex = 0;
      }
      let dx = line.runs.length ? line.width + space : 0;
      for (const part of word.parts) {
        const font = RichText.font(theme, part);
        const width = measurer.width(part.text, font);
        line.runs.push({ text: part.text, dx, width, font, color: part.accent ? theme.accent : theme.color, word: wordIndex });
        dx += width;
      }
      line.width = dx;
      wordIndex++;
    }
    if (line.runs.length) lines.push({ ...line, last: true });
    return lines;
  }

  /** Растягивает промежутки между словами так, чтобы строка заняла ровно width; последнюю строку и однословные не трогает. */
  static justify(line: RichLine, width: number): RichLine {
    const gaps = line.runs.reduce((max, r) => Math.max(max, r.word), 0);
    if (line.last || gaps === 0 || width <= line.width) return line;
    const extra = (width - line.width) / gaps;
    return { ...line, width, runs: line.runs.map((r) => ({ ...r, dx: r.dx + extra * r.word })) };
  }
}
