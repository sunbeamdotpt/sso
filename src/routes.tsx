import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { App } from "./app.tsx";
import { LoginFlowPage } from "./pages/login-flow.tsx";
import { ConsentPage } from "./pages/consent-page.tsx";
import { OAuthLoginPage } from "./pages/oauth-login-page.tsx";
import { PostLogoutPage } from "./pages/post-logout-page.tsx";
import { ErrorPage } from "./pages/error-page.tsx";
import { DevicePage } from "./pages/device-page.tsx";

function PublicRoute({ children }: { children: React.ReactNode }) {
  // Keep the login page renderable even if already authenticated;
  // the page itself decides whether to show the form or success state.
  return <>{children}</>;
}

const rootRoute = createRootRoute({
  component: App,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => (
    <PublicRoute>
      <LoginFlowPage />
    </PublicRoute>
  ),
});

const consentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/consent",
  component: ConsentPage,
});

const oauthLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/login",
  component: OAuthLoginPage,
});

const oauthLoggedOutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/logged-out",
  component: PostLogoutPage,
});

const errorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/error",
  component: ErrorPage,
});

const deviceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/device",
  component: DevicePage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  consentRoute,
  oauthLoginRoute,
  oauthLoggedOutRoute,
  errorRoute,
  deviceRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <div
      style={{
        padding: "24px",
        minHeight: "100vh",
        backgroundColor: "var(--colors-bg\\.page)",
      }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
    </div>
  ),
});

// Register router type for TanStack Router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
