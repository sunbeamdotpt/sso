import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRedirectHistory, detectRedirectLoop } from "./redirect-guard.ts";

function mockWindow(
  locationHref: string,
  storage: Record<string, string> = {},
) {
  const store = { ...storage };
  return {
    location: { href: locationHref },
    sessionStorage: {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
    },
  } as unknown as Window;
}

describe("detectRedirectLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers?.();
  });

  it("allows the first redirect", () => {
    const win = mockWindow("https://auth.sunbeam.pt/login");
    expect(detectRedirectLoop("/api/self-service/login/browser", win)).toBeNull();
  });

  it("detects a repeated redirect as a loop", () => {
    const win = mockWindow("https://auth.sunbeam.pt/login");
    detectRedirectLoop("/api/self-service/login/browser", win);

    const result = detectRedirectLoop(
      "/api/self-service/login/browser",
      win,
    );
    expect(result).not.toBeNull();
    expect(result).toContain("Redirect loop detected");
  });

  it("does not flag a redirect to a different target", () => {
    const win = mockWindow("https://auth.sunbeam.pt/login");
    detectRedirectLoop("/api/self-service/login/browser", win);

    const result = detectRedirectLoop("/api/self-service/recovery/browser", win);
    expect(result).toBeNull();
  });

  it("does not flag a redirect from a different source", () => {
    const win = mockWindow("https://auth.sunbeam.pt/login");
    detectRedirectLoop("/api/self-service/login/browser", win);

    win.location.href = "https://auth.sunbeam.pt/recovery";
    const result = detectRedirectLoop("/api/self-service/login/browser", win);
    expect(result).toBeNull();
  });

  it("clears history on demand", () => {
    const win = mockWindow("https://auth.sunbeam.pt/login");
    detectRedirectLoop("/api/self-service/login/browser", win);
    clearRedirectHistory(win);

    const result = detectRedirectLoop(
      "/api/self-service/login/browser",
      win,
    );
    expect(result).toBeNull();
  });
});
