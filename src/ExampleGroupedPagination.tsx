import { Badge, Flex, Pagination, Select, Switch, Text } from "@mantine/core";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { features } from "./table/features";
import { TMTable2 } from "./table/TMTable2";

type Employee = {
  id: number;
  name: string;
  department: string;
  role: string;
  location: string;
  salary: number;
  status: "Active" | "On leave" | "Terminated";
};

const FIRST_NAMES = [
  "Anna", "Erik", "Maria", "Lars", "Sofia", "Johan", "Emma", "Anders", "Karin", "Mikael",
  "Lena", "Patrik", "Helena", "Martin", "Cecilia", "Fredrik", "Sara", "Tobias", "Åsa", "Daniel",
];

const LAST_NAMES = [
  "Lindqvist", "Johansson", "Svensson", "Eriksson", "Karlsson", "Nilsson", "Petersson",
  "Gustafsson", "Magnusson", "Olsson", "Persson", "Björk", "Lundström", "Holm", "Strand",
];

const DEPARTMENTS = ["Engineering", "Product", "Design", "Sales", "HR", "Finance", "Marketing", "Operations"];

const ROLES: Record<string, string[]> = {
  Engineering: ["Engineer", "Senior Engineer", "Tech Lead", "DevOps Engineer"],
  Product: ["Product Manager", "Product Analyst"],
  Design: ["UX Designer", "Visual Designer"],
  Sales: ["Account Executive", "Sales Director"],
  HR: ["HR Manager", "Recruiter"],
  Finance: ["Controller", "Financial Analyst"],
  Marketing: ["Content Strategist", "Marketing Manager"],
  Operations: ["Operations Manager", "Logistics Coordinator"],
};

const LOCATIONS = ["Stockholm", "Göteborg", "Malmö", "Remote"];

function generateEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => {
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const roles = ROLES[dept];
    return {
      id: i + 1,
      name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3 + 7) % LAST_NAMES.length]}`,
      department: dept,
      role: roles[(i * 7) % roles.length],
      location: LOCATIONS[(i * 3 + 1) % LOCATIONS.length],
      salary: 42000 + ((i * 3761 + 17) % 80) * 1000,
      status: i % 10 < 7 ? "Active" : i % 10 < 9 ? "On leave" : "Terminated",
    };
  });
}

const DETAIL_HEIGHT = 68;

function EmployeeDetail({ employee }: { employee: Employee }) {
  const fields: [string, string][] = [
    ["Employee ID", `EMP-${String(employee.id).padStart(5, "0")}`],
    ["Role", employee.role],
    ["Department", employee.department],
    ["Location", employee.location],
    [
      "Salary",
      employee.salary.toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
    ],
    ["Status", employee.status],
  ];
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        height: DETAIL_HEIGHT,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "var(--mantine-spacing-xl)",
        padding: "0 var(--mantine-spacing-md)",
        backgroundColor: "var(--mantine-color-default-hover)",
        borderBottom: "1px solid var(--mantine-color-default-border)",
      }}
    >
      {fields.map(([label, value]) => (
        <div key={label}>
          <Text
            size="xs"
            c="dimmed"
            tt="uppercase"
            fw={600}
            mb={2}
            style={{ letterSpacing: "0.04em" }}
          >
            {label}
          </Text>
          <Text size="sm">{value}</Text>
        </div>
      ))}
    </div>
  );
}

const columnHelper = createColumnHelper<typeof features, Employee>();

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
  columnHelper.accessor("name", {
    header: "Name",
    minSize: 180,
    enableSorting: true,
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    enableGrouping: true,
    enableSorting: true,
  }),
  columnHelper.accessor("role", {
    header: "Role",
    minSize: 160,
  }),
  columnHelper.accessor("location", {
    header: "Location",
    minSize: 120,
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 140,
    enableSorting: true,
    aggregationFn: "mean",
    cell: (info) =>
      info.getValue().toLocaleString("sv-SE", {
        style: "currency",
        currency: "SEK",
        maximumFractionDigits: 0,
      }),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 110,
    cell: (info) => {
      const value = info.getValue();
      const color =
        value === "Active" ? "green" : value === "On leave" ? "yellow" : "red";
      return (
        <Badge color={color} variant="light" size="sm">
          {value}
        </Badge>
      );
    },
  }),
]);

export function ExampleGroupedPagination() {
  const data = useMemo(() => generateEmployees(60), []);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.id),
    getRowCanExpand: () => true,
    enableGrouping: true,
    enableExpanding: true,
    enableSorting: true,
    enableRowSelection: true,
    groupedColumnMode: false,
    initialState: {
      grouping: ["department"],
      expanded: {},
      sorting: [{ id: "name", desc: false }],
      columnPinning: { left: ["select"], right: [] },
      // Grouped starts on a single page showing every group — see setGrouped.
      pagination: { pageIndex: 0, pageSize: data.length },
    },
  });

  const isGrouped = table.store.state.grouping.length > 0;
  const rows = table.getRowModel().rows;
  const groupCount = rows.filter((row) => row.getIsGrouped()).length;

  // Grouping and pagination don't combine here: paging would slice through
  // groups arbitrarily, splitting a group's rows across pages. So grouping
  // forces a single page (pageSize = all rows) and pagination is disabled;
  // turning grouping off restores normal pageSize-10 pagination.
  function setGrouped(grouped: boolean) {
    table.setGrouping(grouped ? ["department"] : []);
    table.setExpanded({});
    table.setPagination({ pageIndex: 0, pageSize: grouped ? data.length : 10 });
  }

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text fw={600} size="lg">
          Employees{" "}
          <Text component="span" size="sm" c="dimmed" fw={400}>
            — 60 rows · grouping on/off + pagination
          </Text>
        </Text>
        <Switch
          label="Group by department"
          checked={isGrouped}
          onChange={(e) => setGrouped(e.currentTarget.checked)}
        />
      </Flex>

      <TMTable2.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable2.Table table={table} loading={false}>
          <TMTable2.THead table={table} />
          <TMTable2.TBody>
            {rows.map((row) => {
              if (row.getIsGrouped()) {
                const avgSalary = row.getValue("salary") as number;
                return (
                  <div
                    key={row.id}
                    role="row"
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0 16px",
                      minHeight: "48px",
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
                      {String(row.getValue("department"))}
                    </Text>
                    <Badge size="sm" variant="light" color="blue">
                      {row.subRows.length} employees
                    </Badge>
                    <Text size="sm" c="dimmed" style={{ marginLeft: "auto" }}>
                      Avg:{" "}
                      {Math.round(avgSalary).toLocaleString("sv-SE", {
                        style: "currency",
                        currency: "SEK",
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </div>
                );
              }
              return (
                // Subgrid wrapper lets the detail panel span full width while the
                // row above stays aligned to the column tracks.
                <div
                  key={row.id}
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "subgrid",
                    cursor: "pointer",
                  }}
                  onClick={row.getToggleExpandedHandler()}
                >
                  <TMTable2.TBodyRow row={row} mih="48px" />
                  {row.getIsExpanded() && (
                    <EmployeeDetail employee={row.original} />
                  )}
                </div>
              );
            })}
          </TMTable2.TBody>
        </TMTable2.Table>
      </TMTable2.RoundedCornerWrapper>

      <Flex justify="space-between" align="center">
        <Text size="xs" c="dimmed">
          {isGrouped
            ? `Showing all ${groupCount} groups (${data.length} employees) · pagination disabled while grouped`
            : `Page ${table.store.state.pagination.pageIndex + 1} of ${table.getPageCount()} · ${table.getRowCount()} rows`}
        </Text>
        <Flex align="center" gap="md">
          <Select
            size="xs"
            w="90px"
            disabled={isGrouped}
            value={isGrouped ? "10" : String(table.store.state.pagination.pageSize)}
            data={["5", "10", "25"]}
            onChange={(value) => {
              table.setPageSize(Number(value) || 10);
              table.setPageIndex(0);
            }}
            allowDeselect={false}
          />
          <Pagination
            size="sm"
            disabled={isGrouped}
            value={table.store.state.pagination.pageIndex + 1}
            onChange={(pageIndex) => table.setPageIndex(pageIndex - 1)}
            total={isGrouped ? 1 : Math.max(1, table.getPageCount())}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}
