import type { StandConfig } from '../config/types';
import type { FontLibrary } from '../fonts/FontLibrary';
import type { AssetKey, AssetStore } from '../state/AssetStore';
import type { ConfigStore } from '../state/ConfigStore';
import type { SurfaceId } from '../surfaces/Surface';
import type { CameraPreset } from '../three/StandView';
import { Controls } from './Controls';
import { FilePicker } from './FilePicker';
import { FontOptions } from './FontOptions';
import { buildFullLayout } from './layouts/FullLayout';
import { buildSimpleLayout } from './layouts/SimpleLayout';
import { ModeSwitch, type PanelMode } from './ModeSwitch';
import type { PanelActions, PanelKit } from './PanelKit';
import { PhrasesEditor } from './PhrasesEditor';

export type { PanelActions } from './PanelKit';

const CAMERA_PRESETS: { name: CameraPreset; label: string }[] = [
  { name: 'corner', label: 'Угол' },
  { name: 'front', label: 'Фронт' },
  { name: 'left', label: 'Слева' },
  { name: 'top', label: 'Сверху' },
  { name: 'main', label: 'Гл. стена' },
  { name: 'photo', label: 'Фото-стена' },
];

const ALIGN = [
  { value: 'top', label: 'сверху' },
  { value: 'center', label: 'по центру' },
  { value: 'bottom', label: 'снизу' },
];

const LAYOUTS: Record<PanelMode, (kit: PanelKit) => void> = {
  simple: buildSimpleLayout,
  full: buildFullLayout,
};

/** Скрываемая панель настроек справа; два режима — простой и полный. */
export class Panel implements PanelKit {
  readonly el = Controls.el('aside', 'panel');
  /** Кнопки вверху справа: режим и показ панели */
  readonly topbar = Controls.el('div', 'topbar');
  readonly controls: Controls;
  readonly fonts: FontOptions;
  private body = Controls.el('div', 'panel-body');
  private toggle = Controls.button('Настройки', () => this.setOpen(!this.open), 'btn panel-toggle');
  private modes = new ModeSwitch((mode) => this.build(mode));
  private editor: PhrasesEditor | null = null;
  private pickers: FilePicker[] = [];
  private infos = new Map<SurfaceId, HTMLElement>();
  private open = true;

  constructor(
    readonly store: ConfigStore,
    private readonly assets: AssetStore,
    readonly library: FontLibrary,
    readonly actions: PanelActions,
  ) {
    this.controls = new Controls(store);
    this.fonts = new FontOptions(store, library);
    this.el.append(this.body);
    this.topbar.append(this.modes.el, this.toggle);
    this.setOpen(true);
    this.build(this.modes.mode);
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.el.classList.toggle('panel-hidden', !open);
    this.toggle.classList.toggle('panel-toggle-active', open);
  }

  /** Перечитать поля (и списки шрифтов/начертаний) и список фраз. */
  refresh(): void {
    this.editor?.render();
    this.controls.sync();
    this.pickers.forEach((p) => p.sync());
  }

  updateInfo(): void {
    for (const s of this.actions.surfaces()) {
      const el = this.infos.get(s.id);
      if (el) el.textContent = s.info;
    }
  }

  /** Пересобрать панель в выбранном режиме. */
  private build(mode: PanelMode): void {
    this.controls.release(0);
    this.pickers = [];
    this.infos.clear();
    this.editor = null;
    this.body.replaceChildren();
    LAYOUTS[mode](this);
    // Список фраз пересоздаётся в хвосте привязок — подключается последним
    (this.editor as PhrasesEditor | null)?.mount();
    this.updateInfo();
  }

  // ---- PanelKit ----

  max(key: keyof StandConfig['stand']): number {
    return Number(this.store.value.stand[key]);
  }

  section(title: string, open = false): HTMLDetailsElement {
    const details = Controls.el('details', 'section');
    details.open = open;
    details.append(Controls.el('summary', 'section-title', title));
    this.body.append(details);
    return details;
  }

  info(id: SurfaceId): HTMLElement {
    const el = Controls.el('div', 'section-info');
    this.infos.set(id, el);
    return el;
  }

  picker(key: AssetKey, label: string, accept: string): HTMLElement {
    const p = new FilePicker(this.assets, key, label, accept);
    this.pickers.push(p);
    return p.el;
  }

  phrases(simple: boolean): PhrasesEditor {
    this.editor = new PhrasesEditor(this.store, this.controls, this.fonts, simple);
    return this.editor;
  }

  /** Поля перехода: начало/конец в мм, кривая, крутизна. */
  gradient(base: string, max = this.max('mainWidth'), startLabel = 'Начало, мм', endLabel = 'Конец, мм'): HTMLElement[] {
    const c = this.controls;
    return [
      c.number(`${base}.start`, startLabel, { min: 0, max, step: 10, slider: true }),
      c.number(`${base}.end`, endLabel, { min: 0, max, step: 10, slider: true }),
      c.select(`${base}.curve`, 'Кривая', [
        { value: 'linear', label: 'равномерно' },
        { value: 'easeIn', label: 'медленно в начале' },
        { value: 'easeOut', label: 'быстро в начале' },
        { value: 'smooth', label: 'плавно с обеих сторон' },
        { value: 'soft', label: 'мягко, без резких краёв' },
      ]),
      c.number(`${base}.power`, 'Крутизна (у «мягко» — длина хвоста)', { min: 0.2, max: 8, step: 0.05, slider: true }),
    ];
  }

  cameraPresets(): HTMLElement {
    const row = Controls.el('div', 'btn-row');
    CAMERA_PRESETS.forEach((p) => row.append(Controls.button(p.label, () => this.actions.preset(p.name))));
    return row;
  }

  photoFraming(): HTMLElement[] {
    const c = this.controls;
    return [
      c.number('mosaic.zoom', 'Масштаб фото', { min: 0.1, max: 4, step: 0.01, slider: true }),
      c.number('mosaic.offsetX', 'Сдвиг X, %', { min: -100, max: 100, step: 0.5, slider: true }),
      c.number('mosaic.offsetY', 'Сдвиг Y, %', { min: -100, max: 100, step: 0.5, slider: true }),
      c.number('mosaic.underlay', 'Фото под буквами', { min: 0, max: 1, step: 0.01, slider: true }),
    ];
  }

  photoOverlay(): HTMLElement[] {
    const c = this.controls;
    return [
      Controls.el('div', 'subsection-title', 'Логотип поверх'),
      c.checkbox('mosaic.overlay.enabled', 'Показывать'),
      this.picker('photoLogo', 'Файл', 'image/*'),
      c.number('mosaic.overlay.x', 'Центр X, мм', { min: 0, max: this.max('sideWidth'), step: 5, slider: true }),
      c.number('mosaic.overlay.y', 'Центр Y, мм', { min: 0, max: this.max('height'), step: 5, slider: true }),
      c.number('mosaic.overlay.height', 'Масштаб (высота), мм', { min: 10, max: this.max('height'), step: 5, slider: true }),
      c.number('mosaic.overlay.opacity', 'Прозрачность', { min: 0, max: 1, step: 0.01, slider: true }),
      c.checkbox('mosaic.overlay.tint', 'Свой цвет поверх файла'),
      c.color('mosaic.overlay.color', 'Цвет'),
    ];
  }

  stripLogo(side: 'left' | 'front', title: string, withAlign: boolean): HTMLElement[] {
    const c = this.controls;
    const base = `strips.${side}`;
    const stripH = this.max('stripHeight');
    return [
      Controls.el('div', 'subsection-title', title),
      this.picker(side === 'left' ? 'logoLeft' : 'logoFront', 'Свой файл', 'image/*'),
      c.number(`${base}.logoHeight`, 'Масштаб (высота), мм', { min: 10, max: 600, step: 1, slider: true }),
      ...(withAlign ? [c.select(`${base}.logoAlign`, 'По вертикали', ALIGN)] : []),
      c.number(`${base}.logoOffset`, 'Отступ по вертикали, мм', { min: -stripH, max: stripH, step: 1, slider: true }),
      c.number(`${base}.logoPadRight`, 'Отступ справа, мм', { min: 0, max: 1000, step: 5, slider: true }),
      c.checkbox(`${base}.logoTint`, 'Свой цвет поверх файла'),
      c.color(`${base}.logoColor`, 'Цвет'),
    ];
  }

  exportRows(png: boolean): HTMLElement[] {
    return this.actions.surfaces().map((s) =>
      Controls.line(
        s.title,
        ...(png ? [Controls.button('PNG', () => void this.actions.exportPng(s.id))] : []),
        Controls.button('SVG', () => void this.actions.exportSvg(s.id)),
      ),
    );
  }

  configRow(reset: boolean): HTMLElement {
    return Controls.line(
      'Настройки',
      Controls.button('Сохранить', () => this.actions.saveConfig()),
      Controls.button('Загрузить', () => void this.actions.loadConfig()),
      ...(reset
        ? [
            Controls.button('Сброс', () => {
              if (confirm('Сбросить все настройки?')) this.store.reset();
            }),
          ]
        : []),
    );
  }
}
