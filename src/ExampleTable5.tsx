import { Badge, Flex, SegmentedControl, Table, Text } from "@mantine/core";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { features } from "./table/features";
import { TMTable } from "./table/TMTable";

type Sale = {
  id: number;
  product: "Widget Pro" | "Connector Kit" | "Mount Bracket" | "LED Panel";
  region: "North" | "South" | "East" | "West";
  salesperson: "Alice Berg" | "Bob Ek" | "Carol Strand" | "Dave Lund" | "Eva Sjö";
  quarter: "Q1 2026" | "Q2 2026";
  amount: number;
  units: number;
};

const columnHelper = createColumnHelper<typeof features, Sale>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    size: 48,
    minSize: 48,
    maxSize: 48,
    header: ({ table }) => <TMTable.SelectAllCheckbox table={table} size="xs" />,
    cell: ({ row }) => <TMTable.SelectRowCheckbox row={row} size="xs" />,
  }),
  columnHelper.accessor("product", {
    header: "Product",
    minSize: 160,
    enableGrouping: true,
  }),
  columnHelper.accessor("region", {
    header: "Region",
    minSize: 120,
    enableGrouping: true,
    cell: (info) => {
      const color: Record<string, string> = {
        North: "blue",
        South: "orange",
        East: "teal",
        West: "grape",
      };
      return (
        <Badge variant="light" color={color[info.getValue()] ?? "gray"} size="sm">
          {info.getValue()}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("salesperson", {
    header: "Salesperson",
    minSize: 150,
    enableGrouping: true,
  }),
  columnHelper.accessor("quarter", {
    header: "Quarter",
    minSize: 110,
    enableGrouping: true,
    cell: (info) => (
      <Badge variant="outline" color="violet" size="sm">
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("amount", {
    header: "Amount (SEK)",
    minSize: 140,
    aggregationFn: "sum",
    cell: (info) =>
      info.getValue().toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
  }),
  columnHelper.accessor("units", {
    header: "Units",
    minSize: 90,
    aggregationFn: "sum",
  }),
]);

const DATA: Sale[] = [
  { id: 1,  product: "Widget Pro",    region: "North", salesperson: "Alice Berg",   quarter: "Q1 2026", amount: 18500, units: 2  },
  { id: 2,  product: "Connector Kit", region: "North", salesperson: "Bob Ek",       quarter: "Q1 2026", amount: 4200,  units: 12 },
  { id: 3,  product: "Mount Bracket", region: "South", salesperson: "Carol Strand", quarter: "Q1 2026", amount: 6600,  units: 6  },
  { id: 4,  product: "LED Panel",     region: "East",  salesperson: "Dave Lund",    quarter: "Q1 2026", amount: 5100,  units: 8  },
  { id: 5,  product: "Widget Pro",    region: "West",  salesperson: "Eva Sjö",      quarter: "Q1 2026", amount: 22000, units: 3  },
  { id: 6,  product: "Connector Kit", region: "South", salesperson: "Alice Berg",   quarter: "Q1 2026", amount: 3800,  units: 10 },
  { id: 7,  product: "Mount Bracket", region: "East",  salesperson: "Bob Ek",       quarter: "Q1 2026", amount: 7200,  units: 8  },
  { id: 8,  product: "LED Panel",     region: "North", salesperson: "Carol Strand", quarter: "Q1 2026", amount: 3900,  units: 6  },
  { id: 9,  product: "Widget Pro",    region: "East",  salesperson: "Dave Lund",    quarter: "Q1 2026", amount: 15500, units: 2  },
  { id: 10, product: "Connector Kit", region: "West",  salesperson: "Eva Sjö",      quarter: "Q1 2026", amount: 5600,  units: 16 },
  { id: 11, product: "Mount Bracket", region: "North", salesperson: "Alice Berg",   quarter: "Q1 2026", amount: 5400,  units: 5  },
  { id: 12, product: "LED Panel",     region: "West",  salesperson: "Bob Ek",       quarter: "Q1 2026", amount: 4700,  units: 9  },
  { id: 13, product: "Widget Pro",    region: "South", salesperson: "Carol Strand", quarter: "Q2 2026", amount: 19800, units: 3  },
  { id: 14, product: "Connector Kit", region: "North", salesperson: "Dave Lund",    quarter: "Q2 2026", amount: 4900,  units: 14 },
  { id: 15, product: "Mount Bracket", region: "West",  salesperson: "Eva Sjö",      quarter: "Q2 2026", amount: 8100,  units: 9  },
  { id: 16, product: "LED Panel",     region: "South", salesperson: "Alice Berg",   quarter: "Q2 2026", amount: 6200,  units: 11 },
  { id: 17, product: "Widget Pro",    region: "North", salesperson: "Bob Ek",       quarter: "Q2 2026", amount: 21000, units: 3  },
  { id: 18, product: "Connector Kit", region: "East",  salesperson: "Carol Strand", quarter: "Q2 2026", amount: 3500,  units: 9  },
  { id: 19, product: "Mount Bracket", region: "South", salesperson: "Dave Lund",    quarter: "Q2 2026", amount: 6800,  units: 7  },
  { id: 20, product: "LED Panel",     region: "West",  salesperson: "Eva Sjö",      quarter: "Q2 2026", amount: 5300,  units: 10 },
  { id: 21, product: "Widget Pro",    region: "East",  salesperson: "Alice Berg",   quarter: "Q2 2026", amount: 16500, units: 2  },
  { id: 22, product: "Connector Kit", region: "West",  salesperson: "Bob Ek",       quarter: "Q2 2026", amount: 4100,  units: 11 },
  { id: 23, product: "Mount Bracket", region: "North", salesperson: "Carol Strand", quarter: "Q2 2026", amount: 5900,  units: 6  },
  { id: 24, product: "LED Panel",     region: "East",  salesperson: "Dave Lund",    quarter: "Q2 2026", amount: 4400,  units: 7  },
  { id: 25, product: "Widget Pro",    region: "South", salesperson: "Eva Sjö",      quarter: "Q1 2026", amount: 17200, units: 2  },
  { id: 26, product: "Connector Kit", region: "East",  salesperson: "Alice Berg",   quarter: "Q1 2026", amount: 3200,  units: 8  },
  { id: 27, product: "Mount Bracket", region: "West",  salesperson: "Bob Ek",       quarter: "Q1 2026", amount: 7500,  units: 8  },
  { id: 28, product: "LED Panel",     region: "North", salesperson: "Carol Strand", quarter: "Q1 2026", amount: 4100,  units: 7  },
  { id: 29, product: "Widget Pro",    region: "West",  salesperson: "Dave Lund",    quarter: "Q2 2026", amount: 23500, units: 3  },
  { id: 30, product: "Connector Kit", region: "South", salesperson: "Eva Sjö",      quarter: "Q2 2026", amount: 4600,  units: 13 },
];

const GROUP_BY_OPTIONS = [
  { value: "region",      label: "Region"      },
  { value: "quarter",     label: "Quarter"     },
  { value: "salesperson", label: "Salesperson" },
  { value: "product",     label: "Product"     },
];

export function ExampleTable5() {
  const data = useMemo(() => DATA, []);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.id),
    initialState: {
      grouping: ["region"],
      expanded: true,
      columnPinning: { left: ["select"], right: [] },
      sorting: [{ id: "amount", desc: true }],
    },
    enableGrouping: true,
    enableExpanding: true,
    enableSorting: true,
    enableRowSelection: true,
    manualPagination: true,
    groupedColumnMode: false,
  });

  // Read groupBy from TanStack's own state so the control stays in sync
  // without needing a separate React useState.
  const groupBy = table.store.state.grouping[0] ?? "region";

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text fw={600} size="lg">
          Sales
        </Text>
        <Flex align="center" gap="xs">
          <Text size="sm" c="dimmed">
            Group by
          </Text>
          <SegmentedControl
            value={groupBy}
            onChange={(value) => {
              table.setGrouping([value]);
              table.setExpanded(true);
            }}
            data={GROUP_BY_OPTIONS}
            size="xs"
          />
        </Flex>
      </Flex>

      <TMTable.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable.Table table={table} loading={false}>
          <TMTable.THead table={table} />
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                const totalAmount = row.getValue("amount") as number;
                const totalUnits = row.getValue("units") as number;
                return (
                  <Table.Tr
                    key={row.id}
                    onClick={row.getToggleExpandedHandler()}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 16px",
                        backgroundColor: "var(--mantine-color-default-hover)",
                        borderBottom:
                          "1px solid var(--mantine-color-default-border)",
                      }}
                    >
                      <Text size="xs" c="dimmed" w={10}>
                        {row.getIsExpanded() ? "▲" : "▼"}
                      </Text>
                      <Text fw={600} size="sm">
                        {String(row.getValue(groupBy))}
                      </Text>
                      <Badge size="sm" variant="light" color="blue">
                        {row.subRows.length} records
                      </Badge>
                      <Text size="sm" c="dimmed" style={{ marginLeft: "auto" }}>
                        {Math.round(totalUnits)} units ·{" "}
                        {Math.round(totalAmount).toLocaleString("sv-SE", {
                          style: "currency",
                          currency: "SEK",
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              }
              return <TMTable.TBodyTr key={row.id} row={row} mih="52px" />;
            })}
          </Table.Tbody>
        </TMTable.Table>
      </TMTable.RoundedCornerWrapper>
    </Flex>
  );
}
