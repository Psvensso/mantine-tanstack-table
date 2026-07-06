import { z } from "zod";
import type {
  ColumnFiltersState,
  ExpandedState,
  GroupingState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import {
  createUrlSyncedStateConfig,
  type UrlSlice,
  type UrlSyncedStateConfig,
} from "../../url-state";
import { tableSlices } from "./tableUrlSlices";

/**
 * Ergonomic shortcut over `createUrlSyncedStateConfig` for the common case:
 * a page syncing standard TanStack Table v9 slices. You pass a plain `defaults`
 * record and it wires up the matching `tableSlices` for you. Reach for the
 * generic `createUrlSyncedStateConfig` directly when you want to mix these with
 * non-table slices that carry their own codecs; simple extra params
 * (booleans, text, enums) fit the `custom` field here.
 *
 * Call at module scope — `useUrlSyncedState` needs `defaults` referentially
 * stable across renders.
 */

type StandardSlices = {
  sorting: SortingState;
  pagination: PaginationState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  grouping: GroupingState;
  expanded: ExpandedState;
};

/** A non-table search param synced through the same machinery (e.g. a server-side filter, a UI toggle). */
export type CustomSlice<T> = {
  schema: z.ZodType<T>;
  defaultValue: T;
};

export type TableSearchConfig<TDefaults extends Record<string, unknown>> =
  UrlSyncedStateConfig<TDefaults>;

// Widens the caller's literal defaults back to the full state types —
// `sorting: [{ id: "name", desc: false }]` must produce an
// `Atom<SortingState>`, not an `Atom<{ id: string; desc: false }[]>`.
type WidenStandardSlices<TStandard> = {
  [K in Extract<keyof TStandard, keyof StandardSlices>]: StandardSlices[K];
};

const STANDARD_SLICE_BUILDERS: Record<
  Exclude<keyof StandardSlices, "columnFilters">,
  (def: never) => UrlSlice<unknown>
> = {
  sorting: (def: SortingState) => tableSlices.sorting({ default: def }),
  pagination: (def: PaginationState) => tableSlices.pagination({ default: def }),
  grouping: (def: GroupingState) => tableSlices.grouping({ default: def }),
  expanded: (def: ExpandedState) => tableSlices.expanded({ default: def }),
  globalFilter: (def: string) => tableSlices.globalFilter({ default: def }),
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
   * Required when `defaults` includes `columnFilters`.
   */
  filterValue?: z.ZodType;
  /** Extra non-table params to sync alongside (server filters, UI toggles, …). */
  custom?: TCustom;
}): TableSearchConfig<
  WidenStandardSlices<TStandard> & {
    [K in keyof TCustom]: TCustom[K]["defaultValue"];
  }
> {
  const { defaults, filterValue, custom } = config;
  const slices: Record<string, UrlSlice<unknown>> = {};

  for (const key of Object.keys(defaults)) {
    if (key === "columnFilters") {
      if (!filterValue) {
        throw new Error(
          "createTableSearchConfig: `filterValue` is required when syncing `columnFilters`",
        );
      }
      slices[key] = tableSlices.columnFilters({
        filterValue,
        default: defaults[key] as { id: string; value: unknown }[],
      });
    } else {
      const build =
        STANDARD_SLICE_BUILDERS[key as keyof typeof STANDARD_SLICE_BUILDERS];
      if (!build) {
        throw new Error(
          `createTableSearchConfig: unknown slice "${key}" — standard slices are ${Object.keys(STANDARD_SLICE_BUILDERS).join(", ")}, columnFilters; anything else goes in \`custom\``,
        );
      }
      slices[key] = build(
        (defaults as Record<string, unknown>)[key] as never,
      );
    }
  }

  for (const [key, slice] of Object.entries(custom ?? {})) {
    slices[key] = { schema: slice.schema, defaultValue: slice.defaultValue };
  }

  return createUrlSyncedStateConfig(slices) as unknown as TableSearchConfig<
    WidenStandardSlices<TStandard> & {
      [K in keyof TCustom]: TCustom[K]["defaultValue"];
    }
  >;
}
