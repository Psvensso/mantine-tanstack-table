import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  defaultStringifySearch,
  redirect,
} from "@tanstack/react-router";
import { AppLayout } from "./AppLayout";
import { encodeSearch } from "./url-state";
import {
  DynamicGroupingExample,
  dynamicGroupingSearch,
} from "./examples/DynamicGroupingExample";
import {
  ExpandableRowsExample,
  expandableRowsSearch,
} from "./examples/ExpandableRowsExample";
import {
  FilteringPinningExample,
  filteringPinningSearch,
} from "./examples/FilteringPinningExample";
import { FormValidationExample } from "./examples/FormValidationExample";
import { MultiActionSearchFormExample } from "./examples/MultiActionSearchFormExample";
import { QueryBuilderExample } from "./examples/query-builder/QueryBuilderExample";
import {
  GroupingPaginationExample,
  groupingPaginationSearch,
} from "./examples/GroupingPaginationExample";
import {
  RowGroupingExample,
  rowGroupingSearch,
} from "./examples/RowGroupingExample";
import {
  ServerSideFilteringExample,
  serverSideFilteringSearch,
} from "./examples/ServerSideFilteringExample";
import {
  SubgridTableExample,
  subgridTableSearch,
} from "./examples/SubgridTableExample";
import {
  VirtualizedExpandableExample,
  virtualizedExpandableSearch,
} from "./examples/VirtualizedExpandableExample";
import {
  VirtualizedGroupingExample,
  virtualizedGroupingSearch,
} from "./examples/VirtualizedGroupingExample";
import { ElsewherePage } from "./routes-url-sync/ElsewherePage";
import { employeesSearch } from "./routes-url-sync/searchSchema";
import { TableSyncPage } from "./routes-url-sync/TableSyncPage";

const rootRoute = createRootRoute({ component: AppLayout });

// The pre-router app was a hand-rolled `/?tab=<id>` switcher — map those ids
// to their routes so old bookmarks keep working.
const LEGACY_TAB_PATHS: Record<string, string> = {
  employees: "/filtering-pinning",
  orders: "/expandable-rows",
  "employees-grouped": "/row-grouping",
  products: "/server-side-filtering",
  sales: "/dynamic-grouping",
  projects: "/subgrid-table",
  "employees-virtual": "/virtualized-grouping",
  "orders-virtual-grouped": "/virtualized-expandable",
  "employees-grouped-pagination": "/grouping-pagination",
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: LEGACY_TAB_PATHS[search.tab ?? ""] ?? "/filtering-pinning",
      replace: true,
    });
  },
});

export const filteringPinningRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/filtering-pinning",
  validateSearch: (search: Record<string, unknown>) =>
    filteringPinningSearch.schema.parse(search),
  component: FilteringPinningExample,
});

export const expandableRowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/expandable-rows",
  validateSearch: (search: Record<string, unknown>) =>
    expandableRowsSearch.schema.parse(search),
  component: ExpandableRowsExample,
});

export const rowGroupingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/row-grouping",
  validateSearch: (search: Record<string, unknown>) =>
    rowGroupingSearch.schema.parse(search),
  component: RowGroupingExample,
});

export const serverSideFilteringRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/server-side-filtering",
  validateSearch: (search: Record<string, unknown>) =>
    serverSideFilteringSearch.schema.parse(search),
  component: ServerSideFilteringExample,
});

export const dynamicGroupingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dynamic-grouping",
  validateSearch: (search: Record<string, unknown>) =>
    dynamicGroupingSearch.schema.parse(search),
  component: DynamicGroupingExample,
});

export const subgridTableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/subgrid-table",
  validateSearch: (search: Record<string, unknown>) =>
    subgridTableSearch.schema.parse(search),
  component: SubgridTableExample,
});

export const virtualizedGroupingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/virtualized-grouping",
  validateSearch: (search: Record<string, unknown>) =>
    virtualizedGroupingSearch.schema.parse(search),
  component: VirtualizedGroupingExample,
});

export const virtualizedExpandableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/virtualized-expandable",
  validateSearch: (search: Record<string, unknown>) =>
    virtualizedExpandableSearch.schema.parse(search),
  component: VirtualizedExpandableExample,
});

export const groupingPaginationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/grouping-pagination",
  validateSearch: (search: Record<string, unknown>) =>
    groupingPaginationSearch.schema.parse(search),
  component: GroupingPaginationExample,
});

export const formValidationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/form-validation",
  component: FormValidationExample,
});

export const queryBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/query-builder",
  component: QueryBuilderExample,
});

export const multiActionSearchFormRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/multi-action-search-form",
  component: MultiActionSearchFormExample,
});

// The original URL-sync deep-dive keeps its pre-unification path so old
// deep links (and its fallback-store demo flow) survive unchanged.
export const tableSyncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/table-url-sync",
  validateSearch: (search: Record<string, unknown>) =>
    employeesSearch.schema.parse(search),
  component: TableSyncPage,
});

export const elsewhereRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/table-url-sync/elsewhere",
  component: ElsewherePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  filteringPinningRoute,
  expandableRowsRoute,
  rowGroupingRoute,
  serverSideFilteringRoute,
  dynamicGroupingRoute,
  subgridTableRoute,
  virtualizedGroupingRoute,
  virtualizedExpandableRoute,
  groupingPaginationRoute,
  formValidationRoute,
  queryBuilderRoute,
  multiActionSearchFormRoute,
  tableSyncRoute,
  elsewhereRoute,
]);

export const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
  // Write the table-state slices as compact human-readable strings
  // (`sorting=-salary.name`, `pagination=1_10`) instead of percent-encoded
  // JSON. This must live at the router level: navigation re-validates search
  // params (which decodes them back to state shapes) before stringifying, so
  // encoding anywhere earlier gets undone. The route schemas accept both
  // forms, so pre-existing JSON URLs keep working.
  stringifySearch: (search) => defaultStringifySearch(encodeSearch(search)),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
