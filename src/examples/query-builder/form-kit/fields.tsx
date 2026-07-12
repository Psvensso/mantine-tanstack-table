import { NumberInput, Select, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useConditionScope, useFieldContext } from "./contexts";
import { firstErrorMessage } from "../validation";
import {
  OPERATOR_LABELS,
  type ConditionValue,
  type Operator,
} from "../types";

/**
 * Kit field components. Each one is registered with createFormHook (see
 * formHook.tsx) and consumed pre-bound off the AppField render prop:
 *
 *   <form.AppField name="price.operator">{(f) => <f.OperatorSelect />}</form.AppField>
 *
 * They get their field via useFieldContext and their attribute metadata via
 * the surrounding <ConditionScope>.
 */

export function OperatorSelect() {
  const field = useFieldContext<Operator | null>();
  const { def } = useConditionScope();
  return (
    <Select
      aria-label={`${def.label} operator`}
      placeholder="Operator"
      w={130}
      data={def.allowedOperators.map((op) => ({
        value: op,
        label: OPERATOR_LABELS[op],
      }))}
      value={field.state.value}
      onChange={(op) => field.handleChange(op as Operator | null)}
      onBlur={field.handleBlur}
      error={firstErrorMessage(field.state.meta.errors)}
    />
  );
}

/** Picks the input from the attribute's value type; `placeholder` marks the
 * slot's role ("Value" / "From" / "To"). */
export function ValueInput({ placeholder = "Value" }: { placeholder?: string }) {
  const field = useFieldContext<ConditionValue>();
  const { def } = useConditionScope();
  const shared = {
    onBlur: field.handleBlur,
    error: firstErrorMessage(field.state.meta.errors),
    placeholder,
    "aria-label": `${def.label} ${placeholder.toLowerCase()}`,
    style: { flex: 1, minWidth: 130 },
  };
  switch (def.type) {
    case "string":
      return def.options ? (
        <Select
          {...shared}
          data={def.options}
          value={(field.state.value as string | null) ?? null}
          onChange={(value) => field.handleChange(value)}
          clearable
        />
      ) : (
        <TextInput
          {...shared}
          value={(field.state.value as string | null) ?? ""}
          onChange={(e) => field.handleChange(e.currentTarget.value)}
        />
      );
    case "number":
      return (
        <NumberInput
          {...shared}
          suffix={def.unit ? ` ${def.unit}` : undefined}
          value={(field.state.value as number | string | null) ?? ""}
          onChange={(value) => field.handleChange(value)}
        />
      );
    case "date":
      return (
        <DateInput
          {...shared}
          value={(field.state.value as string | null) ?? null}
          onChange={(value) => field.handleChange(value)}
          clearable
        />
      );
  }
}
