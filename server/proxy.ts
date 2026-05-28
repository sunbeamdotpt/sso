import type { Context } from "hono";

const KRATOS_ADMIN_URL =
  Deno.env.get("KRATOS_ADMIN_URL") ??
  "http://kratos-admin.ory.svc.cluster.local:80";

const KRATOS_PUBLIC_URL =
  Deno.env.get("KRATOS_PUBLIC_URL") ??
  "http://kratos-public.ory.svc.cluster.local:80";

// Paths that must be served from the public API (not the admin API)
const PUBLIC_API_PATHS = ["/schemas"];

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

export async function proxyHandler(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  // Strip the /api prefix
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const isPublic = PUBLIC_API_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const upstream = isPublic ? KRATOS_PUBLIC_URL : KRATOS_ADMIN_URL;
  const target = `${upstream}${path}${url.search}`;

  const reqHeaders = new Headers();
  for (const [key, value] of c.req.raw.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      reqHeaders.set(key, value);
    }
  }

  let resp: Response;
  try {
    resp = await fetch(target, {
      method: c.req.method,
      headers: reqHeaders,
      body: c.req.method !== "GET" && c.req.method !== "HEAD"
        ? c.req.raw.body
        : undefined,
      redirect: "manual",
    });
  } catch {
    return c.text("Upstream unavailable", 502);
  }

  const respHeaders = new Headers();
  for (const [key, value] of resp.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      respHeaders.set(key, value);
    }
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
}
