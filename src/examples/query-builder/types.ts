export type AttributeType = "string" | "number" | "date";

export type Operator = "equals" | "min" | "max" | "between";

export const OPERATOR_LABELS: Record<Operator, string> = {
  equals: "Equals",
  min: "At least",
  max: "At most",
  between: "Between",
};

export type AttributeDef = {
  name: string;
  label: string;
  description?: string;
  type: AttributeType;
  allowedOperators: Operator[];
  /** Enum-ish string attributes render a Select constrained to these. */
  options?: string[];
  /** UI suffix for numeric inputs ("SEK", "cm³", "hp"). */
  unit?: string;
  /** Inclusive numeric bounds, folded into the value schema (number type). */
  min?: number;
  max?: number;
};

/** How the conditions inside one attribute wrapper combine. */
export type Join = "AND" | "OR";

/** A group's member conditions, keyed by member attribute name. */
export type GroupMemberValues = Record<string, ConditionDraft>;

/**
 * The context passed to a group rule — deliberately zod's `superRefine`
 * `ctx.addIssue` shape so a rule reads like a zod refinement, but decoupled
 * from zod internals. A `path` targeting a member field (e.g.
 * `["CAR_ENGINE_CYLINDER_VOLUME", "value"]`) surfaces on that input; an empty
 * `path` is a whole-group message and surfaces on the form. The evaluator
 * routes both safely (see validation.evaluateGroupRules) — unlike a raw zod
 * root-path issue, which deadlocks the form.
 */
export type GroupRuleCtx = {
  addIssue: (issue: { path: (string | number)[]; message: string }) => void;
};

/** A group's special cross-member validation, extension point per group. */
export type GroupRule = (values: GroupMemberValues, ctx: GroupRuleCtx) => void;

export type GroupedAttributeDef = {
  name: string;
  label: string;
  description?: string;
  /** AttributeDef names edited together as one unit — rendered from here. */
  members: string[];
  /**
   * Whole-group "at least one member filled" gate. `undefined` uses a default
   * message, a string overrides it, `false` disables the requirement.
   */
  requireMessage?: string | false;
  /** Group-specific cross-member rules, zod-refinement-like (see GroupRule). */
  rule?: GroupRule;
};

/** The "empty" shapes Mantine inputs report mid-edit, plus real values. */
export type ConditionValue = string | number | "" | null;

/**
 * The in-progress state of one condition inside a subform. Which attribute
 * it belongs to is decided by the subform's value key, not stored here.
 */
export type ConditionDraft = {
  operator: Operator | null;
  /** Single value, or the range start when operator is "between". */
  value: ConditionValue;
  /** Range end — only meaningful for "between". */
  valueTo: ConditionValue;
};

export const isEmptyValue = (value: ConditionValue): value is "" | null =>
  value === "" || value === null;

/** A condition takes part in the query once the user has put a value in it. */
export const conditionIsActive = (condition: ConditionDraft): boolean =>
  !isEmptyValue(condition.value) ||
  (condition.operator === "between" && !isEmptyValue(condition.valueTo));
