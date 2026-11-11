import type { StandConfig } from '../config/types';
import type { FontLibrary } from '../fonts/FontLibrary';
import type { AssetKey } from '../state/AssetStore';
import type { ConfigStore } from '../state/ConfigStore';
import type { SurfaceId } from '../surfaces/Surface';
import type { CameraPreset } from '../three/StandView';
import type { Controls } from './Controls';
import type { FontOptions } from './FontOptions';
import type { PhrasesEditor } from './PhrasesEditor';

export interface PanelActions {
  preset(name: CameraPreset): void;
  screenshot(): void;
  exportPng(id: SurfaceId): Promise<void>;
  exportSvg(id: SurfaceId): Promise<void>;
  saveConfig(): void;
  loadConfig(): Promise<void>;
  surfaces(): { id: SurfaceId; title: string; info: string }[];
}

/** Строительные блоки панели: из них собираются полная и упрощённая раскладки. */
export interface PanelKit {
  readonly controls: Controls;
  readonly fonts: FontOptions;
  readonly store: ConfigStore;
  readonly library: FontLibrary;
  readonly actions: PanelActions;
  /** Размер стенда из конфига, мм */
  max(key: keyof StandConfig['stand']): number;
  section(title: string, open?: boolean): HTMLDetailsElement;
  info(id: SurfaceId): HTMLElement;
  picker(key: AssetKey, label: string, accept: string): HTMLElement;
  /** Редактор фраз; simple — только строка, X, ширина */
  phrases(simple: boolean): PhrasesEditor;
  gradient(base: string, max?: number, startLabel?: string, endLabel?: string): HTMLElement[];
  cameraPresets(): HTMLElement;
  /** Масштаб и сдвиг фото, фото под буквами */
  photoFraming(): HTMLElement[];
  /** Логотип поверх фото-стены */
  photoOverlay(): HTMLElement[];
  /** Логотип одной полосы; withAlign — с выбором выравнивания по вертикали */
  stripLogo(side: 'left' | 'front', title: string, withAlign: boolean): HTMLElement[];
  /** Строки экспорта поверхностей; png — с кнопкой PNG */
  exportRows(png: boolean): HTMLElement[];
  /** Сохранить / загрузить настройки; reset — с кнопкой сброса */
  configRow(reset: boolean): HTMLElement;
}
