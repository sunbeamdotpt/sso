import type { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

function getClientIdentifier(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";
  return `${c.req.method}:${c.req.path}:${ip}`;
}

/**
 * Rate-limit state-mutating auth endpoints by IP + path.
 * This is an in-memory store; use Redis in multi-instance deployments.
 */
export function rateLimitMiddleware(
  windowMs = RATE_LIMIT_WINDOW_MS,
  maxRequests = RATE_LIMIT_MAX,
) {
  return async (c: Context, next: Next) => {
    const key = getClientIdentifier(c);
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count++;
      if (entry.count > maxRequests) {
        return c.json({ error: "Too many requests. Please try again later." }, 429);
      }
    }

    await next();
  };
}

/**
 * Security headers baseline for the SSO portal.
 */
export async function securityHeadersMiddleware(
  c: Context,
  next: Next,
): Promise<void> {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' https:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';",
  );
  if (Deno.env.get("NODE_ENV") === "production") {
    c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  await next();
}
