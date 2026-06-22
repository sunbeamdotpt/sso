import { createRestClient } from "@sunbeam/g2v/rest";
import { authSelectors } from "@sunbeam/g2v/state";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * Custom fetch wrapper that sends Kratos session tokens via the
 * `X-Session-Token` header instead of `Authorization: Bearer`.
 *
 * Browser flows (settings, logout) rely on cookies, so we always
 * send `credentials: "same-origin"`.  We only inject
 * `X-Session-Token` when a real API token is present — the literal
 * string `"cookie"` means the session is managed by Kratos via
 * HTTP-only cookie and must not be sent as a header.
 */
function kratosFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = authSelectors.token();
  const opts: RequestInit = { ...init, credentials: "same-origin" };
  const headers = new Headers(init?.headers);

  // createRestClient injects Authorization: Bearer <token>.  For Kratos
  // we either replace it with X-Session-Token or remove it entirely when
  // relying on cookie-based auth.
  const _hadAuth = headers.get("Authorization");
  headers.delete("Authorization");

  if (token && token !== "cookie") {
    headers.set("X-Session-Token", token);
  }

  opts.headers = headers;
  return fetch(input, opts);
}

export const api = createRestClient({
  baseUrl,
  defaultHeaders: {
    Accept: "application/json",
  },
  fetch: kratosFetch,
});
