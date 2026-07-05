import { useSelector } from "@tanstack/react-store";
import type { Atom } from "@tanstack/store";
import type { PaginationState } from "@tanstack/react-table";
import { useEffect } from "react";
import {
  useTableUrlState,
  type NavigateFn,
  type TableUrlAtoms,
} from "./useTableUrlState";

/**
 * Route-facing convenience layer over `useTableUrlState`: give it the route
 * and a `defaults` object (usually from `createTableSearchConfig`) and it
 * returns the atoms plus a `tableOptions` object to spread into `useTable`.
 *
 * Spreading `tableOptions` is what enforces the two invariants of this
 * pattern that are easy to forget when wiring by hand:
 *  - the synced atoms are handed to `options.atoms`, and
 *  - `autoResetPageIndex` is disabled, so v9's on-mount "sorting changed"
 *    reset can't clobber a pageIndex just restored from the URL/fallback.
 *    Pages that combine pagination with filtering must pair this with
 *    `usePageIndexClamp` below.
 */

// The slice names TanStack Table v9 accepts in `options.atoms`. Keys of
// `defaults` outside this list (custom search params like a server-side
// filter input) still get atoms + URL sync, but are excluded from
// `tableOptions.atoms` since the table has no such state slice.
const TABLE_SLICE_KEYS = [
  "sorting",
  "pagination",
  "columnFilters",
  "globalFilter",
  "grouping",
  "expanded",
  "rowSelection",
  "columnVisibility",
  "columnOrder",
  "columnPinning",
  "columnSizing",
] as const;

type TableSliceKey = (typeof TABLE_SLICE_KEYS)[number];

export type TableAtomsOf<TDefaults> = Pick<
  TableUrlAtoms<TDefaults>,
  Extract<keyof TDefaults, TableSliceKey>
>;

export interface TableUrlRoute<TDefaults extends Record<string, unknown>> {
  useSearch: () => Partial<TDefaults>;
  useNavigate: () => NavigateFn<Partial<TDefaults>>;
}

export function useTableUrlSync<TDefaults extends Record<string, unknown>>(config: {
  /** The TanStack Router route (or route API) this table page renders under. */
  route: TableUrlRoute<TDefaults>;
  /** Namespaces the local fallback store, e.g. "examples/filtering-pinning". */
  scope: string;
  /** `createTableSearchConfig(...).defaults` — must be module-scope stable. */
  defaults: TDefaults;
  /** Debounce (ms) before writing a state change back to the URL. Default 200. */
  debounceMs?: number;
}): {
  atoms: TableUrlAtoms<TDefaults>;
  tableOptions: {
    atoms: TableAtomsOf<TDefaults>;
    autoResetPageIndex: false;
  };
} {
  const { route, scope, defaults, debounceMs } = config;
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const atoms = useTableUrlState({ scope, search, navigate, defaults, debounceMs });

  const tableAtoms = {} as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    if ((TABLE_SLICE_KEYS as readonly string[]).includes(key)) {
      tableAtoms[key] = atoms[key as keyof TDefaults];
    }
  }

  return {
    atoms,
    tableOptions: {
      atoms: tableAtoms as TableAtomsOf<TDefaults>,
      autoResetPageIndex: false,
    },
  };
}

/**
 * With `autoResetPageIndex` off (see `useTableUrlSync`), a filter or search
 * change can strand `pageIndex` past the last page of the shrunken row set.
 * This clamps it back — writing through `table.setPageIndex` hits the
 * pagination atom, so the URL follows automatically. Subscribes to the atom's
 * `pageIndex` so a deep link straight to an out-of-range page also clamps.
 */
export function usePageIndexClamp(
  table: { getPageCount: () => number; setPageIndex: (index: number) => void },
  paginationAtom: Atom<PaginationState>,
): void {
  const pageIndex = useSelector(paginationAtom, (p) => p.pageIndex);
  const pageCount = table.getPageCount();
  useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      table.setPageIndex(pageCount - 1);
    }
  }, [pageCount, pageIndex, table]);
}
