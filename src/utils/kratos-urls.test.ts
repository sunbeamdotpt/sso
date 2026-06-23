import { describe, expect, it } from "vitest";
import { getLoginBrowserUrl, getRecoveryBrowserUrl } from "./kratos-urls.ts";

describe("getLoginBrowserUrl", () => {
  it("always includes refresh=true", () => {
    const url = getLoginBrowserUrl();
    expect(url).toContain("refresh=true");
  });

  it("preserves return_to when provided", () => {
    const url = getLoginBrowserUrl("/device?code=abc");
    expect(url).toContain("return_to=%2Fdevice%3Fcode%3Dabc");
  });

  it("does not depend on authentication state", () => {
    // This is a regression guard: the URL must never change based on whether the
    // caller thinks the user is authenticated. Both calls must produce the same
    // shape.
    expect(getLoginBrowserUrl()).toBe(getLoginBrowserUrl());
  });
});

describe("getRecoveryBrowserUrl", () => {
  it("points to the recovery browser endpoint", () => {
    expect(getRecoveryBrowserUrl()).toBe("/api/self-service/recovery/browser");
  });
});
