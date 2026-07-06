/**
 * Generic URL-synced state kit — domain-agnostic, reusable by any page that
 * wants shareable / reload-safe / back-forward-safe state in the URL.
 *
 * - `useUrlSyncedState` — the hook: defaults in, one atom per key out, kept in
 *   sync with the URL and a client-side fallback store.
 * - `createUrlSyncedStateConfig` + `UrlSlice` — compose slices into the
 *   `{ schema, defaults }` pair for the route and the hook.
 * - `encodeSearch` — wire into the router's `stringifySearch` for compact URLs.
 *
 * The table-specific layer built on top lives in `src/table/url-sync/`.
 */
export {
  useUrlSyncedState,
  type NavigateFn,
  type UrlAtoms,
  type UseUrlSyncedStateConfig,
} from "./useUrlSyncedState";
export {
  createUrlSyncedStateConfig,
  encodeSearch,
  type UrlSlice,
  type UrlSyncedStateConfig,
} from "./createUrlSyncedStateConfig";
export { getFallback, setFallback } from "./urlStateFallback";
