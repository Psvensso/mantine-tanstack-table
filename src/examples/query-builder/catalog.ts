import {
  conditionIsActive,
  type AttributeDef,
  type ConditionDraft,
  type GroupedAttributeDef,
} from "./types";

export const ATTRIBUTES: AttributeDef[] = [
  {
    name: "CAR_MAKE",
    label: "Make",
    description: "Manufacturer of the car",
    type: "string",
    allowedOperators: ["equals"],
    options: ["Volvo", "Saab", "BMW", "Audi", "Toyota", "Tesla"],
  },
  {
    name: "CAR_MODEL_YEAR",
    label: "Model year",
    type: "number",
    allowedOperators: ["equals", "min", "max", "between"],
  },
  {
    name: "CAR_PRICE",
    label: "Price",
    type: "number",
    allowedOperators: ["min", "max", "between"],
    unit: "SEK",
    // Cap that used to live in a bespoke price subform — now plain metadata,
    // folded into the value schema by valueSchemaFor.
    max: 10_000_000,
  },
  {
    name: "CAR_FIRST_REGISTRATION",
    label: "First registration",
    description: "Date the car was first registered",
    type: "date",
    allowedOperators: ["equals", "min", "max", "between"],
  },
  {
    name: "CAR_ENGINE_CYLINDER_VOLUME",
    label: "Cylinder volume",
    type: "number",
    allowedOperators: ["equals", "min", "max", "between"],
    unit: "cm³",
  },
  {
    name: "CAR_ENGINE_FUEL_TYPE",
    label: "Fuel type",
    type: "string",
    allowedOperators: ["equals"],
    options: ["Petrol", "Diesel", "Electric", "Hybrid"],
  },
  {
    name: "CAR_ENGINE_POWER",
    label: "Power",
    type: "number",
    allowedOperators: ["min", "max", "between"],
    unit: "hp",
  },
  {
    name: "BUYER_AGE",
    label: "Age",
    type: "number",
    allowedOperators: ["equals", "min", "max", "between"],
  },
  {
    name: "BUYER_BUDGET",
    label: "Budget",
    type: "number",
    allowedOperators: ["min", "max", "between"],
    unit: "SEK",
  },
  {
    name: "BUYER_LICENSE_TYPE",
    label: "License type",
    type: "string",
    allowedOperators: ["equals"],
    options: ["A", "B", "C", "None"],
  },
  {
    name: "BUYER_MEMBER_SINCE",
    label: "Member since",
    description: "When the buyer registered with us",
    type: "date",
    allowedOperators: ["equals", "min", "max", "between"],
  },
];

// A group is fully self-described here: its members (which the generic group
// form renders — we don't hand-author group markup) AND its special
// validation, expressed as a zod-refinement-like `rule`. Plain attributes
// still own bespoke subforms; only groups are config-driven.
export const GROUPED_ATTRIBUTES: GroupedAttributeDef[] = [
  {
    name: "CAR_ENGINE_GROUP",
    label: "Engine",
    description: "Combined engine criteria",
    members: [
      "CAR_ENGINE_CYLINDER_VOLUME",
      "CAR_ENGINE_FUEL_TYPE",
      "CAR_ENGINE_POWER",
    ],
    requireMessage: "Fill in at least one engine criterion",
    rule: (values, ctx) => {
      const fuel = values.CAR_ENGINE_FUEL_TYPE;
      const cylinder = values.CAR_ENGINE_CYLINDER_VOLUME;
      if (fuel?.value === "Electric" && cylinder && conditionIsActive(cylinder)) {
        ctx.addIssue({
          path: ["CAR_ENGINE_CYLINDER_VOLUME", "value"],
          message: "Electric engines have no cylinder volume",
        });
      }
    },
  },
  {
    name: "BUYER_GROUP",
    label: "Buyer",
    description: "Details about the prospective buyer",
    members: [
      "BUYER_AGE",
      "BUYER_BUDGET",
      "BUYER_LICENSE_TYPE",
      "BUYER_MEMBER_SINCE",
    ],
    requireMessage: "Fill in at least one buyer detail",
    rule: (values, ctx) => {
      const license = values.BUYER_LICENSE_TYPE;
      const budget = values.BUYER_BUDGET;
      if (license?.value === "None" && budget && conditionIsActive(budget)) {
        ctx.addIssue({
          path: ["BUYER_BUDGET", "value"],
          message: "A buyer with no license can't have a car budget",
        });
      }
    },
  },
];

const attributesByName = new Map(ATTRIBUTES.map((def) => [def.name, def]));
const groupsByName = new Map(GROUPED_ATTRIBUTES.map((def) => [def.name, def]));

export function getAttributeDef(name: string | null): AttributeDef | undefined {
  return name == null ? undefined : attributesByName.get(name);
}

/** Lookup for module-scope def constants in subforms — throws on a typo. */
export function requireAttributeDef(name: string): AttributeDef {
  const def = attributesByName.get(name);
  if (!def) throw new Error(`Unknown attribute: ${name}`);
  return def;
}

export function getGroupDef(
  name: string | null,
): GroupedAttributeDef | undefined {
  return name == null ? undefined : groupsByName.get(name);
}

export function requireGroupDef(name: string): GroupedAttributeDef {
  const group = groupsByName.get(name);
  if (!group) throw new Error(`Unknown group: ${name}`);
  return group;
}

/** Member attributes are edited inside their group's subform, not standalone. */
export const GROUP_MEMBER_NAMES = new Set(
  GROUPED_ATTRIBUTES.flatMap((group) => group.members),
);

/** Preselect the operator when the attribute only allows one. */
export function emptyConditionDraft(def: AttributeDef): ConditionDraft {
  return {
    operator: def.allowedOperators.length === 1 ? def.allowedOperators[0] : null,
    value: null,
    valueTo: null,
  };
}
