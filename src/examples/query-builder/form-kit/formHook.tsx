import { Button, Text } from "@mantine/core";
import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext, useFormContext } from "./contexts";
import { OperatorSelect, ValueInput } from "./fields";
import { formErrorMessage } from "../validation";

/** Submit button wired to the surrounding form's canSubmit/isSubmitting. */
function SaveButton({ label = "Save" }: { label?: string }) {
  const form = useFormContext();
  return (
    <form.Subscribe
      selector={(state) => [state.canSubmit, state.isSubmitting] as const}
    >
      {([canSubmit, isSubmitting]) => (
        <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}

/** Renders the form-level submit error — where a subform schema's root-level
 * (`path: []`) refinement issues land, e.g. "fill in at least one". */
function FormError() {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
      {(error) => {
        const message = formErrorMessage(error);
        return message ? (
          <Text size="sm" c="red">
            {message}
          </Text>
        ) : null;
      }}
    </form.Subscribe>
  );
}

/**
 * The app-wide form hook: every subform builds on this. Field components
 * come pre-bound off form.AppField's render prop; form components render
 * inside <form.AppForm>. withFieldGroup powers reusable multi-field blocks
 * (see ConditionGroup.tsx).
 */
export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: { OperatorSelect, ValueInput },
  formComponents: { SaveButton, FormError },
  fieldContext,
  formContext,
});
