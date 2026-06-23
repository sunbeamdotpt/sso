/**
 * Validate a return URL against an allow-list of trusted origins/paths.
 * Rejects absolute URLs to untrusted hosts, protocol-relative URLs,
 * javascript: URLs, and data: URLs.
 */
export function isSafeReturnUrl(
  url: string,
  trustedOrigins: string[] = [],
): boolean {
  if (!url) return false;

  // Reject known dangerous schemes immediately
  const dangerous = /^(javascript|data|vbscript|file|about|blob):/i;
  if (dangerous.test(url.trim())) return false;

  let parsed: URL;
  try {
    parsed = new URL(url, globalThis.location.origin);
  } catch {
    return false;
  }

  // Relative paths (no host) are safe
  if (parsed.origin === globalThis.location.origin) return true;

  // Absolute URLs must match an explicitly trusted origin
  return trustedOrigins.some((origin) => parsed.origin === origin);
}

/**
 * Return a safe redirect URL, or a fallback if the input is not trusted.
 */
export function getSafeReturnUrl(
  url: string | undefined,
  fallback = "/",
  trustedOrigins: string[] = [],
): string {
  if (!url) return fallback;
  return isSafeReturnUrl(url, trustedOrigins) ? url : fallback;
}

const CHALLENGE_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/**
 * Validate a Hydra/Kratos challenge identifier.
 * Expects a standard UUID string.
 */
export function isValidChallenge(challenge: unknown): challenge is string {
  return typeof challenge === "string" && CHALLENGE_PATTERN.test(challenge);
}

/**
 * Sanitize a user-visible string by stripping control characters and trimming.
 * React already escapes HTML; this prevents unusual Unicode/control chars.
 */
export function sanitizeDisplayText(value: unknown): string {
  if (typeof value !== "string") return "";
  // Strip ASCII control characters and trim; React handles HTML escaping.
  return value
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code > 0x1F && code !== 0x7F;
    })
    .join("")
    .trim()
    .slice(0, 1000);
}
