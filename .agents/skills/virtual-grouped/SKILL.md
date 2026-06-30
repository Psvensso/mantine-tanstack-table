---
name: virtual-grouped
description: Step-by-step guide to building a TMTable2 table that combines row grouping (dynamic group-by switch), per-row expandable detail panels, and @tanstack/react-virtual windowed rendering. Use when asked to build or explain the virtual+grouped+details pattern — e.g. files that import both TMTable2 and useVirtualizer, or whenever the three features appear together. Reference implementation: src/ExampleVirtuallyGrouped.tsx.
---

# Building a Virtual + Grouped + Details Table with TMTable2

This guide walks through every decision in
[`src/ExampleVirtuallyGrouped.tsx`](../../../src/ExampleVirtuallyGrouped.tsx) — a
5 000-row table that combines dynamic group-by switching, per-row expandable detail
panels, and `@tanstack/react-virtual` windowed rendering inside TMTable2's CSS-Grid
layout.

For TMTable2 fundamentals (sizing rules, features setup, generic grouping/pagination API)
see the [`tmtable` skill](../tmtable/SKILL.md) and `npx @tanstack/intent@latest list`.
This guide focuses exclusively on the three-way interaction between grouping, expansion,
and virtualization.

---

## 1. Height constants — decide these first

Every row height must be known **before** rendering so `useVirtualizer`'s `estimateSize`
can return the right value. Measure your design, lock the numbers into constants, then
build everything around them.

```ts
const ROW_HEIGHT = 52;            // every row, including group header rows
const DETAIL_HEADER_HEIGHT = 40;  // "Order lines" label + column header
const DETAIL_LINE_HEIGHT = 22;    // one line-item row inside the detail panel
const DETAIL_PADDING = 32;        // top + bottom padding inside the detail box

function getDetailHeight(lineCount: number) {
  return DETAIL_HEADER_HEIGHT + lineCount * DETAIL_LINE_HEIGHT + DETAIL_PADDING;
}
```

If your detail panel has a **fixed** height (like ExampleTable7's `EmployeeDetail`),
use a single `DETAIL_HEIGHT` constant and skip the function. If the height varies per
row (like here, where `lineCount` differs per order), compute it as a function of the
row's data — and call it with `row.original.lines.length` everywhere, both in
`estimateSize` and when rendering the panel.

**Critical:** the number you pass to `estimateSize` must equal the actual rendered height.
Even a 1 px mismatch accumulates over thousands of rows into visible scroll drift.

---

## 2. Detail panel component

The panel must use `gridColumn: "1 / -1"` and an **explicit `height`** that matches
`getDetailHeight`. No `auto` height — the virtualizer pre-allocates space based on
`estimateSize` and the panel must fill exactly that.

```tsx
function OrderLines({ lines, height }: { lines: OrderLine[]; height: number }) {
  return (
    <Box
      style={{
        gridColumn: "1 / -1",
        height,                        // must equal getDetailHeight(lines.length)
        backgroundColor: "var(--mantine-color-default-hover)",
        borderBottom: "1px solid var(--mantine-color-default-border)",
        padding: "8px 16px",
        boxSizing: "border-box",
        overflow: "hidden",            // clip content if constants drift — beats layout shift
      }}
    >
      {/* … render lines … */}
    </Box>
  );
}
```

`overflow: hidden` is a safety net: if a constant is slightly off the panel won't push
other rows out of position.

---

## 3. Column definitions

Two display columns come first: `select` (checkbox, fixed 48 px) and `expand` (chevron,
fixed 48 px). The chevron column renders `null` for grouped rows — group rows have
their own custom click target rendered later in step 8.

```ts
columnHelper.display({
  id: "expand",
  size: 48, minSize: 48, maxSize: 48,
  enableResizing: false,
  cell: ({ row }) =>
    !row.getIsGrouped() ? (
      <Flex justify="center" align="center" w="100%" h="100%">
        <i className={`fa-thin fa-chevron-${row.getIsExpanded() ? "up" : "down"}`}
           style={{ fontSize: 11 }} />
      </Flex>
    ) : null,
}),
```

On data columns, mark the groupable ones explicitly and add `aggregationFn` on any
column whose value should roll up into a group summary (shown in the custom group
header row):

```ts
columnHelper.accessor("status",  { enableGrouping: true, enableSorting: true, … }),
columnHelper.accessor("region",  { enableGrouping: true, enableSorting: true, … }),
columnHelper.accessor("total",   { aggregationFn: "sum", … }),
```

---

## 4. useTable configuration

```ts
const table = useTable({
  features,
  columns,
  data,
  getRowId: (row) => row.id,

  // REQUIRED: leaf rows have no sub-rows, but we still want them expandable
  // to show the detail panel. Without this, getRowCanExpand returns false for
  // every leaf row and row.getToggleExpandedHandler() is a no-op.
  getRowCanExpand: () => true,

  columnResizeMode: "onChange",
  enableGrouping: true,
  enableExpanding: true,
  enableSorting: true,
  enableRowSelection: true,
  manualPagination: true,      // virtualizer owns windowing — disable TanStack paging
  groupedColumnMode: false,    // keep columnOrder intact, don't move grouped cols to front

  initialState: {
    grouping: ["status"],
    expanded: {},              // start fully collapsed — expanded:true would open all details
    columnPinning: { left: ["select"], right: [] },
    sorting: [{ id: "date", desc: true }],
  },
});
```

`manualPagination: true` is **required when virtualizing** — without it,
`getRowModel().rows` returns only the current page instead of the full row set, and
the virtualizer gets the wrong row count.

`expanded: {}` starts everything collapsed. `expanded: true` would expand every group
*and* every leaf row (showing all detail panels at once), which is never what you want
at load time.

---

## 5. Deriving groupBy from table state

Don't store `groupBy` in React state — derive it from the table:

```ts
const groupBy = table.store.state.grouping[0] ?? "status";
const rows = table.getRowModel().rows;  // full set, post-grouping/sorting/expansion
```

`rows` is a **flat array** that already includes both group rows and the currently
expanded leaf rows interleaved — this is what `useVirtualizer.count` should use.

The group-by control resets expansion to avoid stale open groups pointing at the wrong
column's groups:

```tsx
<SegmentedControl
  value={groupBy}
  onChange={(value) => {
    table.setGrouping([value]);
    table.setExpanded({});   // collapse everything on group-by change
  }}
  data={GROUP_BY_OPTIONS}
/>
```

---

## 6. useVirtualizer — the critical part

```ts
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => scrollRef.current,

  estimateSize: (i) => {
    const row = rows[i];
    // Group rows and collapsed leaf rows are always ROW_HEIGHT.
    if (!row || row.getIsGrouped() || !row.getIsExpanded()) return ROW_HEIGHT;
    // Expanded leaf rows = row + detail panel, computed from data.
    return ROW_HEIGHT + getDetailHeight(row.original.lines.length);
  },

  // KEY TRICK: encode expand state in the cache key.
  // useVirtualizer caches sizes by key. If the key doesn't change on expand/collapse,
  // the cached height is reused and the scroll position drifts.
  getItemKey: (i) => {
    const row = rows[i];
    return row ? `${row.id}:${String(row.getIsExpanded())}` : i;
  },

  overscan: 8,
});
```

### Why `getItemKey` must include expand state

`useVirtualizer` caches `estimateSize` results per key. When a row's key is just
`row.id`, toggling expand state doesn't change the key — the virtualizer keeps using
the cached collapsed height even though the row is now taller. Rows below it shift
out of position and scroll position jumps. Appending `:true` / `:false` forces a
cache invalidation on every toggle.

---

## 7. Scroll container and padding rows

TMTable2's `Table` accepts an external `scrollContainerRef`. Pass the same ref to both
— the virtualizer reads scroll position from the same element TMTable2 scrolls.

```tsx
const scrollRef = useRef<HTMLDivElement>(null);

<TMTable2.Table table={table} loading={false} scrollContainerRef={scrollRef}>
```

Padding rows replace the `transform: translateY()` technique used by non-grid
virtualizers. In a CSS Grid every row must participate in the column tracks, so you
can't translate rows off-screen. Instead, pad the top and bottom of the rendered
window with spacer `div`s that span all columns:

```ts
const virtualItems = virtualizer.getVirtualItems();
const paddingTop    = virtualItems[0]?.start ?? 0;
const paddingBottom = virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);
```

```tsx
<TMTable2.TBody>
  {paddingTop > 0 && (
    <div aria-hidden style={{ gridColumn: "1/-1", height: paddingTop }} />
  )}
  {/* … virtual items … */}
  {paddingBottom > 0 && (
    <div aria-hidden style={{ gridColumn: "1/-1", height: paddingBottom }} />
  )}
</TMTable2.TBody>
```

---

## 8. Rendering virtual items — three cases

Map over `virtualItems`, resolve `rows[vItem.index]`, then branch on row type:

### Case A — grouped row

Render a fully custom full-width row. `vItem.size` is always `ROW_HEIGHT` for group
rows (see `estimateSize` above). Read the aggregated value directly via `row.getValue`
— no `flexRender`/`aggregatedCell` needed since this is a hand-built row.

```tsx
if (row.getIsGrouped()) {
  const totalSum = row.getValue("total") as number;
  return (
    <div
      key={vItem.key}
      role="row"
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        height: vItem.size,
        backgroundColor: "var(--mantine-color-default-hover)",
        borderBottom: "1px solid var(--mantine-color-default-border)",
        cursor: "pointer",
      }}
      onClick={row.getToggleExpandedHandler()}
    >
      <Text size="xs" c="dimmed" w={10}>{row.getIsExpanded() ? "▲" : "▼"}</Text>
      <Text fw={600} size="sm">{String(row.getValue(groupBy))}</Text>
      <Badge size="sm" variant="light" color="blue">{row.subRows.length} orders</Badge>
      <Text size="sm" c="dimmed" style={{ marginLeft: "auto" }}>
        Total: {Math.round(totalSum).toLocaleString("sv-SE", {
          style: "currency", currency: "SEK", maximumFractionDigits: 0,
        })}
      </Text>
    </div>
  );
}
```

### Case B — leaf row (collapsed or expanded)

Wrap in a `subgrid` container so the detail panel can span full width while the
`TBodyRow` above stays aligned to the column tracks. The wrapper's `height` must equal
`vItem.size` (what `estimateSize` returned for this index).

```tsx
return (
  <div
    key={vItem.key}
    style={{
      gridColumn: "1 / -1",
      display: "grid",
      gridTemplateColumns: "subgrid",   // inherit parent column tracks
      height: vItem.size,               // must match estimateSize output
      cursor: "pointer",
    }}
    onClick={row.getToggleExpandedHandler()}
  >
    <TMTable2.TBodyRow row={row} mih={`${ROW_HEIGHT}px`} />
    {row.getIsExpanded() && (
      <OrderLines
        lines={row.original.lines}
        height={getDetailHeight(row.original.lines.length)}
      />
    )}
  </div>
);
```

`gridTemplateColumns: "subgrid"` makes this wrapper inherit the parent grid's column
definitions, so `TMTable2.TBodyRow`'s cells remain aligned with the header columns.
The `OrderLines` panel uses `gridColumn: "1 / -1"` to span underneath all columns,
outside the column track constraint.

---

## 9. Complete render structure

```tsx
<TMTable2.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
  <TMTable2.Table table={table} loading={false} scrollContainerRef={scrollRef}>
    <TMTable2.THead table={table} />
    <TMTable2.TBody>

      {paddingTop > 0 && (
        <div aria-hidden style={{ gridColumn: "1/-1", height: paddingTop }} />
      )}

      {virtualItems.map((vItem) => {
        const row = rows[vItem.index];
        if (row.getIsGrouped()) { /* Case A */ }
        return /* Case B */;
      })}

      {paddingBottom > 0 && (
        <div aria-hidden style={{ gridColumn: "1/-1", height: paddingBottom }} />
      )}

    </TMTable2.TBody>
  </TMTable2.Table>
</TMTable2.RoundedCornerWrapper>
```

The outer wrapper must have `flex: 1; minHeight: 0` so it fills the available height
and lets TMTable2's internal scroll container work correctly.

---

## 10. Common mistakes

### Using `transform: translateY()` instead of padding rows

Standard virtualizers offset items with CSS transforms. This breaks CSS Grid because
each row must occupy its grid row track — translated rows punch holes in the column
alignment. Always use padding spacer divs that span `gridColumn: "1/-1"`.

### Forgetting `getRowCanExpand: () => true`

Without this, `row.getIsExpanded()` is always `false` for leaf rows (they have no
sub-rows) and the detail panel never appears. The toggle handler is also a no-op.

### Using `expanded: true` as initial state

`expanded: true` means "every expandable row is open", which includes all leaf rows
once `getRowCanExpand` returns `true` — every detail panel opens at load time. Use
`expanded: {}` to start collapsed.

### Not encoding expand state in `getItemKey`

The virtualizer caches sizes per key. A key of just `row.id` means the cached height
survives expand/collapse, causing scroll drift. Always use `${row.id}:${String(row.getIsExpanded())}`.

### Setting `height: auto` on the detail panel

`auto` height lets the panel grow beyond what `estimateSize` allocated. The rows below
it don't move (the virtualizer already positioned them), so the panel overlaps them.
Use an explicit pixel height matching `getDetailHeight(...)`.

### Missing `manualPagination: true`

`getRowModel().rows` returns only the current page when pagination is active. The
virtualizer gets the wrong count, pads incorrectly, and shows blank areas. Set
`manualPagination: true` to disable paging and get the full row set.

### Calling `table.setGrouping` without resetting `expanded`

Switching the group-by column leaves the old expand state in place. A row ID like
`"status:Delivered"` from the previous grouping may not exist in the new grouping
(`"region:North"`), but the virtualizer still accounts for it in `estimateSize`.
Always call `table.setExpanded({})` immediately after `table.setGrouping([newValue])`.
