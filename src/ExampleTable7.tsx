import { Badge, Flex, SegmentedControl, Text } from "@mantine/core";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { features } from "./table/features";
import { TMTable2 } from "./table/TMTable2";

type Employee = {
  id: number;
  name: string;
  department:
    | "Engineering"
    | "Product"
    | "Design"
    | "Sales"
    | "HR"
    | "Finance"
    | "Marketing"
    | "Operations";
  role: string;
  location: "Stockholm" | "Göteborg" | "Malmö" | "Remote";
  salary: number;
  status: "Active" | "On leave" | "Terminated";
  startYear: number;
};

const FIRST_NAMES = [
  "Anna", "Erik", "Maria", "Lars", "Sofia", "Johan", "Emma", "Anders", "Karin", "Mikael",
  "Lena", "Patrik", "Helena", "Martin", "Cecilia", "Fredrik", "Sara", "Tobias", "Åsa", "Daniel",
  "Ingrid", "Rickard", "Malin", "Oscar", "Petra", "Christoffer", "Johanna", "Magnus", "Nina", "Andreas",
];

const LAST_NAMES = [
  "Lindqvist", "Johansson", "Svensson", "Eriksson", "Karlsson", "Nilsson", "Petersson",
  "Gustafsson", "Magnusson", "Olsson", "Persson", "Björk", "Lundström", "Holm", "Strand",
  "Lund", "Bergman", "Henriksson", "Lindberg", "Abrahamsson",
];

const DEPARTMENTS: Employee["department"][] = [
  "Engineering", "Product", "Design", "Sales", "HR", "Finance", "Marketing", "Operations",
];

const ROLES: Record<Employee["department"], string[]> = {
  Engineering: ["Engineer", "Senior Engineer", "Tech Lead", "Principal Engineer", "DevOps Engineer", "QA Engineer"],
  Product: ["Product Manager", "Product Analyst", "Head of Product"],
  Design: ["UX Designer", "Visual Designer", "Product Designer", "UX Lead"],
  Sales: ["Account Executive", "Sales Director", "SDR", "Account Manager"],
  HR: ["HR Manager", "Recruiter", "Head of HR"],
  Finance: ["Controller", "Financial Analyst", "CFO"],
  Marketing: ["Content Strategist", "Marketing Manager", "Growth Analyst"],
  Operations: ["Operations Manager", "Logistics Coordinator", "Facilities Manager"],
};

const LOCATIONS: Employee["location"][] = ["Stockholm", "Göteborg", "Malmö", "Remote"];

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
      startYear: 2018 + (i % 7),
    };
  });
}

const ROW_HEIGHT = 48;
// Fixed height for the detail panel — must match EmployeeDetail's rendered height
// so estimateSize is accurate and the virtualizer doesn't jump.
const DETAIL_HEIGHT = 68;

function EmployeeDetail({ employee }: { employee: Employee }) {
  const fields: [string, string][] = [
    ["Employee ID", `EMP-${String(employee.id).padStart(5, "0")}`],
    ["Role", employee.role],
    ["Department", employee.department],
    ["Location", employee.location],
    ["Started", String(employee.startYear)],
    ["Tenure", `${2026 - employee.startYear} year${2026 - employee.startYear === 1 ? "" : "s"}`],
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
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2} style={{ letterSpacing: "0.04em" }}>
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
    header: ({ table }) => (
      <TMTable2.SelectAllCheckbox table={table} size="xs" />
    ),
    // stopPropagation so clicking the checkbox doesn't also toggle row expand
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
    // Visual-only chevron — the row container handles the toggle click
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
  columnHelper.accessor("location", {
    header: "Location",
    minSize: 120,
    enableGrouping: true,
    enableSorting: true,
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
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
    enableGrouping: true,
    enableSorting: true,
    cell: (info) => {
      const color =
        info.getValue() === "Active"
          ? "green"
          : info.getValue() === "On leave"
            ? "yellow"
            : "red";
      return (
        <Badge color={color} variant="light" size="sm">
          {info.getValue()}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("startYear", {
    header: "Started",
    minSize: 90,
    enableSorting: true,
  }),
]);

const GROUP_BY_OPTIONS = [
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "status", label: "Status" },
];

export function ExampleTable7() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const data = useMemo(() => generateEmployees(20000), []);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.id),
    // Required for all rows to be expandable: group rows to show children,
    // leaf rows to show the detail panel. The default only allows rows with sub-rows.
    getRowCanExpand: () => true,
    columnResizeMode: "onChange",
    enableGrouping: true,
    enableExpanding: true,
    enableSorting: true,
    enableRowSelection: true,
    manualPagination: true,
    groupedColumnMode: false,
    initialState: {
      grouping: ["department"],
      expanded: {},
      columnPinning: { left: ["select"], right: [] },
      sorting: [{ id: "name", desc: false }],
    },
  });

  const groupBy = table.store.state.grouping[0] ?? "department";
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // Size depends on row type and expand state.
    // getItemKey encodes expand state so the cache is invalidated on toggle.
    estimateSize: (i) => {
      const row = rows[i];
      if (!row || row.getIsGrouped()) return ROW_HEIGHT;
      return row.getIsExpanded() ? ROW_HEIGHT + DETAIL_HEIGHT : ROW_HEIGHT;
    },
    getItemKey: (i) => {
      const row = rows[i];
      return row ? `${row.id}:${String(row.getIsExpanded())}` : i;
    },
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text fw={600} size="lg">
          Employees{" "}
          <Text component="span" size="sm" c="dimmed" fw={400}>
            — 20 000 rows · virtual + grouped + expandable
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
        <TMTable2.Table
          table={table}
          loading={false}
          scrollContainerRef={scrollRef}
        >
          <TMTable2.THead table={table} />
          <TMTable2.TBody>
            {paddingTop > 0 && (
              <div aria-hidden style={{ gridColumn: "1/-1", height: paddingTop }} />
            )}

            {virtualItems.map((vItem) => {
              const row = rows[vItem.index];

              if (row.getIsGrouped()) {
                const avgSalary = row.getValue("salary") as number;
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
                // Row container — clicking anywhere toggles the detail panel.
                // Height = ROW_HEIGHT when collapsed, ROW_HEIGHT + DETAIL_HEIGHT when expanded.
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
                    <EmployeeDetail employee={row.original} />
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
