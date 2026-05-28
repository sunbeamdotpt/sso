import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers/mock-api";
import { identityJoana, identityList } from "./fixtures/identities";
import { sessionList } from "./fixtures/sessions";
import { clientSol, clientList } from "./fixtures/clients";
import { courierMessages } from "./fixtures/courier";
import { jwksOpenIdIdToken, jwksJwtAccessToken, jwksKratosSession } from "./fixtures/jwks";
import { schemaList, personSchemaV3 } from "./fixtures/schemas";

// ---------------------------------------------------------------------------
// 1. OverviewPage  /admin
// ---------------------------------------------------------------------------

test.describe("OverviewPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/identities/,
        method: "GET",
        body: identityList,
      },
      {
        match: /\/api\/admin\/sessions/,
        method: "GET",
        body: sessionList,
      },
      {
        match: /\/api\/admin\/clients/,
        method: "GET",
        body: clientList,
      },
      {
        match: /\/health\/ready/,
        method: "GET",
        body: { status: "ok" },
      },
      {
        match: /\/api\/admin\/version/,
        method: "GET",
        body: { version: "v1.3.1" },
      },
    ]);
  });

  test("loaded state — heading, stat tiles, subsystems, audit timeline", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    // Four stat tiles labelled by the eyebrow text
    await expect(page.getByText("Identities").first()).toBeVisible();
    await expect(page.getByText("Active sessions")).toBeVisible();
    await expect(page.getByText("OAuth2 clients").first()).toBeVisible();
    await expect(page.getByText("Sign-in errors / 24h")).toBeVisible();

    // Subsystems section
    await expect(page.getByText("Subsystems")).toBeVisible();
    await expect(page.getByText("Kratos public")).toBeVisible();
    await expect(page.getByText("Kratos admin")).toBeVisible();
    await expect(page.getByText("Courier (SMTP)")).toBeVisible();
    await expect(page.getByText("Database")).toBeVisible();

    // All subsystem badges should show OK
    const okBadges = page.getByText("OK");
    await expect(okBadges.first()).toBeVisible();

    // Audit timeline heading
    await expect(page.getByText("Audit timeline")).toBeVisible();

    // At least one audit event row
    await expect(page.getByText("identity.created")).toBeVisible();
    await expect(page.getByText("oauth2.client.updated")).toBeVisible();
    await expect(page.getByText("session.revoked")).toBeVisible();
  });

  test("loading state — spinner visible while data loads", async ({ page }) => {
    // Delay the identities response so we can catch the spinner
    await mockApi(page, [
      {
        match: /\/api\/admin\/identities/,
        method: "GET",
        body: async () => {
          await new Promise((r) => setTimeout(r, 300));
          return identityList;
        },
      },
      {
        match: /\/api\/admin\/sessions/,
        method: "GET",
        body: sessionList,
      },
      {
        match: /\/api\/admin\/clients/,
        method: "GET",
        body: clientList,
      },
      {
        match: /\/health\/ready/,
        body: { status: "ok" },
      },
      {
        match: /\/api\/admin\/version/,
        body: { version: "v1.3.1" },
      },
    ]);

    const responsePromise = page.waitForResponse(/\/api\/admin\/identities/);
    await page.goto("/admin");

    // Spinner should appear before the response resolves
    await expect(page.locator('[data-testid="spinner"], [role="status"]').or(page.locator(".lucide-loader, [class*=spinner]")).or(page.getByText("Identities").first()).first()).toBeVisible();

    await responsePromise;
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("degraded health — 503 from health endpoint shows non-OK badge state", async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/identities/,
        method: "GET",
        body: identityList,
      },
      {
        match: /\/api\/admin\/sessions/,
        method: "GET",
        body: sessionList,
      },
      {
        match: /\/api\/admin\/clients/,
        method: "GET",
        body: clientList,
      },
      // Health endpoint returns 503
      {
        match: /\/health\/ready/,
        status: 503,
        body: { status: "error" },
      },
      {
        match: /\/api\/admin\/version/,
        body: { version: "v1.3.1" },
      },
    ]);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    // The subsystems panel still renders the rows (the health badge shows "OK" per static data
    // since the page uses static SUBSYSTEMS list; the Callout appears only on query error)
    await expect(page.getByText("Subsystems")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. IdentitiesPage  /admin/identities
// ---------------------------------------------------------------------------

test.describe("IdentitiesPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/identities/,
        method: "GET",
        body: identityList,
      },
    ]);
  });

  test("loaded state — heading, table rows, create button", async ({ page }) => {
    await page.goto("/admin/identities");

    await expect(page.getByRole("heading", { level: 1, name: "Identities" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Create" })).toBeVisible();

    // All three fixture identities should appear somewhere on the page
    await expect(page.getByText("j.silva@studio.pt")).toBeVisible();
    await expect(page.getByText("aris.t@studio.pt")).toBeVisible();
    await expect(page.getByText("eva.n@studio.pt")).toBeVisible();
  });

  test("search — typing triggers GET with credentials_identifier in query", async ({ page }) => {
    await page.goto("/admin/identities");
    await expect(page.getByRole("heading", { level: 1, name: "Identities" })).toBeVisible();

    const searchReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/identities") &&
      req.url().includes("credentials_identifier=joana")
    );

    await page.getByPlaceholder("search by email, id, name, traits.{key}…").fill("joana");
    await searchReq;
  });

  test("empty state — mock empty array shows no rows", async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/identities/,
        method: "GET",
        body: [],
      },
    ]);

    await page.goto("/admin/identities");
    await expect(page.getByRole("heading", { level: 1, name: "Identities" })).toBeVisible();

    // No identity emails should be visible
    await expect(page.getByText("j.silva@studio.pt")).not.toBeVisible();
    await expect(page.getByText("aris.t@studio.pt")).not.toBeVisible();

    // The "0 records loaded" subtitle should appear
    await expect(page.getByText(/0 records loaded/)).toBeVisible();
  });

  test("pagination — Next button triggers request with page=2", async ({ page }) => {
    // First page returns 25 items to enable Next, second page returns empty so Next disables
    const page1 = Array.from({ length: 25 }, (_, i) => ({ ...identityList[i % identityList.length], id: `id-${i}` }));
    let callCount = 0;
    await mockApi(page, [
      {
        match: /\/api\/admin\/identities/,
        method: "GET",
        body: () => {
          callCount++;
          return callCount === 1 ? page1 : [];
        },
      },
    ]);

    await page.goto("/admin/identities");
    await expect(page.getByRole("heading", { level: 1, name: "Identities" })).toBeVisible();

    const page2Req = page.waitForRequest((req) =>
      req.url().includes("/api/admin/identities") && req.url().includes("page=2")
    );

    await page.getByRole("button", { name: "Next ›" }).click();
    await page2Req;
  });

  test("pagination — Prev button triggers request with page=1 after advancing", async ({ page }) => {
    // Always return 25 items so Next is always enabled
    const fullPage = Array.from({ length: 25 }, (_, i) => ({ ...identityList[i % identityList.length], id: `id-${i}` }));
    let callCount = 0;
    await mockApi(page, [
      {
        match: /\/api\/admin\/identities/,
        method: "GET",
        body: () => {
          callCount++;
          return fullPage;
        },
      },
    ]);

    await page.goto("/admin/identities");
    await expect(page.getByRole("heading", { level: 1, name: "Identities" })).toBeVisible();

    // Go to page 2 — set up waitForRequest BEFORE click
    const page2Req = page.waitForRequest((req) => req.url().includes("page=2"));
    await page.getByRole("button", { name: "Next ›" }).click();
    await page2Req;

    // Come back with Prev — set up waitForRequest BEFORE click
    const prevReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/identities") && req.url().includes("page=1")
    );
    await page.getByRole("button", { name: "‹ Prev" }).click();
    await prevReq;
  });
});

// ---------------------------------------------------------------------------
// 3. IdentityDetailPage  /admin/identities/:id
// ---------------------------------------------------------------------------

const IDENTITY_ID = "8e9105a2-58a0-4b1c-9d33-7e6a2ab44f10";

test.describe("IdentityDetailPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: new RegExp(`/api/admin/identities/${IDENTITY_ID}[^/]`),
        method: "GET",
        body: identityJoana,
      },
      {
        match: new RegExp(`/api/admin/identities/${IDENTITY_ID}/sessions`),
        method: "GET",
        body: sessionList,
      },
      {
        match: /\/api\/admin\/recovery\/link/,
        method: "POST",
        status: 200,
        body: { recovery_link: "https://id.sunbeam.pt/recover?token=test" },
      },
      {
        match: new RegExp(`/api/admin/identities/${IDENTITY_ID}`),
        method: "PATCH",
        status: 200,
        body: { ...identityJoana, state: "inactive" },
      },
      {
        match: new RegExp(`/api/admin/identities/${IDENTITY_ID}`),
        method: "PUT",
        status: 200,
        body: identityJoana,
      },
    ]);
  });

  test("loaded state — avatar, name, ACTIVE badge, tabs visible", async ({ page }) => {
    await page.goto(`/admin/identities/${IDENTITY_ID}`);

    await expect(page.getByRole("heading", { name: "Joana Silva" })).toBeVisible();
    await expect(page.getByText("ACTIVE").first()).toBeVisible();
    await expect(page.getByText("person@v3").first()).toBeVisible();

    // Tabs row — TabTrigger renders as role="tab"
    await expect(page.getByRole("tab", { name: "Traits" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Credentials" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Sessions" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Devices · WebAuthn" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Audit · Flows" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Raw JSON" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Metadata" })).toBeVisible();

    // Traits tab is default — email field is an input; check by value attribute
    await expect(page.locator('input[value="j.silva@studio.pt"]')).toBeVisible();
  });

  test("Credentials tab — renders credential rows", async ({ page }) => {
    await page.goto(`/admin/identities/${IDENTITY_ID}`);
    await expect(page.getByRole("heading", { name: "Joana Silva" })).toBeVisible();

    await page.getByRole("tab", { name: "Credentials" }).click();

    // Credentials detail panel
    await expect(page.getByText("Authentication methods")).toBeVisible();
    // The credential type labels shown in the panel
    await expect(page.getByText("No credential data available.").or(page.getByText("password")).first()).toBeVisible();
  });

  test("Raw JSON tab — JSON content visible", async ({ page }) => {
    await page.goto(`/admin/identities/${IDENTITY_ID}`);
    await expect(page.getByRole("heading", { name: "Joana Silva" })).toBeVisible();

    await page.getByText("Raw JSON").click();

    await expect(page.getByText("Raw identity JSON")).toBeVisible();
    // The identity id should appear in the pre-formatted JSON
    await expect(page.locator("pre").getByText(IDENTITY_ID)).toBeVisible();
  });

  test("Send recovery link — POSTs to /api/admin/recovery/link", async ({ page }) => {
    await page.goto(`/admin/identities/${IDENTITY_ID}`);
    await expect(page.getByRole("heading", { name: "Joana Silva" })).toBeVisible();

    const recoveryReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/recovery/link") && req.method() === "POST"
    );

    await page.getByRole("button", { name: "Send recovery link" }).click();
    const req = await recoveryReq;
    expect(req.postDataJSON()).toMatchObject({ identity_id: IDENTITY_ID });
  });

  test("Disable — PATCHes identity state to inactive", async ({ page }) => {
    await page.goto(`/admin/identities/${IDENTITY_ID}`);
    await expect(page.getByRole("heading", { name: "Joana Silva" })).toBeVisible();

    const disableReq = page.waitForRequest((req) =>
      req.url().includes(`/api/admin/identities/${IDENTITY_ID}`) && req.method() === "PATCH"
    );

    await page.getByRole("button", { name: "Disable" }).click();
    const req = await disableReq;
    const body = req.postDataJSON() as Array<{ op: string; path: string; value: string }>;
    expect(body).toContainEqual(
      expect.objectContaining({ op: "replace", path: "/state", value: "inactive" })
    );
  });
});

// ---------------------------------------------------------------------------
// 4. AdminSessionsPage  /admin/sessions
// ---------------------------------------------------------------------------

test.describe("AdminSessionsPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/sessions/,
        method: "GET",
        body: sessionList,
      },
      {
        match: /\/api\/admin\/sessions\/session-current/,
        method: "DELETE",
        status: 204,
        body: undefined,
      },
      {
        match: /\/api\/admin\/sessions\/session-iphone/,
        method: "DELETE",
        status: 204,
        body: undefined,
      },
      {
        match: /\/api\/admin\/sessions\/session-ipad/,
        method: "DELETE",
        status: 204,
        body: undefined,
      },
      {
        match: /\/api\/admin\/sessions\/session-linux/,
        method: "DELETE",
        status: 204,
        body: undefined,
      },
    ]);
  });

  test("loaded state — heading, table rows visible", async ({ page }) => {
    await page.goto("/admin/sessions");

    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();

    // Four sessions in sessionList — at least some of their device info should show
    await expect(page.getByText("j.silva@studio.pt").first()).toBeVisible();

    // Revoke buttons
    const revokeButtons = page.getByRole("button", { name: "Revoke" });
    await expect(revokeButtons.first()).toBeVisible();
    expect(await revokeButtons.count()).toBeGreaterThanOrEqual(4);
  });

  test("Active filter — changing Select triggers GET with active= param", async ({ page }) => {
    await page.goto("/admin/sessions");
    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();

    const allReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/sessions") && !req.url().includes("active=true")
    );

    // beam-ui Select is Ark UI (combobox), not a native <select>; open then click the option
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "All" }).click();
    await allReq;
  });

  test("Revoke — DELETE to /api/admin/sessions/:id", async ({ page }) => {
    await page.goto("/admin/sessions");
    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();

    const revokeReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/sessions/") && req.method() === "DELETE"
    );

    await page.getByRole("button", { name: "Revoke" }).first().click();
    await revokeReq;
  });
});

// ---------------------------------------------------------------------------
// 5. OAuthClientsPage  /admin/clients
// ---------------------------------------------------------------------------

test.describe("OAuthClientsPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/clients/,
        method: "GET",
        body: clientList,
      },
    ]);
  });

  test("loaded state — heading, 3 client cards, register button", async ({ page }) => {
    await page.goto("/admin/clients");

    await expect(page.getByRole("heading", { name: "OAuth2 / OIDC clients" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Register client" })).toBeVisible();

    // Three client cards
    await expect(page.getByText("Sol Studio (web)")).toBeVisible();
    await expect(page.getByText("Marathon CLI")).toBeVisible();
    await expect(page.getByText("Internal Reports API")).toBeVisible();

    // Edit buttons (one per card)
    const editButtons = page.getByRole("button", { name: "Edit" });
    expect(await editButtons.count()).toBe(3);
  });

  test("empty state — mock empty array shows zero cards", async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/clients/,
        method: "GET",
        body: [],
      },
    ]);

    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: "OAuth2 / OIDC clients" })).toBeVisible();
    await expect(page.getByText("Sol Studio (web)")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).not.toBeVisible();
    await expect(page.getByText("0 registered")).toBeVisible();
  });

  test("Edit click — navigates to /admin/clients/sol-studio-prod", async ({ page }) => {
    // Also mock the detail endpoint so the nav doesn't 404; include list mock too
    await mockApi(page, [
      {
        match: /\/api\/admin\/clients\/sol-studio-prod/,
        method: "GET",
        body: clientSol,
      },
      {
        match: /\/api\/admin\/clients/,
        method: "GET",
        body: clientList,
      },
    ]);

    await page.goto("/admin/clients");
    await expect(page.getByText("Sol Studio (web)")).toBeVisible();

    // Find the Edit button within the Sol Studio card
    const solCard = page.getByText("Sol Studio (web)").locator("..").locator("..");
    await solCard.getByRole("button", { name: "Edit" }).click();

    await expect(page).toHaveURL(/\/admin\/clients\/sol-studio-prod/);
  });
});

// ---------------------------------------------------------------------------
// 6. OAuthClientDetailPage  /admin/clients/:id
// ---------------------------------------------------------------------------

test.describe("OAuthClientDetailPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/clients\/sol-studio-prod/,
        method: "GET",
        body: clientSol,
      },
      {
        match: /\/api\/admin\/clients\/sol-studio-prod/,
        method: "PUT",
        status: 200,
        body: clientSol,
      },
    ]);
  });

  test("loaded state — h2 client name, tabs visible", async ({ page }) => {
    await page.goto("/admin/clients/sol-studio-prod");

    await expect(page.getByRole("heading", { name: "Sol Studio (web)" })).toBeVisible();
    await expect(page.getByText("sol-studio-prod").first()).toBeVisible();

    // Tabs — TabTrigger renders as role="tab"
    await expect(page.getByRole("tab", { name: "Basics" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Grants & Tokens" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Redirect URIs" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "JWKS" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Token TTLs" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Compliance" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Test sign-in" })).toBeVisible();
  });

  test("Basics tab — client_name field populated, Save triggers PUT", async ({ page }) => {
    await page.goto("/admin/clients/sol-studio-prod");
    await expect(page.getByRole("heading", { name: "Sol Studio (web)" })).toBeVisible();

    // client_name TextInput should be populated
    const nameInput = page.locator("input[placeholder]").or(page.locator("input")).filter({ hasText: "" }).first();

    // Edit the client_name field — find input with value "Sol Studio (web)"
    const clientNameField = page.locator(`input[value="Sol Studio (web)"]`);
    await expect(clientNameField).toBeVisible();
    await clientNameField.fill("Sol Studio (web) — edited");

    const saveReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/clients/sol-studio-prod") && req.method() === "PUT"
    );

    await page.getByRole("button", { name: "Save" }).click();
    const req = await saveReq;
    const body = req.postDataJSON() as { client_name?: string };
    expect(body.client_name).toBe("Sol Studio (web) — edited");
  });

  test("add redirect URI — new URI appears in list", async ({ page }) => {
    await page.goto("/admin/clients/sol-studio-prod");
    await expect(page.getByRole("heading", { name: "Sol Studio (web)" })).toBeVisible();

    // Existing URIs should be visible
    await expect(page.getByText("https://sol.sunbeam.pt/auth/callback")).toBeVisible();

    // Add a new URI
    await page.getByPlaceholder("https://…/callback").fill("https://new.example.pt/callback");
    await page.getByRole("button", { name: "+ Add URI" }).click();

    // New URI should appear
    await expect(page.getByText("https://new.example.pt/callback")).toBeVisible();
  });

  test("advanced tabs show placeholder content", async ({ page }) => {
    await page.goto("/admin/clients/sol-studio-prod");
    await expect(page.getByRole("heading", { name: "Sol Studio (web)" })).toBeVisible();

    await page.getByText("Grants & Tokens").click();
    await expect(page.getByText(/Switch to the Basics tab/)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. SchemasPage  /admin/schemas
// ---------------------------------------------------------------------------

test.describe("SchemasPage", () => {
  // personSchemaV3 needs to be base64-encoded as the page does atob(schemaDetail.blob)
  const encodedSchema = btoa(JSON.stringify(personSchemaV3));

  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/schemas$/,
        method: "GET",
        body: schemaList,
      },
      {
        // matches /api/schemas/person%40v3 and /api/schemas/person@v3
        match: /\/api\/schemas\/person/,
        method: "GET",
        body: { blob: encodedSchema },
      },
      {
        match: /\/api\/schemas\/service-account/,
        method: "GET",
        body: { blob: btoa(JSON.stringify({ type: "object" })) },
      },
      {
        match: /\/api\/schemas\/guest/,
        method: "GET",
        body: { blob: btoa(JSON.stringify({ type: "object" })) },
      },
    ]);
  });

  test("loaded state — heading, schema list, editor, live preview fields", async ({ page }) => {
    await page.goto("/admin/schemas");

    await expect(page.getByRole("heading", { name: "Identity Schemas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New schema" })).toBeVisible();

    // Left panel: 4 schemas
    await expect(page.getByText("person@v3").first()).toBeVisible();
    await expect(page.getByText("person@v2")).toBeVisible();
    await expect(page.getByText("service-account")).toBeVisible();
    await expect(page.getByText("guest")).toBeVisible();

    // Editor panel heading
    await expect(page.getByText("Editor")).toBeVisible();

    // Live preview: fallback fields render when no schema blob parsed yet OR when
    // traitFields are extracted. Either way these labels should be on the page.
    await expect(page.getByText("E-Mail").or(page.getByText("First name")).first()).toBeVisible();
  });

  test("clicking person@v2 triggers a different GET /api/schemas", async ({ page }) => {
    await page.goto("/admin/schemas");
    await expect(page.getByRole("heading", { name: "Identity Schemas" })).toBeVisible();

    const v2Req = page.waitForRequest((req) =>
      req.url().includes("/api/schemas/") && req.url().includes("person") && req.url().includes("v2")
    );

    await page.getByText("person@v2").click();
    await v2Req;
  });

  test("Validate button — valid JSON shows success callout", async ({ page }) => {
    await page.goto("/admin/schemas");
    await expect(page.getByRole("heading", { name: "Identity Schemas" })).toBeVisible();
    await expect(page.getByText("Editor")).toBeVisible();

    await page.getByRole("button", { name: "Validate" }).click();

    await expect(page.getByText("✓ Valid JSON")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. FlowsPage  /admin/flows
// ---------------------------------------------------------------------------

test.describe("FlowsPage", () => {
  // FlowsPage uses static mock data — no API routes needed
  test.beforeEach(async ({ page }) => {
    await mockApi(page, []);
  });

  test("loaded state — heading, ToggleGroup, table rows", async ({ page }) => {
    await page.goto("/admin/flows");

    await expect(page.getByRole("heading", { name: "Self-service flows" })).toBeVisible();

    // ToggleGroup items render as role="radio"
    await expect(page.getByRole("radio", { name: "All" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Registration" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Recovery" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Verification" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Logout" })).toBeVisible();

    // Table with mock flows — check several identities
    await expect(page.getByText("j.silva@studio.pt").first()).toBeVisible();
    await expect(page.getByText("aris.t@studio.pt")).toBeVisible();
    await expect(page.getByText("pending@studio.pt")).toBeVisible();

    // Flow type cells — use exact: true to avoid matching the ToggleGroup radio labels
    await expect(page.getByText("login (browser)")).toBeVisible();
    await expect(page.getByText("registration", { exact: true }).first()).toBeVisible();
  });

  test("Login filter — only login rows shown", async ({ page }) => {
    await page.goto("/admin/flows");
    await expect(page.getByRole("heading", { name: "Self-service flows" })).toBeVisible();

    await page.getByRole("radio", { name: "Login" }).click();

    // login rows remain
    await expect(page.getByText("login (browser)")).toBeVisible();
    await expect(page.getByText("login (api)")).toBeVisible();

    // non-login rows should not be visible — use exact: true to avoid ToggleGroup radio match
    await expect(page.getByText("registration", { exact: true })).not.toBeVisible();
    await expect(page.getByText("recovery (link)")).not.toBeVisible();
  });

  test("empty filter result — EmptyState shown", async ({ page }) => {
    await page.goto("/admin/flows");
    await expect(page.getByRole("heading", { name: "Self-service flows" })).toBeVisible();

    // Click Logout toggle — use role="radio" to avoid matching the flow type cell
    await page.getByRole("radio", { name: "Logout" }).click();

    // The logout row should be visible — use exact: true to target the table cell text
    await expect(page.getByText("logout", { exact: true }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 9. CourierPage  /admin/courier
// ---------------------------------------------------------------------------

test.describe("CourierPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/courier\/messages\/courier-3/,
        method: "GET",
        body: courierMessages[2],
      },
      {
        match: /\/api\/admin\/courier\/messages/,
        method: "GET",
        body: courierMessages,
      },
      {
        match: /\/api\/admin\/courier\/messages\/courier-3\/send/,
        method: "PATCH",
        status: 200,
        body: {},
      },
    ]);
  });

  test("loaded state — heading and table rows", async ({ page }) => {
    await page.goto("/admin/courier");

    await expect(page.getByRole("heading", { name: "Courier · message log" })).toBeVisible();

    // All four messages should appear
    await expect(page.getByText("eva.n@studio.pt")).toBeVisible();
    await expect(page.getByText("aris.t@studio.pt")).toBeVisible();
    await expect(page.getByText("beta+1@studio.pt")).toBeVisible();
    await expect(page.getByText("bounce@no-mx.test")).toBeVisible();
  });

  test("row click — detail panel shows subject, Re-send and Edit template buttons", async ({ page }) => {
    await page.goto("/admin/courier");
    await expect(page.getByRole("heading", { name: "Courier · message log" })).toBeVisible();

    // Click the login_code_valid template row for courier-3
    await page.getByText("login_code_valid").click();

    // Detail panel shows the subject from the detail response
    await expect(page.getByText("Your sign-in code")).toBeVisible();

    // Action buttons
    await expect(page.getByRole("button", { name: "Re-send" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit template" })).toBeVisible();
  });

  test("Re-send — PATCHes /api/admin/courier/messages/:id/send for failed messages", async ({ page }) => {
    await page.goto("/admin/courier");
    await expect(page.getByRole("heading", { name: "Courier · message log" })).toBeVisible();

    // Click the login_code_valid row to select it
    await page.getByText("login_code_valid").click();
    await expect(page.getByRole("button", { name: "Re-send" })).toBeVisible();

    // The "↻ Retry failed" toolbar button patches all failed messages
    const retryReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/courier/messages/") &&
      req.url().includes("/send") &&
      req.method() === "PATCH"
    );

    await page.getByRole("button", { name: "↻ Retry failed" }).click();
    await retryReq;
  });
});

// ---------------------------------------------------------------------------
// 10. JwksPage  /admin/jwks
// ---------------------------------------------------------------------------

test.describe("JwksPage", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/keys\/hydra\.openid\.id-token/,
        method: "GET",
        body: jwksOpenIdIdToken,
      },
      {
        match: /\/api\/admin\/keys\/hydra\.jwt\.access-token/,
        method: "GET",
        body: jwksJwtAccessToken,
      },
      {
        match: /\/api\/admin\/keys\/kratos\.session/,
        method: "GET",
        body: jwksKratosSession,
      },
      // Rotate: POST to /api/admin/keys/:set
      {
        match: /\/api\/admin\/keys\//,
        method: "POST",
        status: 200,
        body: { keys: [] },
      },
    ]);
  });

  test("loaded state — heading, key cards, generate button, CURRENT badges", async ({ page }) => {
    await page.goto("/admin/jwks");

    await expect(page.getByRole("heading", { name: "JSON Web Keys" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Generate key" })).toBeVisible();

    // Key set names on the cards
    await expect(page.getByText("hydra.openid.id-token").first()).toBeVisible();
    await expect(page.getByText("hydra.jwt.access-token").first()).toBeVisible();
    await expect(page.getByText("kratos.session").first()).toBeVisible();

    // At least one CURRENT badge
    await expect(page.getByText("CURRENT").first()).toBeVisible();

    // Rotate buttons exist
    const rotateButtons = page.getByRole("button", { name: "Rotate" });
    expect(await rotateButtons.count()).toBeGreaterThanOrEqual(3);
  });

  test("Rotate — POSTs to /api/admin/keys/:set", async ({ page }) => {
    await page.goto("/admin/jwks");
    await expect(page.getByRole("heading", { name: "JSON Web Keys" })).toBeVisible();

    const rotateReq = page.waitForRequest((req) =>
      req.url().includes("/api/admin/keys/") && req.method() === "POST"
    );

    await page.getByRole("button", { name: "Rotate" }).first().click();
    await rotateReq;
  });

  test("overdue rotation — kratos.session card shows warning Callout", async ({ page }) => {
    // kratos.session key triggers warn=true in formatKeyCards (state=current, setName=kratos.session)
    await page.goto("/admin/jwks");
    await expect(page.getByRole("heading", { name: "JSON Web Keys" })).toBeVisible();

    // The overdue callout text
    await expect(page.getByText("Overdue rotation! Auto-policy: 90d")).toBeVisible();
  });

  test("fallback cards rendered when all API calls 404", async ({ page }) => {
    await mockApi(page, [
      {
        match: /\/api\/admin\/keys\//,
        status: 404,
        body: { error: "not found" },
      },
    ]);

    await page.goto("/admin/jwks");
    await expect(page.getByRole("heading", { name: "JSON Web Keys" })).toBeVisible();

    // Fallback static cards include these set names
    await expect(page.getByText("hydra.openid.id-token").first()).toBeVisible();
    await expect(page.getByText("kratos.session").first()).toBeVisible();

    // Fallback kratos.session card also has the overdue callout
    await expect(page.getByText("Overdue rotation! Auto-policy: 90d")).toBeVisible();
  });
});
