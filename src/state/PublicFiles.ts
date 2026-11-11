/** Файлы из папки public (рядом с index.html). Нет файла — null, без ошибок. */
export class PublicFiles {
  static url(path: string): string {
    return import.meta.env.BASE_URL + path;
  }

  static async blob(path: string): Promise<Blob | null> {
    try {
      const res = await fetch(PublicFiles.url(path));
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      // Dev-сервер на неизвестный путь отвечает index.html со статусом 200
      return type.includes('text/html') ? null : await res.blob();
    } catch {
      return null;
    }
  }

  static async json<T>(path: string): Promise<T | null> {
    const blob = await PublicFiles.blob(path);
    if (!blob) return null;
    try {
      return JSON.parse(await blob.text()) as T;
    } catch {
      return null;
    }
  }
}
