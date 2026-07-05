import type { Atom } from "@tanstack/store";
import { useCreateAtom } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import { getFallback, setFallback } from "./tableUrlStateFallback";

type NavigateFn<TSearch> = (opts: {
  search: (prev: TSearch) => TSearch;
  replace?: boolean;
}) => void;

export interface UseTableUrlStateConfig<TDefaults extends Record<string, unknown>> {
  /** Namespaces the local fallback store, e.g. "table-url-sync/employees". */
  scope: string;
  /** `Route.useSearch()` — a field is `undefined` when absent from the URL. */
  search: Partial<TDefaults>;
  /** `Route.useNavigate()` (or equivalent) used to write synced values back to the URL. */
  navigate: NavigateFn<Partial<TDefaults>>;
  /**
   * Fallback values used when a key is present in neither the URL nor the
   * local fallback store. Must be a stable reference (module-level constant)
   * across renders — its KEYS are the selector: whichever table-state slices
   * you list here are the ones that get synced.
   */
  defaults: TDefaults;
  /** Debounce (ms) before writing a state change back to the URL. Default 200. */
  debounceMs?: number;
}

export type TableUrlAtoms<TDefaults> = {
  [K in keyof TDefaults]: Atom<TDefaults[K]>;
};

function resolveValue<TDefaults extends Record<string, unknown>>(
  scope: string,
  key: keyof TDefaults & string,
  search: Partial<TDefaults>,
  defaults: TDefaults,
): TDefaults[typeof key] {
  const fromUrl = search[key];
  if (fromUrl !== undefined) return fromUrl;
  const fallback = getFallback<TDefaults[typeof key]>(scope, key);
  return fallback !== undefined ? fallback : defaults[key];
}

/**
 * Syncs a chosen slice of TanStack Table v9 state to the URL via TanStack
 * Router search params, using v9's external-atoms mechanism (`options.atoms`)
 * so the table writes through the returned atoms directly — no `on*Change`
 * handlers needed.
 *
 * Resolution order for each key, used only once at mount (to seed the atom):
 * URL value, else the module-scoped fallback (survives client-side
 * navigation, not a full reload), else `defaults[key]`.
 *
 * See `.agents/skills/table-url-sync/SKILL.md` for the full usage guide.
 */
export function useTableUrlState<TDefaults extends Record<string, unknown>>(
  config: UseTableUrlStateConfig<TDefaults>,
): TableUrlAtoms<TDefaults> {
  const { scope, search, navigate, defaults, debounceMs = 200 } = config;
  const keys = Object.keys(defaults) as (keyof TDefaults & string)[];

  const atoms = {} as TableUrlAtoms<TDefaults>;
  for (const key of keys) {
    // Safe despite looking like a loop-of-hooks: `keys` is derived from
    // `defaults`, which callers must keep referentially stable, so the same
    // hooks run in the same order on every render for a given call site.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    atoms[key] = useCreateAtom<TDefaults[typeof key]>(
      resolveValue(scope, key, search, defaults),
    );
  }

  // Atom -> fallback store + URL. One shared debounce timer (not one per
  // key) so several slices changing in the same tick (e.g. pageSize also
  // resetting pageIndex) settle into a single navigate() call.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const subscriptions = keys.map((key) =>
      atoms[key].subscribe(() => {
        setFallback(scope, key, atoms[key].get());
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          navigate({
            replace: true,
            search: (prev) => {
              const next = { ...prev };
              for (const k of keys) next[k] = atoms[k].get();
              return next;
            },
          });
        }, debounceMs);
      }),
    );
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
      if (JSON.stringify(next) !== JSON.stringify(atoms[key].get())) {
        atoms[key].set(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, scope, defaults]);

  return atoms;
}
