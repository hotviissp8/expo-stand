import { Db } from './Db';

export type AssetKey = 'photo' | 'logo' | 'logoLeft' | 'logoFront' | 'photoLogo';
export const ASSET_KEYS: AssetKey[] = ['photo', 'logo', 'logoLeft', 'logoFront', 'photoLogo'];

export interface LoadedImage {
  name: string;
  element: HTMLImageElement;
  /** data: URL — для встраивания в SVG */
  dataUrl: string;
}

interface StoredAsset {
  name: string;
  blob: Blob;
}

type Listener = (key: AssetKey) => void;

/** Картинки, выбранные с ПК (фото, логотипы). Живут в IndexedDB между перезапусками. */
export class AssetStore {
  private images = new Map<AssetKey, LoadedImage>();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  image(key: AssetKey): LoadedImage | null {
    return this.images.get(key) ?? null;
  }

  label(key: AssetKey): string {
    return this.images.get(key)?.name ?? '';
  }

  async restore(): Promise<void> {
    for (const key of ASSET_KEYS) {
      const stored = await Db.get<StoredAsset>('assets', key);
      if (stored) await this.apply(key, stored).catch((e) => console.error(key, e));
    }
  }

  async put(key: AssetKey, file: File): Promise<void> {
    const stored: StoredAsset = { name: file.name, blob: file };
    await this.apply(key, stored);
    await Db.put('assets', key, stored);
    this.listeners.forEach((l) => l(key));
  }

  async remove(key: AssetKey): Promise<void> {
    this.images.delete(key);
    await Db.delete('assets', key);
    this.listeners.forEach((l) => l(key));
  }

  private async apply(key: AssetKey, stored: StoredAsset): Promise<void> {
    const dataUrl = await AssetStore.toDataUrl(stored.blob);
    const element = new Image();
    element.src = dataUrl;
    await element.decode();
    this.images.set(key, { name: stored.name, element, dataUrl });
  }

  private static toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
