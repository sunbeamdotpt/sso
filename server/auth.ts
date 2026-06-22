import type { Context, Next } from "hono";

const KRATOS_PUBLIC_URL =
  Deno.env.get("KRATOS_PUBLIC_URL") ??
  "http://kratos-public.ory.svc.cluster.local:80";
const PUBLIC_URL = Deno.env.get("PUBLIC_URL") ?? "http://localhost:3102";

// Routes that require no authentication at all
const PUBLIC_ROUTES = new Set([
  "/login",
  "/error",
  "/health",
]);

// Routes that need CSRF but not a session (Hydra flows)
const CSRF_ONLY_ROUTES = new Set(["/consent", "/logout"]);

const SESSION_COOKIE_NAME = "ory_kratos_session";

function extractSessionCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return cookie.slice(SESSION_COOKIE_NAME.length + 1);
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
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}` },
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

function isPublicRoute(path: string): boolean {
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
    if (
      path.startsWith("/api/") ||
      c.req.header("accept")?.includes("application/json")
    ) {
      return c.json({ error: "AAL2 required", redirectTo }, 403);
    }
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

  await next();
}

/** GET /api/auth/session — returns current session info. */
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

  return c.json({ session: sessionInfo.session });
}
