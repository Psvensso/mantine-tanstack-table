# Dynamic Query Builder — Plan

> **Current design = v3 (groups) + v4 (plain attributes), both at the end.**
> v1 (original, below) was one mega-form. v2 introduced hand-authored subforms
> per attribute. v3 made *grouped* attributes fully config-driven. v4 made
> *plain* attributes generic repeatable AND/OR wrappers and the output a
> recursive boolean tree. Read v1 → v4 for the evolution; for the live design,
> **v4 is authoritative for plain attributes, v3 for groups**, and the earlier
> sections are historical.

An Elasticsearch-flavored query builder example: the user composes a search
from a catalog of *attributes* (each attribute dictates which operators and
value inputs are legal) and *grouped attributes* (several attributes edited
and validated together). Built with `@tanstack/react-form` + zod v4 + Mantine.

## Requirements analysis

From the brief:

1. **Attribute-driven rows.** Each catalog attribute carries metadata:
   value type (`string | number | date`), allowed operators
   (`equals | min | max | between`), UI label/description, ES field name,
   optional enum options. The chosen attribute constrains the operator
   select; the (attribute type × operator) pair decides the value input —
   e.g. `between` + `number` renders a from/to number pair, `between` +
   `date` renders two date pickers.
2. **Grouped attributes.** A group (e.g. `CAR_ENGINE_GROUP`) is a named
   bundle of member attributes edited as one unit, with validation rules
   that span its members in addition to each member's own validation.
3. **The core problem is validation**, at three levels:
   - *Per-field, dynamic:* what makes a value valid depends on two sibling
     fields (attribute → type, operator → shape). A static zod schema can't
     express this; the schema must be **built at validation time** from the
     row's current state.
   - *Cross-field within a condition:* `between` requires both bounds and
     `from ≤ to` — the `to` field must re-validate when `from` changes.
   - *Cross-field within a group / across the form:* group rules ("at least
     one engine criterion", "electric engines have no cylinder volume") read
     several conditions at once; the form as a whole requires ≥ 1 usable row
     and must catch fields the user never touched.

Out of scope (per brief): actually querying Elasticsearch — a middle layer
translates the output into the real ES query. The submit output is therefore
a plain **query object**, `{ conditions: [{ attribute, operator, value,
valueTo?, group? }] }`, displayed live.

## Domain model (`types.ts`, `catalog.ts`)

```ts
type AttributeType = "string" | "number" | "date";
type Operator = "equals" | "min" | "max" | "between";

type AttributeDef = {
  name: string;              // "CAR_MAKE" — catalog id
  label: string;             // UI metadata
  description?: string;
  type: AttributeType;
  allowedOperators: Operator[];
  options?: string[];        // enum-ish strings render a Select
  unit?: string;             // UI suffix ("SEK", "cm³", …)
};

type GroupedAttributeDef = {
  name: string;              // "CAR_ENGINE_GROUP"
  label: string;
  description?: string;
  members: string[];         // AttributeDef names
  // Cross-member rule lives ON the catalog entry — validation is data-driven,
  // adding a group never means editing the validator.
  validateGroup?: (conditions: ConditionDraft[]) => string | undefined;
};
```

Car-search catalog: `CAR_MAKE` (string + options, equals), `CAR_MODEL_YEAR`
(number), `CAR_PRICE` (number, min/max/between), `CAR_FIRST_REGISTRATION`
(date), plus `CAR_ENGINE_GROUP` → `CAR_ENGINE_CYLINDER_VOLUME` (number),
`CAR_ENGINE_FUEL_TYPE` (string + options), `CAR_ENGINE_POWER` (number).

Group rules for the engine group: at least one member must be filled in, and
`FUEL_TYPE = Electric` forbids a cylinder-volume criterion.

## Form state shape — one uniform row type

The key simplification: a plain attribute row is modeled as **a group of
one**. That keeps every TanStack Form path uniform
(`rows[i].conditions[j].value`) instead of fighting a discriminated union
inside `DeepKeys`:

```ts
type ConditionValue = string | number | "" | null; // Mantine "empty" shapes

type ConditionDraft = {
  attribute: string;           // leaf AttributeDef name — fixed per condition
  operator: Operator | null;
  value: ConditionValue;       // single value, or range start for "between"
  valueTo: ConditionValue;     // range end, only meaningful for "between"
};

type QueryRow = {
  id: string;                  // crypto.randomUUID() — stable React key
  attribute: string | null;    // catalog pick (plain OR group); null until chosen
  conditions: ConditionDraft[];// 1 entry for plain, N pre-seeded for a group
};

type QueryFormValues = { rows: QueryRow[] };
```

Whether a row renders as a single line or a bordered group panel is *derived*
by looking `row.attribute` up in the catalog — no `kind` flag to keep in sync.
Picking an attribute in the row's Select replaces the whole row via
`form.replaceFieldValue("rows", i, seededRow)` so stale operator/value state
can't leak across attribute changes; changing the operator resets the two
value fields the same way.

## Validation strategy — the heart of the example

One source of truth: a **schema factory** `valueSchemaFor(def, operator)` in
`validation.ts` returns the zod schema for a single value slot
(`z.number()`, `z.iso.date()`, option-constrained `z.enum`, …). Everything
below calls it — field validators and the submit gate can't drift apart
(same principle as `schema.shape.x` reuse in the existing form example, but
factory-shaped because the schema is only known at runtime).

Three layers:

1. **Field-level, live** (`onChange` *function* validators, not bare
   schemas): the `value` validator reads its sibling operator/attribute via
   `fieldApi.form.getFieldValue(...)`, builds the schema with
   `valueSchemaFor`, and returns `safeParse`'s first issue message.
   `validators.onChangeListenTo: ["rows[i].conditions[j].operator"]` re-runs
   it when the operator flips (a value valid for `equals` may be missing its
   partner for `between`). `valueTo` additionally listens to `value` for the
   live `from ≤ to` check.
2. **Group-level, live**: each group panel mounts
   `<form.Field name={`rows[${i}].conditions`} mode="array">` and gives *that
   array field* an `onChange` validator running the catalog's
   `validateGroup`, with `onChangeListenTo` on every member's
   value/operator path. Cross-member errors ("pick at least one engine
   criterion") surface on the group panel itself, not on an arbitrary member
   input.
3. **Form-level submit gate** (`validators.onSubmitAsync` returning
   `{ form?, fields? }`): a walker re-runs the *same* helpers over every row
   — untouched fields included, which field-level validators can never catch
   — and maps failures onto exact field paths
   (`fields: { "rows[0].conditions[0].value": "Enter a number" }`). Row
   problems that have no input yet ("choose an attribute") and the ≥ 1-row
   rule land as the `form` error. Per the repo's `tanstack-form-composition`
   skill, this `{ fields }` mapping is the verified way to push submit-time
   errors onto fields and flip `canSubmit`.

Error display reuses the errors-are-issue-objects normalization from the
repo's `tanstack-form` skill (`firstErrorMessage`).

## UI (Mantine)

- Row line: attribute `Select` (catalog, groups in their own option group) →
  operator `Select` (filtered to `allowedOperators`) → value input(s) chosen
  by `(type, operator)`:
  | type × operator | input |
  | --- | --- |
  | string equals, with `options` | `Select` |
  | string equals, free text | `TextInput` |
  | number equals/min/max | `NumberInput` (+ `unit` suffix) |
  | number between | two `NumberInput`s |
  | date equals/min/max | `DateInput` |
  | date between | two `DateInput`s |
- Group row: `Fieldset` titled with the group label, one condition line per
  member (attribute fixed, shown as label), group error text underneath.
- `rows` uses `mode="array"` (`pushValue` / `removeValue`); add-row button,
  per-row remove `ActionIcon`.
- Submit builds the query object; a result panel shows the JSON
  (`Code block`). One condition entry per active condition —
  `{ attribute, operator, value, valueTo? }` — with `group` set on entries
  that came from a grouped attribute, so the middle layer keeps the origin.

## Files

```
src/examples/query-builder/
  PLAN.md                  — this plan
  types.ts                 — Operator/AttributeType/defs/draft types
  catalog.ts               — car-search attribute catalog + lookups
  validation.ts            — valueSchemaFor factory, condition/group/submit validators
  queryObject.ts           — draft → query object (middle layer does ES)
  ConditionFields.tsx      — one condition line (operator select + value inputs)
  QueryBuilderExample.tsx  — form, row array, group panels, output
```

Route `/query-builder` in `src/router.tsx` (no search params to validate),
nav entry under FORMS in `src/AppLayout.tsx`.

## Verification

`npm run build` (tsc + vite), `npm run lint`, then drive the dev server:
pick attributes, flip operators (watch inputs swap and stale values reset),
trigger the between-range and electric-engine rules, submit untouched fields,
confirm errors land on the right inputs and the ES JSON is correct.

---

# v2 — attribute subforms, composition pattern

Direction change after discussion. Three decisions drive it:

1. **Markup is authored per attribute, not generated.** Each attribute (or
   grouped attribute) gets its own subform component in `subforms/` with
   full control over rendering — built from a common kit of field
   components that can be extended or bypassed. Compound-component feel à
   la Mantine `Combobox`, but on TanStack Form primitives.
2. **Validation never crosses attribute boundaries.** An attribute (or
   group) validates itself, in isolation. The saved attributes join a
   bigger graph later, but that graph is never validated as a whole — an
   attribute becomes a *form* only while it's open for editing.
3. **Each subform owns a zod schema.** Because a subform's value shape is
   static (named keys, no dynamic arrays), plain zod finally fits the whole
   job: shared builders supply the default rules (value-parses-for-type,
   between needs both bounds, from ≤ to), and each subform layers its
   specific rules on top with `.superRefine` — the "if this then that" and
   "one has to be selected" cases live next to the markup they belong to.

## Editing model

The main screen holds a list of *saved* attribute entries (the future
graph nodes) plus the resulting query object. Opening an entry (or adding
a new attribute) mounts that attribute's subform — a fresh `useAppForm`
instance seeded from the saved conditions. Save = validate → map to
`QueryCondition[]` → write back to the list → unmount the form. Nothing
outside the open subform is ever validated.

## The form kit (`form-kit/`)

Built with `createFormHookContexts` + `createFormHook` (the repo's
tanstack-form-composition skill's pattern):

- **Registered field components** — `OperatorSelect`, `ValueInput` (picks
  Select/TextInput/NumberInput/DateInput from the attribute's type),
  consumed as `<form.AppField name="..."> {(f) => <f.OperatorSelect />}`.
  They read the field via `useFieldContext<T>()` and the *attribute def*
  via a `ConditionScope` React context — the compound-component part:

  ```tsx
  <ConditionScope def={FUEL_TYPE}>
    <form.AppField name="fuelType.operator">{(f) => <f.OperatorSelect />}</form.AppField>
    <form.AppField name="fuelType.value">{(f) => <f.ValueInput />}</form.AppField>
  </ConditionScope>
  ```

- **`ConditionGroup` via `withFieldGroup`** (verified available in the
  installed v1.33): the reusable default block — operator + value +
  conditional range partner — mountable at any key of any subform's
  values. The 90% case is one line; custom subforms compose the parts
  (or raw `form.AppField`) instead when they need different markup.
- **Registered form components** — `SaveButton`, `FormError` (form-level
  error display), used inside `<form.AppForm>`.

Extension story: everything the kit's components use (`useFieldContext`,
`useConditionScope`) is exported, so a side implementation can build its
own field component that plugs into the same slots.

## Shared default validation (`validation.ts`, slimmed)

- `valueSchemaFor(def)` — unchanged leaf schema factory (zod v4).
- `conditionSchema(def)` — zod object for one condition
  (`{ operator, value, valueTo }`): value parses when present, `between`
  requires both bounds, from ≤ to. An `optionalCondition(def)` variant
  accepts the all-empty "inactive" state (for group members).
- `firstErrorMessage` — unchanged.

## Subforms (`subforms/`)

Hand-written exemplars, each exporting `{ Editor, toConditions }` and
registered by attribute name in `subforms/registry.tsx`:

- `CarMakeForm` — simplest case: equals + option select.
- `CarPriceForm` — single condition with range support via `ConditionGroup`.
- `EngineGroupForm` — the showcase. Values shaped as named members
  (`{ cylinderVolume, fuelType, power }`), schema =
  `z.object({...optionalCondition per member}).superRefine(...)` with the
  attribute-specific rules co-located in the same file:
  - at least one member active ("one has to be selected"),
  - fuel type Electric ⇒ cylinder volume empty ("if this then that"),
  each issue `path`-ed at the member it belongs on, so TanStack Form's
  Standard Schema integration places errors without any hand mapping.

## What v1 code survives

`types.ts` (Operator/AttributeDef/etc. — minus the mega-form row types),
`catalog.ts` (defs and metadata; `validateGroup` moves into
`EngineGroupForm`'s schema), `queryObject.ts` (`QueryCondition` /
`QueryObject` unchanged). `ConditionFields.tsx`, `useQueryForm.ts`, and the
row-array `QueryBuilderExample` are replaced.

```
src/examples/query-builder/
  PLAN.md
  types.ts            — Operator, AttributeType, AttributeDef, GroupedAttributeDef
  catalog.ts          — attribute metadata (no validation functions anymore)
  validation.ts       — valueSchemaFor, conditionSchema/optionalCondition, firstErrorMessage
  queryObject.ts      — QueryCondition, QueryObject
  form-kit/
    contexts.tsx      — createFormHookContexts + ConditionScope
    fields.tsx        — OperatorSelect, ValueInput (+ parts they're made of)
    formHook.tsx      — createFormHook wiring; useAppForm, withFieldGroup exports
    ConditionGroup.tsx — the reusable default condition block
  subforms/
    CarMakeForm.tsx
    CarPriceForm.tsx
    EngineGroupForm.tsx
    registry.tsx      — attribute name → subform module
  QueryBuilderExample.tsx — saved-entry list + open-to-edit flow + query object
```

## Open points (to confirm before building)

- Editing UX: inline expanding card under the entry list (proposed) vs
  modal.
- Exemplar coverage: the three subforms above (proposed) — a date
  attribute would be a fourth if wanted.
- Whether unlisted catalog attributes should fall back to a generic
  `ConditionGroup`-based subform, or only registered subforms are offered.

---

# v3 — config-driven groups

Refinement of v2 after a design discussion. v2 hand-authored a subform per
*group* (`EngineGroupForm`, three members typed out in markup). That's wrong
for groups: a group's members come from config, so the form must render them
from config — we don't author group markup by hand. Plain attributes keep
their bespoke subforms; only groups change.

Two things had to stay true simultaneously:

1. **Rendering is generic.** One `GroupAttributeForm` reads
   `GroupedAttributeDef.members`, mounts one `ConditionGroup` per member, and
   builds its value shape (`Record<memberName, ConditionDraft>`) and its
   member schema (`groupMemberSchema`, one `optionalConditionSchema` per
   member) entirely from config. Adding a group, or changing its members,
   never touches this file.
2. **Validation is still extensible per group, zod-refinement-like.** The
   group config carries its own rules:
   - `requireMessage?: string | false` — the whole-group "at least one member
     filled" gate (default message, override, or off).
   - `rule?: (values, ctx) => void` — cross-member rules authored exactly
     like a zod `superRefine`: `ctx.addIssue({ path, message })`. A `path`
     targeting a member field surfaces on that input; an empty `path` is a
     whole-group message.

## Why the rules don't go straight into a zod schema

The v2 engine schema put "at least one" as a `.superRefine` issue with
`path: []`. That deadlocked the form: form-core 1.33 maps a root-path schema
issue onto a **phantom field named `""`** that is never mounted, so its error
never clears and `canSubmit` sticks at `false` (this was the "Save stays
disabled after I fill a value" bug). Verified headlessly.

So group rules are **not** run as a form-level zod schema. `GroupRuleCtx`
mirrors zod's `addIssue` shape (familiar authoring) but is evaluated by
`evaluateGroupRules`, which routes issues itself:

- member-pathed issue → `fields["memberName.value"]` (a real mounted field),
- empty-path issue and the `requireMessage` gate → the form-level `form` error,

returned in the `{ form, fields }` shape TanStack Form's `onSubmitAsync`
consumes. Verified headlessly: both kinds set correctly, both clear on the
next change, and `canSubmit` recovers — no phantom field, no deadlock. A
group author literally cannot cause the v2 deadlock, because even an
empty-path issue is rerouted to the form error rather than a schema root
path.

## Layers, for a group

- Per-member structural validation → sync `onSubmit: groupMemberSchema(group)`
  (member-pathed zod issues, clear on change).
- Cross-member `rule` → form-level `onChange: evaluateGroupRules(..., {
  requireAtLeastOne: false })`. **It must run live, not just on submit:** a
  rule error placed on member A because of member B's value (e.g. budget
  because license = None) would otherwise linger after the user fixes B, and
  the stale field error deadlocks `canSubmit` — the same failure class as the
  root-path bug, one level subtler. A live form-level `onChange` re-maps
  `fields` every change, so the error self-clears (verified). Running it on
  change also fixed the engine group's electric rule, which previously only
  cleared if you cleared the cylinder field, not if you changed fuel away
  from Electric.
- Whole-group "at least one" + a final rule pass → `onSubmitAsync:
  evaluateGroupRules(...)` (default `requireAtLeastOne: true`). Held to submit
  so an untouched group isn't nagged mid-edit; the form error clears on the
  next change.

Two config-driven groups exercise this: `CAR_ENGINE_GROUP` (Electric ⇒ no
cylinder volume) and `BUYER_GROUP` (age / budget / license / member-since,
with "no license ⇒ no budget"). Both are pure catalog config — no component
or validation code per group.

Plain-attribute subforms are unchanged: `CarMakeForm`, `CarPriceForm`
(schema with a `superRefine` cap — fine, its issues are field-pathed), and
the `GenericAttributeForm` fallback.

## Files changed vs v2

- **removed** `subforms/EngineGroupForm.tsx` (hand-authored group).
- **added** `subforms/GroupAttributeForm.tsx` (generic, config-driven; serves
  every group).
- `types.ts` — `GroupMemberValues`, `GroupRuleCtx`, `GroupRule`;
  `GroupedAttributeDef` gains `requireMessage?` and `rule?`.
- `catalog.ts` — engine group carries `requireMessage` + `rule` (the electric
  rule); `requireGroupDef` lookup added.
- `validation.ts` — `groupMemberSchema`, `evaluateGroupRules`; the
  root-path-deadlock note lives here and on the engine rule.
- `subforms/registry.tsx` — `getAttributeEditor` routes any group to
  `GroupAttributeForm` (groups never appear in the plain-attribute registry).

## Whole-form rule constraint (worth promoting to the form skill)

Pattern, verified against `@tanstack/form-core` 1.33: **pathed cross-field
rules belong in a zod schema; whole-form ("root") rules must be form-level
function validators returning a message, never a `path: []` schema issue** —
the latter maps to an unmountable `""` field and deadlocks `canSubmit`.

---

# v4 — attribute wrappers + recursive AND/OR query tree

Two linked requirements landed here.

## 1. Plain attributes become repeatable wrappers

A plain (non-grouped) attribute is no longer one condition — it's a **wrapper**
holding one or more conditions of the *same* attribute plus an AND/OR `join`
(the selector appears once there are 2+ rows). "Make equals Tesla OR Make
equals Volvo" is one wrapper. This replaced ALL the bespoke plain-attribute
subforms with one generic `WrappedAttributeForm`:

- Rendering: an array field of `ConditionGroup` rows (same `def`), add/remove,
  a `join` `SegmentedControl`. Config metadata (type/options/unit/min/max)
  drives each row — nothing per-attribute in code.
- Validation: `wrapperSchema(def)` = `{ join, conditions:
  array(conditionSchema(def)).min(1) }`. Every row is required (the user chose
  to add it), unlike optional group members.
- The old `CarMakeForm` (chips) and `CarPriceForm` (cap) are **deleted**. The
  price cap moved to plain metadata: `AttributeDef.max`, folded into
  `valueSchemaFor`. Per-attribute custom *markup* is no longer a feature for
  plain attributes (the user chose uniform wrappers); custom *rules* live as
  metadata (min/max) or, for groups, the group `rule`.

## 2. The output is a boolean tree with join-to-next operators

The operators live **between** nodes, not hoisted onto the parent: each node
carries a `join` naming the operator that links it to the NEXT sibling, and
the last node in a list omits it. Output shape (`queryObject.ts`):

```ts
type QueryObject = { conditions: QueryNode[] };                  // root list
type QueryNode   = QueryLeaf | QueryGroup;
type QueryLeaf   = QueryCondition & { join?: Join };            // join-to-next
type QueryGroup  = { type: "group"; source: string; conditions: QueryNode[]; join?: Join };
```

`buildQueryObject(saved, rootJoin)` — **no merging** (an earlier iteration
flattened same-join wrappers into the parent; superseded). Every entry stays
its own node, and `linkSiblings` stamps the level's operator as each node's
`join-to-next`:

- plain wrapper, **1 condition** → a bare `QueryLeaf` at the root;
- plain wrapper, **2+ conditions** → a `QueryGroup` (`source` = attribute)
  whose members carry the wrapper's own join between them;
- **grouped attribute** → a `QueryGroup` (`source` = group name) whose members
  carry "AND" between them;
- the root list's nodes carry `rootJoin` as their join-to-next.

Because the operator sits on each node, an OR wrapper keeps its OR even inside
an AND root without any nesting gymnastics — nothing is collapsed. `linkSiblings`
is deliberately non-generic (`QueryNode[]`, not `<T>`): spreading a generic
`node: T` (`{ ...node, join }`) drops back to `{ join }` under TS, so the
concrete signature is required.

`SavedAttribute` gained `kind: "attribute" | "group"` and `join`; the
per-condition `group` tag is gone (a node's `source` carries origin instead).
The root join is a `SegmentedControl` in `QueryBuilderExample`, always visible;
editors report `{ conditions, join }` from `onSave`.

## Files (delta from v3)

- **added** `subforms/WrappedAttributeForm.tsx` (generic, every plain
  attribute).
- **removed** `subforms/CarMakeForm.tsx`, `CarPriceForm.tsx`,
  `GenericAttributeForm.tsx` (superseded by the wrapper; price cap → metadata).
- `types.ts` — `Join`; `AttributeDef.min`/`max`.
- `queryObject.ts` — `QueryLeaf`/`QueryGroup`/`QueryNode`/`QueryObject` with
  per-node join-to-next, `buildQueryObject(saved, rootJoin)` + `linkSiblings`
  (no merging); `SavedAttribute` gains `kind`/`join`; `draftToCondition` drops
  the group arg.
- `validation.ts` — `valueSchemaFor` honours `min`/`max`; new
  `wrapperSchema(def)`.
- `subforms/registry.tsx` — `getAttributeEditor` routes group →
  `GroupAttributeForm`, else → `WrappedAttributeForm`.
- `QueryBuilderExample.tsx` — root `join` state + selector, `kind`/`join` on
  save, wrapper-aware summaries, tree output.

Note: the v2/v3 sections above still describe the deleted `CarMakeForm` /
`CarPriceForm` / `EngineGroupForm`; v4 is authoritative for plain attributes,
v3 for groups.
