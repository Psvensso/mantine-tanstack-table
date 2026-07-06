/**
 * Generic URL-synced state kit — domain-agnostic, reusable by any page that
 * wants shareable / reload-safe / back-forward-safe state in the URL.
 *
 * - `useUrlSyncedState` — the hook: defaults in, one atom per key out, kept in
 *   sync with the URL and a client-side fallback store.
 * - `createUrlSyncedStateConfig` + `UrlSlice` — compose slices into the
 *   `{ schema, defaults }` pair for the route and the hook.
 * - `parseSearchBlob` / `stringifySearchBlob` — wire into the router so the
 *   whole search object travels as one base64url JSON blob param.
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
  type UrlSlice,
  type UrlSyncedStateConfig,
} from "./createUrlSyncedStateConfig";
export { parseSearchBlob, stringifySearchBlob } from "./urlBlobCodec";
export { getFallback, setFallback } from "./urlStateFallback";
