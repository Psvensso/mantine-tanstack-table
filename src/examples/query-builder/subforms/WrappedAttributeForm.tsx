import {
  ActionIcon,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { emptyConditionDraft, requireAttributeDef } from "../catalog";
import { ConditionGroup } from "../form-kit/ConditionGroup";
import { useAppForm } from "../form-kit/formHook";
import {
  conditionToDraft,
  draftToCondition,
  type QueryCondition,
} from "../queryObject";
import { wrapperSchema } from "../validation";
import type { ConditionDraft, Join } from "../types";
import type { AttributeEditorProps } from "./registry";

/**
 * The one editor for ALL plain attributes. It wraps one or more conditions of
 * the same attribute in an AND/OR `join`: the user adds rows of the same
 * attribute and picks how they combine (the join selector appears once there
 * are 2+ rows). Rendering and validation are generic — the attribute's
 * catalog metadata (type, options, unit, min/max) drives everything through
 * ConditionGroup and `wrapperSchema`.
 */
export function WrappedAttributeForm({
  attribute,
  initial,
  initialJoin,
  onSave,
  onCancel,
}: AttributeEditorProps) {
  const def = requireAttributeDef(attribute);
  const schema = useMemo(() => wrapperSchema(def), [def]);

  const [defaultValues] = useState<{ join: Join; conditions: ConditionDraft[] }>(
    () => ({
      join: initialJoin,
      conditions:
        initial.length > 0
          ? initial.map((condition) => conditionToDraft(condition, def))
          : [emptyConditionDraft(def)],
    }),
  );

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => {
      const conditions = value.conditions
        .map((draft) => draftToCondition(def.name, draft))
        .filter((condition): condition is QueryCondition => condition !== undefined);
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
        <form.Subscribe selector={(state) => state.values.conditions.length}>
          {(count) =>
            count >= 2 ? (
              <form.Field name="join">
                {(field) => (
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">
                      Match
                    </Text>
                    <SegmentedControl
                      size="xs"
                      data={["AND", "OR"]}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value as Join)}
                    />
                  </Group>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>

        <form.Field name="conditions" mode="array">
          {(field) => (
            <Stack gap="xs">
              {field.state.value.map((_, index) => (
                <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ConditionGroup
                      form={form}
                      fields={`conditions[${index}]`}
                      def={def}
                    />
                  </div>
                  {field.state.value.length > 1 && (
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Remove condition"
                      onClick={() => field.removeValue(index)}
                    >
                      ✕
                    </ActionIcon>
                  )}
                </Group>
              ))}
              <Group>
                <Button
                  variant="light"
                  size="compact-sm"
                  onClick={() => field.pushValue(emptyConditionDraft(def))}
                >
                  + Add {def.label}
                </Button>
              </Group>
            </Stack>
          )}
        </form.Field>

        <form.AppForm>
          <form.FormError />
          <Group justify="flex-end">
            <Button variant="default" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <form.SaveButton />
          </Group>
        </form.AppForm>
      </Stack>
    </form>
  );
}
