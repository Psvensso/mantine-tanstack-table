/**
 * The React side of the builder: host, editor contract, registry, and one
 * generic editor. Demonstrates every host rule from ../SKILL.md — one open
 * editor, key-remount, seed-once defaultValues, draft⇄domain mapping at the
 * save boundary, repeatable same-field conditions under one join, and the
 * output tree as a pure derivation. Mantine is the incidental UI layer.
 */
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@tanstack/react-form";
import { useState, type ComponentType } from "react";
import { z } from "zod";
import {
  buildQueryTree,
  type Condition,
  type Join,
  type Operator,
  type SavedEntry,
} from "./queryTree";

// ── Minimal field catalog (see the config-driven-forms skill for the full
// metadata-driven treatment — this file focuses on the builder shell). ─────

type FieldDef = { name: string; label: string; operators: readonly Operator[] };

const FIELDS: FieldDef[] = [
  { name: "MAKE", label: "Make", operators: ["equals"] },
  { name: "YEAR", label: "Year", operators: ["equals", "min", "max"] },
  { name: "PRICE", label: "Price", operators: ["min", "max"] },
];

function requireFieldDef(name: string): FieldDef {
  const def = FIELDS.find((f) => f.name === name);
  if (!def) throw new Error(`Unknown field: ${name}`);
  return def;
}

// ── Editor contract + registry ─────────────────────────────────────────────
// The contract speaks DOMAIN types (Condition[]), never form drafts — each
// editor owns its draft shape internally and converts at the boundary.

export type EntryEditorProps = {
  field: string;
  /** Saved conditions; [] when adding a new entry. */
  initial: Condition[];
  initialJoin: Join;
  onSave: (result: { conditions: Condition[]; join: Join }) => void;
  onCancel: () => void;
};

/** Bespoke editors opt in per catalog key; everything else gets the generic. */
const BESPOKE_EDITORS: Record<string, ComponentType<EntryEditorProps>> = {};

export function getEntryEditor(field: string): ComponentType<EntryEditorProps> {
  return BESPOKE_EDITORS[field] ?? GenericEntryEditor;
}

// ── The generic editor ─────────────────────────────────────────────────────

/** Draft: what the inputs work on mid-edit — includes empty shapes the
 * domain Condition type rejects. */
type ConditionDraft = { operator: Operator | null; value: string };

const emptyDraft = (def: FieldDef): ConditionDraft => ({
  // Preselect when the field only allows one operator.
  operator: def.operators.length === 1 ? def.operators[0] : null,
  value: "",
});

const toDraft = (c: Condition): ConditionDraft => ({
  operator: c.operator,
  value: c.value,
});

function wrapperSchema(def: FieldDef) {
  return z.object({
    join: z.enum(["AND", "OR"]),
    conditions: z
      .array(
        z.object({
          operator: z.enum(def.operators as [Operator, ...Operator[]], {
            error: "Choose an operator",
          }),
          value: z.string({ error: "Enter a value" }).trim().min(1, "Enter a value"),
        }),
      )
      .min(1, "Add at least one condition"),
  });
}

function firstErrorMessage(errors: ReadonlyArray<unknown>): string | undefined {
  const [issue] = errors;
  if (issue == null) return undefined;
  return typeof issue === "string"
    ? issue
    : (issue as { message: string }).message;
}

function GenericEntryEditor({
  field,
  initial,
  initialJoin,
  onSave,
  onCancel,
}: EntryEditorProps) {
  const def = requireFieldDef(field);

  // Seed ONCE — a useState initializer, so minted drafts don't churn across
  // re-renders. Pairs with the host's key-remount: new target → fresh seed.
  const [defaultValues] = useState(() => ({
    join: initialJoin,
    conditions:
      initial.length > 0 ? initial.map(toDraft) : [emptyDraft(def)],
  }));

  const form = useForm({
    defaultValues,
    validators: { onSubmit: wrapperSchema(def) },
    onSubmit: ({ value }) => {
      // Validation passed — draft → domain narrowing is safe here.
      const conditions: Condition[] = value.conditions.map((draft) => ({
        field: def.name,
        operator: draft.operator as Operator,
        value: draft.value.trim(),
      }));
      onSave({ conditions, join: value.join });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Stack gap="sm">
        <form.Field name="conditions" mode="array">
          {(conditionsField) => (
            <Stack gap="xs">
              {conditionsField.state.value.map((_, index) => (
                <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
                  <form.Field name={`conditions[${index}].operator`}>
                    {(f) => (
                      <Select
                        aria-label="Operator"
                        w={120}
                        data={[...def.operators]}
                        value={f.state.value}
                        onChange={(v) => f.handleChange(v as Operator | null)}
                        onBlur={f.handleBlur}
                        error={firstErrorMessage(f.state.meta.errors)}
                      />
                    )}
                  </form.Field>
                  <form.Field name={`conditions[${index}].value`}>
                    {(f) => (
                      <TextInput
                        aria-label="Value"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.currentTarget.value)}
                        onBlur={f.handleBlur}
                        error={firstErrorMessage(f.state.meta.errors)}
                      />
                    )}
                  </form.Field>
                  {conditionsField.state.value.length > 1 && (
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      mt={4}
                      aria-label="Remove condition"
                      onClick={() => conditionsField.removeValue(index)}
                    >
                      ✕
                    </ActionIcon>
                  )}
                </Group>
              ))}

              <Group gap="sm">
                <Button
                  variant="light"
                  size="compact-sm"
                  onClick={() => conditionsField.pushValue(emptyDraft(def))}
                >
                  + {def.label} condition
                </Button>
                {/* ONE join per entry — shown once it matters. */}
                {conditionsField.state.value.length >= 2 && (
                  <form.Field name="join">
                    {(f) => (
                      <SegmentedControl
                        size="xs"
                        data={["AND", "OR"]}
                        value={f.state.value}
                        onChange={(v) => f.handleChange(v as Join)}
                      />
                    )}
                  </form.Field>
                )}
              </Group>
            </Stack>
          )}
        </form.Field>

        <Group justify="flex-end">
          <Button variant="default" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
                Save
              </Button>
            )}
          </form.Subscribe>
        </Group>
      </Stack>
    </form>
  );
}

// ── The host ───────────────────────────────────────────────────────────────

type EditingState = {
  /** Entry being edited, or null when adding a new one. */
  id: string | null;
  field: string;
};

const entrySummary = (entry: SavedEntry): string =>
  entry.conditions
    .map((c) => `${c.operator} ${c.value}`)
    .join(` ${entry.join} `);

export function BuilderHost() {
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [rootJoin, setRootJoin] = useState<Join>("AND");
  const [editing, setEditing] = useState<EditingState | null>(null);

  const handleSave = ({
    conditions,
    join,
  }: {
    conditions: Condition[];
    join: Join;
  }) => {
    if (editing === null) return;
    const { id, field } = editing;
    setSaved((prev) =>
      id === null
        ? [
            ...prev,
            {
              id: crypto.randomUUID(),
              field,
              label: requireFieldDef(field).label,
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
  const Editor = editing ? getEntryEditor(editing.field) : null;
  // The output is a PURE derivation of plain data — no form state involved.
  const query = buildQueryTree(saved, rootJoin);

  return (
    <Stack gap="md" maw={640}>
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          Match
        </Text>
        <SegmentedControl
          size="xs"
          data={["AND", "OR"]}
          value={rootJoin}
          onChange={(v) => setRootJoin(v as Join)}
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
              {/* One editor at a time — everything else locks while open. */}
              <Button
                variant="subtle"
                size="compact-sm"
                disabled={editing !== null}
                onClick={() => setEditing({ id: entry.id, field: entry.field })}
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
              {requireFieldDef(editing.field).label}
            </Text>
            <Editor
              // Remount when the target changes so form state never leaks
              // between entries.
              key={`${editing.id ?? "new"}-${editing.field}`}
              field={editing.field}
              initial={editingEntry?.conditions ?? []}
              initialJoin={editingEntry?.join ?? "AND"}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </Stack>
        </Card>
      ) : (
        <Select
          aria-label="Add field"
          placeholder="+ Add condition"
          w={240}
          data={FIELDS.map((f) => ({ value: f.name, label: f.label }))}
          value={null}
          onChange={(field) => {
            if (field !== null) setEditing({ id: null, field });
          }}
        />
      )}

      <Code block>{JSON.stringify(query, null, 2)}</Code>
    </Stack>
  );
}
