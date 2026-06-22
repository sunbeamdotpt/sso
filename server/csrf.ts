import type { Context, Next } from "hono";

const CSRF_COOKIE_SECRET = Deno.env.get("CSRF_COOKIE_SECRET");
if (!CSRF_COOKIE_SECRET) {
  throw new Error(
    "CSRF_COOKIE_SECRET environment variable is required. " +
      "Generate a random value (≥32 bytes) and set it before starting the server.",
  );
}
const CSRF_COOKIE_NAME = "ory-csrf-token";

const encoder = new TextEncoder();

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacVerify(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  if (expected.length !== signature.length) return false;
  // Constant-time compare
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

function isProduction(): boolean {
  return Deno.env.get("NODE_ENV") === "production" ||
    Deno.env.get("COOKIE_SECURE") === "true";
}

export async function generateCsrfToken(): Promise<{
  token: string;
  cookie: string;
}> {
  const raw = crypto.randomUUID();
  const sig = await hmacSign(raw, CSRF_COOKIE_SECRET);
  const token = `${raw}.${sig}`;
  const secureFlag = isProduction() ? "; Secure" : "";
  const cookie =
    `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict${secureFlag}`;
  return { token, cookie };
}

function extractCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.slice(name.length + 1);
    }
  }
  return null;
}

async function verifyCsrfToken(req: Request): Promise<boolean> {
  const headerToken = req.headers.get("x-csrf-token");
  if (!headerToken) return false;

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieToken = extractCookie(cookieHeader, CSRF_COOKIE_NAME);
  if (!cookieToken) return false;

  // Both must match
  if (headerToken !== cookieToken) return false;

  // Verify HMAC
  const parts = headerToken.split(".");
  if (parts.length !== 2) return false;
  const [raw, sig] = parts;
  return await hmacVerify(raw, sig, CSRF_COOKIE_SECRET);
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function csrfMiddleware(c: Context, next: Next) {
  // Only protect state-mutating methods on non-API routes
  // (API routes proxy to Kratos which has its own CSRF)
  if (MUTATING_METHODS.has(c.req.method) && !c.req.path.startsWith("/api")) {
    const valid = await verifyCsrfToken(c.req.raw);
    if (!valid) {
      return c.text("CSRF token invalid or missing", 403);
    }
  }
  await next();
}
