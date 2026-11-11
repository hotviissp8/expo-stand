import { BUILTIN_WEIGHTS, DEFAULT_FONT_FAMILY, SYSTEM_WEIGHTS } from '../config/defaults';
import { Db } from '../state/Db';
import { FontParser, type FaceInfo } from './FontParser';

interface StoredFace extends FaceInfo {
  id: string;
  fileName: string;
  blob: Blob;
}

export interface FaceSummary {
  weight: number;
  italic: boolean;
}

interface LocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  blob(): Promise<Blob>;
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFontData[]>;
  }
}

type Listener = () => void;

/**
 * Библиотека шрифтов: файлы с ПК и системные шрифты, импортированные целиком (все начертания).
 * Каждое начертание регистрируется как FontFace с точным весом и стилем — canvas и экспорт
 * получают ровно тот файл, что выбран.
 */
export class FontLibrary {
  private faces = new Map<string, StoredFace>();
  private registered = new Map<string, FontFace>();
  private listeners = new Set<Listener>();
  private localCache: LocalFontData[] | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async restore(): Promise<void> {
    const all = await Db.all<StoredFace>('fonts');
    await Promise.all(all.map((face) => this.register(face).catch((e) => console.error(face.fileName, e))));
  }

  families(): string[] {
    return [...new Set([...this.faces.values()].map((f) => f.family))].sort((a, b) => a.localeCompare(b));
  }

  facesOf(family: string): FaceSummary[] {
    return [...this.faces.values()]
      .filter((f) => f.family === family)
      .map((f) => ({ weight: f.weight, italic: f.italic }))
      .sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
  }

  /** Доступные прямые начертания семейства (для выбора веса). */
  weights(family: string): number[] {
    if (family === DEFAULT_FONT_FAMILY) return BUILTIN_WEIGHTS;
    const own = [...new Set(this.facesOf(family).filter((f) => !f.italic).map((f) => f.weight))];
    if (own.length) return own;
    const any = [...new Set(this.facesOf(family).map((f) => f.weight))];
    return any.length ? any : SYSTEM_WEIGHTS;
  }

  async addFiles(files: File[]): Promise<string[]> {
    const added = new Set<string>();
    for (const file of files) {
      const family = await this.addBlob(file, file.name);
      if (family) added.add(family);
    }
    this.emit();
    return [...added];
  }

  async removeFamily(family: string): Promise<void> {
    for (const face of [...this.faces.values()].filter((f) => f.family === family)) {
      this.faces.delete(face.id);
      const ff = this.registered.get(face.id);
      if (ff) document.fonts.delete(ff);
      this.registered.delete(face.id);
      await Db.delete('fonts', face.id);
    }
    this.emit();
  }

  get localSupported(): boolean {
    return typeof window.queryLocalFonts === 'function';
  }

  /** Семейства, установленные в системе (спрашивает разрешение браузера). */
  async localFamilies(): Promise<string[]> {
    this.localCache ??= await window.queryLocalFonts!();
    return [...new Set(this.localCache.map((f) => f.family))].sort((a, b) => a.localeCompare(b));
  }

  /** Импорт всех начертаний системного семейства. */
  async importLocal(family: string): Promise<void> {
    this.localCache ??= await window.queryLocalFonts!();
    for (const font of this.localCache.filter((f) => f.family === family)) {
      await this.addBlob(await font.blob(), `${font.postscriptName || font.fullName}.ttf`, family);
    }
    this.emit();
  }

  private async addBlob(blob: Blob, fileName: string, familyOverride?: string): Promise<string | null> {
    const buffer = await blob.arrayBuffer();
    const info = (await FontParser.parse(buffer).catch(() => null)) ?? FontParser.guess(fileName);
    if (familyOverride) info.family = familyOverride;
    const id = `${info.family}|${info.weight}|${info.italic ? 'i' : 'n'}`;
    const face: StoredFace = { ...info, id, fileName, blob };
    const old = this.registered.get(id);
    if (old) document.fonts.delete(old);
    await this.register(face, buffer);
    await Db.put('fonts', id, face);
    return info.family;
  }

  private async register(face: StoredFace, buffer?: ArrayBuffer): Promise<void> {
    const ff = new FontFace(face.family, buffer ?? (await face.blob.arrayBuffer()), {
      weight: String(face.weight),
      style: face.italic ? 'italic' : 'normal',
    });
    await ff.load();
    document.fonts.add(ff);
    this.faces.set(face.id, face);
    this.registered.set(face.id, ff);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}
