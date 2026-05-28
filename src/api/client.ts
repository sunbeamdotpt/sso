import { createRestClient } from "@sunbeam/g2v/rest";
import { authSelectors } from "@sunbeam/g2v/state";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * Custom fetch wrapper that sends Kratos session tokens via the
 * `X-Session-Token` header instead of `Authorization: Bearer`.
 */
function kratosFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = authSelectors.token();
  if (!token) {
    return fetch(input, init);
  }
  const headers = new Headers(init?.headers);
  // Kratos API flows expect X-Session-Token, not Authorization: Bearer.
  headers.delete("Authorization");
  headers.set("X-Session-Token", token);
  return fetch(input, { ...init, headers });
}

export const api = createRestClient({
  baseUrl,
  defaultHeaders: {
    Accept: "application/json",
  },
  fetch: kratosFetch,
});
