/**
 * Hydra admin/public API helpers for E2E device-authorization tests.
 */

const HYDRA_ADMIN_BASE = "http://localhost:4445";
const HYDRA_PUBLIC_BASE = "http://localhost:4444";

export interface HydraClient {
  client_id: string;
  client_name?: string;
}

export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface DeviceTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${HYDRA_ADMIN_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Hydra admin ${
        init?.method ?? "GET"
      } ${path} failed: ${res.status} ${body}`,
    );
  }
  return res;
}

export async function createDeviceClient(
  clientId: string,
  scopes: string[],
): Promise<HydraClient> {
  const res = await adminFetch("/admin/clients", {
    method: "POST",
    body: JSON.stringify({
      client_id: clientId,
      client_name: `${clientId} (test)`,
      grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
      scope: scopes.join(" "),
      token_endpoint_auth_method: "none",
      skip_consent: true,
    }),
  });
  return res.json();
}

export async function deleteClient(clientId: string): Promise<void> {
  await adminFetch(`/admin/clients/${clientId}`, { method: "DELETE" });
}

export async function startDeviceAuth(
  clientId: string,
  scopes: string[],
): Promise<DeviceAuthorizationResponse> {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes.join(" "),
  });

  const res = await fetch(`${HYDRA_PUBLIC_BASE}/oauth2/device/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hydra device auth failed: ${res.status} ${body}`);
  }

  return res.json();
}

export async function pollDeviceToken(
  deviceCode: string,
  clientId: string,
  intervalSeconds: number,
  maxAttempts = 60,
): Promise<DeviceTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
    client_id: clientId,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalSeconds * 1000));

    const res = await fetch(`${HYDRA_PUBLIC_BASE}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    const data = (await res.json()) as DeviceTokenResponse;

    // Pending means the user hasn't approved yet; keep polling.
    if (data.error === "authorization_pending") {
      continue;
    }

    // Slow down means we should increase the polling interval.
    if (data.error === "slow_down") {
      intervalSeconds += 5;
      continue;
    }

    return data;
  }

  throw new Error("Device token polling timed out");
}
