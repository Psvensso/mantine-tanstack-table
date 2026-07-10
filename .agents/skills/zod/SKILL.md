---
name: zod
description: Reference for zod v4's schema API — top-level string-format schemas (`z.email()`, `z.iso.date()`, not the deprecated `.email()` chain), the unified `{ error }` param for custom messages, `.safeParse`/`.issues`/`z.treeifyError`, and integrating a schema with TanStack Router's `validateSearch` and TanStack Form's field/form validators (both consume zod via the Standard Schema spec, one schema, no adapter). Use whenever writing or editing a `z.object`/`z.string`/etc. schema. For wiring a schema into `@tanstack/react-form`, see the `tanstack-form` skill.
---

# zod v4

Covers zod `4.x`. zod v4 schemas implement the
[Standard Schema](https://standardschema.dev) spec, which is what lets the
*same* schema object plug directly into consumers like TanStack Router's
`validateSearch` or TanStack Form's validators with no adapter package.

## v4 moved string formats to top-level functions

v3's chained `.email()`/`.uuid()`/`.url()` off `z.string()` are deprecated in
v4 (still work, but the top-level form is preferred and is what the type
narrows better against):

```ts
// v4 preferred
z.email("Enter a valid email address")
z.uuid()
z.iso.date()       // "YYYY-MM-DD" string, validated by format
z.iso.datetime()   // ISO 8601 datetime string
z.url()

// v3-style, still works, avoid in new code
z.string().email()
```

`z.iso.date()` is the one to reach for when validating an ISO date **string**
(e.g. from a date picker whose `onChange` hands back a string, not a `Date`
— see the `tanstack-form` skill's Mantine `DateInput` note). It does not
coerce to `Date`; combine with `.refine()` for date-range checks against
strings, or use `z.coerce.date()` if you actually want a `Date` output and
control the input format yourself.

## Custom error messages: the `{ error }` param — verified

v4 unifies v3's scattered `message`/`errorMap`/`invalid_type_error` params
into a single `error` option, which can be a string or a function. It's
**per-schema-call**, not global — chaining a second constraint needs its own
`error`/message argument:

```ts
z.number({ error: "Enter a salary" })   // used for invalid_type (wrong kind of value)
  .min(20_000, "Salary must be at least 20,000 SEK")  // used for too_small
  .max(500_000, "That salary looks too high")          // used for too_big
```

Verified by `safeParse`-ing bad inputs against a schema built this way: a
non-number input produces the `invalid_type` message ("Enter a salary"); a
too-small number produces the `.min()` message, not the `invalid_type` one.
Each failure mode needs its own message if you want them distinguished —
there's no single "catch-all" string that covers every issue code from one
schema unless you explicitly write it that way.

The same `{ error }` param works on `z.enum(values, { error: "..." })` and
`z.date({ error: "..." })`, and — confirmed by testing — produces that
message for `null`/`undefined`/wrong-type input alike, not just "missing".

## `.safeParse` vs `.parse`

- `.safeParse(input)` → `{ success: true, data } | { success: false, error }`.
  Never throws. Use this at UI boundaries (form submit handlers, route
  `validateSearch` if you want to fall back instead of crashing the router).
- `.parse(input)` → returns data or throws `ZodError`. Fine once you already
  know the input passed validation moments ago (e.g. re-parsing inside a
  TanStack Form `onSubmit` after the form-level validator already gated
  submission — see the `tanstack-form` skill) — the point isn't error
  handling, it's recovering the narrowed output type.

## Reading errors

`error.issues` is the flat array — each issue has `message`, `path` (empty
array for a root-level/object-wide issue, `["fieldName"]` for a nested one),
and a `code` (`"too_small"`, `"invalid_type"`, `"invalid_format"`,
`"invalid_value"` for enums, `"custom"` for `.refine()`, ...).

For a nested/grouped view (e.g. to render a per-field error map for an
object schema in one shot rather than filtering `issues` by `path`
yourself), use `z.treeifyError(error)`:

```ts
z.treeifyError(result.error)
// { errors: [], properties: { email: { errors: ["Invalid email address"] }, age: { errors: [...] } } }
```

## Reusing sub-schemas: `schema.shape.field`

`z.object({...}).shape.fieldName` gives you that field's schema in
isolation — the same `ZodType` the parent object validates that key with.
This is how the `tanstack-form` skill's field-level validators stay in sync
with the form-level gate: `validators={{ onChange: employeeFormSchema.shape.name }}`
reuses the exact schema the whole-object submit validator also uses for
`name`, so there's one source of truth instead of two schemas that can drift.

## `z.infer` vs the form's working value type

`z.infer<typeof schema>` is the schema's **output** type — after any
`.transform()`/coercion, with enums/unions narrowed. Don't reuse this as a
React form's `defaultValues` type: mid-edit form state includes values a
schema would reject (`""` before a number is typed, `null` before a date is
picked), which `z.infer` doesn't represent. Declare the form's value type by
hand to match what the inputs actually produce, and let `.parse()`/`.safeParse()`
be the bridge to the schema's narrower output type once validation passes.
See the `tanstack-form` skill's Mantine value-type table for the concrete
shapes each input produces.

## Two common integration points

- **TanStack Router `validateSearch`**: pass `(search) => schema.parse(search)`
  (or a `.safeParse` variant if you want a fallback instead of a thrown error
  on a malformed URL) as the route's `validateSearch` option — the schema's
  output becomes the route's typed search params.
- **TanStack Form validators**: pass the schema (or `schema.shape.field`)
  directly as a `validators.onChange`/`onSubmit`/etc. value — see the
  `tanstack-form` skill for the field-vs-form-level split and the
  `field.state.meta.errors` gotcha that follows from this Standard Schema
  integration.

## Sources

- zod `4.x` (checked against `4.4.3`).
- Behavior above (custom `error` per issue code, `z.iso.date()`,
  `z.treeifyError`, enum/date `null` handling) verified by running
  `safeParse`/`treeifyError` directly against an installed zod v4, not taken
  from docs prose.
