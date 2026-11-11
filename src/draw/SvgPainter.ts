import { letterSpacing, type DrawList, type Paint } from './ops';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number) => +n.toFixed(3);

/** Векторный экспорт: размеры документа в мм, координаты 1 ед. = 1 мм. */
export class SvgPainter {
  paint(list: DrawList): string {
    const defs: string[] = [];
    const refs = new Map<Paint, string>();
    const fill = (paint: Paint): string => {
      if (typeof paint === 'string') return paint;
      const known = refs.get(paint);
      if (known) return known;
      const id = `p-${paint.id}-${refs.size}`;
      if (paint.kind === 'linear') {
        defs.push(
          `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(paint.x0)}" y1="0" x2="${num(Math.max(paint.x1, paint.x0 + 0.01))}" y2="0">` +
            paint.stops.map(([o, c, a = 1]) => `<stop offset="${num(o)}" stop-color="${c}"${a < 1 ? ` stop-opacity="${num(a)}"` : ''}/>`).join('') +
            `</linearGradient>`,
        );
      } else {
        defs.push(
          `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${num(paint.x)}" y="${num(paint.y)}" width="${num(paint.w)}" height="${num(paint.h)}">` +
            `<image href="${paint.source.toDataURL('image/png')}" width="${num(paint.w)}" height="${num(paint.h)}" preserveAspectRatio="none"/></pattern>`,
        );
      }
      const ref = `url(#${id})`;
      refs.set(paint, ref);
      return ref;
    };

    const body: string[] = [];
    for (const op of list.ops) {
      if (op.t === 'rect') {
        body.push(`<rect x="${num(op.x)}" y="${num(op.y)}" width="${num(op.w)}" height="${num(op.h)}" fill="${fill(op.fill)}"/>`);
      } else if (op.t === 'text') {
        body.push(
          `<text x="${num(op.x)}" y="${num(op.y)}" font-family="${esc(op.font.family)}" font-weight="${op.font.weight}"${op.font.italic ? ' font-style="italic"' : ''}${letterSpacing(op.font) ? ` letter-spacing="${num(letterSpacing(op.font))}"` : ''} font-size="${num(op.font.size)}" fill="${fill(op.fill)}">${esc(op.text)}</text>`,
        );
      } else {
        const href = typeof op.href === 'function' ? op.href() : op.href;
        let filter = '';
        if (op.tint) {
          const id = `tint-${defs.length}`;
          defs.push(
            `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">` +
              `<feFlood flood-color="${op.tint}" result="c"/><feComposite in="c" in2="SourceAlpha" operator="in"/></filter>`,
          );
          filter = ` filter="url(#${id})"`;
        }
        body.push(
          `<image x="${num(op.x)}" y="${num(op.y)}" width="${num(op.w)}" height="${num(op.h)}" opacity="${op.opacity}" preserveAspectRatio="none"${filter} href="${href}"/>`,
        );
      }
    }
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${list.width}mm" height="${list.height}mm" viewBox="0 0 ${list.width} ${list.height}" xml:space="preserve">\n` +
      `<defs>${defs.join('')}</defs>\n${body.join('\n')}\n</svg>\n`
    );
  }
}
