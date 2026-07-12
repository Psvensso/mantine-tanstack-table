import { z } from "zod";
import { requireAttributeDef } from "./catalog";
import {
  conditionIsActive,
  type AttributeDef,
  type ConditionDraft,
  type ConditionValue,
  type GroupMemberValues,
  type GroupedAttributeDef,
  type Operator,
} from "./types";

/**
 * The single source of truth for what a value slot accepts, decided by the
 * attribute's metadata. Everything else composes this: the default condition
 * schemas below, the kit's live slot validation, and any subform-specific
 * refinements.
 */
// The explicit Input type parameter matters: TanStack Form only accepts a
// form/field validator whose Standard Schema INPUT type is assignable to the
// (wider, mid-edit) form value type — leaving it to default to `unknown`
// fails that check.
export function valueSchemaFor(
  def: AttributeDef,
): z.ZodType<string | number, string | number> {
  switch (def.type) {
    case "string":
      return def.options
        ? z.enum(def.options as [string, ...string[]], {
            error: `Choose a ${def.label.toLowerCase()}`,
          })
        : z
            .string({ error: `Enter a ${def.label.toLowerCase()}` })
            .trim()
            .min(1, `Enter a ${def.label.toLowerCase()}`);
    case "number": {
      let schema = z.number({ error: "Enter a number" });
      if (def.min !== undefined) {
        schema = schema.min(def.min, `Must be at least ${def.min.toLocaleString("sv-SE")}`);
      }
      if (def.max !== undefined) {
        schema = schema.max(def.max, `Must be at most ${def.max.toLocaleString("sv-SE")}`);
      }
      return schema;
    }
    case "date":
      // Mantine's DateInput reports an ISO date string, not a Date — the
      // schema validates that shape directly (see the repo's zod skill).
      return z.iso.date({ error: "Choose a date" });
  }
}

/** ISO date strings order correctly as strings, so one comparison covers both. */
function rangeEndBeforeStart(
  from: string | number,
  to: string | number,
): boolean {
  return typeof from === "number" && typeof to === "number"
    ? to < from
    : String(to) < String(from);
}

/**
 * Default validation for one *required* condition: an operator is chosen,
 * the value parses for the attribute's type, and "between" additionally
 * needs a parsing, correctly-ordered range end. Subforms layer their
 * attribute-specific rules on top with `.superRefine`.
 */
export function conditionSchema(def: AttributeDef) {
  return z
    .object({
      operator: z.enum(
        def.allowedOperators as [Operator, ...Operator[]],
        { error: "Choose an operator" },
      ),
      value: valueSchemaFor(def),
      valueTo: z.custom<ConditionValue>(),
    })
    .superRefine((condition, ctx) => {
      if (condition.operator !== "between") return;
      const to = valueSchemaFor(def).safeParse(condition.valueTo);
      if (!to.success) {
        ctx.addIssue({
          code: "custom",
          path: ["valueTo"],
          message: to.error.issues[0]?.message ?? "Enter the range end",
        });
        return;
      }
      if (rangeEndBeforeStart(condition.value, to.data)) {
        ctx.addIssue({
          code: "custom",
          path: ["valueTo"],
          message: "Range end must not be before its start",
        });
      }
    });
}

/**
 * A condition that may be left entirely empty ("inactive") — the shape group
 * members have. Once the user puts a value in it, the full required
 * `conditionSchema` applies; its issues are forwarded with their paths so
 * they still land on the right fields.
 */
export function optionalConditionSchema(def: AttributeDef) {
  const active = conditionSchema(def);
  return z
    .object({
      operator: z.custom<Operator | null>(),
      value: z.custom<ConditionValue>(),
      valueTo: z.custom<ConditionValue>(),
    })
    .superRefine((condition, ctx) => {
      if (!conditionIsActive(condition)) return;
      const result = active.safeParse(condition);
      if (result.success) return;
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: [...issue.path] as PropertyKey[],
          message: issue.message,
        });
      }
    });
}

// --- Plain attribute wrapper -------------------------------------------------

/**
 * Schema for a plain attribute wrapper: an AND/OR `join` plus one or more
 * conditions of the same attribute, each required-valid. Every added row is
 * one the user chose to add, so unlike group members they are all required
 * (not optional). Issues path at `conditions[i].*`, real mounted fields.
 */
export function wrapperSchema(def: AttributeDef) {
  return z.object({
    join: z.enum(["AND", "OR"]),
    conditions: z
      .array(conditionSchema(def))
      .min(1, "Add at least one condition"),
  });
}

// --- Group validation (config-driven) ---------------------------------------

/**
 * The per-member structural gate for a group: every member is optional on
 * its own, but a filled-in one must be internally valid. Built from the
 * group's config `members`, so a group renders and validates without any
 * hand-written schema. Used as the sync `onSubmit` validator; its issues are
 * pathed at real member fields and clear on change.
 */
export function groupMemberSchema(
  group: GroupedAttributeDef,
): z.ZodType<GroupMemberValues, GroupMemberValues> {
  const shape: Record<string, z.ZodType> = {};
  for (const name of group.members) {
    shape[name] = optionalConditionSchema(requireAttributeDef(name));
  }
  // A dynamic-key z.object can't infer its input type tightly enough for the
  // form validator boundary; the runtime shape is exactly GroupMemberValues.
  return z.object(shape) as unknown as z.ZodType<
    GroupMemberValues,
    GroupMemberValues
  >;
}

/**
 * Runs a group's whole-group requirement and its special `rule`, returning
 * the `{ form, fields }` shape TanStack Form maps onto the form error and
 * member fields respectively (verified to clear on change and recover
 * `canSubmit`, unlike a zod root-path issue). Member-pathed rule issues
 * become field errors; empty-path ones fold into the form error, so a group
 * author can't accidentally deadlock the form.
 *
 * `requireAtLeastOne` splits the two callers: the cross-member `rule` runs on
 * form-level `onChange` (so a rule error placed on field A clears when the
 * user fixes field B — verified; without this the stale error deadlocks
 * `canSubmit`), while the "at least one filled" gate runs on submit only, so
 * an untouched group isn't nagged the moment the user starts editing.
 */
export function evaluateGroupRules(
  group: GroupedAttributeDef,
  values: GroupMemberValues,
  { requireAtLeastOne = true }: { requireAtLeastOne?: boolean } = {},
): { form?: string; fields: Record<string, string> } | null {
  const fields: Record<string, string> = {};
  let form: string | undefined;

  if (requireAtLeastOne && group.requireMessage !== false) {
    const anyActive = group.members.some((name) => {
      const condition = values[name];
      return condition != null && conditionIsActive(condition);
    });
    if (!anyActive) {
      form = group.requireMessage ?? "Fill in at least one option";
    }
  }

  group.rule?.(values, {
    addIssue: ({ path, message }) => {
      const key = path.join(".");
      if (key) {
        fields[key] ??= message;
      } else {
        form ??= message;
      }
    },
  });

  return form !== undefined || Object.keys(fields).length > 0
    ? { form, fields }
    : null;
}

/**
 * Live per-slot check used by the form kit: quiet while the slot is empty
 * (required-ness is the submit schema's job — flagging a field the moment it
 * appears is noise), parses via `valueSchemaFor` once something is in it.
 */
export function liveSlotError(
  def: AttributeDef,
  raw: ConditionValue,
): string | undefined {
  if (raw === "" || raw === null) return undefined;
  const result = valueSchemaFor(def).safeParse(raw);
  return result.success
    ? undefined
    : (result.error.issues[0]?.message ?? "Invalid value");
}

/**
 * `field.state.meta.errors` mixes Standard Schema issue objects (from zod
 * validators) and plain strings (from function validators) — normalize
 * before rendering.
 */
export function firstErrorMessage(
  errors: ReadonlyArray<unknown>,
): string | undefined {
  const [issue] = errors;
  if (issue == null) return undefined;
  return typeof issue === "string"
    ? issue
    : (issue as { message: string }).message;
}

/**
 * The form-level `errorMap.onSubmit` entry varies by validator kind: a
 * string (function validators), an issue array, or — for a zod schema with
 * root-level `path: []` refinements — a map of issues grouped by joined
 * path, root issues under the `""` key (shape verified headlessly against
 * form-core 1.33). Normalize all of them to one message.
 */
export function formErrorMessage(error: unknown): string | undefined {
  if (error == null) return undefined;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return firstErrorMessage(error);
  if (typeof error === "object") {
    if ("message" in error) return (error as { message: string }).message;
    // A form-level schema's issues arrive grouped by joined path; only the
    // root ("" key) belongs to the form — the rest render at their fields.
    // (Root-path schema issues also deadlock canSubmit, so whole-form rules
    // should be function validators — see EngineGroupForm — but display
    // them if they occur.)
    const root = (error as Record<string, unknown>)[""];
    if (Array.isArray(root)) return firstErrorMessage(root);
  }
  return undefined;
}

/** Re-exported so subform refinements don't need a second import site. */
export { conditionIsActive, type ConditionDraft };
