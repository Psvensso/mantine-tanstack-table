import { emptyConditionDraft } from "./catalog";
import {
  conditionIsActive,
  type AttributeDef,
  type ConditionDraft,
  type Join,
  type Operator,
} from "./types";

/** A saved leaf: one concrete attribute condition (no join — see nodes below). */
export type QueryCondition = {
  attribute: string;
  operator: Operator;
  value: string | number;
  /** Range end — present only for "between". */
  valueTo?: string | number;
};

// In the OUTPUT tree the join is carried per node: `join` is the operator
// linking a node to the NEXT sibling in its list, and is omitted on the last
// node of each list. So a list reads left-to-right as
// `n0 (n0.join) n1 (n1.join) n2` — the AND/OR sits between the nodes, rather
// than as one operator hoisted onto the parent.

/** Output leaf: a condition plus the operator linking it to the next sibling. */
export type QueryLeaf = QueryCondition & { join?: Join };

/**
 * Output group: `conditions` are a sibling list (each carrying its own
 * join-to-next); `source` records the attribute or grouped attribute the node
 * came from; `join` links this group to its own next sibling.
 */
export type QueryGroup = {
  type: "group";
  source: string;
  conditions: QueryNode[];
  join?: Join;
};

export type QueryNode = QueryLeaf | QueryGroup;

/**
 * The output: a boolean tree where operators live between nodes (each node's
 * `join` points at the next sibling). A middle layer translates this to the
 * actual Elasticsearch query, so no ES DSL is built here.
 */
export type QueryObject = {
  conditions: QueryNode[];
};

/**
 * One saved builder entry — a plain attribute wrapper or a grouped attribute
 * — a future node of the bigger query graph. A plain wrapper holds one or
 * more conditions of the SAME attribute combined by `join`; a group holds one
 * condition per member (its members combine structurally, `join` is "AND").
 * Only ever produced by an editor's save.
 */
export type SavedAttribute = {
  id: string;
  /** Catalog name — plain attribute or group. */
  attribute: string;
  label: string;
  kind: "attribute" | "group";
  join: Join;
  conditions: QueryCondition[];
};

/** Stamp each node with the level's operator as its join-to-next; the last
 * node in the list carries no join (nothing follows it). */
function linkSiblings(nodes: QueryNode[], join: Join): QueryNode[] {
  const last = nodes.length - 1;
  return nodes.map((node, i) => (i < last ? { ...node, join } : node));
}

/**
 * Folds saved entries into the output tree. No merging: every entry stays its
 * own node, and operators live between nodes (join-to-next), so an OR wrapper
 * keeps its OR even sitting inside an AND root — nothing is collapsed. A
 * single-condition plain wrapper is a bare leaf; a multi-condition wrapper or
 * a grouped attribute is a group node whose members carry the wrapper's own
 * join between them.
 */
export function buildQueryObject(
  saved: SavedAttribute[],
  rootJoin: Join,
): QueryObject {
  const nodes: QueryNode[] = saved
    .filter((entry) => entry.conditions.length > 0)
    .map((entry): QueryNode => {
      if (entry.kind === "attribute" && entry.conditions.length === 1) {
        return { ...entry.conditions[0] };
      }
      const leaves: QueryNode[] = entry.conditions.map((c) => ({ ...c }));
      return {
        type: "group",
        source: entry.attribute,
        conditions: linkSiblings(leaves, entry.join),
      };
    });
  return { conditions: linkSiblings(nodes, rootJoin) };
}

/**
 * Draft → output condition. Editors call this after their schema passed, so
 * the casts only narrow away the draft's "" | null empty shapes; an inactive
 * draft (e.g. an untouched group member) maps to undefined.
 */
export function draftToCondition(
  attribute: string,
  draft: ConditionDraft,
): QueryCondition | undefined {
  if (draft.operator === null || !conditionIsActive(draft)) return undefined;
  const condition: QueryCondition = {
    attribute,
    operator: draft.operator,
    value: draft.value as string | number,
  };
  if (draft.operator === "between") {
    condition.valueTo = draft.valueTo as string | number;
  }
  return condition;
}

/** Output condition → draft, for seeding an editor when editing a saved entry. */
export function conditionToDraft(
  condition: QueryCondition | undefined,
  def: AttributeDef,
): ConditionDraft {
  if (!condition) return emptyConditionDraft(def);
  return {
    operator: condition.operator,
    value: condition.value,
    valueTo: condition.valueTo ?? null,
  };
}
