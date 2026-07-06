import { z } from "zod";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { createTableSearchConfig } from "../table/url-sync";

// The filter shapes this page's columns actually produce: "equalsString"
// columns carry a string, "inNumberRange" columns carry a [min, max] pair.
export const employeesSearch = createTableSearchConfig({
  defaults: {
    sorting: [{ id: "name", desc: false }],
    pagination: { pageIndex: 0, pageSize: 10 },
    columnFilters: [] as ColumnFiltersState,
    globalFilter: "",
  },
  filterValue: z.union([
    z.string(),
    z.tuple([z.number().nullable(), z.number().nullable()]),
  ]),
});
