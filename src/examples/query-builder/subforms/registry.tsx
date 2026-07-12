import type { ComponentType } from "react";
import { getGroupDef } from "../catalog";
import type { QueryCondition } from "../queryObject";
import type { Join } from "../types";
import { GroupAttributeForm } from "./GroupAttributeForm";
import { WrappedAttributeForm } from "./WrappedAttributeForm";

/** The contract every attribute editor implements. */
export type AttributeEditorProps = {
  /** Catalog name of the attribute (or group) being edited. */
  attribute: string;
  /** Saved conditions when editing an existing entry; [] when adding. */
  initial: QueryCondition[];
  /** The wrapper's saved join (plain attributes); "AND" for groups/new. */
  initialJoin: Join;
  onSave: (result: { conditions: QueryCondition[]; join: Join }) => void;
  onCancel: () => void;
};

export function getAttributeEditor(
  attribute: string,
): ComponentType<AttributeEditorProps> {
  // Groups are config-driven (fixed members + cross rules); every plain
  // attribute uses the generic repeatable wrapper (AND/OR + same-attribute
  // rows). Neither needs a per-attribute component.
  return getGroupDef(attribute) ? GroupAttributeForm : WrappedAttributeForm;
}
