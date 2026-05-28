import type { Context } from "hono";

const KRATOS_PUBLIC_URL =
  Deno.env.get("KRATOS_PUBLIC_URL") ??
  "http://kratos-public.ory.svc.cluster.local:80";

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

function stripHopByHop(headers: Headers): Headers {
  const out = new Headers();
  for (const [key, value] of headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      out.set(key, value);
    }
  }
  return out;
}

/** GET /api/flow/:type?flow=<id> — proxy Kratos self-service flow data. */
export async function flowHandler(c: Context): Promise<Response> {
  const type = c.req.param("type");
  const flowId = c.req.query("flow");

  if (!flowId) {
    return c.json({ error: "Missing flow query parameter" }, 400);
  }

  const target =
    `${KRATOS_PUBLIC_URL}/self-service/${type}/flows?id=${flowId}`;

  const reqHeaders = stripHopByHop(c.req.raw.headers);

  try {
    const resp = await fetch(target, { headers: reqHeaders });
    const respHeaders = stripHopByHop(resp.headers);
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    });
  } catch {
    return c.text("Kratos unavailable", 502);
  }
}

/** GET /api/flow/error?id=<id> — proxy Kratos self-service error. */
export async function flowErrorHandler(c: Context): Promise<Response> {
  const errorId = c.req.query("id");

  if (!errorId) {
    return c.json({ error: "Missing id query parameter" }, 400);
  }

  const target = `${KRATOS_PUBLIC_URL}/self-service/errors?id=${errorId}`;
  const reqHeaders = stripHopByHop(c.req.raw.headers);

  try {
    const resp = await fetch(target, { headers: reqHeaders });
    const respHeaders = stripHopByHop(resp.headers);
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    });
  } catch {
    return c.text("Kratos unavailable", 502);
  }
}
