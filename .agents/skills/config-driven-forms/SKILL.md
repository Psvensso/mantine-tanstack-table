---
name: config-driven-forms
description: Building forms from a metadata catalog with `@tanstack/react-form` v1 + zod v4 — one field-definition config driving both rendering (which input component, which choices) and validation (zod schema factories built from the metadata), the draft-vs-domain type split, declarative per-config validation rules with a zod-like `addIssue` extension point, and the two TypeScript gotchas at the schema/validator boundary (explicit `z.ZodType<Output, Input>` on factories; the dynamic-key `z.object` cast). Use when field sets are data, not code — query/filter builders, admin-defined forms, attribute editors — anywhere adding a field should mean adding a config entry, not writing a component.
---

# Config-driven forms — metadata → schema factories → generic renderer

When a form's fields come from data (a filter builder, an attribute editor,
an admin-defined form), the winning shape is **one catalog, two consumers**:

```
        ┌─────────────────────┐
        │  Field catalog      │   type, label, options, min/max, unit,
        │  (plain data)       │   custom rules
        └─────┬──────────┬────┘
              │          │
   renders    ▼          ▼   validates
  ┌───────────────┐  ┌──────────────────┐
  │ generic form  │  │ schema factories │
  │ component     │  │ (zod)            │
  └───────────────┘  └──────────────────┘
```

Adding a field — or a whole new form — means adding a config entry. Nobody
writes markup or schemas per field, and the input a user sees and the rule
that validates it can't drift apart because both read the same metadata.

Working example in this folder (generic "product filter" domain):
[examples/catalog.ts](examples/catalog.ts) — the metadata types + a config,
[examples/schemas.ts](examples/schemas.ts) — the schema factories,
[examples/ConfigDrivenForm.tsx](examples/ConfigDrivenForm.tsx) — the one
generic renderer.

## The catalog

Field definitions carry everything both consumers need — and nothing else:

```ts
export type FieldDef = {
  name: string;
  label: string;
  type: "string" | "number" | "date";
  /** string type: constrains to these values AND renders a Select. */
  options?: readonly string[];
  min?: number;           // number constraints — validated AND shown
  max?: number;
  unit?: string;
  required?: boolean;
};
```

Keep constraints (`min`, `max`, `options`) in the catalog even when a
bespoke rule could express them — metadata folds into the generated schema
*and* can drive UI affordances (input clamps, placeholder text), a
hand-written refinement can't.

A form config bundles fields plus form-wide concerns:

```ts
export type FormConfig = {
  name: string;
  label: string;
  fields: FieldDef[];
  /** "at least one filled" gate message; false disables the gate. */
  requireMessage?: string | false;
  /** Escape hatch for special cross-field rules — see below. */
  rule?: FormRule;
};
```

## Draft values vs domain values

The form state's value type is **not** the schema's output type. Mid-edit,
every slot can hold an empty state the domain type would reject:

```ts
/** What inputs produce mid-edit — includes the empty shapes. */
export type FieldValue = string | number | "" | null;
/** Draft: what the form works on. */
export type FormValues = Record<string, FieldValue>;
/** Domain: what a passing save produces (no empties). */
export type FilterCriteria = Record<string, string | number>;
```

Declare `defaultValues` in the draft type; map draft → domain only inside
`onSubmit` (which fires only after validation passed, so narrowing casts
there are safe). Provide the reverse mapping (domain → draft) for seeding an
edit of a saved object. Never use `z.infer<schema>` as the form value type —
it doesn't contain the empty states.

## Schema factories — and gotcha #1: explicit `z.ZodType<Output, Input>`

One function turns a `FieldDef` into the zod schema for a *filled* value:

```ts
export function valueSchemaFor(
  def: FieldDef,
): z.ZodType<string | number, string | number> {
  switch (def.type) {
    case "string":
      return def.options
        ? z.enum(def.options as [string, ...string[]], {
            error: `Choose a ${def.label.toLowerCase()}` })
        : z.string({ error: `Enter a ${def.label.toLowerCase()}` })
            .trim().min(1, `Enter a ${def.label.toLowerCase()}`);
    case "number": {
      let schema = z.number({ error: "Enter a number" });
      if (def.min !== undefined) schema = schema.min(def.min, `Must be at least ${def.min.toLocaleString()}`);
      if (def.max !== undefined) schema = schema.max(def.max, `Must be at most ${def.max.toLocaleString()}`);
      return schema;
    }
    case "date":
      // Date pickers that report ISO strings (e.g. Mantine DateInput)
      // validate as strings — no Date coercion.
      return z.iso.date({ error: "Choose a date" });
  }
}
```

**The explicit return annotation with BOTH type parameters is load-bearing.**
TanStack Form's validator slots (`FormValidateOrFn`/`FieldValidateOrFn`)
require a Standard Schema whose declared **input** type is *assignable to*
the field's (wider, mid-edit) value type — a narrower input is fine (an
enum schema validating a `string | null` field works), but
`z.ZodType<Output>` with only one parameter defaults its input to
`unknown`, which is assignable to nothing — the schema is *rejected at the
validator boundary* with an opaque assignability error deep in
`FormValidateOrFn`. Writing `z.ZodType<string | number, string | number>`
(output, input) fixes it. Verified both ways under TS 6.0 strict: the
single-parameter version errors at `validators.onSubmit`, the two-parameter
version compiles. The error message does not point anywhere near the cause,
so know the shape in advance.

## Gotcha #2: dynamic-key `z.object` needs a cast

Building the whole-form schema from config means dynamic keys:

```ts
export function configSchema(
  config: FormConfig,
): z.ZodType<FormValues, FormValues> {
  const shape: Record<string, z.ZodType> = {};
  for (const def of config.fields) {
    shape[def.name] = optionalValueSchema(def); // empty allowed; parses when filled
  }
  // z.object over a Record<string, ZodType> infers input/output as
  // Record<string, unknown> — too loose for the validator boundary (see
  // gotcha #1). The runtime shape IS exactly FormValues, so assert it:
  return z.object(shape) as unknown as z.ZodType<FormValues, FormValues>;
}
```

The double cast (`as unknown as`) is required; a direct `as` fails because
the inferred and asserted types don't overlap in TS's eyes. This is the one
place a cast is the correct tool: zod can't statically know config-driven
keys, and the alternative (per-config hand-written schemas) defeats the
whole pattern.

`optionalValueSchema(def)` is the "empty is fine, filled must parse"
wrapper — the shape config-driven fields almost always need, since which
fields are used is the user's choice:

```ts
function optionalValueSchema(def: FieldDef): z.ZodType {
  return z.custom<FieldValue>().superRefine((value, ctx) => {
    if (value === "" || value === null) {
      if (def.required) ctx.addIssue({ code: "custom", message: `${def.label} is required` });
      return;
    }
    const result = valueSchemaFor(def).safeParse(value);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: result.error.issues[0]?.message ?? "Invalid value" });
    }
  });
}
```

Issues emitted at the slot level get the field's own path when the object
schema runs — they land on real mounted fields and clear on change.

## Declarative rules: a zod-flavored extension point in the config

Special cross-field logic ("digital products have no weight") stays in the
config as a function with a deliberately zod-like ctx, so config authors
write familiar syntax without owning schema plumbing:

```ts
export type RuleCtx = {
  addIssue: (issue: { path: (string | number)[]; message: string }) => void;
};
export type FormRule = (values: FormValues, ctx: RuleCtx) => void;

// in a config:
rule: (values, ctx) => {
  if (values.category === "Digital" && !isEmpty(values.weight)) {
    ctx.addIssue({ path: ["weight"], message: "Digital products have no weight" });
  }
},
```

One evaluator converts collected issues into the `{ form, fields }` shape
TanStack Form's *function* validators accept — pathed issues become field
errors, empty-path issues fold into the form-level message. Routing through
`{ form, fields }` instead of a real zod `.superRefine` is a **safety
property**: a zod issue with `path: []` used as a form-level schema maps to
a phantom unmountable `""` field and permanently deadlocks `canSubmit`
(verified against form-core 1.33) — this evaluator makes that mistake
inexpressible for config authors:

```ts
export function evaluateRules(
  config: FormConfig,
  values: FormValues,
  { requireAtLeastOne = true }: { requireAtLeastOne?: boolean } = {},
): { form?: string; fields: Record<string, string> } | null {
  const fields: Record<string, string> = {};
  let form: string | undefined;

  if (requireAtLeastOne && config.requireMessage !== false) {
    const anyFilled = config.fields.some((def) => !isEmpty(values[def.name]));
    if (!anyFilled) form = config.requireMessage ?? "Fill in at least one field";
  }

  config.rule?.(values, {
    addIssue: ({ path, message }) => {
      const key = path.join(".");
      if (key) fields[key] ??= message;
      else form ??= message;
    },
  });

  return form !== undefined || Object.keys(fields).length > 0
    ? { form, fields }
    : null;
}
```

Wire it with the standard layering (relational rules live so they
self-clear when *any* involved field changes; gates on submit only so an
untouched form isn't nagged):

```ts
const form = useForm({
  defaultValues: emptyValues(config),
  validators: {
    onChange: ({ value }) => evaluateRules(config, value, { requireAtLeastOne: false }),
    onSubmit: configSchema(config),
    onSubmitAsync: async ({ value }) => evaluateRules(config, value),
  },
  onSubmit: ({ value }) => onSave(toDomain(config, value)),
});
```

(The deadlock mechanics and why each rule kind sits in that slot are their
own topic — if a `tanstack-form-cross-field` skill is available it covers
them in depth; the wiring above is correct as-is either way.)

## The generic renderer

One component maps metadata → input. The UI library is incidental; the
pattern is the switch:

```tsx
switch (def.type) {
  case "string": return def.options ? <Select data={[...def.options]} ... /> : <TextInput ... />;
  case "number": return <NumberInput min={def.min} max={def.max} suffix={def.unit && ` ${def.unit}`} ... />;
  case "date":   return <DateInput ... />; // reports ISO string — matches z.iso.date()
}
```

The same `FieldDef` that generated the schema clamps the NumberInput and
labels the unit — metadata consumed twice, defined once. Full component in
[examples/ConfigDrivenForm.tsx](examples/ConfigDrivenForm.tsx), including
the per-field live validator (quiet while empty — required-ness is the
submit schema's job; flagging a field the moment it renders is noise):

```ts
validators: {
  onChange: ({ value }) => {
    if (value === "" || value === null) return undefined;
    const result = valueSchemaFor(def).safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  },
}
```

## Checklist for a new config-driven form

1. Define the draft value type (include every empty shape the inputs
   produce) and the domain type separately; write the two mappers.
2. `valueSchemaFor(def)` with the explicit `z.ZodType<Out, In>` annotation.
3. `configSchema(config)` with the `as unknown as` cast; optional-slot
   wrapper for user-chooses-what-to-fill forms.
4. `evaluateRules` routing config `rule` issues into `{ form, fields }` —
   never let config rules produce root-path zod issues.
5. One renderer switching on `def.type`; feed constraints to both the
   schema and the input props.

## Sources

- `@tanstack/react-form` v1.33, zod v4.4, `@mantine/core` v9 (UI layer
  incidental). The phantom-`""`-field deadlock and `{ form, fields }`
  clearing behavior verified headlessly against `@tanstack/form-core` 1.33;
  both TypeScript gotchas reproduce under TS 6.0 strict — the annotations
  shown are the minimal fixes found by hitting the errors in real code.
- Examples in this folder compile standalone under `tsc --strict`:
  [examples/catalog.ts](examples/catalog.ts),
  [examples/schemas.ts](examples/schemas.ts),
  [examples/ConfigDrivenForm.tsx](examples/ConfigDrivenForm.tsx).
