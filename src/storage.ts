/**
 * localStorage wrapper. Safari private mode, in-app browsers (Instagram, WhatsApp)
 * and full quotas can throw on access; the menu must still render, so every call is guarded.
 */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const v = window.localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore: cart simply won't persist across reloads */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
