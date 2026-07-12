/**
 * Standalone demonstration of the cross-field validation recipe from
 * ../SKILL.md — the three validator layers and the two deadlocks they avoid.
 *
 * Domain: a contact-preferences form.
 *  - Structural (onSubmit, zod):      email must be a valid email if filled.
 *  - Relational (onChange, function): channel "sms" requires a phone number —
 *    the error lands on `phone` but is ALSO triggered/cleared by `channel`,
 *    which is exactly the case that goes stale if run only on submit.
 *  - Gate (onSubmitAsync, function):  at least one of email/phone filled —
 *    exactly the rule that deadlocks canSubmit if written as a zod
 *    root-path (`path: []`) refinement instead.
 *
 * Dependencies: @tanstack/react-form v1, zod v4, @mantine/core (any recent).
 * The Mantine layer is incidental — swap the inputs for anything controlled.
 */
import { Button, Select, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

type ContactValues = {
  email: string;
  phone: string;
  channel: "email" | "sms" | null;
};

const defaultValues: ContactValues = { email: "", phone: "", channel: null };

// ── Layer 1: structural schema. Field-pathed issues ONLY — a root-path
// (`path: []`) issue here would map to a phantom unmountable "" field and
// permanently stick canSubmit=false (verified; see SKILL.md deadlock #1).
const structuralSchema = z.object({
  email: z
    .union([z.literal(""), z.email("Enter a valid email address")])
    .describe("empty allowed; validated once filled"),
  phone: z.string(),
  channel: z.enum(["email", "sms"], { error: "Choose a channel" }),
});

// ── Layer 2: relational rules. Must run on form-level onChange so the
// { fields } map is recomputed on EVERY change — fixing `channel` clears the
// error sitting on `phone` (verified; see SKILL.md deadlock #2).
function relationalRules(value: ContactValues) {
  const fields: Record<string, string> = {};
  if (value.channel === "sms" && value.phone.trim() === "") {
    fields.phone = "SMS notifications need a phone number";
  }
  return Object.keys(fields).length > 0 ? { fields } : null;
}

// ── Layer 3: whole-form gates. Submit-time only (running this on onChange
// would nag before the user typed anything). Function validator, so the
// message clears and canSubmit recovers on the next passing submit.
function gateRules(value: ContactValues) {
  if (value.email.trim() === "" && value.phone.trim() === "") {
    return { form: "Fill in at least one way to reach you", fields: {} };
  }
  return null;
}

// field.state.meta.errors mixes zod issue objects and plain strings.
function firstErrorMessage(errors: ReadonlyArray<unknown>): string | undefined {
  const [issue] = errors;
  if (issue == null) return undefined;
  return typeof issue === "string"
    ? issue
    : (issue as { message: string }).message;
}

// form.state.errorMap.onSubmit: string | issue[] | { [joinedPath]: issue[] }.
function formErrorMessage(error: unknown): string | undefined {
  if (error == null) return undefined;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return firstErrorMessage(error);
  if (typeof error === "object") {
    if ("message" in error) return (error as { message: string }).message;
    const root = (error as Record<string, unknown>)[""];
    if (Array.isArray(root)) return firstErrorMessage(root);
  }
  return undefined;
}

export function ContactPreferencesForm({
  onSave,
}: {
  onSave: (values: ContactValues) => void;
}) {
  const form = useForm({
    defaultValues,
    validators: {
      onChange: ({ value }) => relationalRules(value),
      onSubmit: structuralSchema,
      onSubmitAsync: async ({ value }) => gateRules(value),
    },
    // Fires only when all three layers pass.
    onSubmit: ({ value }) => onSave(value),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Stack gap="sm" maw={360}>
        <form.Field name="email">
          {(field) => (
            <TextInput
              label="Email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.currentTarget.value)}
              onBlur={field.handleBlur}
              error={firstErrorMessage(field.state.meta.errors)}
            />
          )}
        </form.Field>

        <form.Field name="phone">
          {(field) => (
            <TextInput
              label="Phone"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.currentTarget.value)}
              onBlur={field.handleBlur}
              // Errors here can come from the relational onChange rule —
              // triggered by `channel`, cleared by fixing EITHER field.
              error={firstErrorMessage(field.state.meta.errors)}
            />
          )}
        </form.Field>

        <form.Field name="channel">
          {(field) => (
            <Select
              label="Preferred channel"
              data={[
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
              ]}
              value={field.state.value}
              onChange={(v) => field.handleChange(v as ContactValues["channel"])}
              onBlur={field.handleBlur}
              error={firstErrorMessage(field.state.meta.errors)}
            />
          )}
        </form.Field>

        {/* Whole-form gate message (the { form: ... } return). */}
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

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
              Save
            </Button>
          )}
        </form.Subscribe>
      </Stack>
    </form>
  );
}
