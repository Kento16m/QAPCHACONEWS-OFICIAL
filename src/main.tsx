import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SearchProvider } from "@/contexts/SearchContext";
import { analytics } from "@/lib/analytics";
import { getRouter } from "./router";
import "./styles.css";

const GA_TRACKING_ID = "G-6WSQ6L8F6L";

analytics.initialize(GA_TRACKING_ID);

// index.html carries these for crawlers without JavaScript. From here on each route sets its own.
document.head
  .querySelectorAll(
    'title, link[rel="canonical"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]',
  )
  .forEach((tag) => tag.remove());

const router = getRouter();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={router.options.context.queryClient}>
      <SearchProvider>
        <RouterProvider router={router} />
      </SearchProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
