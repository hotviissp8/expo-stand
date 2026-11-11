import { FontsEditor } from '../FontsEditor';
import { Controls } from '../Controls';
import type { PanelKit } from '../PanelKit';

const ALIGN = [
  { value: 'top', label: 'сверху' },
  { value: 'center', label: 'по центру' },
  { value: 'bottom', label: 'снизу' },
];

/** Полная панель: все настройки стенда. */
export function buildFullLayout(kit: PanelKit): void {
  const c = kit.controls;
  const f = kit.fonts;
  const max = (key: Parameters<PanelKit['max']>[0]) => kit.max(key);
  const align = ALIGN;

  const view = kit.section('Вид', true);
  view.append(
    kit.cameraPresets(),
    c.checkbox('view.lit', 'Освещение'),
    c.number('view.light', 'Свет', { min: 0.2, max: 3, step: 0.05, slider: true }),
    c.checkbox('view.shadows', 'Тени'),
    c.checkbox('view.human', 'Человек 1,8 м'),
    c.color('view.background', 'Фон сцены'),
    c.color('view.groundColor', 'Пол зала'),
    c.number('view.pxPerMm', 'Качество, px/мм', { min: 0.5, max: 4, step: 0.1, slider: true }),
    Controls.button('Снимок экрана', () => kit.actions.screenshot()),
  );

  const stand = kit.section('Стенд');
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

  const font = kit.section('Шрифт');
  font.append(c.select('font.family', 'Общий шрифт', f.families(false)), new FontsEditor(kit.library).el);

  const materials = kit.section('Материалы');
  materials.append(
    c.textarea('materials', 'По одному в строке', 14, {
      read: (v) => (v as string[]).join('\n'),
      write: (s) => s.split('\n').map((x) => x.trim()).filter(Boolean),
    }),
  );

  const main = kit.section('Главная стена');
  main.append(
    kit.info('main'),
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
    ...kit.gradient('main.gradient'),
    c.color('stand.cornerColor', 'Цвет угла (и фото-стены)'),
    Controls.el('div', 'subsection-title', 'Градиент названий'),
    c.checkbox('main.textGradientLinked', 'Как у фона'),
    ...kit.gradient('main.textGradient'),
    c.color('main.textInverse', 'Названия у угла'),
    c.color('main.dotInverse', 'Точки у угла'),
  );

  const phrases = kit.section('Фразы');
  phrases.append(
    c.number('main.phraseTracking', 'Трекинг всех фраз (1/1000 кегля)', { min: -200, max: 1000, step: 5, slider: true }),
    kit.phrases(false).el,
  );

  const photo = kit.section('Фото-стена');
  photo.append(
    kit.info('photo'),
    kit.picker('photo', 'Фото', 'image/*'),
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
    ...kit.photoFraming(),
    c.number('mosaic.brightness', 'Яркость', { min: -100, max: 100, step: 1, slider: true }),
    c.number('mosaic.contrast', 'Контраст', { min: -100, max: 200, step: 1, slider: true }),
    c.number('mosaic.saturation', 'Насыщенность', { min: -100, max: 200, step: 1, slider: true }),
    c.number('mosaic.gamma', 'Гамма', { min: 0.2, max: 3, step: 0.05, slider: true }),
    ...kit.photoOverlay(),
    Controls.el('div', 'subsection-title', 'Угол → слова'),
    c.checkbox('mosaic.fade.enabled', 'Включить'),
    ...kit.gradient('mosaic.fade', max('sideWidth'), 'Цвет угла до, мм', 'Слова с, мм'),
    Controls.el('div', 'subsection-title', 'Слова → фото'),
    c.checkbox('mosaic.pixels.enabled', 'Включить'),
    ...kit.gradient('mosaic.pixels', max('sideWidth'), 'Слова до, мм', 'Фото с, мм'),
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
    ...kit.gradient('mosaic.scatter.x', max('sideWidth'), 'Разброшено у, мм', 'Собрано к, мм'),
    Controls.el('div', 'subsection-title', 'Разброс по вертикали'),
    ...kit.gradient('mosaic.scatter.y', max('height'), 'Разброшено у, мм', 'Собрано к, мм'),
  );

  const stripH = max('stripHeight');
  const strips = kit.section('Полосы');
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
    kit.picker('logo', 'Общий файл', 'image/*'),
    ...kit.stripLogo('left', 'Полоса слева', true),
    ...kit.stripLogo('front', 'Полоса фронт', true),
    Controls.el('div', 'subsection-title', 'Внутренняя сторона'),
    c.checkbox('strips.innerContent', 'Текст и лого'),
    c.color('strips.innerBackground', 'Фон без текста'),
  );

  const exp = kit.section('Экспорт');
  exp.append(c.number('view.exportPxPerMm', 'PNG, px/мм', { min: 0.5, max: 12, step: 0.1 }), ...kit.exportRows(true), kit.configRow(true));
}
