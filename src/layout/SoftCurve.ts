/** Шагов численного интегрирования таблицы кривой. */
const SAMPLES = 1024;
/** Хвост при крутизне 1. */
const BASE_DECAY = 6;

/**
 * Мягкий переход без видимых краёв: скорость перехода t²·(1−t)·e^(−k·t).
 * Старт плавный (как у S-кривой), торможение к концу длинное и экспоненциальное —
 * последние оттенки перед белым растянуты, поэтому «края» у белого не видно.
 * Крутизна задаёт длину хвоста: больше — раньше набирает и дольше тянет хвост.
 */
export class SoftCurve {
  private static tables = new Map<number, Float64Array>();

  static at(t: number, power: number): number {
    const table = SoftCurve.table(BASE_DECAY * Math.max(0.05, power));
    const x = Math.min(1, Math.max(0, t)) * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(x));
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  }

  private static table(k: number): Float64Array {
    const key = Math.round(k * 1000) / 1000;
    let table = SoftCurve.tables.get(key);
    if (table) return table;
    table = new Float64Array(SAMPLES + 1);
    for (let i = 1; i <= SAMPLES; i++) {
      const t = (i - 0.5) / SAMPLES;
      table[i] = table[i - 1] + t * t * (1 - t) * Math.exp(-key * t);
    }
    const total = table[SAMPLES];
    for (let i = 0; i <= SAMPLES; i++) table[i] /= total;
    SoftCurve.tables.set(key, table);
    return table;
  }
}
