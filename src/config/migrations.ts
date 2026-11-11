import { createDefaultConfig } from './defaults';
import type { StandConfig } from './types';

/** Сохранённый конфиг как был, до наложения дефолтов: только поля, нужные миграциям. */
export interface Saved {
  version?: unknown;
  main?: { gradientTo?: unknown };
  strips?: { logoHeight?: unknown; padRight?: unknown; logoAlign?: unknown; logoOffset?: unknown };
}

interface Migration {
  /** Применяется к сохранённым конфигам с версией ниже этой */
  version: number;
  apply(config: StandConfig, saved: Saved): void;
}

/** Правки сохранённых настроек при смене значений по умолчанию, которые должны дойти до пользователя. */
const MIGRATIONS: Migration[] = [
  {
    version: 3,
    apply(config, saved) {
      const d = createDefaultConfig();
      if (d.materials.length) config.materials = [...d.materials];
      const m = config.main;
      m.fontSize = d.main.fontSize;
      m.boldSize = d.main.boldSize;
      m.lineHeight = d.main.lineHeight;
      m.marginTop = d.main.marginTop;
      m.marginBottom = d.main.marginBottom;
      m.minGap = d.main.minGap;
      const oldCorner = saved.main?.gradientTo;
      if (typeof oldCorner === 'string') config.stand.cornerColor = oldCorner;
      config.mosaic.scatter.enabled = false;
    },
  },
  {
    version: 4,
    apply(config) {
      // Линейный переход даёт видимый излом на концах — главная стена переходит на мягкую кривую.
      for (const g of [config.main.gradient, config.main.textGradient]) if (g.curve === 'linear') g.curve = 'soft';
      for (const phrase of config.main.phrases) phrase.justify ??= 'auto';
    },
  },
  {
    version: 5,
    apply(config, saved) {
      for (const phrase of config.main.phrases) phrase.tracking ??= 0;
      // Логотип настраивается у каждой полосы отдельно: общие значения копируются в обе
      const old = saved.strips ?? {};
      for (const strip of [config.strips.left, config.strips.front]) {
        if (typeof old.logoHeight === 'number') strip.logoHeight = old.logoHeight;
        if (typeof old.padRight === 'number') strip.logoPadRight = old.padRight;
        if (old.logoAlign === 'top' || old.logoAlign === 'center' || old.logoAlign === 'bottom') strip.logoAlign = old.logoAlign;
        if (typeof old.logoOffset === 'number') strip.logoOffset = old.logoOffset;
      }
    },
  },
];

export function migrate(config: StandConfig, saved: Saved): StandConfig {
  const from = Number(saved.version) || 0;
  for (const m of MIGRATIONS) if (from < m.version) m.apply(config, saved);
  return config;
}
