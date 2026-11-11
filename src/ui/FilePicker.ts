import type { AssetKey, AssetStore } from '../state/AssetStore';
import { Controls } from './Controls';

/** Выбор файла с ПК в AssetStore: кнопка, имя файла, сброс. */
export class FilePicker {
  readonly el: HTMLElement;
  private name = Controls.el('span', 'file-name');

  constructor(private readonly assets: AssetStore, private readonly key: AssetKey, label: string, accept: string) {
    const input = Controls.el('input', 'file-input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) await this.assets.put(this.key, file);
      this.sync();
    });
    const choose = Controls.button('Выбрать', () => input.click());
    const clear = Controls.button('×', async () => {
      await this.assets.remove(this.key);
      this.sync();
    }, 'btn btn-icon');
    this.el = Controls.line(label, choose, clear, input);
    this.el.append(this.name);
    this.sync();
  }

  sync(): void {
    this.name.textContent = this.assets.label(this.key);
  }
}
