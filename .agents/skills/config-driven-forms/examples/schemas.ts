/**
 * Schema factories — metadata in, zod schemas out. Holds both TypeScript
 * gotchas from ../SKILL.md: the explicit `z.ZodType<Output, Input>` on
 * `valueSchemaFor`, and the `as unknown as` cast on the dynamic-key object.
 */
import { z } from "zod";
import {
  isEmpty,
  type FieldDef,
  type FieldValue,
  type FormConfig,
  type FormValues,
} from "./catalog";

/**
 * The schema for a FILLED value slot, decided entirely by metadata.
 *
 * The explicit annotation with BOTH parameters (output, input) is
 * load-bearing: TanStack Form's validator slots require a Standard Schema
 * whose declared INPUT type is assignable to the field's mid-edit value
 * type. `z.ZodType<Output>` alone defaults input to `unknown`, which is
 * assignable to nothing — the schema fails at the `FormValidateOrFn`
 * boundary with an opaque error (verified under TS 6.0 strict).
 */
export function valueSchemaFor(
  def: FieldDef,
): z.ZodType<string | number, string | number> {
  switch (def.type) {
    case "string":
      return def.options
        ? z.enum(def.options as [string, ...string[]], {
            error: `Choose a ${def.label.toLowerCase()}`,
          })
        : z
            .string({ error: `Enter a ${def.label.toLowerCase()}` })
            .trim()
            .min(1, `Enter a ${def.label.toLowerCase()}`);
    case "number": {
      let schema = z.number({ error: "Enter a number" });
      if (def.min !== undefined) {
        schema = schema.min(def.min, `Must be at least ${def.min.toLocaleString()}`);
      }
      if (def.max !== undefined) {
        schema = schema.max(def.max, `Must be at most ${def.max.toLocaleString()}`);
      }
      return schema;
    }
    case "date":
      // Date pickers reporting ISO strings (e.g. Mantine DateInput) are
      // validated as strings — no Date coercion.
      return z.iso.date({ error: "Choose a date" });
  }
}

/**
 * "Empty is fine, filled must parse" — the shape config-driven fields
 * usually need, since which fields get used is the user's choice. Issues
 * emitted here receive the field's own path once the object schema runs,
 * so they land on real mounted fields and clear on change.
 */
function optionalValueSchema(def: FieldDef): z.ZodType {
  return z.custom<FieldValue>().superRefine((value, ctx) => {
    if (isEmpty(value)) {
      if (def.required) {
        ctx.addIssue({ code: "custom", message: `${def.label} is required` });
      }
      return;
    }
    const result = valueSchemaFor(def).safeParse(value);
    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        message: result.error.issues[0]?.message ?? "Invalid value",
      });
    }
  });
}

/**
 * Whole-form structural schema built from config. Dynamic keys mean
 * `z.object` infers `Record<string, unknown>` — too loose for the validator
 * boundary — while the runtime shape IS exactly FormValues, hence the
 * double cast (a direct `as` fails: the types don't overlap in TS's eyes).
 */
export function configSchema(
  config: FormConfig,
): z.ZodType<FormValues, FormValues> {
  const shape: Record<string, z.ZodType> = {};
  for (const def of config.fields) {
    shape[def.name] = optionalValueSchema(def);
  }
  return z.object(shape) as unknown as z.ZodType<FormValues, FormValues>;
}

/**
 * Runs the config's gate + special `rule`, returning the `{ form, fields }`
 * shape TanStack Form's FUNCTION validators accept. Pathed issues become
 * field errors; empty-path issues fold into the form message — so a config
 * author can never produce a root-path zod issue, which (as a form-level
 * schema) would map to a phantom unmountable "" field and permanently
 * deadlock canSubmit (verified against form-core 1.33).
 *
 * `requireAtLeastOne` splits the two call sites: relational rules run on
 * form-level onChange so they self-clear whichever involved field the user
 * fixes; the "at least one" gate runs on submit only, so an untouched form
 * isn't nagged the moment the user starts editing.
 */
export function evaluateRules(
  config: FormConfig,
  values: FormValues,
  { requireAtLeastOne = true }: { requireAtLeastOne?: boolean } = {},
): { form?: string; fields: Record<string, string> } | null {
  const fields: Record<string, string> = {};
  let form: string | undefined;

  if (requireAtLeastOne && config.requireMessage !== false) {
    const anyFilled = config.fields.some((def) => !isEmpty(values[def.name]));
    if (!anyFilled) {
      form = config.requireMessage ?? "Fill in at least one field";
    }
  }

  config.rule?.(values, {
    addIssue: ({ path, message }) => {
      const key = path.join(".");
      if (key) {
        fields[key] ??= message;
      } else {
        form ??= message;
      }
    },
  });

  return form !== undefined || Object.keys(fields).length > 0
    ? { form, fields }
    : null;
}

/**
 * Live per-field check: quiet while empty (required-ness is the submit
 * schema's job — flagging a field the moment it renders is noise), parses
 * once something is in it.
 */
export function liveFieldError(
  def: FieldDef,
  value: FieldValue,
): string | undefined {
  if (isEmpty(value)) return undefined;
  const result = valueSchemaFor(def).safeParse(value);
  return result.success
    ? undefined
    : (result.error.issues[0]?.message ?? "Invalid value");
}
