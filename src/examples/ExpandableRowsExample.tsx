import {
  Badge,
  Box,
  Button,
  Flex,
  Group,
  MultiSelect,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { getRouteApi } from "@tanstack/react-router";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import type { ExpandedState } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { Fragment, useMemo } from "react";
import { z } from "zod";
import {
  createTableSearchConfig,
  useTableUrlSync,
  type CustomSlice,
} from "../table/url-sync";
import { features } from "../table/features";
import { TMTable } from "../table/TMTable";

type OrderLine = {
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
};

const ORDER_STATUSES = [
  "Pending",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
] as const;

type Order = {
  id: string;
  customer: string;
  date: string;
  total: number;
  status: (typeof ORDER_STATUSES)[number];
  lines: OrderLine[];
};

const columnHelper = createColumnHelper<typeof features, Order>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    size: 48,
    minSize: 48,
    maxSize: 48,
    header: ({ table }) => <TMTable.SelectAllCheckbox table={table} size="xs" />,
    cell: ({ row }) => <TMTable.SelectRowCheckbox row={row} size="xs" />,
  }),
  columnHelper.display({
    id: "expand",
    size: 48,
    minSize: 48,
    maxSize: 48,
    cell: ({ row }) => (
      <Flex
        justify="center"
        align="center"
        w="100%"
        style={{ cursor: "pointer" }}
        onClick={row.getToggleExpandedHandler()}
      >
        <Text size="xs" c="dimmed">
          {row.getIsExpanded() ? "▲" : "▼"}
        </Text>
      </Flex>
    ),
  }),
  columnHelper.accessor("id", {
    header: "Order",
    size: 100,
    minSize: 100,
    maxSize: 100,
  }),
  columnHelper.accessor("customer", {
    header: "Customer",
    minSize: 180,
  }),
  columnHelper.accessor("date", {
    header: "Date",
    minSize: 110,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 120,
    cell: (info) => {
      const value = info.getValue();
      const color: Record<Order["status"], string> = {
        Pending: "yellow",
        Processing: "blue",
        Shipped: "cyan",
        Delivered: "green",
        Cancelled: "red",
      };
      return <Badge color={color[value]}>{value}</Badge>;
    },
  }),
  columnHelper.accessor("total", {
    header: "Total",
    minSize: 100,
    cell: (info) =>
      info.getValue().toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
  }),
]);

const DATA: Order[] = [
  {
    id: "ORD-1001",
    customer: "Acme AB",
    date: "2026-06-01",
    total: 14250,
    status: "Delivered",
    lines: [
      { sku: "SKU-A1", description: "Widget Pro 500", qty: 3, unitPrice: 2500 },
      { sku: "SKU-B2", description: "Connector Kit", qty: 15, unitPrice: 250 },
    ],
  },
  {
    id: "ORD-1002",
    customer: "Berg & Co",
    date: "2026-06-03",
    total: 8800,
    status: "Shipped",
    lines: [
      {
        sku: "SKU-C3",
        description: "Mount Bracket XL",
        qty: 8,
        unitPrice: 1100,
      },
    ],
  },
  {
    id: "ORD-1003",
    customer: "Carlsson Bygg",
    date: "2026-06-05",
    total: 33600,
    status: "Processing",
    lines: [
      {
        sku: "SKU-D4",
        description: "Steel Panel 2m",
        qty: 12,
        unitPrice: 1800,
      },
      { sku: "SKU-E5", description: "Bolt Set M12", qty: 120, unitPrice: 40 },
      {
        sku: "SKU-F6",
        description: "Sealing Strip 5m",
        qty: 24,
        unitPrice: 350,
      },
    ],
  },
  {
    id: "ORD-1004",
    customer: "Dahlgren Handel",
    date: "2026-06-07",
    total: 5500,
    status: "Pending",
    lines: [
      { sku: "SKU-G7", description: "LED Panel 60W", qty: 5, unitPrice: 1100 },
    ],
  },
  {
    id: "ORD-1005",
    customer: "Eriksson Fastighet",
    date: "2026-06-08",
    total: 0,
    status: "Cancelled",
    lines: [
      {
        sku: "SKU-H8",
        description: "HVAC Unit 12kW",
        qty: 1,
        unitPrice: 22000,
      },
    ],
  },
  {
    id: "ORD-1006",
    customer: "Forsberg Teknik",
    date: "2026-06-10",
    total: 19200,
    status: "Delivered",
    lines: [
      {
        sku: "SKU-I9",
        description: "PCB Assembly v3",
        qty: 16,
        unitPrice: 1200,
      },
    ],
  },
  {
    id: "ORD-1007",
    customer: "Gustafsson & Son",
    date: "2026-06-11",
    total: 7350,
    status: "Shipped",
    lines: [
      {
        sku: "SKU-J10",
        description: "Safety Harness",
        qty: 7,
        unitPrice: 1050,
      },
    ],
  },
  {
    id: "ORD-1008",
    customer: "Hedlund Lager",
    date: "2026-06-12",
    total: 26400,
    status: "Processing",
    lines: [
      {
        sku: "SKU-K11",
        description: "Pallet Rack 4m",
        qty: 4,
        unitPrice: 6600,
      },
    ],
  },
];

function OrderLines({ lines }: { lines: OrderLine[] }) {
  return (
    <Box
      p="md"
      style={{ backgroundColor: "var(--mantine-color-default-hover)" }}
    >
      <Text fw={600} size="sm" mb="xs">
        Order lines
      </Text>
      <Stack gap={4}>
        <Flex
          gap="md"
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
            paddingBottom: 4,
          }}
        >
          <Text size="xs" fw={600} w={100}>
            SKU
          </Text>
          <Text size="xs" fw={600} style={{ flex: 1 }}>
            Description
          </Text>
          <Text size="xs" fw={600} w={50} ta="right">
            Qty
          </Text>
          <Text size="xs" fw={600} w={90} ta="right">
            Unit price
          </Text>
          <Text size="xs" fw={600} w={90} ta="right">
            Line total
          </Text>
        </Flex>
        {lines.map((line) => (
          <Flex key={line.sku} gap="md">
            <Text size="xs" c="dimmed" w={100}>
              {line.sku}
            </Text>
            <Text size="xs" style={{ flex: 1 }}>
              {line.description}
            </Text>
            <Text size="xs" w={50} ta="right">
              {line.qty}
            </Text>
            <Text size="xs" w={90} ta="right">
              {line.unitPrice.toLocaleString("sv-SE", {
                style: "currency",
                currency: "SEK",
                maximumFractionDigits: 0,
              })}
            </Text>
            <Text size="xs" w={90} ta="right">
              {(line.qty * line.unitPrice).toLocaleString("sv-SE", {
                style: "currency",
                currency: "SEK",
                maximumFractionDigits: 0,
              })}
            </Text>
          </Flex>
        ))}
      </Stack>
    </Box>
  );
}

// Two array-valued custom slices — they demonstrate that array/tuple values
// round-trip through the sync kit like any other slice. No serialization
// concerns here: the router's blob codec JSON-round-trips whatever the schema
// accepts.

// MultiSelect value: a list of statuses.
const statusSlice: CustomSlice<string[]> = {
  schema: z.array(z.string()),
  defaultValue: [],
};

// Date-range picker value: a `[from, to]` tuple of ISO date strings (either
// side null = open bound). Strings, not Date objects — the URL blob is JSON.
type DateRange = [string | null, string | null];
const dateRangeSlice: CustomSlice<DateRange> = {
  schema: z.tuple([z.string().nullable(), z.string().nullable()]),
  defaultValue: [null, null],
};

// Expanded state is keyed by row id (the order id), so a shared URL opens the
// same order lines. `status` and `dateRange` are non-table state synced through
// the same machinery (see the two slices above).
export const expandableRowsSearch = createTableSearchConfig({
  defaults: {
    sorting: [{ id: "date", desc: true }],
    expanded: {} as ExpandedState,
  },
  custom: {
    status: statusSlice,
    dateRange: dateRangeSlice,
  },
});

const routeApi = getRouteApi("/expandable-rows");

export function ExpandableRowsExample() {
  const { atoms, tableOptions } = useTableUrlSync({
    route: routeApi,
    scope: "examples/expandable-rows",
    defaults: expandableRowsSearch.defaults,
  });
  const status = useSelector(atoms.status);
  const dateRange = useSelector(atoms.dateRange);

  // The array-valued URL state drives the visible rows. ISO date strings sort
  // and compare lexicographically, so string comparison is a valid date range.
  const data = useMemo(() => {
    const [from, to] = dateRange;
    return DATA.filter((order) => {
      if (status.length > 0 && !status.includes(order.status)) return false;
      if (from && order.date < from) return false;
      if (to && order.date > to) return false;
      return true;
    });
  }, [status, dateRange]);

  const hasFilters = status.length > 0 || dateRange[0] !== null || dateRange[1] !== null;

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    getRowCanExpand: () => true,
    initialState: {
      columnPinning: { left: ["select"], right: [] },
    },
    enableExpanding: true,
    enableSorting: true,
    enableRowSelection: true,
    ...tableOptions,
  });

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text fw={600} size="lg">
          Orders
        </Text>
        <Group gap="sm" align="flex-end">
          <MultiSelect
            label="Status"
            placeholder={status.length === 0 ? "All statuses" : undefined}
            data={ORDER_STATUSES as unknown as string[]}
            value={status}
            onChange={(value) => atoms.status.set(value)}
            size="xs"
            clearable
            w={240}
          />
          <DatePickerInput
            type="range"
            label="Order date"
            placeholder="Any date"
            value={dateRange}
            onChange={(value) => atoms.dateRange.set(value as DateRange)}
            size="xs"
            clearable
            miw={220}
          />
          {hasFilters && (
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                atoms.status.set([]);
                atoms.dateRange.set([null, null]);
              }}
            >
              Clear
            </Button>
          )}
        </Group>
      </Flex>

      <Text size="xs" c="dimmed">
        {data.length} of {DATA.length} orders
      </Text>

      <TMTable.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable.Table table={table} loading={false}>
          <TMTable.THead table={table} />
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TMTable.TBodyTr row={row} mih="52px" />
                <TMTable.ExpandedTBodyTr row={row}>
                  <OrderLines lines={row.original.lines} />
                </TMTable.ExpandedTBodyTr>
              </Fragment>
            ))}
          </Table.Tbody>
        </TMTable.Table>
      </TMTable.RoundedCornerWrapper>
    </Flex>
  );
}
