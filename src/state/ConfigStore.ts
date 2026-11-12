import { STORAGE_KEY, createDefaultConfig } from '../config/defaults';
import { mergeConfig } from '../config/merge';
import { migrate, type Saved } from '../config/migrations';
import type { ConfigSection, StandConfig } from '../config/types';
import { DefaultsReset } from './DefaultsReset';

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
      if (DefaultsReset.required) {
        localStorage.removeItem(STORAGE_KEY);
        return defaults;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      return ConfigStore.upgrade(JSON.parse(raw));
    } catch {
      return defaults;
    }
  }

  /** Сохранённый конфиг любой версии → текущий: дефолты для новых полей + миграции. */
  static upgrade(saved: unknown): StandConfig {
    return migrate(mergeConfig(createDefaultConfig(), saved), (saved && typeof saved === 'object' ? saved : {}) as Saved);
  }
}
