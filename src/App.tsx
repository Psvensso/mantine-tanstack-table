import { NavLink, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { ExampleTable } from "./ExampleTable";
import { ExampleTable2 } from "./ExampleTable2";
import { ExampleTable3 } from "./ExampleTable3";
import { ExampleTable4 } from "./ExampleTable4";
import { ExampleTable5 } from "./ExampleTable5";

const TABS = [
  {
    id: "employees",
    label: "Employees",
    description: "Filtering, pinning, visibility",
    component: ExampleTable,
  },
  {
    id: "orders",
    label: "Orders",
    description: "Expandable rows",
    component: ExampleTable2,
  },
  {
    id: "employees-grouped",
    label: "Employees (Grouped)",
    description: "Column grouping, collapsible",
    component: ExampleTable3,
  },
  {
    id: "products",
    label: "Products",
    description: "Server-side filters, TanStack Query",
    component: ExampleTable4,
  },
  {
    id: "sales",
    label: "Sales",
    description: "Dynamic column grouping",
    component: ExampleTable5,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

function getTabFromUrl(): TabId {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") as TabId | null;
  return TABS.find((t) => t.id === tab)?.id ?? TABS[0].id;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>(getTabFromUrl);

  function navigate(tab: TabId) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    history.pushState(null, "", url);
    setActiveTab(tab);
  }

  useEffect(() => {
    const handler = () => setActiveTab(getTabFromUrl());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const ActiveComponent = TABS.find((t) => t.id === activeTab)!.component;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
      }}
    >
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
        <Text
          size="xs"
          fw={600}
          c="dimmed"
          px="sm"
          py="xs"
          style={{ letterSpacing: "0.05em" }}
        >
          EXAMPLES
        </Text>
        {TABS.map((tab) => (
          <NavLink
            key={tab.id}
            label={tab.label}
            description={tab.description}
            active={activeTab === tab.id}
            onClick={() => navigate(tab.id)}
            style={{ borderRadius: "var(--mantine-radius-sm)" }}
          />
        ))}
      </nav>
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <ActiveComponent />
      </main>
    </div>
  );
}

export default App;
