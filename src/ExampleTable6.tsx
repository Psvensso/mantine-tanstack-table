import { Badge, Flex, Text } from "@mantine/core";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { features } from "./table/features";
import { TMTable2 } from "./table/TMTable2";

type Project = {
  id: string;
  name: string;
  team: "Frontend" | "Backend" | "Design" | "DevOps" | "Data";
  status: "Active" | "On Hold" | "Completed" | "Cancelled";
  priority: "Low" | "Medium" | "High" | "Critical";
  budget: number;
  deadline: string;
};

const columnHelper = createColumnHelper<typeof features, Project>();

const STATUS_COLOR: Record<Project["status"], string> = {
  Active: "green",
  "On Hold": "yellow",
  Completed: "blue",
  Cancelled: "red",
};

const PRIORITY_COLOR: Record<Project["priority"], string> = {
  Low: "gray",
  Medium: "orange",
  High: "red",
  Critical: "dark",
};

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    size: 48,
    minSize: 48,
    maxSize: 48,
    header: ({ table }) => <TMTable2.SelectAllCheckbox table={table} size="xs" />,
    cell: ({ row }) => <TMTable2.SelectRowCheckbox row={row} size="xs" />,
  }),
  columnHelper.accessor("id", {
    header: "ID",
    size: 90,
    minSize: 90,
    maxSize: 90,
  }),
  columnHelper.accessor("name", {
    header: "Project Name",
    minSize: 200,
    enableSorting: true,
  }),
  columnHelper.accessor("team", {
    header: "Team",
    minSize: 120,
    enableSorting: true,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 120,
    enableSorting: true,
    cell: (info) => (
      <Badge variant="light" color={STATUS_COLOR[info.getValue()]} size="sm">
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("priority", {
    header: "Priority",
    minSize: 110,
    enableSorting: true,
    cell: (info) => (
      <Badge variant="filled" color={PRIORITY_COLOR[info.getValue()]} size="sm">
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("budget", {
    header: "Budget (SEK)",
    minSize: 140,
    enableSorting: true,
    cell: (info) =>
      info.getValue() === 0
        ? "—"
        : info.getValue().toLocaleString("sv-SE", {
            style: "currency",
            currency: "SEK",
            maximumFractionDigits: 0,
          }),
  }),
  columnHelper.accessor("deadline", {
    header: "Deadline",
    minSize: 110,
    enableSorting: true,
  }),
]);

const DATA: Project[] = [
  { id: "PRJ-001", name: "Design System Migration",   team: "Frontend", status: "Active",    priority: "High",     budget: 280000, deadline: "2026-09-30" },
  { id: "PRJ-002", name: "Auth Service Rewrite",      team: "Backend",  status: "Active",    priority: "Critical", budget: 420000, deadline: "2026-08-15" },
  { id: "PRJ-003", name: "Mobile App Redesign",       team: "Design",   status: "On Hold",   priority: "Medium",   budget: 190000, deadline: "2026-11-30" },
  { id: "PRJ-004", name: "CI/CD Pipeline Upgrade",    team: "DevOps",   status: "Completed", priority: "High",     budget: 95000,  deadline: "2026-06-01" },
  { id: "PRJ-005", name: "Data Lake Integration",     team: "Data",     status: "Active",    priority: "High",     budget: 610000, deadline: "2026-12-31" },
  { id: "PRJ-006", name: "API Gateway v2",            team: "Backend",  status: "Active",    priority: "Medium",   budget: 340000, deadline: "2026-10-15" },
  { id: "PRJ-007", name: "Onboarding Flow UX",        team: "Design",   status: "Active",    priority: "Medium",   budget: 145000, deadline: "2026-08-31" },
  { id: "PRJ-008", name: "Log Aggregation Platform",  team: "DevOps",   status: "On Hold",   priority: "Low",      budget: 72000,  deadline: "2026-07-30" },
  { id: "PRJ-009", name: "Real-time Notifications",   team: "Backend",  status: "Active",    priority: "High",     budget: 230000, deadline: "2026-09-15" },
  { id: "PRJ-010", name: "Accessibility Audit",       team: "Frontend", status: "Completed", priority: "Medium",   budget: 68000,  deadline: "2026-05-31" },
  { id: "PRJ-011", name: "ML Recommendation Engine",  team: "Data",     status: "Active",    priority: "Critical", budget: 890000, deadline: "2027-03-31" },
  { id: "PRJ-012", name: "Multi-tenant Architecture", team: "Backend",  status: "Cancelled", priority: "High",     budget: 0,      deadline: "2026-07-01" },
  { id: "PRJ-013", name: "CDN & Edge Caching",        team: "DevOps",   status: "Active",    priority: "Medium",   budget: 128000, deadline: "2026-10-31" },
  { id: "PRJ-014", name: "Brand Identity Refresh",    team: "Design",   status: "Active",    priority: "Low",      budget: 110000, deadline: "2026-11-15" },
  { id: "PRJ-015", name: "Performance Dashboard",     team: "Frontend", status: "Active",    priority: "High",     budget: 185000, deadline: "2026-09-01" },
];

export function ExampleTable6() {
  const data = useMemo(() => DATA, []);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    enableSorting: true,
    enableRowSelection: true,
    manualPagination: true,
    initialState: {
      sorting: [{ id: "deadline", desc: false }],
      columnPinning: { left: ["select"], right: [] },
    },
  });

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Text fw={600} size="lg">
        Projects{" "}
        <Text component="span" size="sm" c="dimmed" fw={400}>
          — TMTable2 (div + CSS Subgrid)
        </Text>
      </Text>

      <TMTable2.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable2.Table table={table} loading={false}>
          <TMTable2.THead table={table} />
          <TMTable2.TBody>
            {table.getRowModel().rows.map((row) => (
              <TMTable2.TBodyRow key={row.id} row={row} mih="48px" />
            ))}
          </TMTable2.TBody>
        </TMTable2.Table>
      </TMTable2.RoundedCornerWrapper>
    </Flex>
  );
}
