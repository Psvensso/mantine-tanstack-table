/**
 * The metadata catalog — the single source both the renderer and the schema
 * factories consume. Plain data: adding a field or a rule touches only this
 * file. See ../SKILL.md.
 */

export type FieldType = "string" | "number" | "date";

/** Mid-edit draft value — includes the empty shapes inputs produce. */
export type FieldValue = string | number | "" | null;

/** Draft: what the form works on (keys = FieldDef names). */
export type FormValues = Record<string, FieldValue>;

/** Domain: what a passing save produces — no empty shapes. */
export type FilterCriteria = Record<string, string | number>;

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  /** string type: constrains values AND makes the renderer pick a Select. */
  options?: readonly string[];
  /** number constraints — folded into the schema AND the input props. */
  min?: number;
  max?: number;
  unit?: string;
  required?: boolean;
};

/** Zod-flavored ctx so config authors write familiar rule syntax without
 * owning schema plumbing. Issues are routed into TanStack Form's
 * `{ form, fields }` validator shape by `evaluateRules` (see schemas.ts). */
export type RuleCtx = {
  addIssue: (issue: { path: (string | number)[]; message: string }) => void;
};
export type FormRule = (values: FormValues, ctx: RuleCtx) => void;

export type FormConfig = {
  name: string;
  label: string;
  fields: FieldDef[];
  /** "at least one filled" gate message; `false` disables the gate. */
  requireMessage?: string | false;
  /** Special cross-field rules for THIS config — the extension point. */
  rule?: FormRule;
};

export function isEmpty(value: FieldValue | undefined): boolean {
  return value === "" || value === null || value === undefined;
}

export function emptyValues(config: FormConfig): FormValues {
  const values: FormValues = {};
  for (const def of config.fields) values[def.name] = null;
  return values;
}

/** Draft → domain. Call only after validation passed (onSubmit), where the
 * empty-shape narrowing is safe. */
export function toDomain(config: FormConfig, values: FormValues): FilterCriteria {
  const criteria: FilterCriteria = {};
  for (const def of config.fields) {
    const value = values[def.name];
    if (!isEmpty(value)) criteria[def.name] = value as string | number;
  }
  return criteria;
}

/** Domain → draft, for seeding an editor with a previously saved object. */
export function toDraft(config: FormConfig, criteria: FilterCriteria): FormValues {
  const values: FormValues = {};
  for (const def of config.fields) values[def.name] = criteria[def.name] ?? null;
  return values;
}

// ── An example config ────────────────────────────────────────────────────

export const PRODUCT_FILTER: FormConfig = {
  name: "PRODUCT_FILTER",
  label: "Product filter",
  fields: [
    { name: "name", label: "Name", type: "string" },
    {
      name: "category",
      label: "Category",
      type: "string",
      options: ["Books", "Electronics", "Digital"],
    },
    { name: "price", label: "Max price", type: "number", min: 0, max: 1_000_000, unit: "SEK" },
    { name: "weight", label: "Max weight", type: "number", min: 0, unit: "kg" },
    { name: "releasedAfter", label: "Released after", type: "date" },
  ],
  requireMessage: "Fill in at least one filter",
  rule: (values, ctx) => {
    if (values.category === "Digital" && !isEmpty(values.weight)) {
      ctx.addIssue({
        path: ["weight"],
        message: "Digital products have no weight",
      });
    }
  },
};
