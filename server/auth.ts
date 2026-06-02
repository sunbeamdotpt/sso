import type { Context, Next } from "hono";

const KRATOS_PUBLIC_URL =
  Deno.env.get("KRATOS_PUBLIC_URL") ??
  "http://kratos-public.ory.svc.cluster.local:80";
const PUBLIC_URL = Deno.env.get("PUBLIC_URL") ?? "http://localhost:3102";
const KRATOS_ADMIN_URL =
  Deno.env.get("KRATOS_ADMIN_URL") ??
  "http://kratos-admin.ory.svc.cluster.local:80";

// Routes that require no authentication at all
const PUBLIC_ROUTES = new Set([
  "/login",
  "/recovery",
  "/verification",
  "/error",
  "/health",
]);

// Routes that need CSRF but not a session (Hydra flows)
const CSRF_ONLY_ROUTES = new Set(["/consent", "/logout"]);

function getAdminList(): string[] {
  const raw = Deno.env.get("ADMIN_IDENTITY_IDS") ?? "";
  if (!raw.trim()) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function extractSessionCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (
      cookie.startsWith("ory_session_") ||
      cookie.startsWith("ory_kratos_session")
    ) {
      return cookie;
    }
  }
  return null;
}

export interface SessionInfo {
  id: string;
  email: string;
  session: unknown;
}

export interface SessionResult {
  info: SessionInfo | null;
  needsAal2: boolean;
  redirectTo?: string;
}

/** Fetch the Kratos session for the given cookie. */
export async function getSession(
  cookieHeader: string,
): Promise<SessionResult> {
  const sessionCookie = extractSessionCookie(cookieHeader);
  if (!sessionCookie) return { info: null, needsAal2: false };

  try {
    const resp = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
      headers: { cookie: sessionCookie },
    });
    if (resp.status === 403) {
      // Session exists but AAL is too low — need 2FA step-up
      const body = await resp.json().catch(() => null);
      const redirectTo = body?.redirect_browser_to ?? body?.error?.details?.redirect_browser_to;
      return { info: null, needsAal2: true, redirectTo };
    }
    if (resp.status !== 200) return { info: null, needsAal2: false };
    const session = await resp.json();
    return {
      info: {
        id: session?.identity?.id ?? "",
        email: session?.identity?.traits?.email ?? "",
        session,
      },
      needsAal2: false,
    };
  } catch {
    return { info: null, needsAal2: false };
  }
}

/** Check if an identity has any 2FA method (TOTP or WebAuthn) configured. */
async function has2fa(identityId: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `${KRATOS_ADMIN_URL}/admin/identities/${identityId}?include_credential=totp&include_credential=webauthn`,
    );
    if (!resp.ok) return true; // fail open — don't block on admin API errors
    const identity = await resp.json();
    const creds = identity?.credentials ?? {};
    const hasTOTP = creds.totp?.identifiers?.length > 0;
    const hasWebAuthn = creds.webauthn?.identifiers?.length > 0;
    return hasTOTP || hasWebAuthn;
  } catch {
    return true; // fail open
  }
}

export function isAdmin(identityId: string, email: string): boolean {
  const adminList = getAdminList();
  if (adminList.length === 0) return true; // bootstrap mode
  return adminList.includes(identityId) || adminList.includes(email);
}

function isPublicRoute(path: string): boolean {
  // Exact match or path starts with the public route + /
  for (const route of PUBLIC_ROUTES) {
    if (path === route || path.startsWith(route + "/")) return true;
  }
  // Flow proxy and flow error endpoints are public (need cookies but not session validation here)
  if (path.startsWith("/api/flow/")) return true;
  // Static assets must be served without auth so the SPA can load
  if (path.startsWith("/assets/") || path === "/index.html" || path === "/favicon.ico") return true;
  return false;
}

function isCsrfOnlyRoute(path: string): boolean {
  for (const route of CSRF_ONLY_ROUTES) {
    if (path === route || path.startsWith(route + "/")) return true;
  }
  // Hydra proxy endpoints
  if (path.startsWith("/api/hydra/")) return true;
  return false;
}

function isAdminRoute(path: string): boolean {
  // Admin API proxy (Kratos admin) and admin-only UI routes
  const adminPrefixes = [
    "/api/identities",
    "/api/admin",
    "/api/sessions",
    "/api/courier",
    "/identities",
    "/sessions",
    "/courier",
    "/schemas",
  ];
  for (const prefix of adminPrefixes) {
    if (path === prefix || path.startsWith(prefix + "/") ||
      path.startsWith(prefix + "?")) {
      return true;
    }
  }
  return false;
}

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;

  // Public routes: no auth needed
  if (isPublicRoute(path)) {
    return await next();
  }

  // CSRF-only routes: skip session check
  if (isCsrfOnlyRoute(path)) {
    return await next();
  }

  // All other routes need authentication
  const cookieHeader = c.req.header("cookie") ?? "";
  const { info: sessionInfo, needsAal2, redirectTo } = await getSession(
    cookieHeader,
  );

  if (needsAal2) {
    // Session exists but needs 2FA — redirect to step-up login
    if (
      path.startsWith("/api/") ||
      c.req.header("accept")?.includes("application/json")
    ) {
      return c.json({ error: "AAL2 required", redirectTo }, 403);
    }
    // Use Kratos-provided redirect URL if available, otherwise construct one
    if (redirectTo) {
      return c.redirect(redirectTo, 302);
    }
    const returnTo = encodeURIComponent(PUBLIC_URL + path);
    return c.redirect(
      `/kratos/self-service/login/browser?aal=aal2&return_to=${returnTo}`,
      302,
    );
  }

  if (!sessionInfo) {
    // API requests get 401, browser requests get redirected
    if (
      path.startsWith("/api/") ||
      c.req.header("accept")?.includes("application/json")
    ) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const loginUrl =
      `${PUBLIC_URL}/login?return_to=${encodeURIComponent(PUBLIC_URL + path)}`;
    return c.redirect(loginUrl, 302);
  }

  c.set("identity", {
    id: sessionInfo.id,
    email: sessionInfo.email,
    session: sessionInfo.session,
  });
  c.set("isAdmin", isAdmin(sessionInfo.id, sessionInfo.email));

  // 2FA enrollment check — force users to set up TOTP/WebAuthn before using the app.
  // Allow /security, /api/auth/*, /api/flow/*, and /kratos/* through so they can
  // actually complete the setup flow.
  const skipMfaCheck = path === "/onboarding" || path.startsWith("/onboarding/") ||
    path.startsWith("/api/auth/") || path.startsWith("/api/flow/") ||
    path.startsWith("/api/avatar/") || path.startsWith("/api/health/") ||
    path === "/health" || path.startsWith("/kratos/");
  if (!skipMfaCheck) {
    const userHas2fa = await has2fa(sessionInfo.id);
    c.set("has2fa", userHas2fa);
    if (!userHas2fa) {
      if (
        path.startsWith("/api/") ||
        c.req.header("accept")?.includes("application/json")
      ) {
        return c.json({ error: "2FA setup required", needs2faSetup: true }, 403);
      }
      return c.redirect("/onboarding", 302);
    }
  }

  // Admin-only routes: check admin status
  if (isAdminRoute(path)) {
    if (!c.get("isAdmin")) {
      if (
        path.startsWith("/api/") ||
        c.req.header("accept")?.includes("application/json")
      ) {
        return c.json({ error: "Forbidden" }, 403);
      }
      return c.redirect("/settings", 302);
    }
  }

  await next();
}

/** DELETE /api/auth/sessions — revokes ALL sessions for the current identity. */
export async function revokeAllSessionsHandler(c: Context): Promise<Response> {
  const identity = c.get("identity");
  if (!identity?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const resp = await fetch(
      `${KRATOS_ADMIN_URL}/admin/identities/${identity.id}/sessions`,
      { method: "DELETE" },
    );
    if (resp.status === 204 || resp.status === 200) {
      return c.json({ ok: true });
    }
    return c.json({ error: "Failed to revoke sessions" }, 500);
  } catch {
    return c.json({ error: "Failed to revoke sessions" }, 500);
  }
}

/** GET /api/auth/session — returns current session + admin status. */
export async function sessionHandler(c: Context): Promise<Response> {
  const cookieHeader = c.req.header("cookie") ?? "";
  const { info: sessionInfo, needsAal2, redirectTo } = await getSession(
    cookieHeader,
  );

  if (needsAal2) {
    return c.json({ error: "AAL2 required", needsAal2: true, redirectTo }, 403);
  }

  if (!sessionInfo) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userHas2fa = await has2fa(sessionInfo.id);
  return c.json({
    session: sessionInfo.session,
    isAdmin: isAdmin(sessionInfo.id, sessionInfo.email),
    needs2faSetup: !userHas2fa,
  });
}
