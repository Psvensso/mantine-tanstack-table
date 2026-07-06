import { z } from "zod";

/**
 * Generic composition of URL-synced state slices into the `{ schema, defaults }`
 * pair that a route and its `useUrlSyncedState` call share. Domain-agnostic:
 * a "slice" is any single value you want in the URL — sorting, a page number,
 * a boolean toggle, a text filter. The table-specific slices live in
 * `src/table/url-sync/tableUrlSlices.ts` and are just one library of these.
 *
 * Each field of the produced schema is `.optional()` with no `.default()` by
 * construction — a field absent from the URL must stay `undefined` so
 * `useUrlSyncedState` can tell "not in the URL" apart from "explicitly set to
 * the default value" and fall back to the local fallback store correctly.
 *
 * Call the factory at module scope: `useUrlSyncedState` requires `defaults`
 * to be referentially stable across renders (its keys drive a hook loop).
 *
 * Serialization is not a slice concern: the router's `parseSearchBlob` /
 * `stringifySearchBlob` (see `urlBlobCodec.ts`) round-trip the whole search
 * object as one base64url JSON blob, so any JSON-serializable value works
 * as-is. Slice values must be JSON-serializable (dates as ISO strings, unset
 * tuple bounds as `null` — schemas use `.nullable()`, not `.optional()`, for
 * those).
 */

export interface UrlSlice<T> {
  /** Validates the value parsed back out of the URL blob. */
  schema: z.ZodType<T>;
  /** Value used when the key is absent from both the URL and the fallback store. */
  defaultValue: T;
}

export type UrlSyncedStateConfig<TDefaults extends Record<string, unknown>> = {
  /** For the route's `validateSearch`. Parses to `Partial<TDefaults>` — absent fields stay `undefined`. */
  schema: z.ZodType<Partial<TDefaults>>;
  /** For `useUrlSyncedState`. Module-scope stable when the factory is called at module scope. */
  defaults: TDefaults;
};

type DefaultsOf<S extends Record<string, UrlSlice<unknown>>> = {
  [K in keyof S]: S[K] extends UrlSlice<infer T> ? T : never;
};

/**
 * Compose a record of slices into `{ schema, defaults }`. The keys of `slices`
 * become the synced keys; each slice contributes its optional schema field and
 * its default value.
 */
export function createUrlSyncedStateConfig<
  S extends Record<string, UrlSlice<unknown>>,
>(slices: S): UrlSyncedStateConfig<DefaultsOf<S>> {
  const shape: Record<string, z.ZodType> = {};
  const defaults: Record<string, unknown> = {};

  for (const [key, slice] of Object.entries(slices)) {
    shape[key] = slice.schema.optional();
    defaults[key] = slice.defaultValue;
  }

  // The shape is assembled dynamically, so its inferred type is too loose for
  // TS to connect back to S — the loop above is what upholds this contract.
  return {
    schema: z.object(shape),
    defaults,
  } as unknown as UrlSyncedStateConfig<DefaultsOf<S>>;
}
