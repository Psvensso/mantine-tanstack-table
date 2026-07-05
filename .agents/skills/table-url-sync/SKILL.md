---
name: table-url-sync
description: How to sync TanStack Table v9 state (sorting, pagination, grouping,
  filters, or any other state slice) to the URL via TanStack Router search
  params. A three-piece kit: `createTableSearchConfig`
  (src/hooks/tableUrlSearchSchema.ts) builds the zod schema + defaults pair,
  `useTableUrlSync` (src/hooks/useTableUrlSync.ts) returns atoms plus
  spreadable `useTable` options, and `useTableUrlState`
  (src/hooks/useTableUrlState.ts) is the underlying generic hook built on v9's
  external-atoms mechanism (options.atoms + useCreateAtom, not
  state+onXChange). State not present in the URL falls back to a
  locally-scoped variable that survives client-side navigation, then to
  defaults. Use whenever a table page needs shareable/bookmarkable/
  back-forward-safe URL state. Reference implementations: every page in
  src/examples/, plus the deep-dive demo in src/routes-url-sync/.
---

# Syncing TanStack Table v9 state to the URL

## Architecture

The whole app is one TanStack Router instance (`src/router.tsx`, code-based
route tree — no file-based route generation) with one route per example page.
Every example table syncs its interesting state slices to the URL through a
three-piece kit:

1. **`createTableSearchConfig`** (`src/hooks/tableUrlSearchSchema.ts`) —
   called at module scope, returns `{ schema, defaults }`. The schema goes
   into the route's `validateSearch`; the defaults go into `useTableUrlSync`.
   One source of truth for which slices sync and what their defaults are.
2. **`useTableUrlSync`** (`src/hooks/useTableUrlSync.ts`) — takes the route
   (via `getRouteApi`), a fallback-store `scope`, and the `defaults`; returns
   `{ atoms, tableOptions }`. Spread `tableOptions` into `useTable`.
   Its sibling `usePageIndexClamp` handles the pagination+filtering corner.
3. **`useTableUrlState`** (`src/hooks/useTableUrlState.ts`) — the underlying
   router-agnostic hook (atoms ↔ URL ↔ fallback store). You rarely call it
   directly; `useTableUrlSync` wraps it.

## Adding a synced table page (the recipe)

```tsx
// 1. Module scope: declare what syncs + defaults. Only genuinely
//    table-specific things live here.
export const myTableSearch = createTableSearchConfig({
  defaults: {
    sorting: [{ id: "name", desc: false }],
    pagination: { pageIndex: 0, pageSize: 10 },
    columnFilters: [] as ColumnFiltersState,
    globalFilter: "",
  },
  // Only needed when syncing columnFilters: the union of filter `value`
  // shapes this table's columns produce. Range bounds must be .nullable()
  // (undefined round-trips through the URL's JSON as null).
  filterValue: z.union([
    z.string(),
    z.tuple([z.number().nullable(), z.number().nullable()]),
  ]),
});

const routeApi = getRouteApi("/my-table");

// 2. In src/router.tsx: a route whose validateSearch uses the schema.
//    validateSearch: (search) => myTableSearch.schema.parse(search)

// 3. In the component:
const { atoms, tableOptions } = useTableUrlSync({
  route: routeApi,
  scope: "examples/my-table", // namespaces the local fallback store
  defaults: myTableSearch.defaults,
});

const table = useTable({
  features, columns, data,
  // unsynced slices keep using initialState as usual:
  initialState: { columnPinning: { left: ["select"], right: [] } },
  ...tableOptions, // wires options.atoms + autoResetPageIndex: false
});

// 4. Only if the page combines pagination with filtering/search:
usePageIndexClamp(table, atoms.pagination);
```

**The keys of `defaults` are the selector.** Whichever slice names you list —
`sorting`, `pagination`, `grouping`, `expanded`, `columnFilters`,
`globalFilter` — are the ones that get synced. The factory widens literal
defaults to the proper state types (`SortingState` etc.), builds each field
as `.optional()` with no `.default()`, and returns a module-stable `defaults`
object, so the three contracts the old hand-rolled setup relied on are now
upheld by construction.

Non-table search params can ride along via `custom` slices — see
`src/examples/ServerSideFilteringExample.tsx`, which syncs its TanStack Query
server-filter inputs (`name`, `category`) through the same machinery. Custom
slices get atoms + URL sync but are excluded from `tableOptions.atoms`.

Resolution order per key, computed once to seed each atom on mount:
1. The URL (`search[key]`), if present.
2. The local fallback store, if an entry exists for `${scope}:${key}`.
3. `defaults[key]`.

After mount: interacting with the table writes through the atom → the hook
mirrors that into both the fallback store and the URL (debounced, `replace:
true`). Browser back/forward or a pasted URL flows the other way: a `search`
change gets applied back onto the atoms (compared with JSON-semantic deep
equality — key-order-insensitive, `undefined` ≡ `null`). URL-seeded values
are also mirrored into the fallback store at mount, so a deep link's state
survives navigating away and back even if the user never changed anything.

If any key seeded from the fallback store rather than the URL (the
"navigated away and back without URL params" case), the hook schedules the
same debounced URL write on mount — restored state is immediately reflected
in the address bar again, keeping the URL shareable. A fresh visit where
everything resolves to `defaults` does NOT write to the URL.

## URL format

The structured slices are written as compact human-readable strings, not
percent-encoded JSON: `?sorting=-salary.name&pagination=1_10&grouping=region`,
`expanded=*` (all) / `expanded=ORD-1008.ORD-1006` (id list),
`columnFilters=department.Sales*salary.40000_60000` (`id.value` pairs joined
by `*`; ranges are `min_max` with an empty side for an open bound).

Two pieces make this work, and both are needed:
- `createTableSearchConfig` wraps each slice schema in a decoder
  (`z.preprocess`) that accepts BOTH the compact string and the raw JSON
  shape — old-format URLs keep working.
- The router is created with a custom `stringifySearch` (`src/router.tsx`)
  that compacts the slices on write. It MUST live at the router level:
  navigation re-validates search params (decoding them back to state shapes)
  before stringifying, so encoding applied anywhere earlier gets undone.

Known limitation: ids containing `.` or a leading `-`, and string filter
values containing `*`/`.` or shaped like `min_max`, won't round-trip through
the compact form. Avoid such ids/values on synced tables.

## What to sync (and what not to)

- Sync the state a user would want in a shared link: sorting, pagination,
  filters, group-by choice, which groups are collapsed.
- `expanded` is a judgment call: synced on the small tables where it IS the
  demo (`ExpandableRowsExample`, `RowGroupingExample`, `DynamicGroupingExample`),
  deliberately NOT synced on the virtualized tables (5 000–20 000 rows —
  per-row detail toggles would bloat the URL for state nobody wants to share).
- Never sync `rowSelection` — ephemeral by nature here.

## Why `atoms`, not `state` + `on*Change`

TanStack Table v9 state-slice ownership precedence is `options.atoms[key]` >
`options.state[key]` + `on*Change` > `initialState` > internal default.
External atoms (via `useCreateAtom` from `@tanstack/react-store`) are v9's
preferred mechanism for sharing/persisting a slice outside the table — the
table writes through the atom you hand it via its normal setters
(`table.setSorting(...)`, etc.), no `on*Change` callback needed. This is
exactly the same shape as the "persist a slice to localStorage" pattern
documented in `@tanstack/react-table`'s own bundled
`compose-with-tanstack-store` skill — we're just persisting to the URL and a
module variable instead of `localStorage`.

To read a synced slice in the component, use
`useSelector(atoms.someSlice)` from `@tanstack/react-store`; to write one
outside the table's own UI, call `atoms.someSlice.set(...)` (or the table
setter — same thing for table slices).

## The fallback store's lifetime

`src/hooks/tableUrlStateFallback.ts` is a plain module-level `Map`. It lives
for as long as the JS module stays loaded: surviving client-side route
transitions (router `Link` navigations), but wiped by a full page reload.
This is intentional — it's what lets "navigate away and back with no URL
params" restore the previous state, while a hard reload correctly falls
through to defaults (or to the URL, if the URL still has params).

The deep-dive demo at `/table-url-sync` (`src/routes-url-sync/`) visualizes
which source each slice resolved from (URL / local fallback / default).

## Common Mistakes

### [CRITICAL] Wiring `atoms` into `useTable` by hand instead of spreading `tableOptions`

`useTableUrlSync().tableOptions` bundles `options.atoms` **and**
`autoResetPageIndex: false`. The latter matters: v9's `autoResetPageIndex`
defaults to `true` client-side, and the very first time sorting/filtering
"changes" (which includes going from nothing to a freshly-restored value at
construction), it calls `resetPageIndex()` internally — silently resetting
`pageIndex` and overwriting whatever was just restored from the URL or the
fallback. This was a real, observed bug during manual testing, not a
theoretical one. Spread `...tableOptions`; don't cherry-pick.

Note spread order: `...tableOptions` after any `initialState` you pass —
synced slices must not also appear in `initialState`.

### [HIGH] Pagination + filtering without `usePageIndexClamp`

With `autoResetPageIndex` off (see above), a filter/search change can strand
`pageIndex` past the last page of the shrunken row set. Any page that syncs
`pagination` AND lets the user filter must call
`usePageIndexClamp(table, atoms.pagination)`. It writes through
`table.setPageIndex`, so the URL follows the clamp automatically, and it
subscribes to the atom so an out-of-range deep link clamps too.

### [HIGH] Hand-rolling the zod schema with `.default()` or required fields

If a field always resolves to a value (via `.default()`) or is required, the
hook can no longer tell "not in the URL, check the fallback" apart from
"explicitly set to this value in the URL" — every fresh visit would look
identical to an explicit deep link. `createTableSearchConfig` builds every
field `.optional()` with no `.default()` for exactly this reason; if you must
hand-roll a schema, preserve that property.

### [MEDIUM] Calling `createTableSearchConfig` inside the component

`useTableUrlState` calls one `useCreateAtom` per key of `defaults` in a loop,
which is only safe if `defaults` has the same keys, in the same order, on
every render. Call the factory at module scope (as every example does) so
the defaults object is referentially stable by construction.

### [MEDIUM] Adding `onSortingChange`/`onPaginationChange` alongside `atoms`

Redundant and confusing — the table already writes through the atom passed
via `options.atoms`. An `on*Change` handler here does nothing useful.

### [MEDIUM] Expecting `table.reset()` to clear URL-synced slices

`table.reset()` only resets internally-owned `baseAtoms`; slices owned by
`options.atoms` are untouched. To reset a synced slice, set the atom
directly: `atoms.sorting.set(myTableSearch.defaults.sorting)`.

### [LOW] Forgetting `replace: true` semantics matter here

The hook always calls `navigate({ replace: true, ... })` — every sort/page
interaction updates the current history entry rather than pushing a new one.
This is intentional: without it, rapidly clicking through several sorts or
pages would spam browser history, and the Back button would step through each
intermediate state instead of leaving the page entirely.
