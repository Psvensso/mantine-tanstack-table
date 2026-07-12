import { Flex, Text } from "@mantine/core";
import { ConditionScope } from "./contexts";
import { withFieldGroup } from "./formHook";
import { liveSlotError } from "../validation";
import type { AttributeDef, ConditionDraft } from "../types";

const CONDITION_DEFAULTS: ConditionDraft = {
  operator: null,
  value: null,
  valueTo: null,
};

/**
 * The reusable default condition block — operator select plus the value
 * input(s) the operator calls for. Being a field group, it mounts at any
 * key of any subform's values whose shape is a ConditionDraft:
 *
 *   <ConditionGroup form={form} fields="price" def={PRICE} />
 *
 * Field names inside are group-relative ("operator", not "price.operator"),
 * which is what makes the block reusable. Subforms that want different
 * markup skip it and compose the ConditionScope + AppField parts directly.
 */
export const ConditionGroup = withFieldGroup({
  defaultValues: CONDITION_DEFAULTS,
  props: {} as { def: AttributeDef; label?: string },
  render: function ConditionGroupRender({ group, def, label }) {
    return (
      <ConditionScope def={def}>
        <Flex gap="sm" align="flex-start" wrap="wrap">
          {label !== undefined && (
            <Text size="sm" w={130} pt={8} title={def.description}>
              {label}
            </Text>
          )}

          <group.AppField
            name="operator"
            listeners={{
              // The operator decides the value shape — a range partner may
              // appear or vanish — so stale values must not survive a switch.
              onChange: () => {
                group.setFieldValue("value", null);
                group.setFieldValue("valueTo", null);
              },
            }}
          >
            {(field) => <field.OperatorSelect />}
          </group.AppField>

          <group.AppField
            name="value"
            validators={{
              onChange: ({ value }) => liveSlotError(def, value),
            }}
          >
            {(field) => (
              <group.Subscribe selector={(state) => state.values.operator}>
                {(operator) => (
                  <field.ValueInput
                    placeholder={operator === "between" ? "From" : "Value"}
                  />
                )}
              </group.Subscribe>
            )}
          </group.AppField>

          <group.Subscribe selector={(state) => state.values.operator}>
            {(operator) =>
              operator === "between" ? (
                <group.AppField
                  name="valueTo"
                  validators={{
                    onChange: ({ value }) => liveSlotError(def, value),
                  }}
                >
                  {(field) => <field.ValueInput placeholder="To" />}
                </group.AppField>
              ) : null
            }
          </group.Subscribe>
        </Flex>
      </ConditionScope>
    );
  },
});
