import type { StandConfig } from '../config/types';
import type { FontLibrary } from '../fonts/FontLibrary';
import type { AssetKey, AssetStore } from '../state/AssetStore';
import type { ConfigStore } from '../state/ConfigStore';
import type { SurfaceId } from '../surfaces/Surface';
import type { CameraPreset } from '../three/StandView';
import { Controls } from './Controls';
import { FilePicker } from './FilePicker';
import { FontOptions } from './FontOptions';
import { FontsEditor } from './FontsEditor';
import { PhrasesEditor } from './PhrasesEditor';

export interface PanelActions {
  preset(name: CameraPreset): void;
  screenshot(): void;
  exportPng(id: SurfaceId): Promise<void>;
  exportSvg(id: SurfaceId): Promise<void>;
  saveConfig(): void;
  loadConfig(): Promise<void>;
  surfaces(): { id: SurfaceId; title: string; info: string }[];
}

const CAMERA_PRESETS: { name: CameraPreset; label: string }[] = [
  { name: 'corner', label: 'Угол' },
  { name: 'front', label: 'Фронт' },
  { name: 'left', label: 'Слева' },
  { name: 'top', label: 'Сверху' },
  { name: 'main', label: 'Гл. стена' },
  { name: 'photo', label: 'Фото-стена' },
];

/** Скрываемая панель настроек справа. */
export class Panel {
  readonly el = Controls.el('aside', 'panel');
  private body = Controls.el('div', 'panel-body');
  private toggle = Controls.button('Настройки', () => this.setOpen(!this.open), 'btn panel-toggle');
  private controls: Controls;
  private phrases: PhrasesEditor;
  private pickers: FilePicker[] = [];
  private infos = new Map<SurfaceId, HTMLElement>();
  private open = true;

  private fonts: FontOptions;

  constructor(
    private readonly store: ConfigStore,
    private readonly assets: AssetStore,
    private readonly library: FontLibrary,
    private readonly actions: PanelActions,
  ) {
    this.controls = new Controls(store);
    this.fonts = new FontOptions(store, library);
    this.phrases = new PhrasesEditor(store, this.controls, this.fonts);
    this.el.append(this.body);
    this.build();
    this.phrases.mount();
  }

  get toggleButton(): HTMLButtonElement {
    return this.toggle;
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.el.classList.toggle('panel-hidden', !open);
    this.toggle.classList.toggle('panel-toggle-active', open);
  }

  /** Перечитать поля (и списки шрифтов/начертаний) и список фраз. */
  refresh(): void {
    this.phrases.render();
    this.controls.sync();
    this.pickers.forEach((p) => p.sync());
  }

  updateInfo(): void {
    for (const s of this.actions.surfaces()) {
      const el = this.infos.get(s.id);
      if (el) el.textContent = s.info;
    }
  }

  private section(title: string, open = false): HTMLDetailsElement {
    const details = Controls.el('details', 'section');
    details.open = open;
    details.append(Controls.el('summary', 'section-title', title));
    this.body.append(details);
    return details;
  }

  private info(id: SurfaceId): HTMLElement {
    const el = Controls.el('div', 'section-info');
    this.infos.set(id, el);
    return el;
  }

  private picker(key: AssetKey, label: string, accept: string): HTMLElement {
    const p = new FilePicker(this.assets, key, label, accept);
    this.pickers.push(p);
    return p.el;
  }

  /** Поля перехода: начало/конец в мм, кривая, крутизна. */
  private gradient(base: string, max = this.store.value.stand.mainWidth, startLabel = 'Начало, мм', endLabel = 'Конец, мм'): HTMLElement[] {
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
      c.number(`${base}.power`, 'Крутизна', { min: 0.2, max: 8, step: 0.05, slider: true }),
    ];
  }

  /** Поля логотипа одной полосы: файл, масштаб, положение, цвет. */
  private stripLogo(side: 'left' | 'front', title: string, stripH: number): HTMLElement[] {
    const c = this.controls;
    const base = `strips.${side}`;
    return [
      Controls.el('div', 'subsection-title', title),
      this.picker(side === 'left' ? 'logoLeft' : 'logoFront', 'Свой файл', 'image/*'),
      c.number(`${base}.logoHeight`, 'Высота (масштаб), мм', { min: 10, max: 600, step: 1, slider: true }),
      c.select(`${base}.logoAlign`, 'По вертикали', [
        { value: 'top', label: 'сверху' },
        { value: 'center', label: 'по центру' },
        { value: 'bottom', label: 'снизу' },
      ]),
      c.number(`${base}.logoOffset`, 'Отступ по вертикали, мм', { min: -stripH, max: stripH, step: 1, slider: true }),
      c.number(`${base}.logoPadRight`, 'Отступ справа, мм', { min: 0, max: 1000, step: 5, slider: true }),
      c.checkbox(`${base}.logoTint`, 'Свой цвет поверх файла'),
      c.color(`${base}.logoColor`, 'Цвет'),
    ];
  }

  private build(): void {
    const c = this.controls;
    const f = this.fonts;
    const max = (key: keyof StandConfig['stand']) => Number(this.store.value.stand[key]);
    const align = [
      { value: 'top', label: 'сверху' },
      { value: 'center', label: 'по центру' },
      { value: 'bottom', label: 'снизу' },
    ];

    const view = this.section('Вид', true);
    const presets = Controls.el('div', 'btn-row');
    CAMERA_PRESETS.forEach((p) => presets.append(Controls.button(p.label, () => this.actions.preset(p.name))));
    view.append(
      presets,
      c.checkbox('view.lit', 'Освещение'),
      c.number('view.light', 'Свет', { min: 0.2, max: 3, step: 0.05, slider: true }),
      c.checkbox('view.shadows', 'Тени'),
      c.checkbox('view.human', 'Человек 1,8 м'),
      c.color('view.background', 'Фон сцены'),
      c.color('view.groundColor', 'Пол зала'),
      c.number('view.pxPerMm', 'Качество, px/мм', { min: 0.5, max: 4, step: 0.1, slider: true }),
      Controls.button('Снимок экрана', () => this.actions.screenshot()),
    );

    const stand = this.section('Стенд');
    stand.append(
      c.number('stand.mainWidth', 'Главная стена, мм', { min: 500, step: 10 }),
      c.number('stand.sideWidth', 'Боковая стена, мм', { min: 500, step: 10 }),
      c.number('stand.height', 'Высота, мм', { min: 500, step: 10 }),
      c.number('stand.wallThickness', 'Толщина стен, мм', { min: 10, step: 5 }),
      c.number('stand.stripHeight', 'Высота полос, мм', { min: 50, step: 10 }),
      c.number('stand.stripThickness', 'Толщина полос, мм', { min: 5, step: 5 }),
      c.color('stand.wallColor', 'Корпус стен'),
      c.color('stand.floorColor', 'Пол стенда'),
      c.checkbox('stand.cornerPost', 'Стойка в углу'),
      c.number('stand.postSize', 'Стойка, мм', { min: 10, step: 5 }),
    );

    const font = this.section('Шрифт');
    font.append(c.select('font.family', 'Общий шрифт', f.families(false)), new FontsEditor(this.library).el);

    const materials = this.section('Материалы');
    materials.append(
      c.textarea('materials', 'По одному в строке', 14, {
        read: (v) => (v as string[]).join('\n'),
        write: (s) => s.split('\n').map((x) => x.trim()).filter(Boolean),
      }),
    );

    const main = this.section('Главная стена');
    main.append(
      this.info('main'),
      c.select('main.family', 'Шрифт', f.families(true)),
      c.select('main.weight', 'Начертание', f.weights('main.family'), true),
      c.number('main.fontSize', 'Кегль, мм', { min: 5, max: 200, step: 1, slider: true }),
      c.number('main.boldSize', 'Кегль **жирного**, мм', { min: 5, max: 300, step: 1, slider: true }),
      c.number('main.lineHeight', 'Шаг строк, мм', { min: 5, max: 300, step: 1, slider: true }),
      c.color('main.background', 'Фон'),
      c.color('main.textColor', 'Названия'),
      c.color('main.dotColor', 'Точки'),
      c.text('main.separator', 'Разделитель'),
      c.number('main.marginTop', 'Отступ сверху, мм', { min: 0, max: max('height'), step: 5, slider: true }),
      c.number('main.marginBottom', 'Отступ снизу, мм', { min: 0, max: max('height'), step: 5, slider: true }),
      c.number('main.marginLeft', 'Начало строк, мм', { min: 0, max: 1000, step: 5, slider: true }),
      c.number('main.textEnd', 'Конец строк, мм', { min: 0, max: max('mainWidth'), step: 10, slider: true }),
      c.number('main.ragged', 'Рваный край, мм', { min: 0, max: 1500, step: 10, slider: true }),
      c.number('main.minGap', 'Мин. промежуток, мм', { min: 0, max: 200, step: 1, slider: true }),
      c.checkbox('main.justify', 'Растягивать строки'),
      c.checkbox('main.justifyPhrases', 'Растягивать фразы'),
      c.checkbox('main.fillGaps', 'Забивать пустоту перед фразой'),
      c.select('main.phraseFlow', 'Фраза', [
        { value: 'fixed', label: 'на своём X' },
        { value: 'follow', label: 'сразу после материала' },
      ]),
      c.checkbox('main.shuffle', 'Перемешать'),
      c.number('main.seed', 'Вариант', { min: 1, step: 1 }),
      Controls.el('div', 'subsection-title', 'Градиент фона'),
      ...this.gradient('main.gradient'),
      c.color('stand.cornerColor', 'Цвет угла (и фото-стены)'),
      Controls.el('div', 'subsection-title', 'Градиент названий'),
      c.checkbox('main.textGradientLinked', 'Как у фона'),
      ...this.gradient('main.textGradient'),
      c.color('main.textInverse', 'Названия у угла'),
      c.color('main.dotInverse', 'Точки у угла'),
    );

    const phrases = this.section('Фразы');
    phrases.append(this.phrases.el);

    const photo = this.section('Фото-стена');
    photo.append(
      this.info('photo'),
      this.picker('photo', 'Фото', 'image/*'),
      c.select('mosaic.mode', 'Цвет букв', [
        { value: 'color', label: 'цветные' },
        { value: 'mono', label: 'монохром' },
      ]),
      c.select('mosaic.sampling', 'Заливка', [
        { value: 'letter', label: 'буква = пиксель' },
        { value: 'smooth', label: 'фото внутри букв' },
      ]),
      c.color('mosaic.background', 'Фон'),
      c.color('mosaic.ink', 'Чернила (монохром)'),
      c.checkbox('mosaic.invert', 'Инверсия'),
      c.select('mosaic.family', 'Шрифт', f.families(true)),
      c.select('mosaic.weight', 'Начертание', f.weights('mosaic.family'), true),
      c.number('mosaic.fontSize', 'Кегль, мм', { min: 3, max: 120, step: 0.5, slider: true }),
      c.number('mosaic.lineHeight', 'Шаг строк, мм', { min: 3, max: 150, step: 0.5, slider: true }),
      c.number('mosaic.minGap', 'Мин. промежуток, мм', { min: 0, max: 100, step: 0.5, slider: true }),
      c.text('mosaic.separator', 'Разделитель'),
      c.number('mosaic.margin', 'Поля, мм', { min: 0, max: 500, step: 5, slider: true }),
      c.checkbox('mosaic.shuffle', 'Перемешать'),
      c.number('mosaic.seed', 'Вариант', { min: 1, step: 1 }),
      c.number('mosaic.zoom', 'Масштаб фото', { min: 0.1, max: 4, step: 0.01, slider: true }),
      c.number('mosaic.offsetX', 'Сдвиг X, %', { min: -100, max: 100, step: 0.5, slider: true }),
      c.number('mosaic.offsetY', 'Сдвиг Y, %', { min: -100, max: 100, step: 0.5, slider: true }),
      c.number('mosaic.brightness', 'Яркость', { min: -100, max: 100, step: 1, slider: true }),
      c.number('mosaic.contrast', 'Контраст', { min: -100, max: 200, step: 1, slider: true }),
      c.number('mosaic.saturation', 'Насыщенность', { min: -100, max: 200, step: 1, slider: true }),
      c.number('mosaic.gamma', 'Гамма', { min: 0.2, max: 3, step: 0.05, slider: true }),
      c.number('mosaic.underlay', 'Фото под буквами', { min: 0, max: 1, step: 0.01, slider: true }),
      Controls.el('div', 'subsection-title', 'Логотип поверх'),
      c.checkbox('mosaic.overlay.enabled', 'Показывать'),
      this.picker('photoLogo', 'Файл', 'image/*'),
      c.number('mosaic.overlay.x', 'Центр X, мм', { min: 0, max: max('sideWidth'), step: 5, slider: true }),
      c.number('mosaic.overlay.y', 'Центр Y, мм', { min: 0, max: max('height'), step: 5, slider: true }),
      c.number('mosaic.overlay.height', 'Высота, мм', { min: 10, max: max('height'), step: 5, slider: true }),
      c.number('mosaic.overlay.opacity', 'Прозрачность', { min: 0, max: 1, step: 0.01, slider: true }),
      c.checkbox('mosaic.overlay.tint', 'Свой цвет поверх файла'),
      c.color('mosaic.overlay.color', 'Цвет'),
      Controls.el('div', 'subsection-title', 'Угол → слова'),
      c.checkbox('mosaic.fade.enabled', 'Включить'),
      ...this.gradient('mosaic.fade', max('sideWidth'), 'Цвет угла до, мм', 'Слова с, мм'),
      Controls.el('div', 'subsection-title', 'Слова → фото'),
      c.checkbox('mosaic.pixels.enabled', 'Включить'),
      ...this.gradient('mosaic.pixels', max('sideWidth'), 'Слова до, мм', 'Фото с, мм'),
      c.number('mosaic.pixelSize', 'Пиксель фото, мм (0 — как есть)', { min: 0, max: 100, step: 1, slider: true }),
      Controls.el('div', 'subsection-title', 'Разброс'),
      c.checkbox('mosaic.scatter.enabled', 'Включить'),
      c.select('mosaic.scatter.axis', 'Направление', [
        { value: 'x', label: 'по горизонтали' },
        { value: 'y', label: 'по вертикали' },
        { value: 'xy', label: 'по обеим' },
      ]),
      c.select('mosaic.scatter.combine', 'Обе оси', [
        { value: 'max', label: 'разброс по любой' },
        { value: 'multiply', label: 'разброс только по обеим' },
      ]),
      c.select('mosaic.scatter.unit', 'Что разбрасывать', [
        { value: 'name', label: 'названия целиком' },
        { value: 'letter', label: 'отдельные буквы' },
      ]),
      c.number('mosaic.scatter.strength', 'Сила', { min: 0, max: 1, step: 0.01, slider: true }),
      c.number('mosaic.scatter.drop', 'Прореживание', { min: 0, max: 1, step: 0.01, slider: true }),
      c.number('mosaic.scatter.jitterX', 'Смещение X, мм', { min: 0, max: 1000, step: 5, slider: true }),
      c.number('mosaic.scatter.jitterY', 'Смещение Y, мм', { min: 0, max: 1000, step: 5, slider: true }),
      c.number('mosaic.scatter.seed', 'Вариант', { min: 1, step: 1 }),
      Controls.el('div', 'subsection-title', 'Разброс по горизонтали'),
      ...this.gradient('mosaic.scatter.x', max('sideWidth'), 'Разброшено у, мм', 'Собрано к, мм'),
      Controls.el('div', 'subsection-title', 'Разброс по вертикали'),
      ...this.gradient('mosaic.scatter.y', max('height'), 'Разброшено у, мм', 'Собрано к, мм'),
    );

    const stripH = max('stripHeight');
    const strips = this.section('Полосы');
    strips.append(
      c.textarea('strips.left.text', 'Текст слева (короткая)', 2),
      c.textarea('strips.front.text', 'Текст фронт (длинная)', 2),
      c.color('strips.background', 'Фон и торцы'),
      c.color('strips.color', 'Текст'),
      c.color('strips.accent', 'Выделение'),
      Controls.el('div', 'subsection-title', 'Текст'),
      c.select('strips.family', 'Шрифт', f.families(true)),
      c.select('strips.weight', 'Начертание', f.weights('strips.family'), true),
      c.select('strips.boldWeight', 'Жирный', f.weights('strips.family'), true),
      c.number('strips.fontSize', 'Кегль, мм', { min: 10, max: 300, step: 1, slider: true }),
      c.select('strips.textAlign', 'По вертикали', align),
      c.number('strips.textOffset', 'Отступ, мм', { min: -stripH, max: stripH, step: 1, slider: true }),
      c.number('strips.padLeft', 'Отступ слева, мм', { min: 0, max: 1000, step: 5, slider: true }),
      Controls.el('div', 'subsection-title', 'Логотип'),
      c.checkbox('strips.separateLogos', 'Свой файл у каждой полосы'),
      this.picker('logo', 'Общий файл', 'image/*'),
      ...this.stripLogo('left', 'Полоса слева', stripH),
      ...this.stripLogo('front', 'Полоса фронт', stripH),
      Controls.el('div', 'subsection-title', 'Внутренняя сторона'),
      c.checkbox('strips.innerContent', 'Текст и лого'),
      c.color('strips.innerBackground', 'Фон без текста'),
    );

    const exp = this.section('Экспорт');
    exp.append(c.number('view.exportPxPerMm', 'PNG, px/мм', { min: 0.5, max: 12, step: 0.1 }));
    for (const s of this.actions.surfaces()) {
      exp.append(
        Controls.line(
          s.title,
          Controls.button('PNG', () => void this.actions.exportPng(s.id)),
          Controls.button('SVG', () => void this.actions.exportSvg(s.id)),
        ),
      );
    }
    exp.append(
      Controls.line(
        'Настройки',
        Controls.button('Сохранить', () => this.actions.saveConfig()),
        Controls.button('Загрузить', () => void this.actions.loadConfig()),
        Controls.button('Сброс', () => {
          if (confirm('Сбросить все настройки?')) this.store.reset();
        }),
      ),
    );
  }
}
