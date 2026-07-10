---
name: tanstack-form
description: Reference for `@tanstack/react-form` v1 — `useForm`, the `form.Field` render-prop pattern, wiring Mantine controlled inputs, Standard Schema validation with zod (no adapter package needed), the field-level-vs-form-level validator split, and `form.Subscribe`/`useStore` for scoped re-renders. Use whenever building or editing a form with `@tanstack/react-form`, e.g. files that call `useForm` or render `form.Field`. For editable-table-cell composition (a `form.AppField` per cell of a `@tanstack/react-table` row), use `npx @tanstack/intent@latest load @tanstack/react-table#react/compose-with-tanstack-form` instead — this skill covers standalone forms. For the zod side of validation, see the `zod` skill.
---

# `@tanstack/react-form` v1 — standalone forms

Reference implementation in this repo:
[`src/examples/FormValidationExample.tsx`](../../../src/examples/FormValidationExample.tsx)
— a Mantine "New Employee" form validated with zod.

## Setup

```bash
npm install @tanstack/react-form zod
```

zod v4 implements the [Standard Schema](https://standardschema.dev) spec, and
`@tanstack/react-form` accepts any Standard Schema directly as a validator —
**no `@tanstack/zod-form-adapter` or similar package is needed** (that was a
v0 requirement, removed in v1).

## Core shape

```tsx
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a full name"),
  email: z.email("Enter a valid email address"),
});

const form = useForm({
  defaultValues: { name: "", email: "" },
  validators: { onSubmit: schema }, // see "Where to put the schema" below
  onSubmit: ({ value }) => {
    const parsed = schema.parse(value); // see note below
    // ...
  },
});
```

```tsx
<form
  onSubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    void form.handleSubmit();
  }}
>
  <form.Field name="name" validators={{ onChange: schema.shape.name }}>
    {(field) => (
      <TextInput
        label="Name"
        value={field.state.value}
        onChange={(e) => field.handleChange(e.currentTarget.value)}
        onBlur={field.handleBlur}
        error={firstErrorMessage(field.state.meta.errors)}
      />
    )}
  </form.Field>
</form>
```

`form.Field` is a render-prop component, not a `name`-attribute-driven input
like native HTML forms or React Hook Form's `register`. Every input is wired
by hand: `value={field.state.value}`, `onChange={(e) =>
field.handleChange(...)}`, `onBlur={field.handleBlur}`. There's no implicit
DOM-based value collection.

**`onSubmit` must call `e.preventDefault()` and `e.stopPropagation()`** before
`form.handleSubmit()` — the library doesn't do this for you, and a nested form
without `stopPropagation()` can double-submit if it's inside another form-like
element.

## `field.state.meta.errors` holds objects, not strings — verified

This is the sharpest gotcha in the whole API. When a field's validator is a
Standard Schema (a zod schema, directly — see above), a failed validation
populates `field.state.meta.errors` with the schema's **issue objects**
(`{ message, path, code, ... }`), not plain strings. Confirmed by running
`@tanstack/form-core` headlessly:

```
errors: [
  { origin: "string", code: "too_small", minimum: 2, path: [], message: "Too short" }
]
```

Official-looking examples that do `field.state.meta.errors.join(',')` only
work when every validator is a plain function returning a string. Mixing in a
zod schema breaks that pattern silently (renders `[object Object]`). Always
normalize:

```ts
function firstErrorMessage(errors: ReadonlyArray<unknown>): string | undefined {
  const [issue] = errors;
  if (issue == null) return undefined;
  return typeof issue === "string" ? issue : (issue as { message: string }).message;
}
```

## Where to put the schema: field-level vs form-level — verified

Two validator surfaces exist and they serve different purposes; use both
together, not one instead of the other:

- **Field-level** (`<form.Field validators={{ onChange: schema.shape.x }}>`):
  runs when that specific field changes. Gives live, per-keystroke feedback
  on the field the user is actually editing.
- **Form-level** (`useForm({ validators: { onSubmit: wholeObjectSchema } })`):
  runs the entire object on every submit attempt and is the **only** thing
  that reliably catches a field the user never touched. Confirmed by testing
  `FormApi.handleSubmit()` headlessly: a form-level `onSubmit` schema
  populates `errorMap.onSubmit` for *every* field with an issue — including
  fields with `isTouched: false` — and correctly flips `canSubmit` to
  `false`. Field-level `onChange`/`onBlur` validators never fire for a field
  the user hasn't interacted with, so relying on them alone lets an empty
  required field slip through on first submit.

Practical pattern: field-level `onChange` (or `onBlur`) validators reusing
`schema.shape.<field>` for responsiveness, plus a form-level `onSubmit:
schema` as the authoritative gate. One schema, two read sites — they can't
drift out of sync because the field-level validators are literally
`schema.shape.x`.

**Don't gate error display on `isTouched`.** Since mounting a field never
runs its validator (confirmed: a freshly-mounted field has `errors: []`
until its value changes or a submit attempt runs), `errors.length > 0` alone
is a safe, sufficient display condition — it's naturally empty until the user
interacts *or* submits, and a failed submit populates it even for untouched
fields (which `isTouched`-gating would incorrectly hide).

## Re-parsing in `onSubmit`

`onSubmit: ({ value })`'s `value` keeps the *form's* value type (whatever you
declared in `defaultValues`, e.g. `salary: number | ""` to match a Mantine
`NumberInput`), not the schema's narrowed output type — TypeScript has no way
to know the form-level validator ran and passed by the time `onSubmit` fires.
If you need the validated/coerced shape (e.g. `department` narrowed to a
literal union, `salary` narrowed from `number | ""` to `number`), re-parse
explicitly: `const parsed = schema.parse(value)`. This is cheap — the
validator already ran moments ago and `onSubmit` only fires when it passed.

## Scoped re-renders: `form.Subscribe`

Reading `form.state.X` directly in the component body re-renders the whole
form on every keystroke (every field write updates form state). Push
form-state-driven UI (like a submit button's disabled/loading state) into a
`form.Subscribe` so only that subtree re-renders:

```tsx
<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
  {([canSubmit, isSubmitting]) => (
    <Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
      Submit
    </Button>
  )}
</form.Subscribe>
```

Each `form.Field` already scopes its own re-renders to that field's state —
this is only needed for state that lives on the form itself (`canSubmit`,
`isSubmitting`, `submissionAttempts`, aggregate `errors`, etc).

## Wiring Mantine inputs — the value types aren't uniform

Mantine's controlled-input `onChange` payloads differ by component, so the
form's `defaultValues` type has to match each input's actual "empty" and
"changed" shapes, not an idealized schema-output shape:

| Mantine component | `onChange` gives you | Form field type |
| --- | --- | --- |
| `TextInput` | `e.currentTarget.value: string` | `string` |
| `NumberInput` | `value: number \| string` (`""` when cleared) | `number \| ""` |
| `Select` | `value: string \| null` | `T \| null` |
| `MultiSelect` | `value: string[]` | `string[]` |
| `DateInput` (`@mantine/dates`) | `value: DateStringValue \| null` — an **ISO string**, not a `Date` | `string \| null` |

The `DateInput` one is easy to get wrong: it's tempting to type the field as
`Date | null` since that's what you'd naturally validate against, but the
component never gives you a `Date` — validate the ISO string directly (zod:
`z.iso.date()`, see the `zod` skill) rather than coercing.

Keep the "form values" type distinct from `z.infer<typeof schema>` — the
former is what the inputs produce mid-edit (including invalid/empty
states), the latter is what a *passing* validation guarantees.

## Reset and imperative access

`form.reset()` restores `defaultValues` and clears all field meta (errors,
touched, dirty). No argument needed for the common case; pass a partial
object to reset to different values.

## Reusable field components and array fields

Not covered in depth here — for the createFormHook / createFormHookContexts
pattern (registering `TextField`/`NumberField`/etc. once and reusing them
across a codebase) and array-field mutation (`form.pushFieldValue`,
`form.removeFieldValue`, subscribing to `data.length` instead of the whole
array to avoid re-render storms), see
`npx @tanstack/intent@latest load @tanstack/react-table#react/compose-with-tanstack-form`
— it's framed around editable table cells but the form-side patterns
(`createFormHook`, `useStore` scoping, array mutation) are general.

## Sources

- `@tanstack/react-form` v1.33.0 and `@tanstack/form-core` v1.33.0
  (`node_modules/@tanstack/form-core/dist/esm/{FieldApi,FormApi}.js`) — the
  error-shape and field-vs-form-validator claims above were verified by
  instantiating `FormApi`/`FieldApi` headlessly and inspecting
  `field.state.meta` / `form.state.errorMap` after `setValue` and
  `handleSubmit()` calls, not taken from docs prose.
- `@tanstack/intent` skill `@tanstack/react-table#react/compose-with-tanstack-form`
  (table+form composition, `createFormHook`, array fields).
- `@mantine/dates` `DateInputProps` (`node_modules/@mantine/dates/lib/components/DateInput/DateInput.d.ts`)
  for the `onChange: (value: DateStringValue | null) => void` signature.
