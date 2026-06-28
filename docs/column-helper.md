# `columnHelper` vs `ColumnDef[]`

TanStack Table v9 gives you two ways to define columns. This doc explains the difference, when each is appropriate, and the specific TypeScript problem that makes `columnHelper` the right default.

---

## The short version

Use `columnHelper.columns([...])` for every table you define in application code. Use raw `ColumnDef[]` only when you are building column arrays programmatically at runtime and cannot know the full list statically.

---

## Raw `ColumnDef[]`

```ts
import type { ColumnDef } from "@tanstack/react-table";
import type { TTableFeatures } from "./table/features";

const columns: ColumnDef<TTableFeatures, Employee>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: (info) => info.getValue(), // ← getValue() returns string | number | boolean | ...
  },
  {
    accessorKey: "salary",
    header: "Salary",
    cell: (info) => info.getValue().toLocaleString(), // ← TS error: union type has no toLocaleString
  },
];
```

### What goes wrong

`ColumnDef<TFeatures, TData>` has a second type parameter `TValue` that represents the value type for each individual column. When you annotate the array as `ColumnDef<TTableFeatures, Employee>[]`, TypeScript widens `TValue` across all columns to their common supertype — effectively `Employee[keyof Employee]` or `unknown`.

Inside `cell`, `getValue()` returns that widened type. You lose:

- Per-column value narrowing (`string` for `name`, `number` for `salary`)
- Type-safe arithmetic or string operations on the value
- Autocomplete on the returned value

The array annotation also does not help TypeScript verify that `accessorKey` values are valid keys of `Employee` — it degrades to `string`.

### When it still works

Raw `ColumnDef[]` is fine when:

- Columns are built dynamically (e.g. from a server schema, a config map, user preferences).
- You do not need per-column value inference — all cell renderers receive the value as `unknown` and cast explicitly.
- You are writing a utility function that accepts an arbitrary column list.

```ts
// Generic utility — ColumnDef[] is correct here
function addSelectionColumn<T extends RowData>(
  columns: ColumnDef<TTableFeatures, T>[],
): ColumnDef<TTableFeatures, T>[] {
  return [selectionColumn, ...columns];
}
```

---

## `columnHelper`

```ts
import { createColumnHelper } from "@tanstack/react-table";
import { features } from "./table/features";

const columnHelper = createColumnHelper<typeof features, Employee>();
```

`createColumnHelper` takes both the features type and the row data type upfront. The returned helper's methods each infer `TValue` individually.

### Methods

| Method | Purpose |
|---|---|
| `columnHelper.accessor(key \| fn, opts)` | Data column — reads a value from the row |
| `columnHelper.display(opts)` | Render-only column — no data access, no filtering/sorting |
| `columnHelper.group(opts)` | Header group — spans multiple child columns |

**`accessor` with a key string**

```ts
columnHelper.accessor("salary", {
  header: "Salary",
  cell: (info) => info.getValue().toLocaleString("sv-SE"), // getValue() is number ✓
})
```

The key is constrained to `DeepKeys<Employee>`, so typos are caught at compile time. `getValue()` returns the exact type of that key (`number`).

**`accessor` with a function**

```ts
columnHelper.accessor((row) => row.firstName + " " + row.lastName, {
  id: "fullName", // required when using a function accessor
  header: "Name",
  cell: (info) => info.getValue(), // string ✓
})
```

**`display`**

```ts
columnHelper.display({
  id: "actions",
  cell: ({ row }) => <DeleteButton id={row.original.id} />,
})
```

No value type involved — `row.original` is `Employee`.

---

## The `columns()` tuple helper

Even with `columnHelper`, putting columns in a plain array literal causes the same widening problem:

```ts
// Still loses per-column TValue
const columns = [
  columnHelper.accessor("name", { ... }),
  columnHelper.accessor("salary", { ... }),
];
// inferred as: (AccessorKeyColumnDef<...> | AccessorKeyColumnDef<...>)[]
```

`columnHelper.columns([...])` wraps the list in a variadic tuple call:

```ts
const columns = columnHelper.columns([
  columnHelper.accessor("name", { ... }),   // TValue = string
  columnHelper.accessor("salary", { ... }), // TValue = number
]);
```

TypeScript preserves each element's individual type as a tuple member rather than computing a union. The inferred type is a readonly tuple — `[AccessorKeyColumnDef<..., string>, AccessorKeyColumnDef<..., number>]` — which is assignable to the `columns` option on `useTable`.

### Why this matters in practice

`cell` receives a `CellContext<TFeatures, TValue>`. With the correct `TValue`:

- `info.getValue()` is narrowed to the column's actual value type.
- Aggregated cells (`aggregatedCell`, `aggregationFn`) receive the correct type.
- Custom filter functions receive the right value type.
- No silent `unknown` casts that hide bugs.

---

## Decision guide

| Situation | Use |
|---|---|
| Static table defined in a component or module | `columnHelper.columns([...])` |
| Dynamic columns from runtime data / config | `ColumnDef<TTableFeatures, T>[]` |
| Utility that transforms/appends to an existing column list | `ColumnDef<TTableFeatures, T>[]` |
| Columns with aggregation, custom cell types | `columnHelper.columns([...])` — TValue is required for correctness |
| You need `DeepKeys` validation on `accessorKey` | `columnHelper.accessor(key, ...)` — raw `accessorKey: string` does not validate |

---

## Gotchas

**`id` is required for function accessors.**
`columnHelper.accessor((row) => row.x, { ... })` must include `id`. String-key accessors derive their id from the key automatically.

**`columns([...])` is a tuple, not a mutable array.**
Do not push to it at runtime. If you need to conditionally add a column, build the array first and then pass it to `columns()`, or use a `useMemo` that computes the full list.

```ts
const cols = useMemo(() => {
  const base = [
    columnHelper.accessor("name", { ... }),
    columnHelper.accessor("salary", { ... }),
  ] as const;

  return showStatus
    ? columnHelper.columns([...base, columnHelper.accessor("status", { ... })])
    : columnHelper.columns([...base]);
}, [showStatus]);
```

**`createColumnHelper` must know `typeof features`.**
Pass `typeof features` (the concrete `tableFeatures({...})` result), not a generic feature type. Feature-aware APIs like `aggregationFn` and `sortFn` resolve their registries from this type parameter.

```ts
// Correct
const columnHelper = createColumnHelper<typeof features, Employee>();

// Wrong — features type not propagated, aggregationFn names won't resolve
const columnHelper = createColumnHelper<Employee>();
```
