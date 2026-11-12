import { DEFAULTS_REVISION, DEFAULTS_REV_KEY } from '../config/defaults';

/**
 * Принудительный сброс к значениям по умолчанию. Если ревизия, с которой посетитель последний раз
 * открывал сайт, не равна текущей (DEFAULTS_REVISION), его сохранённый конфиг и загруженные файлы
 * (фото, логотипы) отбрасываются один раз; дальше он правит и сохраняет свои как обычно.
 */
export class DefaultsReset {
  /** Определяется один раз при загрузке: конфиг и файлы читают одно и то же значение. */
  private static readonly pending = DefaultsReset.stored() !== String(DEFAULTS_REVISION);

  static get required(): boolean {
    return DefaultsReset.pending;
  }

  /** Запоминает, что сброс сделан; вызывать после того, как отброшены и конфиг, и файлы. */
  static commit(): void {
    if (!DefaultsReset.pending) return;
    try {
      localStorage.setItem(DEFAULTS_REV_KEY, String(DEFAULTS_REVISION));
    } catch {
      /* хранилище недоступно: сброс повторится при следующем открытии */
    }
  }

  private static stored(): string | null {
    try {
      return localStorage.getItem(DEFAULTS_REV_KEY);
    } catch {
      return null;
    }
  }
}
