export interface FaceInfo {
  family: string;
  subfamily: string;
  weight: number;
  italic: boolean;
}

const tag = (view: DataView, at: number) =>
  String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

type TableReader = (name: string) => Promise<DataView | null>;

/** Читает семейство, вес и курсив из TTF/OTF/TTC/WOFF. WOFF2 не разбирается (сжатие brotli). */
export class FontParser {
  static async parse(buffer: ArrayBuffer): Promise<FaceInfo | null> {
    const view = new DataView(buffer);
    const signature = tag(view, 0);
    let reader: TableReader | null = null;
    if (signature === 'wOFF') reader = FontParser.woffReader(view);
    else if (signature === 'ttcf') reader = FontParser.sfntReader(view, view.getUint32(12));
    else if (signature === 'OTTO' || signature === 'true' || view.getUint32(0) === 0x00010000) reader = FontParser.sfntReader(view, 0);
    if (!reader) return null;

    const name = await reader('name');
    if (!name) return null;
    const family = FontParser.nameString(name, 16) ?? FontParser.nameString(name, 1);
    if (!family) return null;
    const subfamily = FontParser.nameString(name, 17) ?? FontParser.nameString(name, 2) ?? '';

    let weight = 400;
    let italic = /italic|oblique/i.test(subfamily);
    const os2 = await reader('OS/2');
    if (os2) {
      weight = os2.getUint16(4) || 400;
      if (os2.byteLength >= 64) italic = (os2.getUint16(62) & 1) === 1 || italic;
    }
    return { family, subfamily, weight: FontParser.snapWeight(weight), italic };
  }

  /** Вес по имени файла — для WOFF2. */
  static guess(fileName: string): FaceInfo {
    const base = fileName.replace(/\.[^.]+$/, '');
    const map: [RegExp, number][] = [
      [/thin|hairline/i, 100], [/extra.?light|ultra.?light/i, 200], [/light/i, 300], [/medium/i, 500],
      [/semi.?bold|demi/i, 600], [/extra.?bold|ultra.?bold/i, 800], [/black|heavy/i, 900], [/bold/i, 700],
    ];
    const weight = map.find(([re]) => re.test(base))?.[1] ?? 400;
    const family = base.replace(/[-_ ]?(thin|hairline|extra.?light|ultra.?light|light|regular|medium|semi.?bold|demi.?bold|extra.?bold|ultra.?bold|bold|black|heavy|italic|oblique)+$/gi, '').trim() || base;
    return { family, subfamily: '', weight, italic: /italic|oblique/i.test(base) };
  }

  private static snapWeight(w: number): number {
    return Math.min(900, Math.max(100, Math.round(w / 100) * 100));
  }

  private static sfntReader(view: DataView, start: number): TableReader {
    const numTables = view.getUint16(start + 4);
    return async (name) => {
      for (let i = 0; i < numTables; i++) {
        const rec = start + 12 + i * 16;
        if (tag(view, rec) === name) {
          return new DataView(view.buffer, view.byteOffset + view.getUint32(rec + 8), view.getUint32(rec + 12));
        }
      }
      return null;
    };
  }

  private static woffReader(view: DataView): TableReader {
    const numTables = view.getUint16(12);
    return async (name) => {
      for (let i = 0; i < numTables; i++) {
        const rec = 44 + i * 20;
        if (tag(view, rec) !== name) continue;
        const offset = view.getUint32(rec + 4);
        const compLength = view.getUint32(rec + 8);
        const origLength = view.getUint32(rec + 12);
        const raw = new Uint8Array(view.buffer, view.byteOffset + offset, compLength);
        if (compLength === origLength) return new DataView(raw.slice().buffer);
        const stream = new Blob([raw.slice()]).stream().pipeThrough(new DecompressionStream('deflate'));
        return new DataView(await new Response(stream).arrayBuffer());
      }
      return null;
    };
  }

  /** Строка из таблицы name: сначала Windows/Unicode (en-US), затем любая. */
  private static nameString(view: DataView, nameId: number): string | null {
    const count = view.getUint16(2);
    const storage = view.getUint16(4);
    let fallback: string | null = null;
    for (let i = 0; i < count; i++) {
      const rec = 6 + i * 12;
      const platform = view.getUint16(rec);
      const language = view.getUint16(rec + 4);
      if (view.getUint16(rec + 6) !== nameId) continue;
      const length = view.getUint16(rec + 8);
      const offset = storage + view.getUint16(rec + 10);
      let text = '';
      if (platform === 3 || platform === 0) {
        for (let j = 0; j < length; j += 2) text += String.fromCharCode(view.getUint16(offset + j));
      } else {
        for (let j = 0; j < length; j++) text += String.fromCharCode(view.getUint8(offset + j));
      }
      if (platform === 3 && language === 0x409) return text;
      fallback ??= text;
    }
    return fallback;
  }
}
