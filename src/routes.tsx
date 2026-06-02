import {
  createRouter,
  createRoute,
  createRootRoute,
  Navigate,
} from "@tanstack/react-router";
import { useAuth } from "@sunbeam/g2v";
import { App } from "./app.tsx";
import { DashboardPage } from "./pages/dashboard.tsx";
import { IdentitiesPage } from "./pages/identities.tsx";
import { IdentityDetailPage } from "./pages/identity-detail.tsx";
import { SchemaDetailPage } from "./pages/schema-detail.tsx";
import { LoginFlowPage } from "./pages/login-flow.tsx";
import { RecoveryFlowPage } from "./pages/recovery-flow.tsx";
import { SettingsFlowPage } from "./pages/settings-flow.tsx";
import { VerificationFlowPage } from "./pages/verification-flow.tsx";
import { HealthPage } from "./pages/health.tsx";
import { ConsentPage } from "./pages/consent-page.tsx";
import { OAuthLoginPage } from "./pages/oauth-login-page.tsx";
import { PostLogoutPage } from "./pages/post-logout-page.tsx";
import { ErrorPage } from "./pages/error-page.tsx";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" />;
  return <>{children}</>;
}

const rootRoute = createRootRoute({
  component: App,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  ),
});

const identitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/identities",
  component: () => (
    <ProtectedRoute>
      <IdentitiesPage />
    </ProtectedRoute>
  ),
});

const identityDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/identities/$id",
  component: () => (
    <ProtectedRoute>
      <IdentityDetailPage />
    </ProtectedRoute>
  ),
});

const schemaDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/schemas/$id",
  component: () => (
    <ProtectedRoute>
      <SchemaDetailPage />
    </ProtectedRoute>
  ),
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

const recoveryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recovery",
  component: () => (
    <PublicRoute>
      <RecoveryFlowPage />
    </PublicRoute>
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => (
    <ProtectedRoute>
      <SettingsFlowPage />
    </ProtectedRoute>
  ),
});

const verificationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verification",
  component: () => (
    <PublicRoute>
      <VerificationFlowPage />
    </PublicRoute>
  ),
});

const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/health",
  component: () => (
    <ProtectedRoute>
      <HealthPage />
    </ProtectedRoute>
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  identitiesRoute,
  identityDetailRoute,
  schemaDetailRoute,
  loginRoute,
  recoveryRoute,
  settingsRoute,
  verificationRoute,
  healthRoute,
  consentRoute,
  oauthLoginRoute,
  oauthLoggedOutRoute,
  errorRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <div style={{ padding: "24px" }}>
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
