import { Badge, Flex, Group, Table, Text } from "@mantine/core";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { features } from "../table/features";
import { TMTable } from "../table/TMTable";
import { useTableUrlState } from "../hooks/useTableUrlState";
import { getFallback } from "../hooks/tableUrlStateFallback";
import { EMPLOYEES_DEFAULT_SEARCH } from "./searchSchema";
import { tableSyncRoute } from "./router";

type Employee = {
  id: string;
  name: string;
  department: "Engineering" | "Sales" | "Support" | "Design";
  salary: number;
};

const SCOPE = "table-url-sync/employees";

const columnHelper = createColumnHelper<typeof features, Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "Name", minSize: 180 }),
  columnHelper.accessor("department", { header: "Department", minSize: 150 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 120,
    cell: (info) =>
      info.getValue().toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
  }),
]);

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

function StateSourceBadge({ label, fromUrl }: { label: string; fromUrl: boolean }) {
  const source = fromUrl
    ? "URL"
    : getFallback(SCOPE, label.toLowerCase()) !== undefined
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
  const search = tableSyncRoute.useSearch();
  const navigate = tableSyncRoute.useNavigate();
  const data = useMemo(() => DATA, []);

  const urlAtoms = useTableUrlState({
    scope: SCOPE,
    search,
    navigate,
    defaults: EMPLOYEES_DEFAULT_SEARCH,
  });

  const table = useTable({
    features,
    columns,
    data,
    enableSorting: true,
    // Without this, v9's default autoResetPageIndex fires on mount (sorting
    // going from "nothing yet" to its restored value counts as a change)
    // and silently resets pageIndex back to the internal default, clobbering
    // whatever we just restored from the URL/fallback. See the pagination
    // skill doc's "autoResetPageIndex resets to initialState.pageIndex" note.
    autoResetPageIndex: false,
    atoms: {
      sorting: urlAtoms.sorting,
      pagination: urlAtoms.pagination,
    },
  });

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Text fw={600} size="lg">
        Employees — URL-synced state
      </Text>
      <Group gap="xs">
        <StateSourceBadge label="Sorting" fromUrl={search.sorting !== undefined} />
        <StateSourceBadge label="Pagination" fromUrl={search.pagination !== undefined} />
      </Group>

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
