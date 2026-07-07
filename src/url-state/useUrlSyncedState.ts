import type { Atom } from "@tanstack/store";
import { useCreateAtom } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import { getFallback, setFallback } from "./urlStateFallback";

export type NavigateFn<TSearch> = (opts: {
  search: (prev: TSearch) => TSearch;
  replace?: boolean;
}) => void;

export interface UseUrlSyncedStateConfig<TDefaults extends Record<string, unknown>> {
  /** Namespaces the local fallback store, e.g. "examples/filtering-pinning". */
  scope: string;
  /** `Route.useSearch()` — a field is `undefined` when absent from the URL. */
  search: Partial<TDefaults>;
  /** `Route.useNavigate()` (or equivalent) used to write synced values back to the URL. */
  navigate: NavigateFn<Partial<TDefaults>>;
  /**
   * Fallback values used when a key is present in neither the URL nor the
   * local fallback store. Must be a stable reference (module-level constant)
   * across renders — its KEYS are the selector: whichever state slices you
   * list here are the ones that get synced.
   */
  defaults: TDefaults;
  /** Debounce (ms) before writing a state change back to the URL. Default 200. */
  debounceMs?: number;
}

export type UrlAtoms<TDefaults> = {
  [K in keyof TDefaults]: Atom<TDefaults[K]>;
};

/**
 * JSON-semantic deep equality: key-order-insensitive, and `undefined` equals
 * `null` (and equals an absent key) — matching how values round-trip through
 * the URL's JSON serialization. State with `[undefined, 60000]` must compare
 * equal to the `[null, 60000]` that comes back from the URL.
 */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    return (
      arrA.length === arrB.length && arrA.every((v, i) => jsonEqual(v, arrB[i]))
    );
  }
  const recA = a as Record<string, unknown>;
  const recB = b as Record<string, unknown>;
  for (const k of new Set([...Object.keys(recA), ...Object.keys(recB)])) {
    if (!jsonEqual(recA[k], recB[k])) return false;
  }
  return true;
}

/** `undefined` and `null` both mean "not actually there" throughout this hook. */
function isNullish(value: unknown): boolean {
  return value === undefined || value === null;
}

function resolveValue<TDefaults extends Record<string, unknown>>(
  scope: string,
  key: keyof TDefaults & string,
  search: Partial<TDefaults>,
  defaults: TDefaults,
): TDefaults[typeof key] {
  const fromUrl = search[key];
  // Written as a direct comparison (not `!isNullish(fromUrl)`) so TS narrows
  // the generic-constrained type instead of collapsing it to `unknown`.
  if (fromUrl !== undefined && fromUrl !== null) return fromUrl;
  const fallback = getFallback<TDefaults[typeof key]>(scope, key);
  return fallback !== undefined ? fallback : defaults[key];
}

/**
 * Whether a slice's value is "nothing" and so shouldn't be written into the
 * URL: `undefined`/`null` (a decode failure dropped it, or a consumer wrote
 * one directly), or a falsy scalar (`""`, `0`, `false`) — the common shape of
 * a cleared text filter or toggled-off boolean slice. Only checked at the
 * top level: a slice value that's a non-empty object/array (pagination,
 * sorting, `[]` for "no rows expanded") is never falsy in JS and is written
 * as-is.
 */
function isEmptyUrlValue(value: unknown): boolean {
  return isNullish(value) || value === false || value === "" || value === 0;
}

/**
 * Generic hook that syncs a chosen set of state slices to the URL via TanStack
 * Router search params, using TanStack Store atoms (`useCreateAtom`) as the
 * shared source of truth. Domain-agnostic: it knows nothing about tables — it
 * just keeps a record of atoms in sync with `search`, the given `navigate`,
 * and a module-scoped fallback store. Returns one atom per key of `defaults`,
 * so any consumer (a table's `options.atoms`, a plain component reading via
 * `useSelector`, …) can drive and observe the synced state.
 *
 * Resolution order for each key, used only once at mount (to seed the atom):
 * URL value, else the module-scoped fallback (survives client-side
 * navigation, not a full reload), else `defaults[key]`.
 *
 * If any key seeded from the fallback store rather than the URL, the restored
 * state is written back to the URL on mount (debounced, `replace: true`) so
 * the address bar immediately reflects the restored state and stays shareable
 * after navigating away and back.
 *
 * See `.agents/skills/url-state-sync/SKILL.md` for the full usage guide.
 */
export function useUrlSyncedState<TDefaults extends Record<string, unknown>>(
  config: UseUrlSyncedStateConfig<TDefaults>,
): UrlAtoms<TDefaults> {
  const { scope, search, navigate, defaults, debounceMs = 200 } = config;
  const keys = Object.keys(defaults) as (keyof TDefaults & string)[];

  // Fresh `search` for the subscription callbacks below — their effect
  // deliberately doesn't re-run on search changes.
  const searchRef = useRef(search);
  searchRef.current = search;

  const atoms = {} as UrlAtoms<TDefaults>;
  for (const key of keys) {
    // Safe despite looking like a loop-of-hooks: `keys` is derived from
    // `defaults`, which callers must keep referentially stable, so the same
    // hooks run in the same order on every render for a given call site.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    atoms[key] = useCreateAtom<TDefaults[typeof key]>(
      resolveValue(scope, key, search, defaults),
    );
  }

  // True while a URL write is owed but hasn't run yet. Seeded once at first
  // render: did any key seed from the local fallback store rather than the
  // URL? If so, the restored state must be written back to the URL on mount —
  // a fallback restore doesn't change any atom, so the subscribe-driven write
  // below would never fire and the URL would stay bare (unshareable) despite
  // the UI showing restored state. After mount it also survives effect
  // re-runs (StrictMode remounts, an unstable `navigate` identity): cleanup
  // cancels the debounce timer, and this flag is what tells the next effect
  // run to reschedule the write instead of dropping it.
  const pendingWriteRef = useRef<boolean | null>(null);
  if (pendingWriteRef.current === null) {
    pendingWriteRef.current = keys.some(
      (key) => isNullish(search[key]) && getFallback(scope, key) !== undefined,
    );
  }

  // Atom -> fallback store + URL. One shared debounce timer (not one per
  // key) so several slices changing in the same tick (e.g. pageSize also
  // resetting pageIndex) settle into a single navigate() call.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleUrlWrite = () => {
      pendingWriteRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Cleared here, once the write actually runs — not when it's
        // scheduled. StrictMode mounts effects twice: clearing the flag in
        // the effect body would leave the second run with nothing to
        // schedule after the first run's cleanup cancelled the timer.
        pendingWriteRef.current = false;
        navigate({
          replace: true,
          search: (prev) => {
            const next = { ...prev };
            for (const k of keys) {
              const value = atoms[k].get();
              // Falsy/nullish slice values are cleared rather than written —
              // a bare key or a stray `false`/`0`/`""` in the URL isn't worth
              // the noise, and it keeps a fresh visit's URL trace-free.
              if (isEmptyUrlValue(value)) {
                delete next[k];
              } else {
                next[k] = value;
              }
            }
            return next;
          },
        });
      }, debounceMs);
    };

    // Mirror URL-seeded values into the fallback store so the last-seen
    // state survives navigating away even if the user never changes anything
    // after opening a deep link. Defaults are deliberately NOT mirrored — a
    // fresh visit at defaults must leave no trace, so later bare visits stay
    // bare. (Idempotent on effect re-runs; the subscriptions below keep the
    // store fresh afterwards.)
    for (const key of keys) {
      if (!isNullish(searchRef.current[key])) {
        setFallback(scope, key, atoms[key].get());
      }
    }

    const subscriptions = keys.map((key) =>
      atoms[key].subscribe(() => {
        // The consumer can write value-equal state with a fresh reference into
        // an atom (e.g. a table's auto-reset behaviors firing at construction).
        // Treating those as changes would stamp default values into the URL
        // on a fresh visit — only real value changes count.
        const value = atoms[key].get();
        if (jsonEqual(value, resolveValue(scope, key, searchRef.current, defaults))) {
          return;
        }
        setFallback(scope, key, value);
        scheduleUrlWrite();
      }),
    );

    if (pendingWriteRef.current) {
      scheduleUrlWrite();
    }

    return () => {
      subscriptions.forEach((s) => s.unsubscribe());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, navigate, debounceMs]);

  // URL -> atom (browser back/forward, a pasted URL, returning from another
  // route with no search params). Only `.set()` when the resolved value
  // actually differs, so this doesn't fight the atom -> URL direction above.
  useEffect(() => {
    for (const key of keys) {
      const next = resolveValue(scope, key, search, defaults);
      if (!jsonEqual(next, atoms[key].get())) {
        atoms[key].set(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, scope, defaults]);

  return atoms;
}
