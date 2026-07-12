import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Flex,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useState } from "react";
import {
  ATTRIBUTES,
  GROUPED_ATTRIBUTES,
  GROUP_MEMBER_NAMES,
  getAttributeDef,
  getGroupDef,
} from "./catalog";
import {
  buildQueryObject,
  type QueryCondition,
  type SavedAttribute,
} from "./queryObject";
import { getAttributeEditor } from "./subforms/registry";
import { OPERATOR_LABELS, type Join } from "./types";

// Group members are edited inside their group's subform, not standalone.
const ATTRIBUTE_SELECT_DATA = [
  {
    group: "Attributes",
    items: ATTRIBUTES.filter((def) => !GROUP_MEMBER_NAMES.has(def.name)).map(
      (def) => ({ value: def.name, label: def.label }),
    ),
  },
  {
    group: "Grouped attributes",
    items: GROUPED_ATTRIBUTES.map((def) => ({
      value: def.name,
      label: def.label,
    })),
  },
];

const attributeLabel = (name: string): string =>
  getGroupDef(name)?.label ?? getAttributeDef(name)?.label ?? name;

const conditionSummary = (condition: QueryCondition): string => {
  const range =
    condition.valueTo !== undefined ? ` – ${condition.valueTo}` : "";
  return `${OPERATOR_LABELS[condition.operator].toLowerCase()} ${
    condition.value
  }${range}`;
};

/** e.g. "equals Tesla OR equals Volvo" — the wrapper's conditions + its join. */
const entrySummary = (entry: SavedAttribute): string =>
  entry.conditions.map(conditionSummary).join(` ${entry.join} `);

type EditingState = {
  /** Saved entry being edited, or null when adding a new attribute. */
  id: string | null;
  attribute: string;
};

export function QueryBuilderExample() {
  const [saved, setSaved] = useState<SavedAttribute[]>([]);
  const [rootJoin, setRootJoin] = useState<Join>("AND");
  const [editing, setEditing] = useState<EditingState | null>(null);

  const handleSave = ({
    conditions,
    join,
  }: {
    conditions: QueryCondition[];
    join: Join;
  }) => {
    if (editing === null) return;
    const { id, attribute } = editing;
    const kind = getGroupDef(attribute) ? "group" : "attribute";
    setSaved((prev) =>
      id === null
        ? [
            ...prev,
            {
              id: crypto.randomUUID(),
              attribute,
              label: attributeLabel(attribute),
              kind,
              join,
              conditions,
            },
          ]
        : prev.map((entry) =>
            entry.id === id ? { ...entry, join, conditions } : entry,
          ),
    );
    setEditing(null);
  };

  const editingEntry =
    editing?.id != null
      ? saved.find((entry) => entry.id === editing.id)
      : undefined;
  const Editor = editing ? getAttributeEditor(editing.attribute) : null;
  const query = buildQueryObject(saved, rootJoin);

  return (
    <Flex direction="column" gap="lg" p="lg" h="100%" style={{ overflow: "auto" }}>
      <div>
        <Text fw={600} size="lg">
          Car search — query builder
        </Text>
        <Text size="sm" c="dimmed">
          A plain attribute wraps one or more same-attribute conditions with an
          AND/OR join; grouped attributes bundle fixed members. Each opens as an
          isolated form, and everything folds into one AND/OR query tree.
        </Text>
      </div>

      <Flex gap="xl" wrap="wrap" align="flex-start">
        <Stack gap="md" style={{ flex: 2, minWidth: 520 }}>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Match
            </Text>
            <SegmentedControl
              size="xs"
              data={["AND", "OR"]}
              value={rootJoin}
              onChange={(value) => setRootJoin(value as Join)}
            />
            <Text size="sm" c="dimmed">
              across all conditions
            </Text>
          </Group>

          {saved.map((entry) => (
            <Paper key={entry.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" style={{ minWidth: 0 }}>
                  <Badge variant="light">{entry.label}</Badge>
                  <Text size="sm" truncate>
                    {entrySummary(entry)}
                  </Text>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    disabled={editing !== null}
                    onClick={() =>
                      setEditing({ id: entry.id, attribute: entry.attribute })
                    }
                  >
                    Edit
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Remove ${entry.label}`}
                    disabled={editing !== null}
                    onClick={() =>
                      setSaved((prev) => prev.filter((e) => e.id !== entry.id))
                    }
                  >
                    ✕
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}

          {editing && Editor ? (
            <Card withBorder padding="md">
              <Stack gap="sm">
                <Text fw={600} size="sm">
                  {editing.id === null ? "Add" : "Edit"}:{" "}
                  {attributeLabel(editing.attribute)}
                </Text>
                <Editor
                  // Remount when the target changes so form state never leaks
                  // between attributes or entries.
                  key={`${editing.id ?? "new"}-${editing.attribute}`}
                  attribute={editing.attribute}
                  initial={editingEntry?.conditions ?? []}
                  initialJoin={editingEntry?.join ?? "AND"}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                />
              </Stack>
            </Card>
          ) : (
            <Select
              aria-label="Add attribute"
              placeholder="+ Add attribute"
              w={240}
              data={ATTRIBUTE_SELECT_DATA}
              value={null}
              onChange={(attribute) => {
                if (attribute !== null) setEditing({ id: null, attribute });
              }}
            />
          )}
        </Stack>

        <Stack gap="xs" style={{ flex: 1, minWidth: 320 }}>
          <Text fw={600} size="sm" c="dimmed">
            Query object
          </Text>
          {query.conditions.length === 0 ? (
            <Alert variant="light" color="gray">
              Add and save an attribute — the query object builds up here.
            </Alert>
          ) : (
            <Code block>{JSON.stringify(query, null, 2)}</Code>
          )}
        </Stack>
      </Flex>
    </Flex>
  );
}
