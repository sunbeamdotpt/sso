const REDIRECT_HISTORY_KEY = "sso_redirect_history_v1";
const LOOP_WINDOW_MS = 5000;

export type RedirectRecord = {
  from: string;
  to: string;
  time: number;
};

function normalizeUrl(url: string, base: string): string {
  try {
    const parsed = new URL(url, base);
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

function readHistory(win: Window): RedirectRecord[] {
  try {
    const raw = win.sessionStorage.getItem(REDIRECT_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as RedirectRecord[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(win: Window, history: RedirectRecord[]) {
  try {
    win.sessionStorage.setItem(REDIRECT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

/**
 * Check whether assigning `window.location.href = targetUrl` would continue a
 * redirect loop. Returns a human-readable reason if a loop is detected, or
 * `null` if the redirect is safe.
 *
 * A loop is detected when the same source page has already redirected to the
 * same target within the last few seconds. This prevents the SPA from ping-
 * ponging with Kratos when `default_browser_return_url` points back at a page
 * that itself redirects to Kratos.
 *
 * Callers must still perform the redirect; this function only records the
 * intent and returns the verdict.
 */
export function detectRedirectLoop(
  targetUrl: string,
  win: Window = globalThis.window,
): string | null {
  if (!win?.location || !win?.sessionStorage) return null;

  const from = normalizeUrl(win.location.href, win.location.href);
  const to = normalizeUrl(targetUrl, win.location.href);
  const now = Date.now();

  const history = readHistory(win).filter((r) => now - r.time < LOOP_WINDOW_MS);

  const repeated = history.find((r) => r.from === from && r.to === to);
  if (repeated) {
    return `Redirect loop detected: ${from} → ${to} was already triggered. Check Kratos default_browser_return_url.`;
  }

  writeHistory(win, [...history, { from, to, time: now }]);
  return null;
}

/**
 * Clear the redirect history. Call this when a flow is successfully loaded,
 * so a legitimate later redirect to the same endpoint is not mistaken for a
 * loop.
 */
export function clearRedirectHistory(win: Window = globalThis.window) {
  if (!win?.sessionStorage) return;
  try {
    win.sessionStorage.removeItem(REDIRECT_HISTORY_KEY);
  } catch {
    // Ignore.
  }
}
