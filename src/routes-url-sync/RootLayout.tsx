import { Flex, NavLink, Text } from "@mantine/core";
import { Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export function RootLayout() {
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
        <Text
          size="xs"
          fw={600}
          c="dimmed"
          px="sm"
          py="xs"
          style={{ letterSpacing: "0.05em" }}
        >
          URL SYNC DEMO
        </Text>
        <NavLink
          component={Link}
          to="/"
          label="Employees table"
          description="Sorting + pagination synced to the URL"
          style={{ borderRadius: "var(--mantine-radius-sm)" }}
        />
        <NavLink
          component={Link}
          to="/elsewhere"
          label="Elsewhere"
          description="Navigate here, then back"
          style={{ borderRadius: "var(--mantine-radius-sm)" }}
        />
        {/*
          Real anchor, not a router Link: this exits the demo's own router
          entirely, back into the unrelated tab-switcher app mounted at "/".
          A full navigation here is correct — it's the boundary between the
          two independent apps.
        */}
        <a
          href="/"
          style={{
            marginTop: "auto",
            padding: "8px 12px",
            fontSize: "var(--mantine-font-size-sm)",
          }}
        >
          ← Back to examples
        </a>
      </nav>
      <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <Outlet />
      </main>
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </Flex>
  );
}
