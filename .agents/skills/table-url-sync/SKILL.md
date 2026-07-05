---
name: table-url-sync
description: How to sync TanStack Table v9 state (sorting, pagination, or any
  other state slice) to the URL via TanStack Router search params, using the
  generic `useTableUrlState` hook (src/hooks/useTableUrlState.ts) built on v9's
  external-atoms mechanism (options.atoms + useCreateAtom, not state+onXChange).
  State not present in the URL falls back to a locally-scoped variable that
  survives client-side navigation, then to defaults. Use whenever a table page
  needs shareable/bookmarkable/back-forward-safe URL state, or state that
  should be preserved as a user navigates around the app without a backend.
  Reference implementation: src/routes-url-sync/ (the /table-url-sync demo).
---

# Syncing TanStack Table v9 state to the URL

## Prerequisites

This repo's main app (`/`, `?tab=`) is a hand-rolled tab switcher in
`src/App.tsx` — it does not use TanStack Router. The URL-sync pattern lives in
its own small, separate TanStack Router instance, mounted only under
`/table-url-sync/*` (see `src/main.tsx`'s pathname branch and
`src/routes-url-sync/router.tsx`, a code-based route tree — no file-based
route generation). If you're adding a new page that needs this pattern, either
add a route to that router or set up an equivalent isolated router instance;
don't try to retrofit the main app's tab switcher with search-param state.

## The hook's contract

```ts
const urlAtoms = useTableUrlState({
  scope: "table-url-sync/employees", // namespaces the local fallback store
  search: route.useSearch(),         // fields are `undefined` when absent from the URL
  navigate: route.useNavigate(),
  defaults: { sorting: [...], pagination: { pageIndex: 0, pageSize: 10 } },
});

const table = useTable({
  features, columns, data,
  atoms: { sorting: urlAtoms.sorting, pagination: urlAtoms.pagination },
});
```

**The keys of `defaults` are the selector.** Whichever table-state slice names
you list there — `sorting`, `pagination`, `grouping`, `columnFilters`,
whatever — are the ones that get synced. The hook returns one atom per key,
typed to match `defaults`, ready to drop straight into `useTable({ atoms })`.

Resolution order per key, computed once to seed each atom on mount:
1. The URL (`search[key]`), if present.
2. The local fallback store, if an entry exists for `${scope}:${key}`.
3. `defaults[key]`.

After mount: interacting with the table writes through the atom → the hook
mirrors that into both the fallback store and the URL (debounced, `replace:
true`). Browser back/forward or a pasted URL flows the other way: a `search`
change gets applied back onto the atoms.

## Adding a new synced slice to an existing page

Extend the zod schema (`src/routes-url-sync/searchSchema.ts` for the existing
example) with a new **optional** field, add it to the `defaults` object, and
add the key to the `atoms` record passed to `useTable`. Nothing else changes —
the hook picks up the new key automatically from `Object.keys(defaults)`.

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

## The fallback store's lifetime

`src/hooks/tableUrlStateFallback.ts` is a plain module-level `Map`. It lives
for as long as the JS module stays loaded: surviving client-side route
transitions (real `Link` navigations within the same router), but wiped by a
full page reload or a plain `<a>` navigation. This is intentional — it's what
lets "navigate away and back with no URL params" restore the previous state,
while a hard reload correctly falls through to defaults (or to the URL, if the
URL still has params).

## Common Mistakes

### [CRITICAL] `autoResetPageIndex` clobbering a restored/deep-linked `pageIndex`

Wrong:

```ts
const table = useTable({
  features, columns, data,
  atoms: { sorting: urlAtoms.sorting, pagination: urlAtoms.pagination },
  // missing autoResetPageIndex: false
});
```

TanStack Table v9's `autoResetPageIndex` defaults to `true` client-side. The
very first time sorting/filtering "changes" (which includes going from
nothing to a freshly-restored value at construction), it calls
`resetPageIndex()` internally — silently resetting `pageIndex` back to 0 and
overwriting whatever you just restored from the URL or the local fallback.
This is a real, observed bug during manual testing of this feature, not a
theoretical one.

Correct:

```ts
const table = useTable({
  features, columns, data,
  autoResetPageIndex: false,
  atoms: { sorting: urlAtoms.sorting, pagination: urlAtoms.pagination },
});
```

Only safe to disable like this when you don't also have filtering that could
shrink the row count out from under the current page — if you add filtering
to a page using this pattern, either keep `autoResetPageIndex` enabled and
accept that a deep-linked page can be reset on first filter interaction, or
clamp `pageIndex` manually (see the pagination skill's guidance).

### [HIGH] Unstable `defaults` reference

`useTableUrlState` calls one `useCreateAtom` per key of `defaults`, in a
`for` loop. This is safe ONLY if `defaults` has the same keys, in the same
order, on every render for a given call site — i.e. `defaults` must be a
module-level constant (or otherwise referentially stable). An inline object
literal recreated each render would still have the same keys in practice, but
don't rely on that — define it once, outside the component.

### [HIGH] Non-optional or `.default()`-ed zod fields

```ts
// Wrong — collapses "absent from URL" and "explicitly default" into one value
sorting: z.array(sortingItemSchema).default([]),
```

If a field always resolves to a value (via `.default()`) or is required, the
hook can no longer tell "not in the URL, check the fallback" apart from
"explicitly set to this value in the URL" — every fresh visit would look
identical to an explicit deep link. Keep every synced field `.optional()`
with no `.default()`.

### [MEDIUM] Adding `onSortingChange`/`onPaginationChange` alongside `atoms`

Redundant and confusing — the table already writes through the atom you
passed via `options.atoms`. An `on*Change` handler here does nothing useful.

### [MEDIUM] Using a real `<a>` instead of a router `Link` between synced pages

`RootLayout.tsx` uses TanStack `Link` for `/` ↔ `/elsewhere` navigation (real
client-side transitions, so the fallback `Map` survives), but a plain `<a>`
for "← Back to examples" (a genuine full navigation out of this router
entirely, which correctly wipes the fallback). Swapping these — e.g. using a
real anchor between the two in-demo pages — forces a full reload and defeats
the "state preserved when navigating without URL params" behavior.

### [MEDIUM] Expecting `table.reset()` to clear URL-synced slices

`table.reset()` only resets internally-owned `baseAtoms`; slices owned by
`options.atoms` are untouched. To reset a synced slice, set the atom directly:
`urlAtoms.sorting.set(defaults.sorting)`.

### [LOW] Forgetting `replace: true` semantics matter here

The hook always calls `navigate({ replace: true, ... })` — every sort/page
interaction updates the current history entry rather than pushing a new one.
This is intentional: without it, rapidly clicking through several sorts or
pages would spam browser history, and the Back button would step through each
intermediate state instead of leaving the page entirely.
