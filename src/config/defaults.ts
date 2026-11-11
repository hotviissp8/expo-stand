import { MATERIALS } from '../data/materials';
import { mergeConfig } from './merge';
import { migrate, type Saved } from './migrations';
import PRESET from './preset.json';
import type { PhraseConfig, StandConfig } from './types';
import { CONFIG_VERSION } from './version';

export { CONFIG_VERSION };

/** Встроенный шрифт (пакет @fontsource/inter, все начертания 100–900). */
export const DEFAULT_FONT_FAMILY = 'Inter';
export const BUILTIN_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
/** Начертания системного шрифта, не добавленного в библиотеку. */
export const SYSTEM_WEIGHTS = [400, 700];
export const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
};

export const STORAGE_KEY = 'expo-stand.config';
export const PANEL_MODE_KEY = 'expo-stand.panelMode';
export const ASSET_DB = 'expo-stand';

/** Настройки логотипа одной полосы */
const STRIP_LOGO = { logoHeight: 200, logoPadRight: 60, logoAlign: 'center' as const, logoOffset: 0, logoTint: false, logoColor: '#ffffff' };

export function newPhrase(row: number): PhraseConfig {
  return {
    id: Math.random().toString(36).slice(2, 10),
    enabled: true,
    text: 'Новая **фраза**',
    row,
    x: 900,
    width: 2200,
    color: '#c8c8c8',
    accent: '#ffffff',
    weight: 400,
    boldWeight: 700,
    justify: 'auto',
    tracking: 0,
  };
}

/**
 * Настройки по умолчанию = preset.json (сохранённый конфиг стенда) поверх встроенных значений.
 * Чтобы обновить дефолты, замените preset.json файлом из «Сохранить».
 */
export function createDefaultConfig(): StandConfig {
  return migrate(mergeConfig(builtinConfig(), PRESET), PRESET as Saved);
}

/** Встроенные значения: запасные для полей, которых нет в preset.json. */
export function builtinConfig(): StandConfig {
  return {
    version: CONFIG_VERSION,
    stand: {
      mainWidth: 5000,
      sideWidth: 3000,
      height: 3000,
      wallThickness: 80,
      wallColor: '#e9e9e9',
      floorColor: '#bdbdbd',
      stripHeight: 300,
      stripThickness: 40,
      cornerPost: false,
      postSize: 50,
      cornerColor: '#ffffff',
    },
    font: { family: DEFAULT_FONT_FAMILY },
    materials: [...MATERIALS],
    main: {
      family: '',
      background: '#2f3133',
      textColor: '#45484b',
      dotColor: '#45484b',
      separator: '·',
      fontSize: 42,
      boldSize: 64,
      weight: 600,
      lineHeight: 155,
      marginTop: 110,
      marginBottom: 90,
      marginLeft: 40,
      textEnd: 4700,
      ragged: 300,
      minGap: 45,
      justify: true,
      justifyPhrases: false,
      phraseTracking: 0,
      fillGaps: true,
      shuffle: true,
      seed: 7,
      phraseFlow: 'fixed',
      gradient: { start: 4000, end: 5000, curve: 'soft', power: 1 },
      textGradientLinked: true,
      textGradient: { start: 4000, end: 5000, curve: 'soft', power: 1 },
      textInverse: '#e2e2e2',
      dotInverse: '#e2e2e2',
      phrases: [],
    },
    mosaic: {
      family: '',
      mode: 'color',
      sampling: 'letter',
      background: '#111111',
      ink: '#ffffff',
      invert: false,
      separator: '·',
      fontSize: 16,
      weight: 700,
      lineHeight: 19,
      margin: 0,
      minGap: 10,
      shuffle: true,
      seed: 3,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      gamma: 1,
      underlay: 0,
      fade: { enabled: true, start: 0, end: 1000, curve: 'smooth', power: 1.6 },
      pixels: { enabled: true, start: 1000, end: 2000, curve: 'smooth', power: 1.6 },
      pixelSize: 0,
      scatter: {
        enabled: false,
        axis: 'x',
        combine: 'max',
        x: { start: 0, end: 1800, curve: 'easeOut', power: 1.6 },
        y: { start: 0, end: 1500, curve: 'easeOut', power: 1.6 },
        strength: 1,
        jitterX: 120,
        jitterY: 60,
        drop: 0.6,
        unit: 'name',
        seed: 11,
      },
      overlay: { enabled: true, x: 1500, y: 1250, height: 400, tint: false, color: '#ffffff', opacity: 1 },
    },
    strips: {
      family: '',
      background: '#111111',
      color: '#ffffff',
      accent: '#d12929',
      weight: 500,
      boldWeight: 700,
      fontSize: 110,
      padLeft: 60,
      textAlign: 'center',
      textOffset: 0,
      separateLogos: false,
      innerContent: false,
      innerBackground: '#111111',
      left: { text: '', ...STRIP_LOGO },
      front: { text: '', ...STRIP_LOGO },
    },
    view: {
      pxPerMm: 1.6,
      exportPxPerMm: 4,
      background: '#e4e6e8',
      groundColor: '#d4d6d8',
      lit: true,
      light: 1,
      shadows: false,
      human: false,
    },
  };
}
