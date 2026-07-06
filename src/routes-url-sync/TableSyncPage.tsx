import {
  Badge,
  Button,
  Drawer,
  Flex,
  Group,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { getRouteApi } from "@tanstack/react-router";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { features } from "../table/features";
import { TMTable } from "../table/TMTable";
import { TMTableFilters } from "../table/columnFilters";
import { useTableUrlSync, usePageIndexClamp } from "../table/url-sync";
import { getFallback } from "../url-state";
import { employeesSearch } from "./searchSchema";

type Employee = {
  id: string;
  name: string;
  department: "Engineering" | "Sales" | "Support" | "Design";
  salary: number;
};

const SCOPE = "table-url-sync/employees";

const routeApi = getRouteApi("/table-url-sync");

const DEPARTMENT_OPTIONS = [
  "Engineering",
  "Sales",
  "Support",
  "Design",
] as const satisfies readonly Employee["department"][];

const DATA: Employee[] = [
  { id: "E1", name: "Anna Nilsson", department: "Engineering", salary: 52000 },
  { id: "E2", name: "Björn Karlsson", department: "Sales", salary: 41000 },
  { id: "E3", name: "Carin Ström", department: "Design", salary: 47000 },
  { id: "E4", name: "David Lindqvist", department: "Engineering", salary: 55000 },
  { id: "E5", name: "Elin Bergström", department: "Support", salary: 38000 },
  { id: "E6", name: "Fredrik Åberg", department: "Engineering", salary: 49000 },
  { id: "E7", name: "Greta Holm", department: "Sales", salary: 43000 },
  { id: "E8", name: "Hugo Sandberg", department: "Design", salary: 45000 },
  { id: "E9", name: "Ingrid Dahl", department: "Support", salary: 39500 },
  { id: "E10", name: "Johan Ekström", department: "Engineering", salary: 58000 },
  { id: "E11", name: "Karin Öhman", department: "Sales", salary: 42500 },
  { id: "E12", name: "Lars Ahlberg", department: "Support", salary: 37000 },
];

const SALARY_RANGE = {
  min: Math.min(...DATA.map((employee) => employee.salary)),
  max: Math.max(...DATA.map((employee) => employee.salary)),
};

const columnHelper = createColumnHelper<typeof features, Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "Name", minSize: 180 }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 150,
    filterFn: "equalsString",
    meta: { filter: { variant: "select", options: [...DEPARTMENT_OPTIONS] } },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 120,
    cell: (info) =>
      info.getValue().toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
    filterFn: "inNumberRange",
    meta: { filter: { variant: "range", ...SALARY_RANGE } },
  }),
]);

function StateSourceBadge({
  label,
  stateKey,
  fromUrl,
}: {
  label: string;
  /** Key in the synced-state record, e.g. "columnFilters" — not the display label. */
  stateKey: string;
  fromUrl: boolean;
}) {
  const source = fromUrl
    ? "URL"
    : getFallback(SCOPE, stateKey) !== undefined
      ? "local fallback"
      : "default";
  return (
    <Badge
      variant="light"
      color={source === "URL" ? "blue" : source === "local fallback" ? "grape" : "gray"}
    >
      {label}: {source}
    </Badge>
  );
}

export function TableSyncPage() {
  const search = routeApi.useSearch();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { atoms, tableOptions } = useTableUrlSync({
    route: routeApi,
    scope: SCOPE,
    defaults: employeesSearch.defaults,
  });
  const globalFilter = useSelector(atoms.globalFilter);

  const table = useTable({
    features,
    columns,
    data: DATA,
    enableSorting: true,
    enableGlobalFilter: true,
    ...tableOptions,
  });

  usePageIndexClamp(table, atoms.pagination);

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Flex justify="space-between" align="center">
        <Text fw={600} size="lg">
          Employees — URL-synced state
        </Text>
        <Flex gap="sm" align="center">
          <TMTableFilters.ResetDrawerFiltersButton table={table} />
          <Button size="xs" variant="default" onClick={() => setFiltersOpen(true)}>
            Filters
          </Button>
          <TextInput
            placeholder="Search…"
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.currentTarget.value)}
            size="sm"
            w={240}
          />
        </Flex>
      </Flex>
      <Group gap="xs">
        <StateSourceBadge
          label="Sorting"
          stateKey="sorting"
          fromUrl={search.sorting !== undefined}
        />
        <StateSourceBadge
          label="Pagination"
          stateKey="pagination"
          fromUrl={search.pagination !== undefined}
        />
        <StateSourceBadge
          label="Filters"
          stateKey="columnFilters"
          fromUrl={search.columnFilters !== undefined}
        />
        <StateSourceBadge
          label="Search"
          stateKey="globalFilter"
          fromUrl={search.globalFilter !== undefined}
        />
      </Group>

      <Drawer
        opened={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        position="right"
      >
        <TMTableFilters.DrawerColumnFilters table={table} />
      </Drawer>

      <TMTable.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable.Table table={table} loading={false}>
          <TMTable.THead table={table} />
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => (
              <TMTable.TBodyTr key={row.id} row={row} mih="44px" />
            ))}
          </Table.Tbody>
        </TMTable.Table>
      </TMTable.RoundedCornerWrapper>

      <TMTable.ClientSidePagination table={table} />
    </Flex>
  );
}
