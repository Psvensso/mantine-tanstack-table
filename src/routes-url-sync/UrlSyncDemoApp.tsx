import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

export function UrlSyncDemoApp() {
  return <RouterProvider router={router} />;
}
