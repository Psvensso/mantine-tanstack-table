---
name: tanstack-form-cross-field
description: Cross-field and whole-form validation in `@tanstack/react-form` v1 with zod v4 — the root-path (`path:[]`) schema-issue deadlock that permanently disables submit (a phantom unmountable `""` field), the `{ form, fields }` function-validator return shape that recovers correctly, running relational rules at form-level `onChange` so an error on field A clears when field B is fixed, and the resulting validator layering recipe (structural schema on `onSubmit`, relational rules on `onChange`, gates on `onSubmitAsync`). Use whenever a form has rules spanning multiple fields ("if X then not Y", "at least one of these") or a whole-form error message — get this wrong and `canSubmit` sticks false with no visible reason.
---

# Cross-field & whole-form validation — `@tanstack/react-form` v1 + zod v4

Per-field validation (a zod schema per field, or one object schema on
`onSubmit`) is well-trodden. The failure modes start when a rule spans
fields — "electric engines have no cylinder volume", "fill in at least one
contact method", "budget requires a license". Two of those failure modes
silently **deadlock `canSubmit` to `false` forever**, with the error either
invisible or visibly cleared while the form still refuses to submit. Both
were hit in real code and both are verified below against
`@tanstack/form-core` 1.33.

Runnable demonstration of everything here:
[examples/cross-field-validators.tsx](examples/cross-field-validators.tsx)
(same folder as this file).

## The three kinds of rules — and where each must live

| Rule kind | Example | Validator slot | Written as |
| --- | --- | --- | --- |
| Structural, per-field | "value must be a number ≤ max" | form-level `onSubmit` (+ optional field-level `onChange` for live feedback) | zod schema with **field-pathed** issues |
| Relational, cross-field | "if fuel = Electric, cylinder volume must be empty" | form-level **`onChange`** | function returning `{ fields }` |
| Whole-form gate | "fill in at least one" | form-level `onSubmit`/`onSubmitAsync` | function returning a string or `{ form }` |

The two rules behind this table:

1. **A whole-form message must come from a function validator, never from a
   zod issue with an empty path.** (Deadlock #1 below.)
2. **A rule whose error lands on field A but is triggered by field B must
   run on `onChange`, not only on submit.** (Deadlock #2 below.)

## Deadlock #1: root-path schema issues create a phantom `""` field — verified

The tempting way to write "fill in at least one" is a `.superRefine` on the
whole object schema used as the form-level validator:

```ts
// ❌ DO NOT — permanently disables submit
const schema = z.object({ email: z.string(), phone: z.string() })
  .superRefine((v, ctx) => {
    if (v.email === "" && v.phone === "") {
      ctx.addIssue({ code: "custom", path: [], message: "Fill in at least one" });
    }
  });
const form = useForm({ validators: { onSubmit: schema } });
```

What actually happens (verified headlessly against form-core 1.33):

- TanStack Form maps a form-level schema's issues onto fields **by joined
  path**. An issue with `path: []` maps to a field literally named `""` — a
  field that does not exist and can never mount.
- `errorMap.onSubmit` becomes a grouped object `{ "": [issue] }` (not a
  string, not an array — see "Reading the form-level error" below).
- After the failed submit, the user fixes the data. The phantom `""` field
  has no `onChange` to re-run, and form-level `onSubmit` validators only run
  on submit — but `canSubmit` is already `false`, so the submit button built
  the usual way (`disabled={!canSubmit}`) can never be pressed again.
  **Verified: after fixing every field, `canSubmit` remains `false`.**

The fix is a *function* validator — TanStack Form treats its return value as
a form error directly, no path-mapping involved, and a passing re-submit
clears it (verified: `canSubmit` recovers):

```ts
// ✅ same rule, as a function
const form = useForm({
  validators: {
    onSubmit: ({ value }) =>
      value.email === "" && value.phone === "" ? "Fill in at least one" : undefined,
  },
});
```

Corollary: form-level zod schemas are still the right tool for *structural*
validation — just make sure every issue the schema can emit has a non-empty
`path` pointing at a real, mounted field. Field-pathed issues clear normally
when that field changes.

## The `{ form, fields }` return shape — verified

A form-level function validator can return richer than a string:

```ts
validators: {
  onSubmitAsync: async ({ value }) => {
    if (value.email === "" && value.phone === "") {
      return {
        form: "Fill in at least one contact method", // whole-form message
        fields: { email: "This one, for example" },  // keyed by field path
      };
    }
    return null; // null/undefined = valid
  },
},
```

- `fields` keys are full dotted/bracketed paths into the values object —
  nested paths like `"engine.cylinderVolume.value"` or
  `"rows[2].amount"` work and land on those mounted fields'
  `state.meta.errors` as plain strings.
- `form` lands on `form.state.errorMap.onSubmit`.
- Verified: a later submit returning `null` clears both and `canSubmit`
  recovers — unlike the schema root-path case.
- `onSubmitAsync` may be `async`; it also accepts a sync-shaped return. Use
  it when the gate needs the whole values object at submit time. (The plain
  `onSubmit` slot on the form accepts the same function shape.)

## Deadlock #2: submit-sourced cross-field errors go stale — verified

Suppose the rule "a buyer with license `None` can't have a budget" puts its
error on `budget`, and it runs on submit:

```ts
// ❌ subtle deadlock
validators: {
  onSubmitAsync: async ({ value }) =>
    value.license === "None" && value.budget !== ""
      ? { fields: { budget: "No license — no car budget" } }
      : null,
},
```

The user sees the error on `budget`, but fixes it *the other way* — changes
`license` to `"B"`. Verified sequence:

1. Submit → error on `budget`, `canSubmit: false`.
2. User changes `license` (the trigger field). The rule would now pass — but
   nothing re-runs it: field-level validators only fire for the changed
   field, and submit validators only fire on submit.
3. The stale error keeps `canSubmit: false`. Submit button dead, error
   pointing at a field whose value is fine.

**Fix: run relational rules at form-level `onChange`.** A form-level
`onChange` function runs on *every* field change and its `{ fields }` return
replaces the previous one wholesale — so it is self-clearing regardless of
which field the user fixes (verified: fixing the trigger field clears the
error on the other field and `canSubmit` recovers):

```ts
// ✅ self-clearing
validators: {
  onChange: ({ value }) =>
    value.license === "None" && value.budget !== ""
      ? { fields: { budget: "No license — no car budget" } }
      : null,
},
```

Don't put the "at least one" gate in `onChange` though — it would nag the
user the moment the form mounts and they touch anything. Gates stay on
submit; relational rules go live. Hence the layering recipe:

```ts
const form = useForm({
  defaultValues,
  validators: {
    // Relational rules: live, self-clearing, quiet when satisfied.
    onChange: ({ value }) => relationalRules(value),      // → { fields } | null
    // Structural: every field parses. Zod object schema, field-pathed issues only.
    onSubmit: structuralSchema,
    // Gates: whole-form requirements, checked only when the user tries to save.
    onSubmitAsync: async ({ value }) => gateRules(value), // → { form, fields } | null
  },
  onSubmit: ({ value }) => save(value), // fires only when all three pass
});
```

The three slots coexist; `onSubmit` (the handler) only fires when all pass.

Related but different: `onChangeListenTo` (see the `tanstack-form-composition`
skill if present) makes one *field-level* validator re-run when a named other
field changes. It works for pairwise links (confirm-password), but for rules
over many fields or rules defined in data/config, the form-level `onChange`
function is simpler and covers every trigger automatically.

## Reading the form-level error — three shapes

`form.state.errorMap.onSubmit` is not one type. Verified shapes by validator
kind:

- function returning a string → the **string** itself
- zod schema → issues **grouped by joined path**: `{ "": [rootIssues], "email": [emailIssues] }` — only the `""` key belongs to the form-level display (and per rule #1 you should never produce it, but render it if it occurs)
- some paths produce plain **issue arrays**

Normalize before rendering:

```ts
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

// field.state.meta.errors mixes zod issue objects and plain strings too:
function firstErrorMessage(errors: ReadonlyArray<unknown>): string | undefined {
  const [issue] = errors;
  if (issue == null) return undefined;
  return typeof issue === "string" ? issue : (issue as { message: string }).message;
}
```

Render it from a subscription so only that node re-renders:

```tsx
<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
  {(error) => {
    const message = formErrorMessage(error);
    return message ? <Text c="red" size="sm">{message}</Text> : null;
  }}
</form.Subscribe>
```

## Checklist when `canSubmit` is stuck `false`

1. Does any form-level **schema** emit an issue with `path: []` (root
   `.superRefine`/`.refine` on the object)? → phantom `""` field. Move the
   rule to a function validator.
2. Does a submit-time rule place an error on a field **other than** the ones
   that can invalidate it? → stale error. Move the rule to form-level
   `onChange`.
3. Dump `form.state.errorMap` and every field's `state.meta.errors` — the
   stuck error is in one of them, possibly under a key that isn't a mounted
   field.

## Sources

- `@tanstack/react-form` / `@tanstack/form-core` v1.33, zod v4.4. Every
  claim marked "verified" was confirmed by instantiating `FormApi`/`FieldApi`
  headlessly (`new FormApi(...)`, `mount()`, `handleChange`,
  `handleSubmit()`) and inspecting `state.canSubmit`, `state.errorMap`, and
  field `state.meta.errors` — 15/15 assertions passing — not taken from docs
  prose.
- Working example in this folder:
  [examples/cross-field-validators.tsx](examples/cross-field-validators.tsx).
