import type { Page, Route } from "@playwright/test";

type Json = unknown;

export type RouteSpec = {
  /** Match a request URL by substring (path or full URL). First match wins. */
  match: string | RegExp;
  /** HTTP method to match. Defaults to any. */
  method?: string;
  /** Status code to return. Defaults to 200. */
  status?: number;
  /** JSON body to return, OR a function that returns a body per request. */
  body?: Json | ((route: Route) => Json | Promise<Json>);
  /** Override default content-type header. */
  contentType?: string;
};

const STUB_REDIRECT_HTML = `<!doctype html>
<html><head><title>Redirected</title>
<style>
  body{margin:0;background:#fffaeb;font-family:'Ysabeau Infant',system-ui,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh;color:#1f1f1f;}
  .card{border:1.5px solid #2a2a2a;padding:32px 40px;background:#fff0c2;}
  h1{margin:0 0 8px;font-size:24px;font-weight:600;}
  p{margin:0;color:#4a4a4a;font-size:14px;}
</style></head>
<body><div class="card">
  <h1>Redirected (test stub)</h1>
  <p>Hydra/Kratos returned a redirect_to URL. In tests we render this page instead of the real RP.</p>
</div></body></html>`;

/**
 * Install route mocks against /api/* and /health. Returns 404 for any
 * unmocked /api/* path so missed mocks fail loudly.
 *
 * Also installs a global stub for navigations to non-localhost hosts:
 * Hydra accept/reject responses include a redirect_to URL pointing at the
 * relying party (e.g. https://sol.sunbeam.pt/...) — without intervention the
 * SPA navigates there, the request fails, and the trailing screenshot is
 * blank. Returning a tiny stub page keeps the visual record meaningful.
 */
export async function mockApi(page: Page, specs: RouteSpec[]): Promise<void> {
  // 1. API + health mocks (path-anchored — must NOT match e.g. /src/lib/api.ts).
  await page.route(/^https?:\/\/[^/]+\/(api\/|health\b)/, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    for (const spec of specs) {
      const methodOk = !spec.method || spec.method.toUpperCase() === method;
      if (!methodOk) continue;
      const matches =
        typeof spec.match === "string"
          ? url.includes(spec.match)
          : spec.match.test(url);
      if (!matches) continue;
      const body = typeof spec.body === "function" ? await spec.body(route) : spec.body;
      const status = spec.status ?? 200;
      const headers: Record<string, string> = {
        "content-type": spec.contentType ?? "application/json",
      };
      if (body === undefined || status === 204) {
        await route.fulfill({ status, headers });
        return;
      }
      const payload = typeof body === "string" ? body : JSON.stringify(body);
      await route.fulfill({ status, headers, body: payload });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: `unmocked ${method} ${url}` }),
    });
  });

  // 2. External navigation stub — only intercept top-level document navigations
  //    away from localhost (Hydra redirect_to URLs land here).
  await page.route(
    (url) => {
      const isLocal =
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1";
      return !isLocal;
    },
    async (route) => {
      const req = route.request();
      // Don't stub script/asset fetches — only document navigations.
      if (req.resourceType() !== "document") {
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/html" },
        body: STUB_REDIRECT_HTML,
      });
    },
  );
}

/** Aliases the most common Kratos shape: a flow lookup by id. */
export function flowRoute(type: string, body: Json): RouteSpec {
  return { match: `/api/flow/${type}`, body };
}

/** Standard 204-no-content for DELETE actions. */
export const noContent: RouteSpec["body"] = undefined;
