import type { ConfigStore } from '../state/ConfigStore';

export interface NumberOptions {
  min?: number;
  max?: number;
  step?: number;
  /** Показать ползунок рядом с полем */
  slider?: boolean;
}

export interface Option {
  value: string;
  label: string;
}

interface Binding {
  sync(): void;
}

/** Создаёт поля панели, привязанные к путям конфига. sync() перечитывает значения. */
export class Controls {
  private bindings: Binding[] = [];

  constructor(private readonly store: ConfigStore) {}

  sync(): void {
    this.bindings.forEach((b) => b.sync());
  }

  /** Отвязать поля (при пересоздании динамических списков). */
  release(from: number): void {
    this.bindings.length = from;
  }

  get count(): number {
    return this.bindings.length;
  }

  static el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  static row(label: string, ...inputs: HTMLElement[]): HTMLLabelElement {
    const row = Controls.el('label', 'field');
    row.append(Controls.el('span', 'field-label', label), ...inputs);
    return row;
  }

  /** Строка с кнопками: не label, чтобы клик по строке не нажимал первую кнопку. */
  static line(label: string, ...inputs: HTMLElement[]): HTMLDivElement {
    const row = Controls.el('div', 'field');
    row.append(Controls.el('span', 'field-label', label), ...inputs);
    return row;
  }

  static button(label: string, onClick: () => void, className = 'btn'): HTMLButtonElement {
    const b = Controls.el('button', className, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  number(path: string, label: string, opts: NumberOptions = {}): HTMLElement {
    const input = Controls.el('input', 'field-input field-number');
    input.type = 'number';
    if (opts.min !== undefined) input.min = String(opts.min);
    if (opts.max !== undefined) input.max = String(opts.max);
    input.step = String(opts.step ?? 1);
    const inputs: HTMLInputElement[] = [input];
    if (opts.slider) {
      const range = Controls.el('input', 'field-range');
      range.type = 'range';
      range.min = String(opts.min ?? 0);
      range.max = String(opts.max ?? 100);
      range.step = input.step;
      inputs.unshift(range);
    }
    const apply = (source: HTMLInputElement) => {
      const v = parseFloat(source.value);
      if (Number.isNaN(v)) return;
      inputs.forEach((i) => i !== source && (i.value = String(v)));
      this.store.set(path, v);
    };
    inputs.forEach((i) => i.addEventListener('input', () => apply(i)));
    this.bind(() => inputs.forEach((i) => (i.value = String(this.store.get(path)))));
    return Controls.row(label, ...inputs);
  }

  color(path: string, label: string): HTMLElement {
    const picker = Controls.el('input', 'field-color');
    picker.type = 'color';
    const hex = Controls.el('input', 'field-input field-hex');
    hex.type = 'text';
    picker.addEventListener('input', () => {
      hex.value = picker.value;
      this.store.set(path, picker.value);
    });
    hex.addEventListener('change', () => {
      const v = hex.value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(v)) return;
      picker.value = v;
      this.store.set(path, v);
    });
    this.bind(() => {
      const v = String(this.store.get(path));
      picker.value = v;
      hex.value = v;
    });
    return Controls.row(label, picker, hex);
  }

  text(path: string, label: string): HTMLElement {
    const input = Controls.el('input', 'field-input field-text');
    input.type = 'text';
    input.addEventListener('input', () => this.store.set(path, input.value));
    this.bind(() => (input.value = String(this.store.get(path))));
    return Controls.row(label, input);
  }

  textarea(path: string, label: string, rows = 3, codec?: { read(v: unknown): string; write(s: string): unknown }): HTMLElement {
    const area = Controls.el('textarea', 'field-input field-area');
    area.rows = rows;
    area.spellcheck = false;
    area.addEventListener('input', () => this.store.set(path, codec ? codec.write(area.value) : area.value));
    this.bind(() => {
      if (document.activeElement === area) return;
      const v = this.store.get(path);
      area.value = codec ? codec.read(v) : String(v);
    });
    const wrap = Controls.el('label', 'field field-stack');
    wrap.append(Controls.el('span', 'field-label', label), area);
    return wrap;
  }

  checkbox(path: string, label: string): HTMLElement {
    const input = Controls.el('input', 'field-check');
    input.type = 'checkbox';
    input.addEventListener('change', () => this.store.set(path, input.checked));
    this.bind(() => (input.checked = Boolean(this.store.get(path))));
    return Controls.row(label, input);
  }

  /** options — список или функция: тогда список перестраивается при каждом sync(). */
  select(path: string, label: string, options: Option[] | (() => Option[]), numeric = false): HTMLElement {
    const select = Controls.el('select', 'field-input field-select');
    const fill = () => {
      const list = typeof options === 'function' ? options() : options;
      const current = String(this.store.get(path));
      if (!list.some((o) => o.value === current)) list.push({ value: current, label: `${current} (нет)` });
      select.replaceChildren(
        ...list.map((o) => {
          const opt = Controls.el('option', undefined, o.label);
          opt.value = o.value;
          return opt;
        }),
      );
      select.value = current;
    };
    select.addEventListener('change', () => this.store.set(path, numeric ? Number(select.value) : select.value));
    this.bind(fill);
    return Controls.row(label, select);
  }

  private bind(sync: () => void): void {
    sync();
    this.bindings.push({ sync });
  }
}
