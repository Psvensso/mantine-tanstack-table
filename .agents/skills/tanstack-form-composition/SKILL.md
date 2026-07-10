---
name: tanstack-form-composition
description: Advanced `@tanstack/react-form` v1 patterns beyond a single ad-hoc form — `createFormHook`/`createFormHookContexts` for reusable typed Mantine field components (`form.AppField`, `field.TextField`), `withForm`/`formOptions` for splitting large forms, array fields (`mode="array"`, `pushValue`/`removeValue`, `people[${i}].name` sub-field names), linked-field validation (`onChangeListenTo`), debounced async validators (`onChangeAsync` + `onChangeAsyncDebounceMs`), and mapping server-side submit errors onto fields (`onSubmitAsync` returning `{ fields }`). Use when building an app's shared form infrastructure, a multi-section or dynamic-list form, or wiring server validation errors. For single-form basics (`useForm`, `form.Field` wiring, zod, error display) see the `tanstack-form` skill first.
---

# `@tanstack/react-form` v1 — composition & advanced patterns

Prerequisite: the `tanstack-form` skill (basic `useForm`/`form.Field` wiring,
the error-objects-not-strings gotcha, Mantine value types). This skill covers
what to do once an app has more than one form, or one big/dynamic one.

## `createFormHook`: register Mantine field components once

The single highest-leverage pattern for a codebase with many forms. Instead
of hand-wiring `value`/`onChange`/`onBlur`/`error` on every input, register
typed wrapper components once and consume them via `form.AppField`:

```tsx
// src/form/app-form.ts — ONE per app, everything imports from here
import { createFormHookContexts, createFormHook } from "@tanstack/react-form";
import { Button, TextInput } from "@mantine/core";

const { fieldContext, useFieldContext, formContext, useFormContext } =
  createFormHookContexts();

// Field components: useFieldContext<TValue>() — generic is the FIELD value type
function TextField({ label }: { label: string }) {
  const field = useFieldContext<string>();
  return (
    <TextInput
      label={label}
      value={field.state.value}
      onChange={(e) => field.handleChange(e.currentTarget.value)}
      onBlur={field.handleBlur}
      error={firstErrorMessage(field.state.meta.errors)}
    />
  );
}

// Form components: useFormContext() + form.Subscribe for form-level state
function SubmitButton({ label }: { label: string }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: { TextField },
  formComponents: { SubmitButton },
  fieldContext,
  formContext,
});
```

Usage — `useAppForm` replaces `useForm`; fields render through
`form.AppField` (which provides `fieldContext`), form components need the
`form.AppForm` wrapper (which provides `formContext`):

```tsx
const form = useAppForm({
  defaultValues: { name: "" },
  onSubmit: ({ value }) => save({ employee: value }),
});

<form.AppField
  name="name"
  validators={{ onChange: schema.shape.name }}
  children={(field) => <field.TextField label="Name" />}
/>
<form.AppForm>
  <form.SubmitButton label="Save" />
</form.AppForm>
```

`field.TextField` (capital, off the render-prop arg) is the registered
component pre-bound to *this* field — not an import. Rendering a registered
form component outside `<form.AppForm>` throws a missing-context error.

## `withForm` + `formOptions`: splitting a large form

Break a long form into per-section components that all operate on the one
parent form instance:

```tsx
import { formOptions } from "@tanstack/react-form";
import { useAppForm, withForm } from "../form/app-form";

export const employeeFormOpts = formOptions({
  defaultValues: { name: "", email: "", salary: 0 },
});

export const ContactSection = withForm({
  ...employeeFormOpts,
  props: { title: "Contact" },
  render: ({ form, title }) => (
    <fieldset>
      <legend>{title}</legend>
      <form.AppField name="email" children={(f) => <f.TextField label="Email" />} />
    </fieldset>
  ),
});

// parent
const form = useAppForm({ ...employeeFormOpts, onSubmit: ... });
return <ContactSection form={form} title="Contact details" />;
```

**`withForm`'s `defaultValues` are type-checking only — verified.** Rendered
with a parent whose `defaultValues` differed from the `withForm` ones, the
output showed the parent's runtime values everywhere; the `withForm` values
never appeared. They exist so `form.AppField name="..."` type-checks inside
the section without re-declaring generics. Spread the shared `formOptions`
into both so they can't drift.

## Array fields

Address array items with bracket paths and render the list from the array
field's own state:

```tsx
<form.Field name="people" mode="array">
  {(field) => (
    <>
      {field.state.value.map((_, i) => (
        <form.AppField
          key={i}
          name={`people[${i}].name`}
          children={(f) => <f.TextField label={`Person ${i + 1}`} />}
        />
      ))}
      <Button onClick={() => field.pushValue({ name: "" })}>Add</Button>
      <Button onClick={() => field.removeValue(0)}>Remove first</Button>
    </>
  )}
</form.Field>
```

Mutators — verified against v1.33 by calling each headlessly:

- On the array **field** (`mode: "array"`): `pushValue`, `removeValue`,
  `insertValue`, `swapValues`, `moveValue`, `replaceValue`, `clearValues`.
- On the **form**: `pushFieldValue`, `removeFieldValue`, `insertFieldValue`,
  `swapFieldValues`, `replaceFieldValue`, `clearFieldValues` — but **no
  `moveFieldValue`**; move exists only on the field API. Don't invent it.

Sub-field names use bracket indices (`people[0].name`), and a sub-field
`handleChange` writes into the parent array immutably (verified: the form's
`values.people` reflects it immediately).

If rendering the whole list from `field.state.value` causes visible re-render
churn on large lists, subscribe to just the length instead
(`useStore(form.store, (s) => s.values.people.length)`) and let each row's
own `form.Field` track its item.

## Linked fields: `onChangeListenTo` — verified

A field's validator normally runs only when *that* field changes. For
confirm-password-style rules, make one field's validator re-run when another
field changes:

```tsx
<form.Field
  name="confirm"
  validators={{
    onChangeListenTo: ["password"],
    onChange: ({ value, fieldApi }) =>
      value !== fieldApi.form.getFieldValue("password")
        ? "Passwords do not match"
        : undefined,
  }}
>
```

Verified headlessly: with `confirm = "abc"` and `password` empty, the error
is set; changing `password` to `"abc"` — without touching `confirm` — clears
it; changing `password` again re-sets it. Without `onChangeListenTo`, the
error would go stale until the user re-edited `confirm`.

## Debounced async validation — verified

```tsx
validators={{
  onChange: z.string().min(3, "Min 3 characters"),        // sync, every keystroke
  onChangeAsyncDebounceMs: 500,
  onChangeAsync: z.string().refine(
    async (username) => !(await api.usernameTaken({ username })),
    { message: "Username is taken" },
  ),
}}
```

Verified behavior (v1.33, headless, 200ms debounce, 5 rapid `handleChange`
calls): the async validator ran **2** times, not 5 — the debounce coalesces
keystrokes. The sync `onChange` validator still runs on every keystroke,
unaffected. When the async schema fails, its issues land in
`errorMap.onChange` (merged with the sync validator's key — there is **no**
separate `errorMap.onChangeAsync`), as Standard Schema issue objects — the
same `.message` normalization from the `tanstack-form` skill applies.

## Server errors on submit: `onSubmitAsync` returning `{ fields }` — verified

To surface backend validation errors ("email already registered") on the
right fields, use a **form-level** async submit validator that returns a
field-keyed error map. Returning `null`/`undefined` means valid:

```tsx
const form = useAppForm({
  defaultValues: { email: "" },
  validators: {
    onSubmitAsync: async ({ value }) => {
      const result = await api.register({ registration: value });
      if (result.ok) return null;
      return {
        fields: { email: result.emailError }, // keyed by field name
      };
    },
  },
});
```

Verified headlessly: after a rejected submit, the string appears in that
field's `state.meta.errors`, and `form.state.canSubmit` flips to `false`;
a later submit that returns `null` clears the field error. This keeps the
server round-trip inside the validation lifecycle instead of hand-managing
error state in `onSubmit`.

## Sources

- `@tanstack/react-form` / `@tanstack/form-core` v1.33.0. Every claim marked
  "verified" was confirmed by executing the installed packages headlessly
  (`renderToString` for the `createFormHook`/`withForm` runtime-values claim;
  `FormApi`/`FieldApi` instances for array mutators, `onChangeListenTo`,
  async debounce counts, and `onSubmitAsync` `{ fields }` mapping) — not
  taken from docs prose.
- TanStack Form form-composition guide (React) for the
  `createFormHookContexts`/`createFormHook`/`withForm` API shape.
- Related: `tanstack-form` (basics), `zod` (schema side), and
  `npx @tanstack/intent@latest load @tanstack/react-table#react/compose-with-tanstack-form`
  (the table-editable-cells specialization of these same patterns).
