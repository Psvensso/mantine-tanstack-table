/**
 * The plain-data side of the builder: saved entries and the pure fold into
 * the output tree. No form state anywhere in this file — it is trivially
 * testable headlessly. See ../SKILL.md.
 */

export type Join = "AND" | "OR";
export type Operator = "equals" | "min" | "max";

/** One concrete condition — domain values only, no draft/empty shapes. */
export type Condition = {
  field: string;
  operator: Operator;
  value: string;
};

/**
 * One saved builder entry: 1..n conditions of the SAME field combined by
 * one `join`. Plain serializable data — an entry becomes a form only while
 * open for editing, and only an editor's onSave produces one.
 */
export type SavedEntry = {
  id: string;
  field: string;
  label: string;
  join: Join;
  conditions: Condition[];
};

// ── Output tree ──────────────────────────────────────────────────────────
// `join` is carried per node: the operator linking a node to the NEXT
// sibling in its list, omitted on the last node. A list reads left-to-right
// as `n0 (n0.join) n1 (n1.join) n2` — operators live BETWEEN nodes, not
// hoisted onto the parent, so mixed AND/OR nests without ambiguity and
// without merging same-operator levels.

export type QueryLeaf = Condition & { join?: Join };

export type QueryGroup = {
  type: "group";
  /** The entry the group came from. */
  source: string;
  conditions: QueryNode[];
  join?: Join;
};

export type QueryNode = QueryLeaf | QueryGroup;

export type QueryTree = {
  conditions: QueryNode[];
};

/**
 * Stamp each node with the level's operator as its join-to-next; the last
 * node carries none (nothing follows it).
 *
 * Deliberately NOT generic: `{ ...node, join }` where `node: T` widens to
 * `{ join?: Join }` — spreading a generic drops T (a TypeScript
 * limitation) and the result no longer satisfies QueryNode. Convert other
 * shapes to QueryNode[] BEFORE calling (see buildQueryTree).
 */
function linkSiblings(nodes: QueryNode[], join: Join): QueryNode[] {
  const last = nodes.length - 1;
  return nodes.map((node, i) => (i < last ? { ...node, join } : node));
}

/**
 * Pure fold: (saved, rootJoin) → output tree. No merging — every entry
 * stays its own node, so an OR wrapper keeps its OR inside an AND root.
 * A single-condition entry flattens to a bare leaf; a multi-condition one
 * becomes a group whose members carry the entry's own join between them.
 */
export function buildQueryTree(saved: SavedEntry[], rootJoin: Join): QueryTree {
  const nodes: QueryNode[] = saved
    .filter((entry) => entry.conditions.length > 0)
    .map((entry): QueryNode => {
      if (entry.conditions.length === 1) {
        return { ...entry.conditions[0] };
      }
      const leaves: QueryNode[] = entry.conditions.map((c) => ({ ...c }));
      return {
        type: "group",
        source: entry.field,
        conditions: linkSiblings(leaves, entry.join),
      };
    });
  return { conditions: linkSiblings(nodes, rootJoin) };
}
