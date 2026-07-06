---
name: url-state-sync
description: How to sync arbitrary React state to the URL as TanStack Router
  search params, using TanStack Store atoms as the shared source of truth.
  This is the generic, domain-agnostic kit (not table-specific) — reach for it
  whenever a page needs state that is shareable, bookmarkable, reload-safe,
  back/forward-safe, and per-tab (which rules out localStorage). Core pieces:
  `useUrlSyncedState` (the hook — defaults in, one atom per key out),
  `createUrlSyncedStateConfig` + `UrlSlice` (compose slices into the
  schema+defaults pair), and `encodeSearch` (compact human-readable URLs via
  the router's stringifySearch). Lives in `src/url-state/`. For syncing
  TanStack Table state specifically, see the `table-url-sync` skill, which is
  one consumer of this kit.
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
   module scope. Each entry of `slices` is a `UrlSlice` (schema + default +
   optional compact codec). `schema` goes to the route's `validateSearch`;
   `defaults` goes to the hook. One declaration feeds both — the schema has to
   exist at the route (module load, outside React), separate from the
   component, so this is what keeps them in sync.
2. **`useUrlSyncedState({ scope, search, navigate, defaults })`** → one atom
   per key of `defaults`. It seeds each atom (URL → fallback → default),
   mirrors changes back to the URL (debounced) and the fallback store, and
   applies URL changes onto the atoms. It creates the atoms (rather than
   receiving them) because their initial value must be resolved from the URL.
3. **`encodeSearch`** → wire into the router once as
   `stringifySearch: (s) => defaultStringifySearch(encodeSearch(s))` for
   compact URLs (see "Compact encoding").

## Recipe

```tsx
// 1. Module scope. A slice = schema + default (+ optional codec).
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

## Compact encoding

Booleans, strings, numbers, and enums already serialize readably
(`?detailsShown=true&range=30d`) — no codec needed. Give a slice an
`encode`/`decode` pair only for structured values that would otherwise become
percent-encoded JSON. Decoding runs in the slice schema (`z.preprocess`);
encoding runs in the router's global `stringifySearch` via `encodeSearch`, so
each slice's `encode` is registered by key name globally — a given key maps to
one codec process-wide. Keep codecs within the URL-safe set `A-Za-z0-9 * - . _`.

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

### [MEDIUM] Encoding compact values anywhere but the router
Navigation re-validates search params (decoding them to real shapes) before
stringifying, so any encoding applied earlier is undone. It must live in the
router's `stringifySearch`.

### [LOW] Putting genuinely ephemeral UI state in the URL
If it isn't worth sharing or bookmarking, `useState` is lighter. The URL is
for state a user would want to link to or keep across a reload.
