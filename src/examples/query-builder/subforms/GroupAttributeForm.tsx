import { Button, Fieldset, Group, Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import { requireAttributeDef, requireGroupDef } from "../catalog";
import { ConditionGroup } from "../form-kit/ConditionGroup";
import { useAppForm } from "../form-kit/formHook";
import {
  conditionToDraft,
  draftToCondition,
  type QueryCondition,
} from "../queryObject";
import { evaluateGroupRules, groupMemberSchema } from "../validation";
import type { ConditionDraft, GroupMemberValues } from "../types";
import type { AttributeEditorProps } from "./registry";

/**
 * The one editor for ALL grouped attributes. It renders nothing bespoke:
 * members come from the group's config (`members`), one ConditionGroup each,
 * and validation is the config too — the per-member structural schema plus
 * the group's own `requireMessage` / `rule` extension, run through the
 * `{ form, fields }` submit path so errors land correctly and clear. Adding
 * a group (or changing its members/rules) never touches this file.
 */
export function GroupAttributeForm({
  attribute,
  initial,
  onSave,
  onCancel,
}: AttributeEditorProps) {
  const group = requireGroupDef(attribute);
  const members = useMemo(
    () => group.members.map(requireAttributeDef),
    [group],
  );
  const memberSchema = useMemo(() => groupMemberSchema(group), [group]);

  // Seed once from the saved conditions; minted uuids etc. must not churn.
  const [defaultValues] = useState<GroupMemberValues>(() => {
    const seeded: GroupMemberValues = {};
    for (const def of members) {
      const saved = initial.find((condition) => condition.attribute === def.name);
      seeded[def.name] = conditionToDraft(saved, def);
    }
    return seeded;
  });

  const form = useAppForm({
    defaultValues,
    validators: {
      // Cross-member rules run live so a rule error placed on one member
      // clears when the user fixes a different member (no stale-error
      // deadlock); the "at least one" gate is held back to submit.
      onChange: ({ value }) =>
        evaluateGroupRules(group, value as GroupMemberValues, {
          requireAtLeastOne: false,
        }),
      onSubmit: memberSchema,
      onSubmitAsync: async ({ value }) =>
        evaluateGroupRules(group, value as GroupMemberValues),
    },
    onSubmit: ({ value }) => {
      const values = value as GroupMemberValues;
      const conditions = members
        .map((def) => draftToCondition(def.name, values[def.name] as ConditionDraft))
        .filter((condition): condition is QueryCondition => condition !== undefined);
      // A group's members combine structurally (AND); it carries no user join.
      onSave({ conditions, join: "AND" });
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
        <Fieldset legend={`${group.label} criteria (fill in any)`}>
          <Stack gap="xs">
            {members.map((def) => (
              <ConditionGroup
                key={def.name}
                form={form}
                fields={def.name}
                def={def}
                label={def.label}
              />
            ))}
          </Stack>
        </Fieldset>

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
