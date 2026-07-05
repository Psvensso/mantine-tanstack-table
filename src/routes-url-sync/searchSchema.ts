import { z } from "zod";
import type { PaginationState, SortingState } from "@tanstack/react-table";

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

const paginationSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().positive(),
});

// Fields are `.optional()` with no `.default()` — a field absent from the
// URL must stay `undefined` so `useTableUrlState` can tell "not in the URL"
// apart from "explicitly set to the default value" and fall back to the
// local fallback store correctly.
export const employeesSearchSchema = z.object({
  sorting: z.array(sortingItemSchema).optional(),
  pagination: paginationSchema.optional(),
});

export type EmployeesSearch = z.infer<typeof employeesSearchSchema>;

export const EMPLOYEES_DEFAULT_SEARCH: {
  sorting: SortingState;
  pagination: PaginationState;
} = {
  sorting: [{ id: "name", desc: false }],
  pagination: { pageIndex: 0, pageSize: 10 },
};
