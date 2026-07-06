import { z } from "zod";
import type {
  ColumnFiltersState,
  ExpandedState,
  GroupingState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import type { UrlSlice } from "../../url-state";

/**
 * TanStack Table v9 state slices as `UrlSlice`s for the generic URL-state kit,
 * each with a compact string codec so the URL reads
 * `?sorting=-salary.name&pagination=1_10` instead of percent-encoded JSON.
 *
 * These are just one library of slices — mix them with your own (a boolean
 * toggle, a text field) in `createUrlSyncedStateConfig`, or use the
 * `createTableSearchConfig` shortcut for the common all-table case.
 *
 * Codec grammar (all within the URL-safe set `A-Za-z0-9 * - . _`):
 *   sorting        `-salary.name`          `-` prefix = desc, `.` separates
 *   pagination     `1_10`                  `pageIndex_pageSize`
 *   grouping       `region.product`        `.` separates
 *   expanded       `*` | `E1.E2` | ``      `*` = all, `.`-list of open ids
 *   columnFilters  `dept.Sales*salary.40000_60000*tags.Alpha.Beta`
 *                                          `id.value` pairs joined by `*`; a
 *                                          range value is `min_max` (empty
 *                                          side = open bound); an array value
 *                                          (e.g. a multiselect) is `.`-led,
 *                                          `.`-joined items (`.Alpha.Beta`,
 *                                          empty array is just `.`)
 *
 * Decoders are total — they never throw; a garbage value decodes to a shape
 * the slice schema then rejects, surfacing as a normal validateSearch error.
 *
 * Known limitation: column/row ids containing `.` or a leading `-`, and string
 * filter values containing `*`/`.`, leading with `.`, or shaped like
 * `min_max`, won't round-trip through the compact form. Avoid such ids/values
 * on synced tables. Array filter values always decode to `string[]` — if a
 * column's filter value is numeric (e.g. a multiselect of ids), give it
 * `z.array(z.coerce.number())` in `filterValue` rather than `z.array(z.number())`.
 */

const sortingSchema = z.array(z.object({ id: z.string(), desc: z.boolean() }));

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

const paginationSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().positive(),
});

function encodePagination(pagination: PaginationState): string {
  return `${pagination.pageIndex}_${pagination.pageSize}`;
}

function decodePagination(raw: string): unknown {
  const [pageIndex, pageSize] = raw.split("_").map(Number);
  return { pageIndex, pageSize };
}

const groupingSchema = z.array(z.string());

function encodeGrouping(grouping: GroupingState): string {
  return grouping.join(".");
}

function decodeGrouping(raw: string): GroupingState {
  return raw === "" ? [] : raw.split(".");
}

// `true` means "everything expanded"; the record form maps row ids.
const expandedSchema = z.union([
  z.literal(true),
  z.record(z.string(), z.boolean()),
]);

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

// A range is a 2-element tuple of number|null — anything else array-shaped
// (e.g. a multiselect's `string[]`) is encoded as a `.`-led, `.`-joined list.
// The leading `.` is the array marker: without it, `RANGE_VALUE_RE` requires
// an underscore that a dot-joined list never contains, so the two can't
// collide even when every item happens to look numeric.
function encodeFilterValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (
      value.length === 2 &&
      value.every((item) => item === null || typeof item === "number")
    ) {
      const [min, max] = value as [number | null, number | null];
      return `${min ?? ""}_${max ?? ""}`;
    }
    return `.${value.map(String).join(".")}`;
  }
  return String(value);
}

function decodeFilterValue(rawValue: string): unknown {
  if (rawValue.includes("_") && RANGE_VALUE_RE.test(rawValue)) {
    const [min, max] = rawValue.split("_");
    return [min === "" ? null : Number(min), max === "" ? null : Number(max)];
  }
  if (rawValue.startsWith(".")) {
    const rest = rawValue.slice(1);
    return rest === "" ? [] : rest.split(".");
  }
  return rawValue;
}

function encodeColumnFilters(filters: ColumnFiltersState): string {
  return filters.map((f) => `${f.id}.${encodeFilterValue(f.value)}`).join("*");
}

function decodeColumnFilters(raw: string): unknown {
  if (raw === "") return [];
  return raw.split("*").map((pair) => {
    // Split at the FIRST `.` only — range values contain dots in decimals,
    // and array values start with one.
    const dot = pair.indexOf(".");
    const id = dot === -1 ? pair : pair.slice(0, dot);
    const rawValue = dot === -1 ? "" : pair.slice(dot + 1);
    return { id, value: decodeFilterValue(rawValue) };
  });
}

type ColumnFilter<V> = { id: string; value: V };

/**
 * Slice factories for the standard TanStack Table v9 state slices. Each takes
 * its default value and returns a `UrlSlice`; `columnFilters` also needs the
 * union of filter `value` shapes its columns produce (range bounds must be
 * `.nullable()` — an unset bound is `undefined` in state but `null` in the URL).
 */
export const tableSlices = {
  sorting(opts: { default: SortingState }): UrlSlice<SortingState> {
    return {
      schema: sortingSchema,
      defaultValue: opts.default,
      encode: encodeSorting,
      decode: decodeSorting,
    };
  },
  pagination(opts: { default: PaginationState }): UrlSlice<PaginationState> {
    return {
      schema: paginationSchema,
      defaultValue: opts.default,
      encode: encodePagination,
      decode: decodePagination,
    };
  },
  grouping(opts: { default: GroupingState }): UrlSlice<GroupingState> {
    return {
      schema: groupingSchema,
      defaultValue: opts.default,
      encode: encodeGrouping,
      decode: decodeGrouping,
    };
  },
  expanded(opts: { default: ExpandedState }): UrlSlice<ExpandedState> {
    return {
      schema: expandedSchema,
      defaultValue: opts.default,
      encode: encodeExpanded,
      decode: decodeExpanded,
    };
  },
  // Plain string — the router already writes it readably, so no codec.
  globalFilter(opts: { default: string }): UrlSlice<string> {
    return { schema: z.string(), defaultValue: opts.default };
  },
  columnFilters<V>(opts: {
    filterValue: z.ZodType<V>;
    default: ColumnFilter<V>[];
  }): UrlSlice<ColumnFilter<V>[]> {
    return {
      schema: z.array(z.object({ id: z.string(), value: opts.filterValue })),
      defaultValue: opts.default,
      encode: encodeColumnFilters as (value: ColumnFilter<V>[]) => string,
      decode: decodeColumnFilters,
    };
  },
};

export type StandardTableSlice = keyof typeof tableSlices;
