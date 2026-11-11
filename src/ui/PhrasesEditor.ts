import { newPhrase } from '../config/defaults';
import type { ConfigStore } from '../state/ConfigStore';
import { Controls } from './Controls';
import type { FontOptions } from './FontOptions';

/** Список фраз главной стены: добавить, дублировать, удалить, поля каждой фразы. */
export class PhrasesEditor {
  readonly el = Controls.el('div', 'phrases');
  private list = Controls.el('div', 'phrases-list');
  private bindingStart = 0;

  constructor(
    private readonly store: ConfigStore,
    private readonly controls: Controls,
    private readonly fonts: FontOptions,
  ) {
    const add = Controls.button('+ Фраза', () => {
      const phrases = this.store.value.main.phrases;
      const lastRow = phrases.reduce((max, p) => Math.max(max, p.row), 0);
      this.store.mutate('main.phrases', (c) => c.main.phrases.push(newPhrase(lastRow + 3)));
      this.render();
    });
    this.el.append(this.list, add);
  }

  /** Вызывать после создания остальных полей панели: список пересоздаётся в хвосте привязок. */
  mount(): void {
    this.bindingStart = this.controls.count;
    this.render();
  }

  render(): void {
    this.controls.release(this.bindingStart);
    this.list.replaceChildren();
    this.store.value.main.phrases.forEach((phrase, i) => {
      const base = `main.phrases.${i}`;
      const card = Controls.el('div', 'phrase');
      const head = Controls.el('div', 'phrase-head');
      head.append(
        Controls.el('span', 'phrase-title', `${i + 1}`),
        this.controls.checkbox(`${base}.enabled`, 'вкл'),
        Controls.button('Копия', () => {
          this.store.mutate('main.phrases', (c) => c.main.phrases.splice(i + 1, 0, { ...phrase, id: newPhrase(0).id, row: phrase.row + 2 }));
          this.render();
        }),
        Controls.button('×', () => {
          this.store.mutate('main.phrases', (c) => c.main.phrases.splice(i, 1));
          this.render();
        }, 'btn btn-icon'),
      );
      card.append(
        head,
        this.controls.textarea(`${base}.text`, '**жирный** ==выделенный== __курсив__', 2),
        this.controls.number(`${base}.row`, 'Строка', { min: 1, step: 1 }),
        this.controls.number(`${base}.x`, 'X, мм', { min: 0, max: this.store.value.stand.mainWidth, step: 5, slider: true }),
        this.controls.number(`${base}.width`, 'Ширина, мм', { min: 100, max: this.store.value.stand.mainWidth, step: 5, slider: true }),
        this.controls.color(`${base}.color`, 'Цвет'),
        this.controls.color(`${base}.accent`, 'Выделение'),
        this.controls.select(`${base}.weight`, 'Начертание', this.fonts.weights('main.family'), true),
        this.controls.select(`${base}.boldWeight`, 'Жирный', this.fonts.weights('main.family'), true),
      );
      this.list.append(card);
    });
  }
}
