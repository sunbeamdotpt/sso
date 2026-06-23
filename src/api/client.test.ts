import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authActions } from "@sunbeam/g2v/state";
import { api } from "./client.ts";

describe("kratosFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    authActions.logout();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    authActions.logout();
  });

  it("strips Authorization when token is 'cookie'", async () => {
    authActions.loginSuccess({
      accessToken: "cookie",
      claims: { sub: "test" },
    });

    const captured: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(input), init: init ?? {} });
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;

    await api.get("/test");

    expect(captured).toHaveLength(1);
    const headers = new Headers(captured[0].init.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(captured[0].init.credentials).toBe("same-origin");
  });

  it("sends X-Session-Token when token is real", async () => {
    authActions.loginSuccess({
      accessToken: "real-session-token-123",
      claims: { sub: "test" },
    });

    const captured: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(input), init: init ?? {} });
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;

    await api.get("/test");

    expect(captured).toHaveLength(1);
    const headers = new Headers(captured[0].init.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("X-Session-Token")).toBe("real-session-token-123");
  });
});
