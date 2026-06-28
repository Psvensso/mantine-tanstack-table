import type { RowData } from "@tanstack/react-table";
import {
  aggregationFns,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * Shared TanStack Table v9 features configuration.
 * Includes all features and filter/sort/aggregation function registries.
 */

export const features = tableFeatures({
  // All features
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnGroupingFeature,
  columnFacetingFeature,

  // Row model factories
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  facetedUniqueValues: createFacetedUniqueValues(),

  // Function registries (makes filterFn strings like "includesString" work)
  filterFns,
  sortFns,
  aggregationFns,
});

export type TTableFeatures = typeof features;

// Augment TanStack's ColumnMeta so `meta: { flex: 2 }` on a column
// produces `minmax(minSize, 2fr)` instead of the default `1fr`.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TFeatures, TData extends RowData, TValue = unknown> {
    flex?: number;
  }
}
