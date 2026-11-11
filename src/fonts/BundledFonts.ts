import { PublicFiles } from '../state/PublicFiles';

/** Манифест шрифтов, вшитых в сайт: public/fonts/fonts.json */
const FONTS_DIR = 'fonts/';
const MANIFEST = `${FONTS_DIR}fonts.json`;

interface BundledFace {
  family: string;
  weight: number;
  italic?: boolean;
  file: string;
}

/**
 * Шрифты, которые лежат рядом с сайтом и подключаются сразу при запуске
 * (не нужно устанавливать в систему или добавлять в библиотеку).
 */
export class BundledFonts {
  static async load(): Promise<void> {
    const faces = (await PublicFiles.json<BundledFace[]>(MANIFEST)) ?? [];
    await Promise.all(
      faces.map(async (f) => {
        const ff = new FontFace(f.family, `url("${PublicFiles.url(FONTS_DIR + f.file)}")`, {
          weight: String(f.weight),
          style: f.italic ? 'italic' : 'normal',
        });
        try {
          document.fonts.add(await ff.load());
        } catch (e) {
          console.error(f.file, e);
        }
      }),
    );
  }
}
