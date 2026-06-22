import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createTransport,
  FrameworkProvider,
  withAuth,
  withLogging,
  withRequestId,
  withRetryInterceptor,
  withTracing,
} from "@sunbeam/g2v";
import { authSelectors } from "@sunbeam/g2v/state";
import { uiActions } from "@sunbeam/g2v/state";
import { setupOtel } from "@sunbeam/g2v/otel";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes.tsx";
import { AuthProvider } from "./providers/auth.tsx";
import "./styles/global.css";

// Default to dark theme when the user has no saved preference.
const hasSavedTheme = Boolean(globalThis.localStorage?.getItem("sunbeam-g2v:ui"));
if (!hasSavedTheme) {
  uiActions.setTheme("dark");
}

const otlpUrl = import.meta.env.VITE_SUNBEAM_OTLP_URL;
if (otlpUrl) {
  setupOtel({
    serviceName: "sso-ui",
    otlpUrl,
    environment: import.meta.env.MODE,
  });
}

const transport = createTransport({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  interceptors: [
    withRequestId(),
    withAuth({ getToken: () => authSelectors.token() }),
    withTracing({ tracerName: "sso-ui" }),
    withLogging(),
    withRetryInterceptor({ onlyIdempotent: true }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FrameworkProvider
      transport={transport}
      otel={
        otlpUrl
          ? { serviceName: "sso-ui", otlpUrl }
          : undefined
      }
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </FrameworkProvider>
  </StrictMode>,
);
