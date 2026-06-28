import { Badge, Flex, Table, Text } from "@mantine/core";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { features } from "./table/features";
import { TMTable } from "./table/TMTable";

type Employee = {
  id: number;
  name: string;
  department: string;
  role: string;
  location: string;
  salary: number;
  status: "Active" | "On leave" | "Terminated";
};

const columnHelper = createColumnHelper<typeof features, Employee>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    size: 48,
    minSize: 48,
    maxSize: 48,
    header: ({ table }) => <TMTable.SelectAllCheckbox table={table} size="xs" />,
    cell: ({ row }) => <TMTable.SelectRowCheckbox row={row} size="xs" />,
  }),
  columnHelper.accessor("name", {
    header: "Name",
    minSize: 180,
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    enableGrouping: true,
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
    minSize: 100,
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

const DATA: Employee[] = [
  { id: 1, name: "Anna Lindqvist", department: "Engineering", role: "Senior Engineer", location: "Stockholm", salary: 72000, status: "Active" },
  { id: 2, name: "Erik Johansson", department: "Product", role: "Product Manager", location: "Göteborg", salary: 68000, status: "Active" },
  { id: 3, name: "Maria Svensson", department: "Design", role: "UX Designer", location: "Stockholm", salary: 61000, status: "On leave" },
  { id: 4, name: "Lars Eriksson", department: "Engineering", role: "Tech Lead", location: "Malmö", salary: 85000, status: "Active" },
  { id: 5, name: "Sofia Karlsson", department: "Sales", role: "Account Executive", location: "Stockholm", salary: 55000, status: "Active" },
  { id: 6, name: "Johan Nilsson", department: "Engineering", role: "Junior Engineer", location: "Göteborg", salary: 48000, status: "Active" },
  { id: 7, name: "Emma Petersson", department: "HR", role: "HR Manager", location: "Stockholm", salary: 62000, status: "Active" },
  { id: 8, name: "Anders Gustafsson", department: "Finance", role: "CFO", location: "Stockholm", salary: 110000, status: "Active" },
  { id: 9, name: "Karin Magnusson", department: "Engineering", role: "Senior Engineer", location: "Malmö", salary: 74000, status: "Terminated" },
  { id: 10, name: "Mikael Olsson", department: "Design", role: "Visual Designer", location: "Stockholm", salary: 58000, status: "Active" },
  { id: 11, name: "Lena Persson", department: "Product", role: "Product Analyst", location: "Göteborg", salary: 57000, status: "On leave" },
  { id: 12, name: "Patrik Björk", department: "Sales", role: "Sales Director", location: "Stockholm", salary: 92000, status: "Active" },
  { id: 13, name: "Helena Lundström", department: "Engineering", role: "DevOps Engineer", location: "Stockholm", salary: 76000, status: "Active" },
  { id: 14, name: "Martin Holm", department: "Finance", role: "Financial Analyst", location: "Malmö", salary: 65000, status: "Active" },
  { id: 15, name: "Cecilia Strand", department: "HR", role: "Recruiter", location: "Göteborg", salary: 52000, status: "Active" },
  { id: 16, name: "Fredrik Lund", department: "Engineering", role: "Principal Engineer", location: "Stockholm", salary: 95000, status: "Active" },
  { id: 17, name: "Sara Bergman", department: "Marketing", role: "Content Strategist", location: "Stockholm", salary: 54000, status: "Active" },
  { id: 18, name: "Tobias Henriksson", department: "Sales", role: "Account Manager", location: "Göteborg", salary: 59000, status: "Terminated" },
  { id: 19, name: "Åsa Lindberg", department: "Design", role: "UX Lead", location: "Stockholm", salary: 79000, status: "Active" },
  { id: 20, name: "Daniel Abrahamsson", department: "Engineering", role: "Mobile Engineer", location: "Malmö", salary: 69000, status: "Active" },
  { id: 21, name: "Ingrid Söderström", department: "Product", role: "Head of Product", location: "Stockholm", salary: 105000, status: "Active" },
  { id: 22, name: "Rickard Ekström", department: "Finance", role: "Controller", location: "Göteborg", salary: 67000, status: "Active" },
  { id: 23, name: "Malin Hellström", department: "Marketing", role: "Marketing Manager", location: "Stockholm", salary: 71000, status: "On leave" },
  { id: 24, name: "Oscar Fridén", department: "Engineering", role: "Backend Engineer", location: "Stockholm", salary: 73000, status: "Active" },
  { id: 25, name: "Petra Nordin", department: "HR", role: "Head of HR", location: "Stockholm", salary: 88000, status: "Active" },
  { id: 26, name: "Christoffer Åberg", department: "Sales", role: "SDR", location: "Malmö", salary: 44000, status: "Active" },
  { id: 27, name: "Johanna Ek", department: "Engineering", role: "QA Engineer", location: "Göteborg", salary: 60000, status: "Active" },
  { id: 28, name: "Magnus Sjöberg", department: "Design", role: "Product Designer", location: "Stockholm", salary: 66000, status: "Active" },
  { id: 29, name: "Nina Wahlberg", department: "Marketing", role: "Growth Analyst", location: "Stockholm", salary: 61000, status: "Active" },
  { id: 30, name: "Andreas Wallin", department: "Engineering", role: "CTO", location: "Stockholm", salary: 125000, status: "Active" },
];

export function ExampleTable3() {
  const data = useMemo(() => DATA, []);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.id),
    initialState: {
      grouping: ["department"],
      expanded: true,
      sorting: [{ id: "department", desc: false }],
      columnPinning: { left: ["select"], right: [] },
    },
    enableGrouping: true,
    enableExpanding: true,
    enableSorting: true,
    enableRowSelection: true,
    manualPagination: true,
    groupedColumnMode: false,
  });

  return (
    <Flex direction="column" gap="md" p="lg" h="100%">
      <Text fw={600} size="lg">
        Employees by Department
      </Text>

      <TMTable.RoundedCornerWrapper style={{ flex: 1, minHeight: 0 }}>
        <TMTable.Table table={table} loading={false}>
          <TMTable.THead table={table} />
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                const avgSalary = row.getValue("salary") as number;
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
                        {row.getValue("department") as string}
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
                    </Table.Td>
                  </Table.Tr>
                );
              }
              return <TMTable.TBodyTr key={row.id} row={row} />;
            })}
          </Table.Tbody>
        </TMTable.Table>
      </TMTable.RoundedCornerWrapper>
    </Flex>
  );
}
