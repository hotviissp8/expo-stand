import type { FontLibrary } from '../fonts/FontLibrary';
import { Controls } from './Controls';

/** Библиотека шрифтов в панели: файлы, системные семейства, список с удалением. */
export class FontsEditor {
  readonly el = Controls.el('div', 'fonts');
  private list = Controls.el('div', 'fonts-list');
  private localRow = Controls.el('div', 'field fonts-local');
  private localSelect = Controls.el('select', 'field-input field-select');
  private status = Controls.el('div', 'section-info');

  constructor(private readonly library: FontLibrary) {
    const input = Controls.el('input', 'file-input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.ttf,.otf,.ttc,.woff,.woff2';
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])];
      input.value = '';
      if (files.length) void this.run(() => this.library.addFiles(files).then((f) => `добавлено: ${f.join(', ')}`));
    });

    const buttons = [Controls.button('Файлы…', () => input.click())];
    if (library.localSupported) buttons.push(Controls.button('Системные…', () => void this.showLocal()));

    this.localSelect.addEventListener('change', () => {
      const family = this.localSelect.value;
      if (family) void this.run(() => this.library.importLocal(family).then(() => `добавлено: ${family}`));
    });
    this.localRow.append(Controls.el('span', 'field-label', 'Установленные'), this.localSelect);
    this.localRow.hidden = true;

    this.el.append(Controls.line('Добавить шрифт', ...buttons, input), this.localRow, this.status, this.list);
    library.subscribe(() => this.render());
    this.render();
  }

  private async showLocal(): Promise<void> {
    await this.run(async () => {
      const families = await this.library.localFamilies();
      const empty = Controls.el('option', undefined, '— выбрать —');
      empty.value = '';
      this.localSelect.replaceChildren(
        empty,
        ...families.map((f) => {
          const o = Controls.el('option', undefined, f);
          o.value = f;
          return o;
        }),
      );
      this.localRow.hidden = false;
      return `семейств в системе: ${families.length}`;
    });
  }

  private async run(task: () => Promise<string>): Promise<void> {
    this.status.textContent = '…';
    try {
      this.status.textContent = await task();
    } catch (e) {
      this.status.textContent = String(e);
    }
  }

  private render(): void {
    this.list.replaceChildren(
      ...this.library.families().map((family) => {
        const faces = this.library
          .facesOf(family)
          .map((f) => `${f.weight}${f.italic ? 'i' : ''}`)
          .join(' ');
        const row = Controls.line(family, Controls.el('span', 'fonts-faces', faces));
        row.append(Controls.button('×', () => void this.library.removeFamily(family), 'btn btn-icon'));
        return row;
      }),
    );
  }
}
