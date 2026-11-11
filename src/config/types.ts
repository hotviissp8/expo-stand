/** Все размеры в миллиметрах, цвета — CSS hex. */

/** auto — как общая настройка «Растягивать фразы» */
export type PhraseJustify = 'auto' | 'on' | 'off';

export interface PhraseConfig {
  id: string;
  enabled: boolean;
  /** Разметка: **жирный**, ==выделенный==, __курсив__ */
  text: string;
  /** Номер строки, с 1 */
  row: number;
  /** Начало фразы по горизонтали, мм от левого края стены */
  x: number;
  /** Максимальная ширина фразы, мм; длиннее — перенос на следующую строку */
  width: number;
  color: string;
  accent: string;
  weight: number;
  boldWeight: number;
  /** Растянуть строки фразы по её ширине (кроме последней строки абзаца) */
  justify: PhraseJustify;
}

export interface StandGeometry {
  mainWidth: number;
  sideWidth: number;
  height: number;
  wallThickness: number;
  wallColor: string;
  floorColor: string;
  stripHeight: number;
  stripThickness: number;
  cornerPost: boolean;
  postSize: number;
  /** Цвет угла: конец градиента главной стены и начало фото-стены */
  cornerColor: string;
}

export interface FontConfig {
  family: string;
}

/** soft — S-образно с нулевым наклоном на концах (без видимого начала и конца), крутизна не влияет */
export type GradientCurve = 'linear' | 'easeIn' | 'easeOut' | 'smooth' | 'soft';

export interface GradientConfig {
  start: number;
  end: number;
  curve: GradientCurve;
  /** Крутизна кривой: 1 — равномерно, больше — резче */
  power: number;
}

/** Переход, который можно выключить. */
export interface RampConfig extends GradientConfig {
  enabled: boolean;
}

/** fixed — фраза стоит на своём X; follow — сразу после последнего влезшего названия */
export type PhraseFlow = 'fixed' | 'follow';

export interface MainWallConfig {
  /** Пусто — общий шрифт */
  family: string;
  background: string;
  textColor: string;
  dotColor: string;
  separator: string;
  fontSize: number;
  /** Кегль **жирного** во фразах, мм */
  boldSize: number;
  weight: number;
  lineHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  /** Где заканчиваются названия, мм */
  textEnd: number;
  /** Случайное укорочение строк, мм */
  ragged: number;
  minGap: number;
  justify: boolean;
  /** Растягивать фразы по их ширине (у каждой можно переопределить) */
  justifyPhrases: boolean;
  /** Пустоту перед фразой забивать подходящим по ширине материалом */
  fillGaps: boolean;
  shuffle: boolean;
  seed: number;
  phraseFlow: PhraseFlow;
  gradient: GradientConfig;
  /** Градиент названий и точек повторяет градиент фона */
  textGradientLinked: boolean;
  textGradient: GradientConfig;
  textInverse: string;
  dotInverse: string;
  phrases: PhraseConfig[];
}

export type MosaicColorMode = 'color' | 'mono';
export type MosaicSampling = 'letter' | 'smooth';

export interface MosaicConfig {
  family: string;
  mode: MosaicColorMode;
  sampling: MosaicSampling;
  background: string;
  ink: string;
  invert: boolean;
  separator: string;
  fontSize: number;
  weight: number;
  lineHeight: number;
  margin: number;
  minGap: number;
  shuffle: boolean;
  seed: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  underlay: number;
  /** От угла: цвет угла → картинка из слов */
  fade: RampConfig;
  /** Картинка из слов → фото */
  pixels: RampConfig;
  /** Размер «пикселя» фото, мм; 0 — фото как есть */
  pixelSize: number;
  scatter: ScatterConfig;
  overlay: LogoOverlayConfig;
}

export type ScatterAxis = 'x' | 'y' | 'xy';
export type ScatterCombine = 'max' | 'multiply';
export type ScatterUnit = 'name' | 'letter';

/** Разброс текста: от start (полный разброс) к end (собрано), по каждой оси своя кривая. */
export interface ScatterConfig {
  enabled: boolean;
  axis: ScatterAxis;
  /** Как сочетать оси: max — разброс там, где разбросано хоть по одной; multiply — только где по обеим */
  combine: ScatterCombine;
  x: GradientConfig;
  y: GradientConfig;
  /** Общая сила 0..1 */
  strength: number;
  /** Наибольшее смещение, мм */
  jitterX: number;
  jitterY: number;
  /** Доля выкинутых элементов при полном разбросе, 0..1 */
  drop: number;
  unit: ScatterUnit;
  seed: number;
}

/** Логотип поверх всей поверхности: положение центра и высота в мм, цвет поверх файла (файл = маска). */
export interface LogoOverlayConfig {
  enabled: boolean;
  /** Центр, мм от левого края */
  x: number;
  /** Центр, мм от верха */
  y: number;
  height: number;
  tint: boolean;
  color: string;
  opacity: number;
}

export type VAlign = 'top' | 'center' | 'bottom';

export interface StripText {
  text: string;
  /** Закрасить логотип этой полосы цветом (файл служит маской по прозрачности) */
  logoTint: boolean;
  logoColor: string;
}

export interface StripsConfig {
  family: string;
  background: string;
  color: string;
  accent: string;
  weight: number;
  boldWeight: number;
  fontSize: number;
  padLeft: number;
  textAlign: VAlign;
  /** От выбранного края (для центра — сдвиг вниз), мм */
  textOffset: number;
  logoHeight: number;
  padRight: number;
  logoAlign: VAlign;
  logoOffset: number;
  /** Свой логотип у каждой полосы */
  separateLogos: boolean;
  innerContent: boolean;
  innerBackground: string;
  left: StripText;
  front: StripText;
}

export interface ViewConfig {
  pxPerMm: number;
  exportPxPerMm: number;
  background: string;
  groundColor: string;
  lit: boolean;
  light: number;
  shadows: boolean;
  human: boolean;
}

export interface StandConfig {
  version: number;
  stand: StandGeometry;
  font: FontConfig;
  materials: string[];
  main: MainWallConfig;
  mosaic: MosaicConfig;
  strips: StripsConfig;
  view: ViewConfig;
}

export type ConfigSection = keyof Omit<StandConfig, 'version'>;
