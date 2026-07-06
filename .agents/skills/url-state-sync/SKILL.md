---
name: url-state-sync
description: How to sync arbitrary React state to the URL as TanStack Router
  search params, using TanStack Store atoms as the shared source of truth.
  This is the generic, domain-agnostic kit (not table-specific) — reach for it
  whenever a page needs state that is shareable, bookmarkable, reload-safe,
  back/forward-safe, and per-tab (which rules out localStorage). Core pieces:
  `useUrlSyncedState` (the hook — defaults in, one atom per key out),
  `createUrlSyncedStateConfig` + `UrlSlice` (compose slices into the
  schema+defaults pair), and `parseSearchBlob`/`stringifySearchBlob` (the
  router-level codec: the whole search object travels as one base64url JSON
  blob param). Lives in `src/url-state/`. For syncing TanStack Table state
  specifically, see the `table-url-sync` skill, which is one consumer of this
  kit.
---

# Syncing arbitrary state to the URL

## When to use this

Use the URL as the store when state should be **shareable / bookmarkable**,
survive a **reload**, survive **in-app navigation and back/forward**, and be
**per-tab**. That last point is why the URL beats storage: `localStorage` is
one shared bucket per origin, so two tabs with different state clobber each
other; `sessionStorage` is per-tab but not deep-linkable. The URL is the only
medium that is all four at once.

Reload-safety comes from the **URL itself** (re-parsed on load), not from the
fallback store (an in-memory `Map`, wiped on reload). The fallback store only
covers the one gap the URL can't: navigating within the app to a param-less
URL and back.

Be selective — only put state worth persisting in the URL; leave ephemeral UI
state as ordinary `useState`.

## The three pieces

1. **`createUrlSyncedStateConfig(slices)`** → `{ schema, defaults }`. Call at
   module scope. Each entry of `slices` is a `UrlSlice` (schema + default).
   `schema` goes to the route's `validateSearch`; `defaults` goes to the hook.
   One declaration feeds both — the schema has to exist at the route (module
   load, outside React), separate from the component, so this is what keeps
   them in sync.
2. **`useUrlSyncedState({ scope, search, navigate, defaults })`** → one atom
   per key of `defaults`. It seeds each atom (URL → fallback → default),
   mirrors changes back to the URL (debounced) and the fallback store, and
   applies URL changes onto the atoms. It creates the atoms (rather than
   receiving them) because their initial value must be resolved from the URL.
3. **`parseSearchBlob` / `stringifySearchBlob`** → wire both into the router
   once: `createRouter({ parseSearch: parseSearchBlob, stringifySearch:
   stringifySearchBlob })` (see "The URL blob codec").

## Recipe

```tsx
// 1. Module scope. A slice = schema + default.
export const dashboardSearch = createUrlSyncedStateConfig({
  detailsShown: { schema: z.boolean(), defaultValue: false },
  range: { schema: z.enum(["7d", "30d", "90d"]), defaultValue: "30d" },
});

const routeApi = getRouteApi("/dashboard");

// 2. Route (router.tsx): validateSearch: (s) => dashboardSearch.schema.parse(s)

// 3. Component:
const atoms = useUrlSyncedState({
  route: routeApi,               // supplies useSearch + useNavigate
  scope: "dashboard",            // namespaces the fallback store
  defaults: dashboardSearch.defaults,
});
const detailsShown = useSelector(atoms.detailsShown);
// write with atoms.detailsShown.set(true) — URL + fallback follow automatically
```

(`useUrlSyncedState` itself takes `search`/`navigate` directly; a route-facing
wrapper like the table's `useTableUrlSync` can take a `route` instead. Use
whichever fits — the core hook is router-agnostic.)

**The keys of `defaults` are the selector** — whichever keys you list get
synced. `defaults` must be a stable module-level object: the hook creates one
atom per key in a loop, so the key set must be identical on every render.

## The URL blob codec

The whole search object travels as one base64url JSON blob under a single
param: `?_s=eyJzb3J0aW5nIjp...`. Deliberate trade: URLs are opaque (not
human-readable), but any JSON-serializable value round-trips exactly — no
per-slice codecs, no delimiter grammar, no restrictions on what strings or
array shapes a slice may hold. The pipeline is `parseSearchBlob` (blob →
object) → route `validateSearch` (zod) → components; on write, navigation
re-validates and `stringifySearchBlob` re-encodes.

Rules that follow from "the URL is JSON":
- Slice values must be JSON-serializable: dates as ISO strings, never `Date`.
- `undefined` inside arrays/tuples becomes `null` — use `.nullable()` in
  schemas for open bounds, not `.optional()`.
- `parseSearchBlob` is total: a tampered/truncated blob is dropped (page
  degrades to defaults, no crash). Plain non-blob params still parse and
  override blob keys — hand-typed params keep working as an escape hatch.

## Fields must be `.optional()` with no `.default()`

`createUrlSyncedStateConfig` enforces this. A field absent from the URL must
stay `undefined` so the hook can tell "not in the URL" (→ check fallback →
default) apart from "explicitly set to this value". A `.default()` collapses
those two and every fresh visit looks like a deep link.

## Common Mistakes

### [HIGH] Building the config inside the component
The atom-creation loop keys off `Object.keys(defaults)`, so `defaults` must be
referentially stable. Call `createUrlSyncedStateConfig` at module scope.

### [MEDIUM] Expecting the fallback store to survive a reload
It's an in-memory `Map`. Reload-safety is the URL's job — the store only
restores state across in-app navigation to a param-less URL. Both together
cover reload + nav + deep link.

### [MEDIUM] Encoding search values anywhere but the router
Navigation re-validates search params (producing real state shapes) before
stringifying, so any encoding applied earlier is undone. Serialization lives
only in the router's `parseSearch`/`stringifySearch` pair — and both halves
must be wired, or blobs are written that nothing decodes (or vice versa).

### [MEDIUM] Storing non-JSON values in a slice
The blob is `JSON.stringify`/`JSON.parse` — a `Date`, `Map`, or `Set` won't
round-trip. Store ISO strings / arrays / plain objects; let the zod schema
enforce it.

### [LOW] Putting genuinely ephemeral UI state in the URL
If it isn't worth sharing or bookmarking, `useState` is lighter. The URL is
for state a user would want to link to or keep across a reload.
