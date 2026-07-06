/**
 * Module-scoped fallback for table state that should survive client-side
 * navigation (e.g. away from and back to a table page) but does NOT need to
 * persist across a full page reload — that's exactly what a plain
 * module-level variable gives us for free.
 *
 * Keyed by `${scope}:${key}` so multiple table pages can use this store
 * without colliding.
 */
const fallbackStore = new Map<string, unknown>();

export function getFallback<T>(scope: string, key: string): T | undefined {
  return fallbackStore.get(`${scope}:${key}`) as T | undefined;
}

export function setFallback<T>(scope: string, key: string, value: T): void {
  fallbackStore.set(`${scope}:${key}`, value);
}
