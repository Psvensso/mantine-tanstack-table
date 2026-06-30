import { Button, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import type { RowData, Table as TanstackTableDef } from "@tanstack/react-table";
import type { ComponentProps } from "react";

/**
 * Shape of `columnDef.meta.filter`. A column carries one of these to opt into
 * the drawer filter UI — see the `ColumnMeta` augmentation in `./features.tsx`.
 */
export type ColumnFilterMeta =
  | { variant: "select"; options: string[] }
  | { variant: "range"; min: number; max: number };

// Same AnyFeatures/AnyTableFeaturesRecord pattern as TMTable.tsx: TanStack's
// `in out TFeatures` is invariant, so these components accept any concrete
// `tableFeatures({...})` result without an assignability check against it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFeatures = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTableFeaturesRecord = Record<string, any>;

/**
 * The set of "drawer filter" columns isn't a hand-maintained id list — it's
 * derived by scanning the live column defs for `meta.filter`. Both
 * `DrawerColumnFilters` and `ResetDrawerFiltersButton` call this so the two
 * components never need to agree on a shared list of ids.
 */
function getDrawerFilterColumns<T extends RowData>(
  table: TanstackTableDef<AnyFeatures, T>,
) {
  return table
    .getAllLeafColumns()
    .filter((column) => column.columnDef.meta?.filter !== undefined);
}

function DrawerColumnFilters<
  T extends RowData,
  TF extends AnyTableFeaturesRecord = AnyFeatures,
>({ table: tableArg }: { table: TanstackTableDef<TF, T> }) {
  const table = tableArg as TanstackTableDef<AnyFeatures, T>;
  const columns = getDrawerFilterColumns(table);

  if (columns.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No filterable columns configured.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {columns.map((column) => {
        const filter = column.columnDef.meta?.filter as
          | ColumnFilterMeta
          | undefined;
        const label =
          typeof column.columnDef.header === "string"
            ? column.columnDef.header
            : column.id;

        if (filter?.variant === "select") {
          return (
            <Select
              key={column.id}
              label={label}
              placeholder="Any"
              data={filter.options}
              value={(column.getFilterValue() as string | undefined) ?? null}
              onChange={(value) => column.setFilterValue(value ?? undefined)}
              clearable
            />
          );
        }

        if (filter?.variant === "range") {
          const [from, to] =
            (column.getFilterValue() as [number?, number?] | undefined) ?? [];
          return (
            <Group key={column.id} grow align="flex-start">
              <NumberInput
                label={`${label} (min)`}
                placeholder={String(filter.min)}
                value={from ?? ""}
                onChange={(value) =>
                  column.setFilterValue(
                    (old: [number?, number?] | undefined) => [
                      value === "" ? undefined : Number(value),
                      old?.[1],
                    ],
                  )
                }
              />
              <NumberInput
                label={`${label} (max)`}
                placeholder={String(filter.max)}
                value={to ?? ""}
                onChange={(value) =>
                  column.setFilterValue(
                    (old: [number?, number?] | undefined) => [
                      old?.[0],
                      value === "" ? undefined : Number(value),
                    ],
                  )
                }
              />
            </Group>
          );
        }

        return null;
      })}
    </Stack>
  );
}

function ResetDrawerFiltersButton<
  T extends RowData,
  TF extends AnyTableFeaturesRecord = AnyFeatures,
>({
  table: tableArg,
  ...buttonProps
}: { table: TanstackTableDef<TF, T> } & ComponentProps<typeof Button>) {
  const table = tableArg as TanstackTableDef<AnyFeatures, T>;
  const columns = getDrawerFilterColumns(table);
  const hasActiveFilter = columns.some((column) => column.getIsFiltered());

  return (
    <Button
      variant="default"
      size="xs"
      disabled={!hasActiveFilter}
      onClick={() => {
        for (const column of columns) {
          column.setFilterValue(undefined);
        }
      }}
      {...buttonProps}
    >
      Reset drawer filters
    </Button>
  );
}

export const TMTableFilters = {
  DrawerColumnFilters,
  ResetDrawerFiltersButton,
};
