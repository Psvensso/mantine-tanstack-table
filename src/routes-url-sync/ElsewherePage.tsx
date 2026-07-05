import { Flex, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";

export function ElsewherePage() {
  return (
    <Flex direction="column" gap="md" p="lg">
      <Text fw={600} size="lg">
        Elsewhere
      </Text>
      <Text size="sm" c="dimmed" maw={480}>
        This page has nothing to do with the table. Its only purpose is to
        prove a point: navigate here from the employees table after sorting
        or paginating it, then go back with the link below — no search
        params are passed. The table should restore your last sort/page from
        its local fallback store rather than resetting to defaults.
      </Text>
      <Link to="/table-url-sync" style={{ width: "fit-content" }}>
        ← Back to the employees table
      </Link>
    </Flex>
  );
}
