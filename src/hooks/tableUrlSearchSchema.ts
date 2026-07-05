import { z } from "zod";
import type {
  ColumnFiltersState,
  ExpandedState,
  GroupingState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";

/**
 * Shared zod schemas + factory for table URL-state search params.
 *
 * `createTableSearchConfig` produces the `{ schema, defaults }` pair a route
 * and its `useTableUrlSync` call share, so a table page only declares what is
 * genuinely table-specific: which slices to sync, their default values, and
 * (when syncing `columnFilters`) the filter value shapes its columns produce.
 *
 * The schema fields are `.optional()` with no `.default()` by construction —
 * a field absent from the URL must stay `undefined` so `useTableUrlState`
 * can tell "not in the URL" apart from "explicitly set to the default value"
 * and fall back to the local fallback store correctly.
 *
 * Call the factory at module scope: `useTableUrlState` requires `defaults`
 * to be referentially stable across renders (its keys drive a hook loop).
 *
 * ## URL encoding
 *
 * The structured slices are written to the URL as compact human-readable
 * strings instead of percent-encoded JSON (the router's default). The router
 * serializes with `URLSearchParams`, which leaves only `A-Za-z0-9 * - . _`
 * unescaped — the codecs below build on exactly those characters:
 *
 *   sorting        `-salary.name`          `-` prefix = desc, `.` separates
 *   pagination     `1_10`                  `pageIndex_pageSize`
 *   grouping       `region.product`        `.` separates
 *   expanded       `*` | `E1.E2` | ``      `*` = all, `.`-list of open ids
 *   columnFilters  `dept.Sales*salary.40000_60000`
 *                                          `id.value` pairs joined by `*`;
 *                                          a range value is `min_max` with
 *                                          an empty side for an open bound
 *
 * Each schema field accepts BOTH the compact string (decoded via
 * `z.preprocess`) and the raw JSON shape, so pre-existing JSON URLs keep
 * working. Known limitation of the compact forms: column/row ids containing
 * `.` or a leading `-`, string filter values containing `*` or `.`, and
 * string filter values that look like a `min_max` range will not round-trip
 * — avoid such ids/values on synced tables (none exist in this repo).
 */

export const sortingSchema = z.array(
  z.object({ id: z.string(), desc: z.boolean() }),
);

export const paginationSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().positive(),
});

export const groupingSchema = z.array(z.string());

// `true` means "everything expanded"; the record form maps row ids.
export const expandedSchema = z.union([
  z.literal(true),
  z.record(z.string(), z.boolean()),
]);

export const globalFilterSchema = z.string();

// ---------------------------------------------------------------------------
// Compact URL codecs (see the module doc's "URL encoding" section).
// Decoders are total — they never throw; garbage input decodes to a shape the
// slice schema then rejects, surfacing as a normal validateSearch error.
// ---------------------------------------------------------------------------

function encodeSorting(sorting: SortingState): string {
  return sorting.map((s) => (s.desc ? `-${s.id}` : s.id)).join(".");
}

function decodeSorting(raw: string): SortingState {
  if (raw === "") return [];
  return raw
    .split(".")
    .map((item) =>
      item.startsWith("-")
        ? { id: item.slice(1), desc: true }
        : { id: item, desc: false },
    );
}

function encodePagination(pagination: PaginationState): string {
  return `${pagination.pageIndex}_${pagination.pageSize}`;
}

function decodePagination(raw: string): unknown {
  const [pageIndex, pageSize] = raw.split("_").map(Number);
  return { pageIndex, pageSize };
}

function encodeGrouping(grouping: GroupingState): string {
  return grouping.join(".");
}

function decodeGrouping(raw: string): GroupingState {
  return raw === "" ? [] : raw.split(".");
}

function encodeExpanded(expanded: ExpandedState): string {
  if (expanded === true) return "*";
  // `false` entries mean "collapsed", same as absence — drop them.
  return Object.keys(expanded)
    .filter((id) => expanded[id])
    .join(".");
}

function decodeExpanded(raw: string): ExpandedState {
  if (raw === "*") return true;
  if (raw === "") return {};
  return Object.fromEntries(raw.split(".").map((id) => [id, true]));
}

// A range filter value serialized as `min_max` (either side empty = open).
const RANGE_VALUE_RE = /^-?\d*(?:\.\d+)?_-?\d*(?:\.\d+)?$/;

function encodeFilterValue(value: unknown): string {
  if (Array.isArray(value) && value.length === 2) {
    const [min, max] = value as [number | null, number | null];
    return `${min ?? ""}_${max ?? ""}`;
  }
  return String(value);
}

function encodeColumnFilters(filters: ColumnFiltersState): string {
  return filters
    .map((f) => `${f.id}.${encodeFilterValue(f.value)}`)
    .join("*");
}

function decodeColumnFilters(raw: string): unknown {
  if (raw === "") return [];
  return raw.split("*").map((pair) => {
    // Split at the FIRST `.` only — range values contain dots in decimals.
    const dot = pair.indexOf(".");
    const id = dot === -1 ? pair : pair.slice(0, dot);
    const rawValue = dot === -1 ? "" : pair.slice(dot + 1);
    if (rawValue.includes("_") && RANGE_VALUE_RE.test(rawValue)) {
      const [min, max] = rawValue.split("_");
      return {
        id,
        value: [
          min === "" ? null : Number(min),
          max === "" ? null : Number(max),
        ],
      };
    }
    return { id, value: rawValue };
  });
}

/**
 * Slice-name → compact-string encoder, applied by `useTableUrlSync` on the
 * way INTO the URL. Decoding happens in the schema (`z.preprocess`), so both
 * directions live behind the same key set. `globalFilter` and custom slices
 * are plain values the router already writes readably.
 */
export const TABLE_URL_SLICE_ENCODERS: Record<
  string,
  (value: never) => string
> = {
  sorting: encodeSorting,
  pagination: encodePagination,
  grouping: encodeGrouping,
  expanded: encodeExpanded,
  columnFilters: encodeColumnFilters,
};

/**
 * Returns a copy of `search` with the standard structured slices compacted.
 * The router calls `stringifySearch` both with decoded state shapes (after
 * validateSearch, on navigation) and with raw pre-validation values (during
 * location parsing) — so only values in their decoded shape (arrays/objects,
 * or `expanded: true`) are encoded; already-compact strings pass through.
 */
export function encodeTableUrlSearch(
  search: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...search };
  for (const [key, encode] of Object.entries(TABLE_URL_SLICE_ENCODERS)) {
    const value = out[key];
    const isDecodedShape =
      (typeof value === "object" && value !== null) ||
      (key === "expanded" && value === true);
    if (isDecodedShape) {
      out[key] = encode(value as never);
    }
  }
  return out;
}

const SLICE_DECODERS: Record<string, (raw: string) => unknown> = {
  sorting: decodeSorting,
  pagination: decodePagination,
  grouping: decodeGrouping,
  expanded: decodeExpanded,
  columnFilters: decodeColumnFilters,
};

/** Accept the compact string form (decode it) or the raw shape (JSON URLs). */
function withCompactDecoding(key: string, schema: z.ZodType): z.ZodType {
  const decode = SLICE_DECODERS[key];
  if (!decode) return schema;
  return z.preprocess((value) => {
    // The router's query parser coerces numeric-looking values before we see
    // them ("3.5" → 3.5) — stringify numbers back so e.g. an expanded-row
    // list of numeric ids still decodes. Booleans pass through untouched:
    // `expanded=true` (the JSON form of "all expanded") must stay a literal.
    if (typeof value === "string" || typeof value === "number") {
      return decode(String(value));
    }
    return value;
  }, schema);
}

type StandardSlices = {
  sorting: SortingState;
  pagination: PaginationState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  grouping: GroupingState;
  expanded: ExpandedState;
};

const STANDARD_SLICE_SCHEMAS: Record<
  Exclude<keyof StandardSlices, "columnFilters">,
  z.ZodType
> = {
  sorting: sortingSchema,
  pagination: paginationSchema,
  globalFilter: globalFilterSchema,
  grouping: groupingSchema,
  expanded: expandedSchema,
};

/** A non-table search param synced through the same machinery (e.g. a server-side filter). */
export type CustomSlice<T> = {
  schema: z.ZodType<T>;
  defaultValue: T;
};

export type TableSearchConfig<TDefaults extends Record<string, unknown>> = {
  /** For the route's `validateSearch`. Parses to `Partial<TDefaults>` — absent fields stay `undefined`. */
  schema: z.ZodType<Partial<TDefaults>>;
  /** For `useTableUrlSync`. Module-scope stable when the factory is called at module scope. */
  defaults: TDefaults;
};

// Widens the caller's literal defaults back to the full state types —
// `sorting: [{ id: "name", desc: false }]` must produce an
// `Atom<SortingState>`, not an `Atom<{ id: string; desc: false }[]>` the
// table couldn't write into.
type WidenStandardSlices<TStandard> = {
  [K in Extract<keyof TStandard, keyof StandardSlices>]: StandardSlices[K];
};

export function createTableSearchConfig<
  TStandard extends Partial<StandardSlices>,
  TCustom extends Record<string, CustomSlice<unknown>> = Record<never, never>,
>(config: {
  /** Which standard slices to sync, with their default values. The keys are the selector. */
  defaults: TStandard;
  /**
   * Union of the filter `value` shapes this table's columns produce, e.g.
   * `z.union([z.string(), z.tuple([z.number().nullable(), z.number().nullable()])])`.
   * Required when `defaults` includes `columnFilters`. An unset range bound is
   * `undefined` in table state but round-trips through the URL as `null`, so
   * range tuple members must be `.nullable()`.
   */
  filterValue?: z.ZodType;
  /** Extra non-table params to sync alongside (e.g. server-side filter inputs). */
  custom?: TCustom;
}): TableSearchConfig<
  WidenStandardSlices<TStandard> & {
    [K in keyof TCustom]: TCustom[K]["defaultValue"];
  }
> {
  const { defaults, filterValue, custom } = config;

  const shape: Record<string, z.ZodType> = {};
  for (const key of Object.keys(defaults)) {
    if (key === "columnFilters") {
      if (!filterValue) {
        throw new Error(
          "createTableSearchConfig: `filterValue` is required when syncing `columnFilters`",
        );
      }
      shape[key] = withCompactDecoding(
        key,
        z.array(z.object({ id: z.string(), value: filterValue })),
      ).optional();
    } else {
      const standard =
        STANDARD_SLICE_SCHEMAS[key as keyof typeof STANDARD_SLICE_SCHEMAS];
      if (!standard) {
        throw new Error(
          `createTableSearchConfig: unknown slice "${key}" — standard slices are ${Object.keys(STANDARD_SLICE_SCHEMAS).join(", ")}, columnFilters; anything else goes in \`custom\``,
        );
      }
      shape[key] = withCompactDecoding(key, standard).optional();
    }
  }

  const customDefaults: Record<string, unknown> = {};
  for (const [key, slice] of Object.entries(custom ?? {})) {
    shape[key] = slice.schema.optional();
    customDefaults[key] = slice.defaultValue;
  }

  // The shape is assembled dynamically, so its type is too loose for TS to
  // connect back to TStandard/TCustom on its own — the runtime construction
  // above is what upholds this contract.
  return {
    schema: z.object(shape),
    defaults: { ...customDefaults, ...defaults },
  } as unknown as TableSearchConfig<
    WidenStandardSlices<TStandard> & {
      [K in keyof TCustom]: TCustom[K]["defaultValue"];
    }
  >;
}
