/**
 * The one generic renderer — any FormConfig in, a validated form out.
 * Mantine is the incidental UI layer; the pattern is the `switch` on
 * `def.type` and the validator wiring. See ../SKILL.md.
 */
import { Button, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@tanstack/react-form";
import {
  emptyValues,
  toDomain,
  type FieldDef,
  type FieldValue,
  type FilterCriteria,
  type FormConfig,
} from "./catalog";
import { configSchema, evaluateRules, liveFieldError } from "./schemas";

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

/** Metadata → input component. The same def that generated the schema also
 * clamps the NumberInput and labels the unit — defined once, consumed twice. */
function FieldInput({
  def,
  value,
  onChange,
  onBlur,
  error,
}: {
  def: FieldDef;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
  error: string | undefined;
}) {
  switch (def.type) {
    case "string":
      return def.options ? (
        <Select
          label={def.label}
          data={[...def.options]}
          value={typeof value === "string" && value !== "" ? value : null}
          onChange={(v) => onChange(v)}
          onBlur={onBlur}
          error={error}
          clearable
        />
      ) : (
        <TextInput
          label={def.label}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
          onBlur={onBlur}
          error={error}
        />
      );
    case "number":
      return (
        <NumberInput
          label={def.label}
          min={def.min}
          max={def.max}
          suffix={def.unit ? ` ${def.unit}` : undefined}
          value={typeof value === "number" ? value : ""}
          // Mantine NumberInput reports number | string ("" when cleared).
          onChange={(v) => onChange(v === "" ? null : v)}
          onBlur={onBlur}
          error={error}
        />
      );
    case "date":
      return (
        <DateInput
          label={def.label}
          // Mantine DateInput reports an ISO date STRING (or null), not a
          // Date — which is why the schema side is z.iso.date().
          value={typeof value === "string" && value !== "" ? value : null}
          onChange={(v) => onChange(v)}
          onBlur={onBlur}
          error={error}
          clearable
        />
      );
  }
}

export function ConfigDrivenForm({
  config,
  onSave,
}: {
  config: FormConfig;
  onSave: (criteria: FilterCriteria) => void;
}) {
  const form = useForm({
    defaultValues: emptyValues(config),
    validators: {
      // Relational config rules: live, so an error placed on one field
      // clears when the user fixes ANY involved field.
      onChange: ({ value }) =>
        evaluateRules(config, value, { requireAtLeastOne: false }),
      // Structural: every filled slot parses per its metadata.
      onSubmit: configSchema(config),
      // Gate: "at least one filled" — submit-time only.
      onSubmitAsync: async ({ value }) => evaluateRules(config, value),
    },
    // Fires only when all layers pass — draft → domain narrowing is safe.
    onSubmit: ({ value }) => onSave(toDomain(config, value)),
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
        {config.fields.map((def) => (
          <form.Field
            key={def.name}
            name={def.name}
            validators={{
              // Live per-field feedback; quiet while empty.
              onChange: ({ value }) => liveFieldError(def, value),
            }}
          >
            {(field) => (
              <FieldInput
                def={def}
                value={field.state.value}
                onChange={(value) => field.handleChange(value)}
                onBlur={field.handleBlur}
                error={firstErrorMessage(field.state.meta.errors)}
              />
            )}
          </form.Field>
        ))}

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
              Apply {config.label.toLowerCase()}
            </Button>
          )}
        </form.Subscribe>
      </Stack>
    </form>
  );
}
