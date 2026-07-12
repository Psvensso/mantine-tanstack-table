import { createFormHookContexts } from "@tanstack/react-form";
import { createContext, useContext, type ReactNode } from "react";
import type { AttributeDef } from "../types";

// The TanStack Form side of the composition: field components read their
// field through useFieldContext, form components (SaveButton, FormError)
// read the form through useFormContext. One instance per app.
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

// The attribute-metadata side: kit components also need to know WHICH
// attribute they're editing (operators, value type, options, unit). That
// arrives via React context instead of props, Mantine-Combobox style — put
// a ConditionScope around any markup and every kit part inside it wires
// itself to that attribute. Custom side implementations plug into the same
// slot by calling useConditionScope.
type ConditionScopeValue = {
  def: AttributeDef;
};

const ConditionScopeContext = createContext<ConditionScopeValue | null>(null);

export function ConditionScope({
  def,
  children,
}: ConditionScopeValue & { children: ReactNode }) {
  return (
    <ConditionScopeContext.Provider value={{ def }}>
      {children}
    </ConditionScopeContext.Provider>
  );
}

export function useConditionScope(): ConditionScopeValue {
  const scope = useContext(ConditionScopeContext);
  if (scope === null) {
    throw new Error("Query-builder field components need a <ConditionScope>");
  }
  return scope;
}
