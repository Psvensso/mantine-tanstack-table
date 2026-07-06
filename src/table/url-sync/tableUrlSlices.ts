import { z } from "zod";
import type {
  ExpandedState,
  GroupingState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import type { UrlSlice } from "../../url-state";

/**
 * TanStack Table v9 state slices as `UrlSlice`s for the generic URL-state kit:
 * just a zod schema + default per slice. Serialization is handled wholesale by
 * the router's blob codec (`urlBlobCodec.ts`) — everything JSON-serializable
 * round-trips exactly, so there are no per-slice codecs and no restrictions on
 * ids or filter values (any string, array, or nested shape works).
 *
 * These are one library of slices — mix them with your own (a boolean toggle,
 * a multiselect's `string[]`) in `createUrlSyncedStateConfig`, or use the
 * `createTableSearchConfig` shortcut for the common all-table case.
 */

const sortingSchema = z.array(z.object({ id: z.string(), desc: z.boolean() }));

const paginationSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().positive(),
});

const groupingSchema = z.array(z.string());

// `true` means "everything expanded"; the record form maps row ids.
const expandedSchema = z.union([
  z.literal(true),
  z.record(z.string(), z.boolean()),
]);

type ColumnFilter<V> = { id: string; value: V };

/**
 * Slice factories for the standard TanStack Table v9 state slices. Each takes
 * its default value and returns a `UrlSlice`; `columnFilters` also needs the
 * union of filter `value` shapes its columns produce (range bounds must be
 * `.nullable()` — an unset bound is `undefined` in state but `null` after the
 * JSON round-trip).
 */
export const tableSlices = {
  sorting(opts: { default: SortingState }): UrlSlice<SortingState> {
    return { schema: sortingSchema, defaultValue: opts.default };
  },
  pagination(opts: { default: PaginationState }): UrlSlice<PaginationState> {
    return { schema: paginationSchema, defaultValue: opts.default };
  },
  grouping(opts: { default: GroupingState }): UrlSlice<GroupingState> {
    return { schema: groupingSchema, defaultValue: opts.default };
  },
  expanded(opts: { default: ExpandedState }): UrlSlice<ExpandedState> {
    return { schema: expandedSchema, defaultValue: opts.default };
  },
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
    };
  },
};

export type StandardTableSlice = keyof typeof tableSlices;
