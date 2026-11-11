import { PANEL_MODE_KEY } from '../config/defaults';
import { Controls } from './Controls';

export type PanelMode = 'simple' | 'full';

const MODES: { mode: PanelMode; label: string }[] = [
  { mode: 'simple', label: 'Простой' },
  { mode: 'full', label: 'Полный' },
];
const DEFAULT_MODE: PanelMode = 'simple';

/** Переключатель режима панели; выбор запоминается в браузере. */
export class ModeSwitch {
  readonly el = Controls.el('div', 'mode-switch');
  private buttons = new Map<PanelMode, HTMLButtonElement>();
  private current: PanelMode;

  constructor(private readonly onChange: (mode: PanelMode) => void) {
    this.current = ModeSwitch.load();
    for (const { mode, label } of MODES) {
      const b = Controls.button(label, () => this.set(mode), 'btn mode-switch-btn');
      this.buttons.set(mode, b);
      this.el.append(b);
    }
    this.paint();
  }

  get mode(): PanelMode {
    return this.current;
  }

  private set(mode: PanelMode): void {
    if (mode === this.current) return;
    this.current = mode;
    try {
      localStorage.setItem(PANEL_MODE_KEY, mode);
    } catch {
      /* без хранилища режим живёт до перезагрузки */
    }
    this.paint();
    this.onChange(mode);
  }

  private paint(): void {
    this.buttons.forEach((b, mode) => b.classList.toggle('mode-switch-active', mode === this.current));
  }

  private static load(): PanelMode {
    try {
      const v = localStorage.getItem(PANEL_MODE_KEY);
      if (MODES.some((m) => m.mode === v)) return v as PanelMode;
    } catch {
      /* нет доступа к хранилищу */
    }
    return DEFAULT_MODE;
  }
}
