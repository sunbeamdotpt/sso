import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAvailableMfaMethods, needsMfa, submitFlow } from "./flows.ts";
import { mockLoginFlow } from "../test/mocks.ts";
import type { LoginFlow } from "./types.ts";

describe("submitFlow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns success with session on successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            session: {
              identity: { id: "user-1", traits: { email: "test@example.com" } },
              authenticator_assurance_level: "aal1",
            },
          }),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {
      identifier: "test",
      password: "pass",
    }, "password");
    expect(result.success).toBe(true);
    expect(result.session?.identity.id).toBe("user-1");
  });

  it("returns updated flow on successful submit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ui: {
              action: "/self-service/recovery",
              method: "POST",
              nodes: [],
              messages: [],
            },
          }),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {}, "code");
    expect(result.success).toBe(true);
    expect(result.flow).toBeDefined();
  });

  it("returns error on failed login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            ui: {
              messages: [{ type: "error", text: "Invalid credentials" }],
              nodes: [],
            },
          }),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {
      identifier: "bad",
      password: "bad",
    }, "password");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid credentials");
  });

  it("detects expired flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        json: () =>
          Promise.resolve({
            error: { id: "self_service_flow_expired", code: 410 },
          }),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {}, "password");
    expect(result.success).toBe(false);
    expect(result.error).toBe("This session expired. Please try again.");
  });

  it("handles redirect_browser_to response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            redirect_browser_to: "https://example.com/redirect",
          }),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {}, "password");
    expect(result.success).toBe(false);
    expect(result.redirect_browser_to).toBe("https://example.com/redirect");
  });

  it("returns error.message when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ error: { message: "Internal server error" } }),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {}, "password");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Internal server error");
  });

  it("returns generic HTTP status for unknown errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {}, "password");
    expect(result.success).toBe(false);
    expect(result.error).toBe("HTTP 503");
  });

  it("returns unexpected response when no session or ui", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );
    const result = await submitFlow(mockLoginFlow as LoginFlow, {}, "password");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unexpected response from flow.");
  });
});

describe("needsMfa", () => {
  it("returns true when requested_aal is aal2 and no state", () => {
    expect(needsMfa({ requested_aal: "aal2" } as LoginFlow)).toBe(true);
  });
  it("returns false when aal1", () => {
    expect(needsMfa({ requested_aal: "aal1" } as LoginFlow)).toBe(false);
  });
  it("returns false for undefined flow", () => {
    expect(needsMfa(undefined)).toBe(false);
  });
});

describe("getAvailableMfaMethods", () => {
  it("returns totp and lookup_secret methods", () => {
    const flow = {
      ui: {
        nodes: [{ group: "totp" }, { group: "lookup_secret" }, {
          group: "default",
        }],
      },
    };
    expect(getAvailableMfaMethods(flow as LoginFlow)).toEqual([
      "totp",
      "lookup_secret",
    ]);
  });
  it("returns webauthn method", () => {
    const flow = { ui: { nodes: [{ group: "webauthn" }] } };
    expect(getAvailableMfaMethods(flow as LoginFlow)).toEqual(["webauthn"]);
  });
  it("returns empty array for undefined flow", () => {
    expect(getAvailableMfaMethods(undefined)).toEqual([]);
  });
});
