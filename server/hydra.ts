import type { Context } from "hono";

const HYDRA_ADMIN_URL =
  Deno.env.get("HYDRA_ADMIN_URL") ??
  "http://hydra-admin.ory.svc.cluster.local:4445";

const KRATOS_ADMIN_URL =
  Deno.env.get("KRATOS_ADMIN_URL") ??
  "http://kratos-admin.ory.svc.cluster.local:80";

const TRUSTED_CLIENT_IDS = new Set(
  (Deno.env.get("TRUSTED_CLIENT_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

async function hydraFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const resp = await fetch(`${HYDRA_ADMIN_URL}${path}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...init,
  });
  return resp;
}

/**
 * Fetch a Kratos identity and map its traits to standard OIDC claims,
 * filtered by the granted scopes.
 */
async function getIdentityClaims(
  subject: string,
  grantedScopes: string[],
): Promise<Record<string, unknown>> {
  const scopes = new Set(grantedScopes);
  const claims: Record<string, unknown> = {};

  let traits: Record<string, unknown>;
  let verifiableAddresses: Array<{ value: string; verified: boolean }>;
  try {
    const resp = await fetch(
      `${KRATOS_ADMIN_URL}/admin/identities/${subject}`,
      { headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return claims;
    const identity = await resp.json();
    traits = (identity.traits as Record<string, unknown>) ?? {};
    verifiableAddresses = identity.verifiable_addresses ?? [];
  } catch {
    return claims;
  }

  if (scopes.has("email") && traits.email) {
    claims.email = traits.email;
    const addr = verifiableAddresses.find((a) => a.value === traits.email);
    claims.email_verified = addr?.verified ?? false;
  }

  if (scopes.has("profile")) {
    if (traits.given_name) claims.given_name = traits.given_name;
    if (traits.family_name) claims.family_name = traits.family_name;
    if (traits.middle_name) claims.middle_name = traits.middle_name;
    if (traits.nickname) claims.nickname = traits.nickname;
    if (traits.picture) claims.picture = traits.picture;
    if (traits.phone_number) claims.phone_number = traits.phone_number;

    // Synthesize "name" from given + family name
    const parts = [traits.given_name, traits.family_name].filter(Boolean);
    if (parts.length > 0) claims.name = parts.join(" ");

    // Non-standard but useful: map to first_name/last_name aliases
    // that some La Suite apps read via OIDC_USERINFO_FULLNAME_FIELDS
    if (traits.given_name) claims.first_name = traits.given_name;
    if (traits.family_name) claims.last_name = traits.family_name;
  }

  return claims;
}

/** GET /api/hydra/consent?challenge=<ch> */
export async function getConsent(c: Context): Promise<Response> {
  const challenge = c.req.query("challenge");
  if (!challenge) return c.json({ error: "Missing challenge" }, 400);

  try {
    const resp = await hydraFetch(
      `/admin/oauth2/auth/requests/consent?consent_challenge=${challenge}`,
    );
    const data = await resp.json();

    // Auto-accept all consent requests — all our clients are internal/trusted.
    // Hydra's skip_consent should prevent reaching here, but belt-and-suspenders.
    {
      const idTokenClaims = await getIdentityClaims(
        data.subject,
        data.requested_scope,
      );
      const acceptResp = await hydraFetch(
        `/admin/oauth2/auth/requests/consent/accept?consent_challenge=${challenge}`,
        {
          method: "PUT",
          body: JSON.stringify({
            grant_scope: data.requested_scope,
            grant_access_token_audience:
              data.requested_access_token_audience,
            remember: true,
            remember_for: 2592000,
            session: { id_token: idTokenClaims },
          }),
        },
      );
      const acceptData = await acceptResp.json();
      return c.json({ redirect_to: acceptData.redirect_to, auto: true });
    }

    return c.json(data);
  } catch {
    return c.text("Hydra unavailable", 502);
  }
}

/** POST /api/hydra/consent/accept */
export async function acceptConsent(c: Context): Promise<Response> {
  const body = await c.req.json();
  const { challenge, grantScope, remember } = body;
  if (!challenge) return c.json({ error: "Missing challenge" }, 400);

  try {
    // Fetch the consent request to get the subject (identity ID)
    const consentResp = await hydraFetch(
      `/admin/oauth2/auth/requests/consent?consent_challenge=${challenge}`,
    );
    const consentData = await consentResp.json();

    const idTokenClaims = await getIdentityClaims(
      consentData.subject,
      grantScope ?? consentData.requested_scope,
    );

    const resp = await hydraFetch(
      `/admin/oauth2/auth/requests/consent/accept?consent_challenge=${challenge}`,
      {
        method: "PUT",
        body: JSON.stringify({
          grant_scope: grantScope,
          remember: remember ?? false,
          remember_for: 0,
          session: { id_token: idTokenClaims },
        }),
      },
    );
    const data = await resp.json();
    return c.json(data);
  } catch {
    return c.text("Hydra unavailable", 502);
  }
}

/** POST /api/hydra/consent/reject */
export async function rejectConsent(c: Context): Promise<Response> {
  const body = await c.req.json();
  const { challenge } = body;
  if (!challenge) return c.json({ error: "Missing challenge" }, 400);

  try {
    const resp = await hydraFetch(
      `/admin/oauth2/auth/requests/consent/reject?consent_challenge=${challenge}`,
      {
        method: "PUT",
        body: JSON.stringify({
          error: "access_denied",
          error_description: "The resource owner denied the request",
        }),
      },
    );
    const data = await resp.json();
    return c.json(data);
  } catch {
    return c.text("Hydra unavailable", 502);
  }
}

/** GET /api/hydra/logout?challenge=<ch> */
export async function getLogout(c: Context): Promise<Response> {
  const challenge = c.req.query("challenge");
  if (!challenge) return c.json({ error: "Missing challenge" }, 400);

  try {
    const resp = await hydraFetch(
      `/admin/oauth2/auth/requests/logout?logout_challenge=${challenge}`,
    );
    const data = await resp.json();
    return c.json(data);
  } catch {
    return c.text("Hydra unavailable", 502);
  }
}

/** POST /api/hydra/logout/accept */
export async function acceptLogout(c: Context): Promise<Response> {
  const body = await c.req.json();
  const { challenge } = body;
  if (!challenge) return c.json({ error: "Missing challenge" }, 400);

  try {
    const resp = await hydraFetch(
      `/admin/oauth2/auth/requests/logout/accept?logout_challenge=${challenge}`,
      { method: "PUT" },
    );
    const data = await resp.json();
    return c.json(data);
  } catch {
    return c.text("Hydra unavailable", 502);
  }
}

/** POST /api/hydra/login/accept — accept Hydra login challenge after Kratos login succeeds. */
export async function acceptLogin(c: Context): Promise<Response> {
  const body = await c.req.json();
  const { challenge, subject } = body;
  if (!challenge || !subject) {
    return c.json({ error: "Missing challenge or subject" }, 400);
  }

  try {
    const resp = await hydraFetch(
      `/admin/oauth2/auth/requests/login/accept?login_challenge=${challenge}`,
      {
        method: "PUT",
        body: JSON.stringify({
          subject,
          remember: true,
          remember_for: 0,
        }),
      },
    );
    const data = await resp.json();
    return c.json(data);
  } catch {
    return c.text("Hydra unavailable", 502);
  }
}
