import { CONFIG_VERSION, STORAGE_KEY, createDefaultConfig } from '../config/defaults';
import { migrate, type Saved } from '../config/migrations';
import type { ConfigSection, StandConfig } from '../config/types';

export interface ConfigChange {
  /** Путь вида "main.fontSize"; "*" — заменён весь конфиг. */
  path: string;
  section: ConfigSection | '*';
}

type Listener = (change: ConfigChange) => void;

/** Хранит конфиг стенда, раздаёт изменения по путям, сохраняет в localStorage. */
export class ConfigStore {
  private config: StandConfig;
  private listeners = new Set<Listener>();
  private saveTimer = 0;

  constructor() {
    this.config = ConfigStore.load();
  }

  get value(): StandConfig {
    return this.config;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(path: string): unknown {
    return path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], this.config);
  }

  set(path: string, value: unknown): void {
    const keys = path.split('.');
    const last = keys.pop()!;
    const parent = keys.reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, this.config as unknown as Record<string, unknown>);
    if (parent[last] === value) return;
    parent[last] = value;
    this.emit({ path, section: keys[0] as ConfigSection ?? (last as ConfigSection) });
  }

  /** Изменение по месту (массивы, вложенные объекты) с явным путём. */
  mutate(path: string, fn: (config: StandConfig) => void): void {
    fn(this.config);
    this.emit({ path, section: path.split('.')[0] as ConfigSection });
  }

  replace(next: StandConfig): void {
    this.config = ConfigStore.upgrade(next);
    this.emit({ path: '*', section: '*' });
  }

  reset(): void {
    this.replace(createDefaultConfig());
  }

  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  private emit(change: ConfigChange): void {
    this.scheduleSave();
    this.listeners.forEach((l) => l(change));
  }

  private scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config)), 300);
  }

  private static load(): StandConfig {
    const defaults = createDefaultConfig();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      return ConfigStore.upgrade(JSON.parse(raw));
    } catch {
      return defaults;
    }
  }

  /** Сохранённый конфиг любой версии → текущий: дефолты для новых полей + миграции. */
  static upgrade(saved: unknown): StandConfig {
    return migrate(ConfigStore.merge(createDefaultConfig(), saved), (saved && typeof saved === 'object' ? saved : {}) as Saved);
  }

  /** Накладывает сохранённое на значения по умолчанию: новые поля получают дефолт. */
  static merge<T>(base: T, saved: unknown): T {
    if (saved === undefined || saved === null) return base;
    if (Array.isArray(base)) return (Array.isArray(saved) ? saved : base) as T;
    if (typeof base === 'object' && base !== null) {
      if (typeof saved !== 'object') return base;
      const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
      for (const key of Object.keys(out)) out[key] = ConfigStore.merge(out[key], (saved as Record<string, unknown>)[key]);
      out.version = CONFIG_VERSION;
      if (!('version' in (base as object))) delete out.version;
      return out as T;
    }
    return (typeof saved === typeof base ? saved : base) as T;
  }
}
