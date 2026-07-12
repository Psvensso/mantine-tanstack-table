import { Flex, NavLink, Text } from "@mantine/core";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

type NavItem = {
  to: string;
  label: string;
  description: string;
};

const EXAMPLE_LINKS: NavItem[] = [
  {
    to: "/filtering-pinning",
    label: "Filtering & Pinning",
    description: "Employees · column filters, global search, pagination",
  },
  {
    to: "/expandable-rows",
    label: "Expandable Rows",
    description: "Orders · expandable order lines",
  },
  {
    to: "/row-grouping",
    label: "Row Grouping",
    description: "Employees · grouped by department, collapsible",
  },
  {
    to: "/server-side-filtering",
    label: "Server-Side Filtering",
    description: "Products · TanStack Query, manual filters",
  },
  {
    to: "/dynamic-grouping",
    label: "Dynamic Grouping",
    description: "Sales · switchable group-by",
  },
  {
    to: "/subgrid-table",
    label: "Subgrid Table",
    description: "Projects · TMTable2, div + CSS Subgrid",
  },
  {
    to: "/virtualized-grouping",
    label: "Virtualized Grouping",
    description: "Employees · 20 000 rows, virtual + grouping",
  },
  {
    to: "/virtualized-expandable",
    label: "Virtualized Expandable",
    description: "Orders · 5 000 rows, virtual + details toggle",
  },
  {
    to: "/grouping-pagination",
    label: "Grouping + Pagination",
    description: "Employees · grouping on/off + pagination",
  },
];

const FORM_LINKS: NavItem[] = [
  {
    to: "/form-validation",
    label: "Employee Form",
    description: "TanStack Form + Zod validation",
  },
  {
    to: "/query-builder",
    label: "Query Builder",
    description: "Car search · dynamic attributes, grouped validation",
  },
];

const URL_SYNC_LINKS: NavItem[] = [
  {
    to: "/table-url-sync",
    label: "URL Sync Deep-Dive",
    description: "State-source badges + local fallback demo",
  },
  {
    to: "/table-url-sync/elsewhere",
    label: "Elsewhere",
    description: "Navigate here, then back",
  },
];

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <Text
        size="xs"
        fw={600}
        c="dimmed"
        px="sm"
        py="xs"
        style={{ letterSpacing: "0.05em" }}
      >
        {title}
      </Text>
      {items.map((item) => (
        <NavLink
          key={item.to}
          component={Link}
          to={item.to}
          label={item.label}
          description={item.description}
          active={pathname === item.to}
          style={{ borderRadius: "var(--mantine-radius-sm)" }}
        />
      ))}
    </>
  );
}

export function AppLayout() {
  return (
    <Flex h="100vh" style={{ overflow: "hidden" }}>
      <nav
        style={{
          width: 230,
          flexShrink: 0,
          borderRight: "1px solid var(--mantine-color-default-border)",
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <NavSection title="EXAMPLES" items={EXAMPLE_LINKS} />
        <NavSection title="FORMS" items={FORM_LINKS} />
        <NavSection title="URL SYNC DEMO" items={URL_SYNC_LINKS} />
      </nav>
      <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <Outlet />
      </main>
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </Flex>
  );
}
