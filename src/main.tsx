import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { UrlSyncDemoApp } from "./routes-url-sync/UrlSyncDemoApp.tsx";
import "./index.css";

const queryClient = new QueryClient();

// The URL-sync demo lives in its own small TanStack Router instance, mounted
// only under /table-url-sync — the rest of the app keeps its existing
// ?tab= based tab switcher untouched. See src/routes-url-sync/router.tsx.
const isUrlSyncDemo = window.location.pathname.startsWith("/table-url-sync");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        {isUrlSyncDemo ? <UrlSyncDemoApp /> : <App />}
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
);
