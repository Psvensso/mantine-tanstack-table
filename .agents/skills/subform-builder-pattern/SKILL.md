---
name: subform-builder-pattern
description: Architecture for builder UIs (query/filter builders, rule editors, condition lists) with `@tanstack/react-form` v1 — saved entries are plain data and a form exists ONLY while one entry is open for editing; covers the host/editor split, the editor props contract + registry (generic config-driven editors with bespoke overrides), key-based remounting, seed-once defaultValues, draft⇄domain mapping at the save boundary, repeatable same-field conditions under one AND/OR join, and emitting a boolean output tree with join-to-next operators (plus the TS generic-spread gotcha in the tree builder). Use when users assemble a growing list/graph of structured entries where each entry is edited and validated in isolation.
---

# The ephemeral-subform builder pattern

Builder UIs (query builders, filter builders, rule engines, audience
segmenters) share a shape: the user assembles a **list of structured
entries**, each entry is created/edited through a small form, and the whole
thing folds into one output object. The architecture that keeps this simple:

```
┌────────────── Host (plain React state) ──────────────┐
│ saved: SavedEntry[]        ← plain data, NO form      │
│ rootJoin: "AND" | "OR"                                │
│ editing: { id | null, key } | null                    │
│                                                       │
│   [entry] [entry] [entry]   ← rendered summaries      │
│   ┌─────────────────────┐                             │
│   │  ONE open editor    │ ← a real form EXISTS only   │
│   │  (useForm inside)   │   while an entry is open    │
│   └─────────────────────┘                             │
│                                                       │
│ output = buildTree(saved, rootJoin)  ← derived, pure  │
└───────────────────────────────────────────────────────┘
```

**The load-bearing decision: an entry becomes a form only while open.**
Saved entries are plain serializable data. Consequences:

- **Validation never spans entries.** Only the open editor validates; the
  saved graph is never validated in its entirety. Cross-entry rules don't
  exist by construction, which is what keeps validation tractable as the
  builder grows.
- Invalid state can't leak into the output — an editor only exits through
  `onSave` (validated) or `onCancel` (discarded).
- The output object is a pure derivation of `(saved, rootJoin)` — no form
  state involved, trivially testable headlessly.

Working example in this folder (a generic filter builder):
[examples/queryTree.ts](examples/queryTree.ts) — plain-data types + the
output-tree fold, [examples/BuilderHost.tsx](examples/BuilderHost.tsx) —
host, editor contract, registry, and a generic editor.

## Host mechanics

```tsx
type EditingState = {
  id: string | null;       // null = adding new; otherwise the entry being edited
  field: string;           // which catalog key the editor is for
};

const [saved, setSaved] = useState<SavedEntry[]>([]);
const [rootJoin, setRootJoin] = useState<Join>("AND");
const [editing, setEditing] = useState<EditingState | null>(null);
```

Three rules that prevent whole categories of bugs:

1. **One editor open at a time**; disable the other entries' Edit/Remove
   buttons while open. Multiple simultaneous forms multiplies state-sync
   surface for no user value.
2. **Remount the editor by `key` when the target changes:**

   ```tsx
   <Editor
     key={`${editing.id ?? "new"}-${editing.field}`}
     ...
   />
   ```

   Form libraries keep internal state per instance; without the key, opening
   entry B right after entry A reuses the instance and A's values/errors
   bleed through. The key makes "open" ≡ "fresh form" by construction.
3. **Seed `defaultValues` exactly once**, from the saved entry, inside the
   editor:

   ```tsx
   const [defaultValues] = useState(() => ({
     join: initialJoin,
     conditions: initial.length > 0 ? initial.map(toDraft) : [emptyDraft()],
   }));
   const form = useForm({ defaultValues, ... });
   ```

   A `useState` initializer (not a bare object in render, not `useMemo`)
   guarantees minted values (uuids, timestamps, empty drafts) don't churn
   across re-renders, and pairs with the key-remount: new target → new
   mount → fresh seed.

## The editor contract + registry

Every editor — generic or bespoke — implements one props contract, so the
host neither knows nor cares which it renders:

```ts
export type EntryEditorProps = {
  field: string;                    // catalog key being edited
  initial: Condition[];             // saved conditions ([] when adding new)
  initialJoin: Join;
  onSave: (result: { conditions: Condition[]; join: Join }) => void;
  onCancel: () => void;
};
```

A registry maps catalog keys to editors, with a generic (config-driven)
editor as the default and bespoke ones as overrides:

```ts
const BESPOKE_EDITORS: Record<string, ComponentType<EntryEditorProps>> = {
  // "SPECIAL_FIELD": SpecialFieldEditor,   ← opt-in per key
};
export function getEntryEditor(field: string): ComponentType<EntryEditorProps> {
  return BESPOKE_EDITORS[field] ?? GenericEntryEditor;
}
```

This is the escape-hatch structure that keeps the system config-driven:
99% of fields cost one catalog entry; the odd special case gets a real
component without contorting the config format. (For how the generic
editor's schemas and inputs derive from catalog metadata, see the
`config-driven-forms` skill if present — the pattern here works with
hand-written editors too.)

Note the contract speaks **domain types** (`Condition[]`), not form drafts.
Each editor owns its draft shape internally and converts at the boundary
(`toDraft` on seed, `fromDraft` in `onSave`, after validation passed).
The host never sees a draft.

## Repeatable conditions under one join (the "wrapper")

A common builder requirement: one entry holds *several conditions of the
same field* combined by a single AND/OR — "Make equals Tesla OR Make equals
Volvo" as ONE saved entry. Model it as the entry, not as separate entries:

```ts
export type SavedEntry = {
  id: string;
  field: string;
  label: string;
  join: Join;               // ONE join per entry, applied between its conditions
  conditions: Condition[];  // 1..n, all the same field
};
```

In the editor this is a plain array field (`mode: "array"` +
`conditions[${i}]` sub-paths, add/remove buttons) plus a join
`SegmentedControl` shown only when `conditions.length >= 2`. The zod gate is
`z.object({ join: z.enum(["AND", "OR"]), conditions: z.array(conditionSchema).min(1) })` —
array issues path at `conditions[i].field`, real mounted fields, so they
display and clear normally.

## The output: a boolean tree with join-to-next operators

Representing mixed AND/OR without ambiguity: **each node carries the
operator linking it to the NEXT sibling; the last node in a list carries
none.** A list reads left-to-right as `n0 (n0.join) n1 (n1.join) n2`. No
hoisted parent operator, no merging of same-operator levels — every saved
entry stays its own node, so an OR wrapper keeps its OR while sitting
inside an AND root:

```jsonc
{
  "conditions": [
    { "field": "MAKE", "operator": "equals", "value": "Tesla", "join": "AND" },
    { "type": "group", "source": "YEAR", "conditions": [
      { "field": "YEAR", "operator": "min", "value": "2020", "join": "OR" },
      { "field": "YEAR", "operator": "equals", "value": "2018" }
    ] }
  ]
}
```

The fold is ~20 lines ([examples/queryTree.ts](examples/queryTree.ts)):
single-condition entries flatten to a bare leaf, multi-condition entries
become a group whose members carry the entry's own join; the root join is
distributed onto the top-level nodes the same way.

**TS gotcha in the link helper — don't make it generic.** The obvious
signature loses the type:

```ts
// ❌ `{ ...node, join }` where node: T widens to `{ join?: Join }` —
//    spreading a generic drops T (known TS limitation), and the result
//    no longer satisfies the node union.
function linkSiblings<T extends { join?: Join }>(nodes: T[], join: Join): T[]

// ✅ concrete element type — the spread stays a QueryNode
function linkSiblings(nodes: QueryNode[], join: Join): QueryNode[] {
  const last = nodes.length - 1;
  return nodes.map((node, i) => (i < last ? { ...node, join } : node));
}
```

Convert other shapes to `QueryNode[]` *before* calling it
(`const leaves: QueryNode[] = entry.conditions.map((c) => ({ ...c }))`)
rather than reaching for the generic.

## Reusable multi-field blocks inside editors: `withFieldGroup`

When several editors repeat the same cluster of fields (e.g. an
operator-select + value-input pair), `createFormHook`'s `withFieldGroup`
defines the block once with **group-relative field names** and mounts it at
any path of any form whose values contain that shape:

```tsx
const ConditionBlock = withFieldGroup({
  defaultValues: { operator: null, value: "" },   // the block's value SHAPE
  props: {} as { label?: string },
  render: function Render({ group, label }) {
    return (
      <>
        <group.AppField name="operator">{/* relative name! */}
          {(field) => /* ... */}
        </group.AppField>
        <group.AppField name="value">{(field) => /* ... */}</group.AppField>
      </>
    );
  },
});

// mount anywhere the shape exists — top-level key or array element:
<ConditionBlock form={form} fields="price" label="Price" />
<ConditionBlock form={form} fields={`conditions[${i}]`} />
```

`group.Subscribe` selectors and `group.setFieldValue` are also
group-relative — a block can reset its own sibling fields (e.g. clear
`value` when `operator` changes) without knowing where it's mounted. This is
what makes one condition block serve every editor in the builder. (Full
`withFieldGroup` API notes live in the `tanstack-form-composition` skill if
present; the snippet above is the complete pattern needed here.)

## Checklist for a new builder

1. Plain-data `SavedEntry` type (serializable, domain values, one `join`).
2. Host: `saved` + `rootJoin` + `editing` state; one editor at a time;
   key-remount; derived output rendered live.
3. Editor contract in domain types; registry with a generic default.
4. Editors: seed-once `useState(() => ...)`, draft⇄domain mapping at the
   boundary, validation entirely inside.
5. Output fold: join-to-next nodes, concrete (non-generic) link helper.

## Sources

- `@tanstack/react-form` v1.33 (`useForm`, `mode: "array"`,
  `createFormHook`'s `withFieldGroup` — presence and group-relative
  behavior verified against the installed package), zod v4.4,
  `@mantine/core` v9 (incidental UI layer).
- The pattern was extracted from a working Elasticsearch-style query
  builder; the examples here compile standalone under `tsc --strict`:
  [examples/queryTree.ts](examples/queryTree.ts),
  [examples/BuilderHost.tsx](examples/BuilderHost.tsx).
