import { Badge, Flex, Loader, Rating, Select, Table, Text, TextInput } from "@mantine/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { TMTable } from "./table/TMTable";

// Only the features this table actually uses — no grouping, expanding, selection,
// filtering, pagination, visibility, ordering, or resizing.
// columnPinningFeature and columnSizingFeature are required by TMTable's grid layout.
const productFeatures = tableFeatures({
  columnSizingFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
});

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
};

const columnHelper = createColumnHelper<typeof productFeatures, Product>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    size: 48,
    minSize: 48,
    maxSize: 48,
    header: ({ table }) => <TMTable.SelectAllCheckbox table={table} size="xs" />,
    cell: ({ row }) => <TMTable.SelectRowCheckbox row={row} size="xs" />,
  }),
  columnHelper.accessor("sku", {
    header: "SKU",
    size: 100,
    minSize: 100,
    maxSize: 100,
  }),
  columnHelper.accessor("name", {
    header: "Name",
    minSize: 200,
  }),
  columnHelper.accessor("category", {
    header: "Category",
    minSize: 130,
    cell: (info) => {
      const color: Record<string, string> = {
        Electronics: "blue",
        Office: "teal",
        Accessories: "grape",
      };
      return (
        <Badge variant="light" color={color[info.getValue()] ?? "gray"}>
          {info.getValue()}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("price", {
    header: "Price (SEK)",
    minSize: 120,
    cell: (info) =>
      info.getValue().toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
  }),
  columnHelper.accessor("stock", {
    header: "Stock",
    minSize: 90,
    cell: (info) => {
      const qty = info.getValue();
      const color = qty <= 10 ? "red" : qty <= 30 ? "yellow" : "green";
      return (
        <Text size="sm" c={color} fw={qty <= 10 ? 600 : undefined}>
          {qty}
        </Text>
      );
    },
  }),
  columnHelper.accessor("rating", {
    header: "Rating",
    minSize: 150,
    cell: (info) => (
      <Flex align="center" gap={6}>
        <Rating value={info.getValue()} fractions={2} readOnly size="xs" />
        <Text size="xs" c="dimmed">
          {info.getValue().toFixed(1)}
        </Text>
      </Flex>
    ),
  }),
]);

async function fetchProducts(
  filters: Record<string, string>,
  signal: AbortSignal,
): Promise<Product[]> {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== ""),
  );
  const qs = params.size ? `?${params.toString()}` : "";
  const res = await fetch(`/api/products${qs}`, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<Product[]>;
}

const CATEGORIES = ["Electronics", "Office", "Accessories"];

export function ExampleTable4() {
  const [nameFilter, setNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Stable filters object used as the query key — only rebuilds when values change.
  // manualFiltering means TanStack Table never touches these values itself;
  // they live here and drive the server request directly.
  const filters = useMemo(
    () => ({
      ...(nameFilter ? { name: nameFilter } : {}),
      ...(categoryFilter ? { category: categoryFilter } : {}),
    }),
    [nameFilter, categoryFilter],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["products", filters],
    queryFn: ({ signal }) => fetchProducts(filters, signal),
    placeholderData: keepPreviousData,
  });

  const table = useTable({
    features: productFeatures,
    columns,
    data: data ?? [],
    getRowId: (row) => String(row.id),
    enableSorting: true,
    enableRowSelection: true,
    initialState: {
      sorting: [{ id: "name", desc: false }],
      columnPinning: { left: ["select"], right: [] },
    },
  });

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Flex justify="space-between" align="center">
        <Flex align="center" gap="sm">
          <Text fw={600} size="lg">
            Products
          </Text>
          {isFetching && !isPending && <Loader size="xs" />}
        </Flex>
        {isError && (
          <Flex align="center" gap="sm">
            <Text size="sm" c="red">
              {error.message}
            </Text>
            <Text
              size="sm"
              c="blue"
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => refetch()}
            >
              Retry
            </Text>
          </Flex>
        )}
      </Flex>

      <Flex gap="sm">
        <TextInput
          placeholder="Filter by name…"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.currentTarget.value)}
          size="sm"
          style={{ flex: 1 }}
        />
        <Select
          placeholder="All categories"
          value={categoryFilter}
          onChange={setCategoryFilter}
          data={CATEGORIES}
          size="sm"
          clearable
          w={180}
        />
      </Flex>

      <TMTable.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable.Table table={table} loading={isPending}>
          <TMTable.THead table={table} />
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => (
              <TMTable.TBodyTr key={row.id} row={row} mih="52px" />
            ))}
          </Table.Tbody>
        </TMTable.Table>
      </TMTable.RoundedCornerWrapper>
    </Flex>
  );
}
