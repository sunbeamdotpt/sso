/// <reference lib="deno.ns" />
import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import {
  authMiddleware,
  sessionHandler,
} from "./server/auth.ts";
import { proxyHandler } from "./server/proxy.ts";
import { csrfMiddleware } from "./server/csrf.ts";
import { flowHandler, flowErrorHandler } from "./server/flow.ts";
import {
  acceptConsent,
  acceptLogin,
  acceptLogout,
  getConsent,
  getLogout,
  rejectConsent,
} from "./server/hydra.ts";
import { rateLimitMiddleware, securityHeadersMiddleware } from "./server/security.ts";

const app = new Hono();

// Security headers on every response
app.use("/*", securityHeadersMiddleware);

// Health check -- no auth required
app.get("/health", (c) =>
  c.json({ ok: true, time: new Date().toISOString() }));

// Rate-limit auth endpoints (mutating methods)
const authRateLimit = rateLimitMiddleware();
app.use("/api/self-service/login/*", authRateLimit);
app.use("/api/self-service/recovery/*", authRateLimit);
app.use("/api/self-service/logout/*", authRateLimit);
app.use("/api/hydra/*", authRateLimit);

// Auth middleware on everything except /health
app.use("/*", async (c, next) => {
  if (c.req.path === "/health") return await next();
  return await authMiddleware(c, next);
});

// CSRF protection on non-API state-mutating requests
app.use("/*", csrfMiddleware);

// Session endpoint
app.get("/api/auth/session", sessionHandler);

// Flow proxy (public — cookies forwarded but no session check)
app.get("/api/flow/error", flowErrorHandler);
app.get("/api/flow/:type", flowHandler);

// Hydra proxy (CSRF only — no session required)
app.get("/api/hydra/consent", getConsent);
app.post("/api/hydra/consent/accept", acceptConsent);
app.post("/api/hydra/consent/reject", rejectConsent);
app.get("/api/hydra/logout", getLogout);
app.post("/api/hydra/logout/accept", acceptLogout);
app.post("/api/hydra/login/accept", acceptLogin);

// Proxy all other /api/* requests to Kratos
app.all("/api/*", proxyHandler);

// Static files from dist
app.use(
  "/*",
  serveStatic({
    root: "./dist",
  }),
);

// SPA fallback: serve index.html for unmatched routes
app.use(
  "/*",
  serveStatic({
    root: "./dist",
    path: "index.html",
  }),
);

const port = parseInt(Deno.env.get("PORT") ?? "3102", 10);
console.log(`kratos-admin listening on :${port}`);
Deno.serve({ port }, app.fetch);
