import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { RootLayout } from "./RootLayout";
import { TableSyncPage } from "./TableSyncPage";
import { ElsewherePage } from "./ElsewherePage";
import { employeesSearchSchema } from "./searchSchema";

const rootRoute = createRootRoute({ component: RootLayout });

export const tableSyncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>) =>
    employeesSearchSchema.parse(search),
  component: TableSyncPage,
});

export const elsewhereRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/elsewhere",
  component: ElsewherePage,
});

const routeTree = rootRoute.addChildren([tableSyncRoute, elsewhereRoute]);

// Routes above are defined relative to this basepath, so the route tree
// itself doesn't need to know where it's mounted within the larger app.
export const router = createRouter({
  routeTree,
  basepath: "/table-url-sync",
  history: createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
