---
name: tmtable
description: Implementation details specific to this repo's TMTable2 grid-based table component (src/table/TMTable2.tsx) — defining columns, column sizing, resizing, row grouping/aggregation, and @tanstack/react-virtual virtualization. Use whenever adding/editing a table built on TMTable2, e.g. files that import TMTable2 and createColumnHelper. For generic TanStack Table v9 API docs, use `npx @tanstack/intent@latest list` instead — this skill only covers what's specific to TMTable2's implementation.
---

# Using TMTable2

TMTable2 renders as a single CSS Grid (`role="table"` div with `display: grid`), not a
`<table>`. Reference implementation: [`src/table/TMTable2.tsx`](../../../src/table/TMTable2.tsx).
Shared feature config: [`src/table/features.tsx`](../../../src/table/features.tsx). Worked
examples: [`ExampleTable6.tsx`](../../../src/ExampleTable6.tsx) (plain), 
[`ExampleTable7.tsx`](../../../src/ExampleTable7.tsx) (20,000 rows, grouped + expandable +
virtualized).

For the general columnHelper-vs-raw-`ColumnDef[]` typing rationale, see
[`docs/column-helper.md`](../../../docs/column-helper.md). For the generic TanStack Table v9
API (grouping, aggregation, sorting, pinning, etc.) use `npx @tanstack/intent@latest list` /
`load` per [`AGENTS.md`](../../../AGENTS.md) — this skill only covers what's specific to
TMTable2's implementation, not the underlying library.

## Defining columns

```ts
import { createColumnHelper } from "@tanstack/react-table";
import { features } from "./table/features";

const columnHelper = createColumnHelper<typeof features, Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "Name", minSize: 180 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    cell: (info) => info.getValue().toLocaleString("sv-SE"),
  }),
]);
```

Always pass `typeof features` (the concrete `tableFeatures({...})` result), not a bare data
type — feature-aware APIs like `aggregationFn` resolve their registries from it.

### TMTable2's sizing rule (not in TanStack's docs — this is TMTable2's own layout logic)

From `TableComponent` in `TMTable2.tsx`:

```ts
const isFixed = col.columnDef.minSize === col.columnDef.maxSize;
const isResized = col.id in columnSizing;
return isFixed || isResized
  ? `${col.getSize()}px`
  : `minmax(${col.columnDef.minSize || 0}px, ${col.columnDef.meta?.flex ?? 1}fr)`;
```

A column is **fixed-width** in the grid only when `size === minSize === maxSize` (or the user
has dragged it to a specific size, which also pins it to `px`). Every other column is
**flexible** — `minmax(minSize, Nfr)` where `N` comes from `meta.flex` (default `1`).

- **Fixed columns** (checkboxes, icon buttons, IDs with a known width): set `size`, `minSize`,
  and `maxSize` to the *same* value.
- **Flexible columns** (text/data columns that should grow): set only `minSize`.
- **Relative weighting between flexible columns**: use `meta: { flex: N }` (declared via the
  `ColumnMeta` module augmentation in `features.tsx`). `flex: 2` takes twice the leftover space
  of `flex: 1`.
- Always set `minSize` on flexible columns — otherwise they can be squeezed to zero next to
  wider siblings.

### Reserved display columns

`select` and `expand` are conventional `id`s used across the examples — both fixed-width
(48px), `enableResizing: false`:

```ts
columnHelper.display({
  id: "select",
  size: 48,
  minSize: 48,
  maxSize: 48,
  enableResizing: false,
  header: ({ table }) => <TMTable2.SelectAllCheckbox table={table} size="xs" />,
  cell: ({ row }) => (
    // stopPropagation so clicking the checkbox doesn't also trigger a row click handler
    <div onClick={(e) => e.stopPropagation()}>
      <TMTable2.SelectRowCheckbox row={row} size="xs" />
    </div>
  ),
})
```

### Column gotchas

- `columnHelper.columns([...])` returns a readonly tuple. Don't push to it — build the array
  with `useMemo` first, then pass the full list to `columns()`.
- Function accessors require an explicit `id`. String-key accessors derive it automatically.
- Grid column order is always left-pinned → center → right-pinned
  (`getLeftLeafColumns()` + `getCenterLeafColumns()` + `getRightLeafColumns()`), matching
  `getHeaderGroups()`/`getVisibleCells()` order.

## Making columns resizable

The resize handle UI is already built into `THead` — nothing to render yourself. Resizing is
purely feature + column configuration.

**Required features:** `columnSizingFeature` and `columnResizingFeature` must both be in the
`tableFeatures()` set. They're in the shared `features` export, so any table using `features`
already has them. If you build a minimal, scoped feature set instead (see `ExampleTable4.tsx`),
include both explicitly — `columnSizingFeature` is required unconditionally by TMTable2's
layout (it reads `columnSizing` state for the fixed-vs-flex check above) even without resizing
enabled, and `columnPinningFeature` is similarly required unconditionally.

**Enable on `useTable`:**

```ts
const table = useTable({
  features,
  columns,
  data,
  columnResizeMode: "onChange", // resize updates live while dragging, not just on release
});
```

**Per-column control:** resizable by default once the features above are present; opt out
with `enableResizing: false` on fixed-width-by-convention columns (checkboxes, chevrons).
`THead` only renders the resize handle when `header.column.getCanResize()` is true.

**Interaction with the sizing rule above:** TMTable2 checks `col.id in columnSizing` in
addition to the static `minSize === maxSize` check. A flexible column that the user manually
resizes switches to a fixed `px` width for the rest of the session, because its id now appears
in `table.store.state.columnSizing`. A column with `enableResizing: false` never enters
`columnSizing`, so it stays governed by the static rule forever. `table.resetColumnSizing()`
clears the state if you need to snap back.

**Gotcha:** setting `maxSize === minSize` makes a column fixed-width *and* removes any range to
drag within, even if `enableResizing: true`. Pick one: fixed-via-equal-sizes (no resize), or
flexible-with-a-range (resizable).

## Row grouping & aggregation

TanStack's `columnGroupingFeature` (despite the name) is the *row*-grouping feature — see the
TanStack `grouping` skill via `intent` for the full generic API (`setGrouping`,
`aggregationFn`, `getGroupingValue`, etc.). What's specific to TMTable2: **grouped rows are not
data rows and TMTable2 has no built-in renderer for them** — `TMTable2.TBodyRow` only renders
normal leaf rows. You must render grouped header rows yourself as a custom full-width row:

```tsx
{row.getIsGrouped() ? (
  <div
    role="row"
    style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12 }}
    onClick={row.getToggleExpandedHandler()}
  >
    <Text>{row.getIsExpanded() ? "▲" : "▼"}</Text>
    <Text fw={600}>{String(row.getValue(groupBy))}</Text>
    <Badge>{row.subRows.length} employees</Badge>
    {/* Read the aggregated value directly via getValue — no flexRender/aggregatedCell
        needed since this is a hand-rendered row, not a TMTable2.TBodyRow */}
    <Text>
      Avg: {Math.round(row.getValue("salary") as number).toLocaleString("sv-SE", {
        style: "currency", currency: "SEK", maximumFractionDigits: 0,
      })}
    </Text>
  </div>
) : (
  <TMTable2.TBodyRow row={row} mih="48px" />
)}
```

`gridColumn: "1 / -1"` makes the group row span every column track, same as the virtualization
padding rows below.

**This repo's convention:** set `groupedColumnMode: false` on `useTable` so grouped columns
keep their declared `columnOrder`/grid position instead of jumping to the front (the TanStack
default is `'reorder'`). See `ExampleTable7.tsx`.

```ts
const table = useTable({
  features,
  columns,
  data,
  enableGrouping: true,
  groupedColumnMode: false,
  initialState: { grouping: ["department"] },
});

// switching the group-by column
table.setGrouping([value]);
table.setExpanded({}); // collapse everything on group-by change, avoids stale expand state
```

Per-column: `enableGrouping: true` on the groupable columns, `aggregationFn: "mean"` (or
`"sum"`, `"count"`, etc., or a custom fn registered in `features.tsx`'s `aggregationFns`) on
the columns to aggregate.

## Virtualizing with @tanstack/react-virtual

TMTable2 doesn't know about virtualization — it renders whatever children `TBody` is given.
Virtualization is entirely the caller's responsibility via `useVirtualizer`.

**Scroll container:** `TMTable2.Table` accepts an external `scrollContainerRef` — always pass
your own ref for a virtualized table, since the virtualizer needs to read scroll position from
the same element TMTable2 scrolls:

```tsx
const scrollRef = useRef<HTMLDivElement>(null);

<TMTable2.Table table={table} loading={false} scrollContainerRef={scrollRef}>
  ...
</TMTable2.Table>
```

**`estimateSize` must account for row type and state** — don't use one constant height if rows
can be grouped or expandable:

```ts
const ROW_HEIGHT = 48;
const DETAIL_HEIGHT = 68; // must match the actual rendered height of the detail panel

const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: (i) => {
    const row = rows[i];
    if (!row || row.getIsGrouped()) return ROW_HEIGHT;
    return row.getIsExpanded() ? ROW_HEIGHT + DETAIL_HEIGHT : ROW_HEIGHT;
  },
  getItemKey: (i) => {
    const row = rows[i];
    // Encode expand state in the key so the virtualizer's size cache is invalidated
    // on toggle — otherwise it keeps using the stale collapsed/expanded height.
    return row ? `${row.id}:${String(row.getIsExpanded())}` : i;
  },
  overscan: 8,
});
```

The `getItemKey` trick is easy to miss: `useVirtualizer` caches sizes by key. If the key is
just the row index/id, toggling expand state won't invalidate the cached height, causing
under/over-scroll near that row.

**Padding rows, not transforms:** TMTable2's body is a CSS Grid with one row per grid row — you
can't `transform: translateY()` individual virtual items, because each row needs to
participate in the grid's column tracks. Pad above/below the rendered window with spacer divs:

```tsx
const virtualItems = virtualizer.getVirtualItems();
const paddingTop = virtualItems[0]?.start ?? 0;
const paddingBottom = virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);

<TMTable2.TBody>
  {paddingTop > 0 && <div aria-hidden style={{ gridColumn: "1/-1", height: paddingTop }} />}
  {virtualItems.map((vItem) => {
    const row = rows[vItem.index];
    return <TMTable2.TBodyRow key={vItem.key} row={row} mih={`${vItem.size}px`} />;
  })}
  {paddingBottom > 0 && <div aria-hidden style={{ gridColumn: "1/-1", height: paddingBottom }} />}
</TMTable2.TBody>
```

**Subgrid technique for expandable rows:** a row can't grow to fit a detail panel underneath
without breaking the column grid — the panel needs to span full width while the row above stays
aligned to the column tracks. Wrap each row + its optional detail panel in its own subgrid
container:

```tsx
<div
  key={vItem.key}
  style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "subgrid", height: vItem.size }}
  onClick={row.getToggleExpandedHandler()}
>
  <TMTable2.TBodyRow row={row} mih={`${ROW_HEIGHT}px`} />
  {row.getIsExpanded() && <EmployeeDetail employee={row.original} />}
</div>
```

`gridTemplateColumns: "subgrid"` makes the wrapper inherit the parent grid's column tracks, so
`TMTable2.TBodyRow` still lines up with the header while the detail panel uses
`gridColumn: "1 / -1"` to span underneath. The wrapper's `height` must equal whatever
`estimateSize` returned for that index.

### Virtualization gotchas

- Pass `getRowCanExpand: () => true` to `useTable` if every leaf row (not just rows with
  sub-rows) should be individually expandable — the default only allows expansion on rows with
  children.
- Use `manualPagination: true` (or otherwise disable pagination) when virtualizing — you want
  `getRowModel()` to return the full row set since the virtualizer does the windowing.
- Keep `overscan` reasonable (the example uses 8) — too high defeats virtualization at 10k+
  rows, too low causes visible blank flashes on fast scroll.
