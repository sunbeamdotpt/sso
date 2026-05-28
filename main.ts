import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import {
  authMiddleware,
  revokeAllSessionsHandler,
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
import { deleteAvatar, getAvatar, uploadAvatar } from "./server/s3.ts";

const app = new Hono();

// Health check -- no auth required
app.get("/health", (c) =>
  c.json({ ok: true, time: new Date().toISOString() }));

// Auth middleware on everything except /health
app.use("/*", async (c, next) => {
  if (c.req.path === "/health") return await next();
  return await authMiddleware(c, next);
});

// CSRF protection on non-API state-mutating requests
app.use("/*", csrfMiddleware);

// Session endpoints
app.get("/api/auth/session", sessionHandler);
app.delete("/api/auth/sessions", revokeAllSessionsHandler);

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

// Avatar S3 proxy (auth required)
app.put("/api/avatar", uploadAvatar);
app.get("/api/avatar/:id", getAvatar);
app.delete("/api/avatar", deleteAvatar);

// Proxy all other /api/* requests to Kratos Admin (admin required via authMiddleware)
app.all("/api/*", proxyHandler);

// Static files from ui/dist
app.use(
  "/*",
  serveStatic({
    root: "./ui/dist",
  }),
);

// SPA fallback: serve index.html for unmatched routes
app.use(
  "/*",
  serveStatic({
    root: "./ui/dist",
    path: "index.html",
  }),
);

const port = parseInt(Deno.env.get("PORT") ?? "3102", 10);
console.log(`sso listening on :${port}`);
Deno.serve({ port }, app.fetch);
