import { ASSET_DB } from '../config/defaults';

export type StoreName = 'assets' | 'fonts';

const DB_VERSION = 2;

/** Общая IndexedDB проекта: файлы картинок и шрифтов. */
export class Db {
  private static instance: Promise<IDBDatabase> | null = null;

  private static open(): Promise<IDBDatabase> {
    Db.instance ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(ASSET_DB, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ['assets', 'fonts'] as StoreName[]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return Db.instance;
  }

  static async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await Db.open();
    return Db.done<T | undefined>(db.transaction(store).objectStore(store).get(key));
  }

  static async all<T>(store: StoreName): Promise<T[]> {
    const db = await Db.open();
    return Db.done<T[]>(db.transaction(store).objectStore(store).getAll());
  }

  static async put(store: StoreName, key: string, value: unknown): Promise<void> {
    const db = await Db.open();
    await Db.done(db.transaction(store, 'readwrite').objectStore(store).put(value, key));
  }

  static async delete(store: StoreName, key: string): Promise<void> {
    const db = await Db.open();
    await Db.done(db.transaction(store, 'readwrite').objectStore(store).delete(key));
  }

  private static done<T>(req: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  }
}
