---
name: tanstack-form-multi-action
description: Pattern for a single TanStack Form driving two or more submit actions that each require a different set of fields — e.g. "Search" vs "Save search", "draft vs publish", "quick add vs full add". Use this whenever a form has multiple submit buttons with different validation rules, when some fields are required by one action and optional (or absent) for another, or when the user asks about multiple Zod schemas / multiple validators on one form. Applies to React 19 + TypeScript (strict) + TanStack Form + Zod standard-schema.
---

# One form, many actions, many schemas

Runnable demonstration of everything here:
[src/examples/MultiActionSearchFormExample.tsx](../../../src/examples/MultiActionSearchFormExample.tsx)
(a "Search" vs "Save search" form, wired into the app's `/multi-action-form` route).

## The model

Three layers. Do not collapse them.

| Layer | Contains | Role |
| --- | --- | --- |
| **`baseSchema`** | Every field on screen. Full shape rules. **All optional.** | The values shape. Source of the `FormValues` type. The form's live validator. |
| **`searchSchema`** | `baseSchema.required({ ...search-only fields })` | Enforced at submit time, search branch only. |
| **`saveSchema`** | `baseSchema.required({ ...save-only fields })` | Enforced at submit time, save branch only. |

**Optionality is per-action. Shape is universal.** A field's `z.email()`, `.max(500)`, regex, etc. is written exactly once — in the base. Children only re-add presence via `.required()`, which strips the `.optional()` wrapper and leaves every other rule intact.

## Why the base must be the live validator

`form.handleSubmit()` runs the form's validators *first* and aborts before `onSubmit` on failure. If you put an action-specific schema on the form, the *other* action's button gets blocked by requirements it doesn't care about.

So the form-level validator must be the **intersection** of what all actions need — i.e. shared shape rules with nothing action-specific required. That is `baseSchema`. Each action then enforces its own contract inside `onSubmit`.

## 1. The schemas

```ts
import { z } from "zod";

const baseSchema = z.object({
  // shared
  query: querySchema,
  name: z.string().min(1, "Required").max(100).optional(),
  // search-only
  index: z.string().optional(),
  timeRange: z.string().optional(),
  // save-only
  description: z.string().max(500).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  owner: z.string().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

const searchSchema = baseSchema.required({ index: true, timeRange: true });

const saveSchema = baseSchema
  .required({ name: true, from: true, to: true, owner: true })
  .refine((v) => v.from <= v.to, { message: "From must precede To", path: ["to"] });
```

`FormValues` is the single type for `defaultValues`, `form.state.values`, and every boundary function.

### ⚠️ `.required()` is not `.min(1)`

`.required()` removes `undefined` from the type — but `""` still passes a bare `z.string()`. Text inputs whose empty state is `""` (i.e. most of them) will submit an empty string and Zod will wave it through.

**Put the emptiness rule in the base:** `z.string().min(1, "Required").optional()`. Then `.required({ name: true })` genuinely means "non-empty string present". This is the most common bug in this pattern.

### ⚠️ `.required()`'s own message wins over the wrapped schema's `error` — verified

A field declared as `z.enum(THINGS, { error: "Choose a thing" }).optional()` looks like it will show `"Choose a thing"` once `.required()` makes it mandatory. It does not, when the value is genuinely `undefined` (key omitted or never set — the case a `<Select>` defaulted to `null`/`undefined` and never touched will hit):

```
z.object({ index: z.enum(INDEXES, { error: "Choose an index" }).optional() })
  .required()
  .safeParse({})
// → { path: ["index"], message: "Invalid input: expected nonoptional, received undefined" }
```

Verified against zod 4.4.3 — `.required()` synthesizes its own `invalid_type`/`nonoptional` issue for the missing key and does not consult the wrapped schema's `error` config. The wrapped schema's message *does* still fire for values that are present but wrong (e.g. an out-of-enum string), and — separately — a `.min(1, "message").optional()` string's message fires correctly for `""`, because that's a real present-value failure, not a missing-key one. So:

- Text inputs defaulted to `""` and gated with `.min(1, "…").optional()` → custom message always shows correctly.
- `<Select>`/date-picker fields defaulted to `undefined` and never touched before an invalid submit → the user sees zod's generic "expected nonoptional" message, not your custom one. If that matters, give the field its own `.required({ error: "Choose a thing" })` call (zod v4 accepts a params object there too) rather than relying on the child schema's `error`, or catch it with a dedicated `.refine()` on the derived schema.

## 2. Wiring: submit intent

One `useForm`, one submit path, branched on meta.

```ts
type SubmitIntent = { intent: "search" | "save" };

const form = useForm({
  defaultValues,
  onSubmitMeta: { intent: "search" } as SubmitIntent,
  validators: { onChange: baseSchema }, // the floor — blocks neither button
  onSubmit: async ({ value, meta }) => {
    form.setErrorMap({ onSubmit: undefined }); // clear stale errors from the other branch

    const schema = meta.intent === "save" ? saveSchema : searchSchema;
    const result = schema.safeParse(value);

    if (!result.success) {
      form.setErrorMap({
        onSubmit: {
          fields: Object.fromEntries(
            result.error.issues.map((i) => [i.path.join("."), i.message]),
          ),
        },
      });
      return;
    }

    if (meta.intent === "save") {
      await saveMutation.mutateAsync(toSavePayload(result.data));
    } else {
      await search(toSearchPayload(result.data));
    }
  },
});
```

```tsx
<Button onClick={() => form.handleSubmit({ intent: "search" })}>Search</Button>
<Button onClick={() => form.handleSubmit({ intent: "save" })}>Save search</Button>
```

**Clear the error map at the top of `onSubmit`.** Otherwise a failed Save leaves "Owner is required" on screen after a subsequent successful Search.

`useForm` here is the plain hook from `@tanstack/react-form` — no `createFormHook`/`useAppForm` setup required, `onSubmitMeta` and `handleSubmit(meta)` are on the base `FormApi` (verified in `FormApi.d.ts`, see Sources). If the app already has a `useAppForm` from `createFormHook` (see the `tanstack-form-composition` skill), it works identically — it's the same `FormApi` underneath with typed field components layered on top.

## 3. Project the payloads — don't send the whole values blob

The form's values are the *union* of all fields. Neither endpoint wants all of them.

```ts
const toSearchPayload = (v: z.infer<typeof searchSchema>) => ({
  query: v.query, name: v.name, index: v.index, timeRange: v.timeRange,
});

const toSavePayload = (v: z.infer<typeof saveSchema>) => ({
  query: v.query, name: v.name, description: v.description,
  from: v.from, to: v.to, owner: v.owner,
});
```

In strict TS, branch on `meta.intent` *before* calling `safeParse` (one `if`/`else`, each with its own schema and payload call) rather than hoisting a single `schema.safeParse(value)` behind a ternary — the ternary's result type is the union of both schemas' outputs, so the compiler won't let you pass it to a projector that expects one specific branch's shape.

## 4. Group the action-specific fields in the UI

If save-only fields (Description, Owner, dates) sit inline among search fields, the user can't tell why they're there. Put them under a headed section — *Save this search* — so the grouping explains itself without disabling or hiding anything.

## Verify against installed types

Two APIs here have moved between versions. Read the shipped `.d.ts`, don't trust memory or docs:

- **`onSubmitMeta` / `handleSubmit(meta)`** → `node_modules/@tanstack/form-core/dist/esm/FormApi.d.ts`
- **`setErrorMap`** shape → same file, `GlobalFormValidationError<TFormData>` in `node_modules/@tanstack/form-core/dist/esm/types.d.ts` (`{ form?: ValidationError; fields: Partial<Record<DeepKeys<TFormData>, ValidationError>> }`). If the nested `{ onSubmit: { fields: {...} } }` shape doesn't match, fall back to per-field: `form.setFieldMeta(name, (m) => ({ ...m, errorMap: { onSubmit: message } }))`.

**Zero-API-risk fallback:** if submit meta doesn't pan out, leave `onSubmit` as pure search and make Save a plain `onClick` that never calls `handleSubmit` — it just runs `saveSchema.safeParse(form.state.values)` → `setErrorMap` or mutate.

## Anti-patterns

- ❌ Putting an action-specific schema on `validators.onChange` — blocks the other button.
- ❌ Two `useForm` instances over the same fields.
- ❌ Swapping `validators.onChange` based on which button was clicked — validation flicker, stale error maps.
- ❌ Wrapping or transforming the validator output. Pass the raw Zod schema; standard-schema handles it.
- ❌ Attaching the schema at field level and expecting path-based error routing. Form level only.
- ❌ Restating shared shape rules in each child schema instead of deriving with `.required()`.
- ❌ `.transform()` in form schemas — diverges input/output types and breaks inference. Use `z.preprocess()`.

## Sources

- `@tanstack/react-form` / `@tanstack/form-core` v1.33, zod v4.4.3 — `onSubmitMeta`, `handleSubmit(meta)`, and `setErrorMap`'s `GlobalFormValidationError` shape confirmed directly against the shipped `.d.ts` files in this repo's `node_modules`. The `.required()` message-override behavior above was verified by running `safeParse` against a live schema built with the installed zod version, not taken from docs prose.
- Working example in this repo: [src/examples/MultiActionSearchFormExample.tsx](../../../src/examples/MultiActionSearchFormExample.tsx).
