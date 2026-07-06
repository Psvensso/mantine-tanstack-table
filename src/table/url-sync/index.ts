/**
 * Table-specific URL-sync layer, built on the generic kit in `src/url-state/`.
 *
 * - `createTableSearchConfig` — shortcut that maps a `defaults` record of
 *   standard table slices to `{ schema, defaults }`.
 * - `tableSlices` — the underlying slice library, for mixing table slices with
 *   your own via the generic `createUrlSyncedStateConfig`.
 * - `useTableUrlSync` + `usePageIndexClamp` — wire the synced atoms into
 *   `useTable` and handle the pagination+filtering corner.
 */
export {
  createTableSearchConfig,
  type CustomSlice,
  type TableSearchConfig,
} from "./createTableSearchConfig";
export { tableSlices, type StandardTableSlice } from "./tableUrlSlices";
export {
  useTableUrlSync,
  usePageIndexClamp,
  type TableAtomsOf,
  type TableUrlRoute,
} from "./useTableUrlSync";
