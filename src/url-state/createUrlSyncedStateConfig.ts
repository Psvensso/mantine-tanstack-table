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
 * Use the produced `parse` (not `schema.parse`) for a route's
 * `validateSearch` — it never throws. A garbage or invalid value for a key
 * (a hand-edited URL, a stale link) is dropped from that key only, rather
 * than failing the whole route's navigation.
 *
 * ## Compact URL encoding
 *
 * A slice may carry an `encode`/`decode` pair to serialize a structured value
 * as a compact human-readable string instead of percent-encoded JSON. The
 * router serializes with `URLSearchParams`, which leaves only
 * `A-Za-z0-9 * - . _` unescaped, so codecs should build on those characters.
 *
 * Decoding runs inside the schema (`z.preprocess`, per slice). Encoding must
 * run in the router's global `stringifySearch` (see `encodeSearch`) — so the
 * factory registers each slice's `encode` in a module-global map keyed by
 * slice name. Consequence: a given slice name maps to one codec process-wide
 * (two routes can't use the same name with different codecs). Slices without
 * a codec (booleans, strings, numbers) are written readably by the router's
 * default and need no registration.
 */

export interface UrlSlice<T> {
  /** Validates the decoded value. Keep it tolerant of the raw JSON shape too. */
  schema: z.ZodType<T>;
  /** Value used when the key is absent from both the URL and the fallback store. */
  defaultValue: T;
  /**
   * Compact string encoder (optional). Method syntax is deliberate: it keeps
   * `UrlSlice<Specific>` assignable to `UrlSlice<unknown>` so heterogeneous
   * slice records compose without variance errors.
   */
  encode?(value: T): string;
  /** Inverse of `encode`. Total — never throws; the schema rejects bad shapes. */
  decode?(raw: string): unknown;
}

export type UrlSyncedStateConfig<TDefaults extends Record<string, unknown>> = {
  /**
   * The composed schema, for callers that want to fold it into a bigger
   * `z.object` themselves. Prefer `parse` below for a route's
   * `validateSearch` — this raw schema still throws on an invalid field.
   */
  schema: z.ZodType<Partial<TDefaults>>;
  /** For `useUrlSyncedState`. Module-scope stable when the factory is called at module scope. */
  defaults: TDefaults;
  /**
   * Tolerant parse for a route's `validateSearch`. Never throws: a field
   * that's absent, `null`, or fails its slice schema (a hand-edited URL, a
   * stale link from a since-changed codec) is simply omitted from the
   * result rather than raising a validation error for the whole route —
   * `useUrlSyncedState` then resolves that key through the fallback store
   * or its default, same as if it had never been in the URL.
   */
  parse: (search: Record<string, unknown>) => Partial<TDefaults>;
};

// Slice-name -> compact encoder, populated by `createUrlSyncedStateConfig` as
// configs are constructed (at module load). Read by `encodeSearch` in the
// router's `stringifySearch`. Stored as `(value: never) => string` so any
// concrete encoder is assignable; call sites pass `value as never`.
const sliceEncoders = new Map<string, (value: never) => string>();

/**
 * Returns a copy of `search` with any slice that has a registered compact
 * encoder serialized to its string form. The router calls `stringifySearch`
 * both with decoded values (arrays/objects/booleans, after `validateSearch`
 * on navigation) and with raw pre-validation values (already-compact strings,
 * during location parsing) — so only non-string values are encoded; strings
 * are assumed already compact and pass through. Wire this into the router as
 * `stringifySearch: (s) => defaultStringifySearch(encodeSearch(s))`.
 */
export function encodeSearch(
  search: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...search };
  for (const key of Object.keys(out)) {
    const value = out[key];
    const encode = sliceEncoders.get(key);
    if (encode && value !== undefined && typeof value !== "string") {
      out[key] = encode(value as never);
    }
  }
  return out;
}

/** Accept the compact string form (decode it) or the raw shape (JSON URLs). */
function withCompactDecoding(
  decode: (raw: string) => unknown,
  schema: z.ZodType,
): z.ZodType {
  return z.preprocess((value) => {
    // The router's query parser coerces numeric-looking values before we see
    // them ("3.5" → 3.5) — stringify numbers back so e.g. a list of numeric
    // ids still decodes. Booleans pass through untouched: a literal `true`
    // (e.g. the JSON form of "all expanded") must stay a literal.
    if (typeof value === "string" || typeof value === "number") {
      return decode(String(value));
    }
    return value;
  }, schema);
}

type DefaultsOf<S extends Record<string, UrlSlice<unknown>>> = {
  [K in keyof S]: S[K] extends UrlSlice<infer T> ? T : never;
};

/**
 * Compose a record of slices into `{ schema, defaults }`. The keys of `slices`
 * become the synced keys; each slice contributes its optional schema field
 * (with compact decoding if it has a codec), its default value, and — if it
 * has an `encode` — a registration into the global encoder map.
 */
export function createUrlSyncedStateConfig<
  S extends Record<string, UrlSlice<unknown>>,
>(slices: S): UrlSyncedStateConfig<DefaultsOf<S>> {
  const shape: Record<string, z.ZodType> = {};
  const fields: Record<string, z.ZodType> = {};
  const defaults: Record<string, unknown> = {};

  for (const [key, slice] of Object.entries(slices)) {
    const field = slice.decode
      ? withCompactDecoding(slice.decode, slice.schema)
      : slice.schema;
    fields[key] = field;
    shape[key] = field.optional();
    defaults[key] = slice.defaultValue;
    if (slice.encode) {
      sliceEncoders.set(key, slice.encode as (value: never) => string);
    }
  }

  // Field-by-field so one bad/garbage value can't take the whole route down:
  // absent, `null`, or schema-rejected keys are simply dropped from the
  // result instead of throwing — `useUrlSyncedState` treats a missing key as
  // "fall back to the fallback store, then the default".
  function parse(search: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(fields)) {
      const raw = search[key];
      if (raw === undefined || raw === null) continue;
      const result = fields[key].safeParse(raw);
      if (result.success) out[key] = result.data;
    }
    return out;
  }

  // The shape is assembled dynamically, so its inferred type is too loose for
  // TS to connect back to S — the loop above is what upholds this contract.
  return {
    schema: z.object(shape),
    defaults,
    parse,
  } as unknown as UrlSyncedStateConfig<DefaultsOf<S>>;
}
