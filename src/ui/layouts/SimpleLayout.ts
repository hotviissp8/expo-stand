import { Controls } from '../Controls';
import type { PanelKit } from '../PanelKit';

/**
 * Упрощённая панель (для руководителя): только положение и масштаб элементов.
 * Тексты, цвета, шрифты и остальное берутся из настроек по умолчанию (config/preset.json).
 */
export function buildSimpleLayout(kit: PanelKit): void {
  const c = kit.controls;
  const max = (key: Parameters<PanelKit['max']>[0]) => kit.max(key);
  const stripH = max('stripHeight');

  // В этом режиме у каждой полосы свой логотип
  if (!kit.store.value.strips.separateLogos) kit.store.set('strips.separateLogos', true);

  kit.section('Вид', true).append(kit.cameraPresets());

  kit.section('Главная стена').append(
    c.number('main.ragged', 'Рваный край, мм', { min: 0, max: 1500, step: 10, slider: true }),
  );

  kit.section('Фразы').append(
    c.number('main.phraseTracking', 'Трекинг всех фраз (1/1000 кегля)', { min: -200, max: 1000, step: 5, slider: true }),
    kit.phrases(true).el,
  );

  kit.section('Фото-стена').append(...kit.photoFraming(), ...kit.photoOverlay());

  kit.section('Полосы').append(
    Controls.el('div', 'subsection-title', 'Текст'),
    c.number('strips.padLeft', 'Отступ слева, мм', { min: 0, max: 1000, step: 5, slider: true }),
    c.number('strips.textOffset', 'Отступ по вертикали, мм', { min: -stripH, max: stripH, step: 1, slider: true }),
    ...kit.stripLogo('left', 'Логотип: полоса слева', false),
    ...kit.stripLogo('front', 'Логотип: полоса фронт', false),
  );

  kit.section('Экспорт').append(...kit.exportRows(false), kit.configRow(false));
}
