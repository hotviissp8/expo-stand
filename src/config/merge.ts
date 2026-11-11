import { CONFIG_VERSION } from './version';

/** Накладывает сохранённое на значения по умолчанию: новые поля получают дефолт, лишние отбрасываются. */
export function mergeConfig<T>(base: T, saved: unknown): T {
  if (saved === undefined || saved === null) return base;
  if (Array.isArray(base)) return (Array.isArray(saved) ? saved : base) as T;
  if (typeof base === 'object' && base !== null) {
    if (typeof saved !== 'object') return base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(out)) out[key] = mergeConfig(out[key], (saved as Record<string, unknown>)[key]);
    if ('version' in (base as object)) out.version = CONFIG_VERSION;
    return out as T;
  }
  return (typeof saved === typeof base ? saved : base) as T;
}
