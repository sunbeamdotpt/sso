import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  AuthProvider,
  clearSession,
  setUserSession,
  validateSession,
} from "./auth.tsx";
import { authActions } from "@sunbeam/g2v/state";
import type { Identity } from "../api/types.ts";

vi.mock("@sunbeam/g2v/state", async () => {
  const actual = await vi.importActual("@sunbeam/g2v/state");
  return {
    ...actual,
    authActions: {
      loginSuccess: vi.fn(),
      logout: vi.fn(),
    },
  };
});

describe("validateSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true and hydrates auth store on active session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            active: true,
            identity: { id: "user-1", traits: { email: "test@example.com" } },
            authenticator_assurance_level: "aal2",
          }),
      }),
    );
    const result = await validateSession();
    expect(result).toBe(true);
    expect(authActions.loginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        claims: expect.objectContaining({ sub: "user-1" }),
      }),
    );
  });

  it("returns false on invalid session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    const result = await validateSession();
    expect(result).toBe(false);
    expect(authActions.logout).toHaveBeenCalled();
  });

  it("returns false on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const result = await validateSession();
    expect(result).toBe(false);
    expect(authActions.logout).toHaveBeenCalled();
  });

  it("returns false when session is inactive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            active: false,
            identity: { id: "user-1", traits: {} },
          }),
      }),
    );
    const result = await validateSession();
    expect(result).toBe(false);
    expect(authActions.logout).toHaveBeenCalled();
  });
});

describe("setUserSession", () => {
  it("stores identity in auth store", () => {
    setUserSession(
      { id: "user-1", traits: { email: "test@example.com" } } as Identity,
      "aal2",
    );
    expect(authActions.loginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        claims: expect.objectContaining({ sub: "user-1" }),
      }),
    );
  });
});

describe("clearSession", () => {
  it("calls logout endpoint and clears store", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ logout_token: "token-123" }),
      }),
    );
    await clearSession();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(authActions.logout).toHaveBeenCalled();
  });

  it("handles missing logout token gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );
    await clearSession();
    expect(authActions.logout).toHaveBeenCalled();
  });

  it("handles logout init failure gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    );
    await clearSession();
    expect(authActions.logout).toHaveBeenCalled();
  });

  it("handles logout endpoint failure gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    await clearSession();
    expect(authActions.logout).toHaveBeenCalled();
  });
});

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows loading state initially", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );
    render(
      <AuthProvider>
        <div data-testid="content">Protected Content</div>
      </AuthProvider>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders children after session validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            active: true,
            identity: { id: "user-1", traits: { email: "test@example.com" } },
          }),
      }),
    );

    render(
      <AuthProvider>
        <div data-testid="content">Protected Content</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
    expect(authActions.loginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        claims: expect.objectContaining({ sub: "user-1" }),
      }),
    );
  });
});
