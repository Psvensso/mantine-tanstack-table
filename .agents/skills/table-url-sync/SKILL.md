---
name: table-url-sync
description: How to sync TanStack Table v9 state (sorting, pagination, grouping,
  expanded, column/global filters) to the URL so a table is shareable,
  bookmarkable, reload-safe and back/forward-safe. This is the table-specific
  layer built on the generic `url-state-sync` kit. Core pieces:
  `createTableSearchConfig` (maps a `defaults` record of table slices to the
  schema+defaults pair), `useTableUrlSync` (returns the synced atoms plus
  `tableOptions` to spread into `useTable`), `usePageIndexClamp`, and the
  `tableSlices` library. Lives in `src/table/url-sync/`. Reference
  implementations: every page in `src/examples/`, plus the annotated
  deep-dive demo in `src/routes-url-sync/`. For the underlying generic
  mechanism (and for syncing non-table state), see the `url-state-sync` skill.
---

# Syncing TanStack Table v9 state to the URL

## Architecture

The app is one TanStack Router instance (`src/router.tsx`, code-based route
tree) with one route per example. Table URL-sync is a thin table-specific layer
over the generic `url-state-sync` kit:

- **`createTableSearchConfig`** — shortcut over the generic
  `createUrlSyncedStateConfig`: give it a `defaults` record of standard table
  slices and it wires the matching `tableSlices` for you, returning
  `{ schema, defaults }`.
- **`useTableUrlSync`** — table-facing wrapper over `useUrlSyncedState`:
  returns `{ atoms, tableOptions }`. Spreading `tableOptions` into `useTable`
  wires `options.atoms` **and** `autoResetPageIndex: false`.
- **`usePageIndexClamp`** — for pages that combine pagination with filtering.
- **`tableSlices`** — the slice library, if you want to mix table slices with
  your own via the generic factory.

Everything table-specific ends there; the atoms↔URL↔fallback engine, the
config factory, and the compact-URL machinery are all the generic kit.

## Adding a synced table page (the recipe)

```tsx
// 1. Module scope — declare only what's table-specific: which slices, their
//    defaults, and (if syncing columnFilters) the filter value shapes.
export const myTableSearch = createTableSearchConfig({
  defaults: {
    sorting: [{ id: "name", desc: false }],
    pagination: { pageIndex: 0, pageSize: 10 },
    columnFilters: [] as ColumnFiltersState,
    globalFilter: "",
  },
  filterValue: z.union([
    z.string(),
    z.tuple([z.number().nullable(), z.number().nullable()]),
  ]),
});

const routeApi = getRouteApi("/my-table");

// 2. In src/router.tsx: validateSearch: (s) => myTableSearch.schema.parse(s)

// 3. In the component:
const { atoms, tableOptions } = useTableUrlSync({
  route: routeApi,
  scope: "examples/my-table",   // namespaces the fallback store
  defaults: myTableSearch.defaults,
});

const table = useTable({
  features, columns, data,
  initialState: { columnPinning: { left: ["select"], right: [] } }, // unsynced slices
  ...tableOptions,              // options.atoms + autoResetPageIndex: false
});

// 4. Only if the page combines pagination with filtering/search:
usePageIndexClamp(table, atoms.pagination);
```

**The keys of `defaults` are the selector** — whichever standard slices you
list get synced. Read a synced slice in the component with
`useSelector(atoms.someSlice)`; write one outside the table's own UI with the
table setter (or `atoms.someSlice.set(...)`). Call `createTableSearchConfig`
at module scope — the atoms are created in a per-key loop that needs a stable
key set.

## Mixing in non-table state

Server-side filter inputs, a "details panel shown" toggle, etc. aren't table
state. Two options, both through the same machinery:
- Small extras (booleans, text, enums): the `custom` field of
  `createTableSearchConfig` — `custom: { detailsShown: { schema: z.boolean(), defaultValue: false } }`.
  They get synced atoms but are excluded from `tableOptions.atoms`. See
  `ServerSideFilteringExample` (its `name`/`category` inputs).
- Anything more: drop to the generic `createUrlSyncedStateConfig` and mix
  `tableSlices` with your own slices. See the `url-state-sync` skill.

## What to sync (and what not to)

- Sync what a user would want in a shared link: sorting, pagination, filters,
  group-by choice, which groups are collapsed.
- `expanded` is a judgment call: synced on the small tables where it IS the
  demo (`ExpandableRowsExample`, `RowGroupingExample`, `DynamicGroupingExample`),
  deliberately NOT on the virtualized tables (thousands of rows — per-row
  toggles would bloat the URL for state nobody shares).
- Never sync `rowSelection` — ephemeral here.

## URL format

Table slices are written as compact strings, not percent-encoded JSON:
`?sorting=-salary.name&pagination=1_10&grouping=region`, `expanded=*` (all) or
`expanded=ORD-1008.ORD-1006` (id list), `columnFilters=department.Sales*salary.40000_60000`
(`id.value` pairs joined by `*`; ranges are `min_max`, empty side = open bound).
The codecs live in `tableSlices`; encoding is wired once into the router's
`stringifySearch` via the generic `encodeSearch`. Schemas accept both the
compact and raw-JSON forms, so old JSON URLs keep working. Limitation: ids with
`.` or a leading `-`, and string filter values with `*`/`.` or shaped like
`min_max`, won't round-trip — avoid them on synced tables.

## Why `atoms`, not `state` + `on*Change`

TanStack Table v9 state-slice ownership precedence is `options.atoms[key]` >
`options.state[key]` + `on*Change` > `initialState` > internal default.
External atoms (via `useCreateAtom` from `@tanstack/react-store`) are v9's
mechanism for sharing/persisting a slice outside the table — the table writes
through the atom via its normal setters (`table.setSorting(...)`), no
`on*Change` needed. Same shape as the "persist a slice to localStorage" pattern
in `@tanstack/react-table`'s bundled `compose-with-tanstack-store` skill; we
persist to the URL + a module `Map` instead.

## Common Mistakes

### [CRITICAL] Wiring `atoms` into `useTable` by hand instead of spreading `tableOptions`
`tableOptions` bundles `options.atoms` **and** `autoResetPageIndex: false`. The
latter matters: v9's `autoResetPageIndex` defaults to `true`, and the first
time sorting/filtering "changes" (including going from nothing to a restored
value at construction) it calls `resetPageIndex()` internally — silently
clobbering a `pageIndex` just restored from the URL/fallback. Observed in real
testing, not theoretical. Spread `...tableOptions`; don't cherry-pick. Put it
after any `initialState`, and don't also list a synced slice in `initialState`.

### [HIGH] Pagination + filtering without `usePageIndexClamp`
With `autoResetPageIndex` off, a filter/search change can strand `pageIndex`
past the last page of the shrunken row set. Any page syncing `pagination` that
also filters must call `usePageIndexClamp(table, atoms.pagination)`.

### [HIGH] Hand-rolling the schema with `.default()` or required fields
Collapses "absent from URL" and "explicitly default" into one, so every fresh
visit looks like a deep link. `createTableSearchConfig` builds every field
`.optional()` with no `.default()` — preserve that if you hand-roll.

### [MEDIUM] Calling `createTableSearchConfig` inside the component
`defaults` must be referentially stable (the atom loop keys off it). Module
scope only.

### [MEDIUM] Adding `onSortingChange`/`onPaginationChange` alongside `atoms`
Redundant — the table already writes through the atom in `options.atoms`.

### [MEDIUM] Expecting `table.reset()` to clear URL-synced slices
`table.reset()` only resets internally-owned `baseAtoms`; slices owned by
`options.atoms` are untouched. Reset a synced slice by setting the atom:
`atoms.sorting.set(myTableSearch.defaults.sorting)`.

### [LOW] `replace: true` semantics
The hook always navigates with `replace: true`, so each interaction updates the
current history entry rather than pushing a new one — otherwise rapid sorting/
paging would spam Back. Intentional.
