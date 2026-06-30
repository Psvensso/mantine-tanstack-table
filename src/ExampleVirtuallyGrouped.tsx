import { Badge, Box, Flex, SegmentedControl, Stack, Text } from "@mantine/core";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { features } from "./table/features";
import { TMTable2 } from "./table/TMTable2";

type OrderLine = {
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
};

type Order = {
  id: string;
  customer: string;
  date: string;
  region: "North" | "South" | "East" | "West";
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  total: number;
  lines: OrderLine[];
};

const CUSTOMERS = [
  "Acme AB", "Berg & Co", "Carlsson Bygg", "Dahlgren Handel", "Eriksson Fastighet",
  "Forsberg Teknik", "Gustafsson & Son", "Hedlund Lager", "Ivarsson Industri", "Jonsson Logistik",
  "Karlqvist Bygg", "Lindholm Maskin", "Moberg Elektro", "Nyström Verkstad", "Olofsson Handel",
];

const STATUSES: Order["status"][] = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
const REGIONS: Order["region"][] = ["North", "South", "East", "West"];

const SKUS: [string, string, number][] = [
  ["SKU-A1", "Widget Pro 500", 2500],
  ["SKU-B2", "Connector Kit", 250],
  ["SKU-C3", "Mount Bracket XL", 1100],
  ["SKU-D4", "Steel Panel 2m", 1800],
  ["SKU-E5", "Bolt Set M12", 40],
  ["SKU-F6", "Sealing Strip 5m", 350],
  ["SKU-G7", "LED Panel 60W", 1100],
  ["SKU-H8", "HVAC Unit 12kW", 22000],
];

function generateOrders(count: number): Order[] {
  return Array.from({ length: count }, (_, i) => {
    const lineCount = 1 + (i % 4);
    const lines: OrderLine[] = Array.from({ length: lineCount }, (_, j) => {
      const [sku, description, unitPrice] = SKUS[(i * 3 + j * 5) % SKUS.length];
      const qty = 1 + ((i + j * 7) % 12);
      return { sku, description, qty, unitPrice };
    });
    const total = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    return {
      id: `ORD-${1000 + i}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      date: new Date(2026, 0, 1 + (i % 180)).toISOString().slice(0, 10),
      region: REGIONS[(i * 2 + 1) % REGIONS.length],
      status: STATUSES[i % STATUSES.length],
      total,
      lines,
    };
  });
}

const ROW_HEIGHT = 52;
const DETAIL_HEADER_HEIGHT = 40;
const DETAIL_LINE_HEIGHT = 22;
const DETAIL_PADDING = 32;

// Detail height depends on how many order lines this specific order has —
// unlike a fixed DETAIL_HEIGHT, estimateSize must compute this per row.
function getDetailHeight(lineCount: number) {
  return DETAIL_HEADER_HEIGHT + lineCount * DETAIL_LINE_HEIGHT + DETAIL_PADDING;
}

function OrderLines({ lines, height }: { lines: OrderLine[]; height: number }) {
  return (
    <Box
      style={{
        gridColumn: "1 / -1",
        height,
        backgroundColor: "var(--mantine-color-default-hover)",
        borderBottom: "1px solid var(--mantine-color-default-border)",
        padding: "8px 16px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Text fw={600} size="xs" mb={4}>
        Order lines
      </Text>
      <Stack gap={2}>
        {lines.map((line) => (
          <Flex key={line.sku} gap="md">
            <Text size="xs" c="dimmed" w={80}>
              {line.sku}
            </Text>
            <Text size="xs" style={{ flex: 1 }}>
              {line.description}
            </Text>
            <Text size="xs" w={40} ta="right">
              ×{line.qty}
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

const columnHelper = createColumnHelper<typeof features, Order>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    size: 48,
    minSize: 48,
    maxSize: 48,
    enableResizing: false,
    header: ({ table }) => <TMTable2.SelectAllCheckbox table={table} size="xs" />,
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <TMTable2.SelectRowCheckbox row={row} size="xs" />
      </div>
    ),
  }),
  columnHelper.display({
    id: "expand",
    size: 48,
    minSize: 48,
    maxSize: 48,
    enableResizing: false,
    // Visual-only chevron — clicking anywhere on the row toggles details.
    cell: ({ row }) =>
      !row.getIsGrouped() ? (
        <Flex justify="center" align="center" w="100%" h="100%">
          <i
            className={`fa-thin fa-chevron-${row.getIsExpanded() ? "up" : "down"}`}
            style={{ fontSize: 11 }}
          />
        </Flex>
      ) : null,
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
    enableSorting: true,
  }),
  columnHelper.accessor("date", {
    header: "Date",
    minSize: 110,
    enableSorting: true,
  }),
  columnHelper.accessor("region", {
    header: "Region",
    minSize: 100,
    enableGrouping: true,
    enableSorting: true,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 120,
    enableGrouping: true,
    enableSorting: true,
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
    minSize: 110,
    enableSorting: true,
    aggregationFn: "sum",
    cell: (info) =>
      info.getValue().toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
  }),
]);

const GROUP_BY_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "region", label: "Region" },
];

export function ExampleVirtuallyGrouped() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const data = useMemo(() => generateOrders(5000), []);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    // Both group rows (to show children) and leaf rows (to show the detail
    // panel) need to expand — the default only allows rows with sub-rows.
    getRowCanExpand: () => true,
    columnResizeMode: "onChange",
    enableGrouping: true,
    enableExpanding: true,
    enableSorting: true,
    enableRowSelection: true,
    manualPagination: true,
    groupedColumnMode: false,
    initialState: {
      grouping: ["status"],
      expanded: {},
      columnPinning: { left: ["select"], right: [] },
      sorting: [{ id: "date", desc: true }],
    },
  });

  const groupBy = table.store.state.grouping[0] ?? "status";
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => {
      const row = rows[i];
      if (!row || row.getIsGrouped() || !row.getIsExpanded()) return ROW_HEIGHT;
      return ROW_HEIGHT + getDetailHeight(row.original.lines.length);
    },
    // Encode expand state in the key so the virtualizer's size cache is
    // invalidated on toggle (otherwise it keeps using the stale height).
    getItemKey: (i) => {
      const row = rows[i];
      return row ? `${row.id}:${String(row.getIsExpanded())}` : i;
    },
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom = virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text fw={600} size="lg">
          Orders{" "}
          <Text component="span" size="sm" c="dimmed" fw={400}>
            — 5 000 rows · virtual + grouped + details toggle
          </Text>
        </Text>
        <Flex align="center" gap="xs">
          <Text size="sm" c="dimmed">
            Group by
          </Text>
          <SegmentedControl
            value={groupBy}
            onChange={(value) => {
              table.setGrouping([value]);
              table.setExpanded({});
            }}
            data={GROUP_BY_OPTIONS}
            size="xs"
          />
        </Flex>
      </Flex>

      <TMTable2.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable2.Table table={table} loading={false} scrollContainerRef={scrollRef}>
          <TMTable2.THead table={table} />
          <TMTable2.TBody>
            {paddingTop > 0 && (
              <div aria-hidden style={{ gridColumn: "1/-1", height: paddingTop }} />
            )}

            {virtualItems.map((vItem) => {
              const row = rows[vItem.index];

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
                    <Text size="xs" c="dimmed" w={10}>
                      {row.getIsExpanded() ? "▲" : "▼"}
                    </Text>
                    <Text fw={600} size="sm">
                      {String(row.getValue(groupBy))}
                    </Text>
                    <Badge size="sm" variant="light" color="blue">
                      {row.subRows.length} orders
                    </Badge>
                    <Text size="sm" c="dimmed" style={{ marginLeft: "auto" }}>
                      Total:{" "}
                      {Math.round(totalSum).toLocaleString("sv-SE", {
                        style: "currency",
                        currency: "SEK",
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </div>
                );
              }

              return (
                // Row + detail panel share a subgrid so the panel can span
                // full width while the row above stays aligned to columns.
                <div
                  key={vItem.key}
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "subgrid",
                    height: vItem.size,
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
            })}

            {paddingBottom > 0 && (
              <div aria-hidden style={{ gridColumn: "1/-1", height: paddingBottom }} />
            )}
          </TMTable2.TBody>
        </TMTable2.Table>
      </TMTable2.RoundedCornerWrapper>
    </Flex>
  );
}
