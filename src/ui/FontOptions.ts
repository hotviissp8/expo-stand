import { DEFAULT_FONT_FAMILY, WEIGHT_NAMES } from '../config/defaults';
import type { FontLibrary } from '../fonts/FontLibrary';
import type { ConfigStore } from '../state/ConfigStore';
import type { Option } from './Controls';

/** Списки для выбора шрифта и начертания — из библиотеки шрифтов. */
export class FontOptions {
  constructor(private readonly store: ConfigStore, private readonly library: FontLibrary) {}

  /** Семейства; inherit — первым пунктом «общий». */
  families(inherit: boolean): () => Option[] {
    return () => {
      const list: Option[] = [DEFAULT_FONT_FAMILY, ...this.library.families().filter((f) => f !== DEFAULT_FONT_FAMILY)].map((f) => ({ value: f, label: f }));
      if (inherit) list.unshift({ value: '', label: `общий (${this.store.value.font.family})` });
      return list;
    };
  }

  /** Начертания действующего шрифта раздела (familyPath — путь к его полю семейства). */
  weights(familyPath: string): () => Option[] {
    return () => {
      const family = String(this.store.get(familyPath) || this.store.value.font.family);
      return this.library.weights(family).map((w) => ({ value: String(w), label: `${w} ${WEIGHT_NAMES[w] ?? ''}`.trim() }));
    };
  }
}
