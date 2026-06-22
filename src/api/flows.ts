import type { LoginFlow, SettingsFlow, UIFlow } from "./types.ts";
import { getFlowError, findNodeByName } from "./types.ts";

export interface FlowSubmitResult {
  success: boolean;
  session?: { identity: { id: string; traits: Record<string, unknown> }; authenticator_assurance_level?: string };
  flow?: LoginFlow | SettingsFlow;
  error?: string;
  redirect_browser_to?: string;
}

function getActionPath(action: string): string {
  try {
    const url = new URL(action);
    return url.pathname + url.search;
  } catch {
    return action;
  }
}

/**
 * Submit a Kratos self-service flow.
 * @param flow The current flow (login or settings)
 * @param body The form body to submit
 * @param method The Kratos method name (e.g., "password", "totp", "lookup_secret")
 */
export async function submitFlow(
  flow: { ui: UIFlow },
  body: Record<string, unknown>,
  method: string,
): Promise<FlowSubmitResult> {
  const path = getActionPath(flow.ui.action);

  // Include CSRF token if present
  const csrfNode = findNodeByName(flow.ui, "csrf_token");
  const csrfToken = csrfNode?.attributes.value ?? "";

  const res = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, csrf_token: csrfToken, method }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (data?.ui) {
      return { success: false, flow: data as LoginFlow | SettingsFlow, error: getFlowError(data.ui) };
    }
    if (data?.redirect_browser_to) {
      return { success: false, redirect_browser_to: data.redirect_browser_to };
    }
    const isExpired = data?.error?.id === "self_service_flow_expired" || data?.error?.code === 410;
    if (isExpired) {
      return { success: false, error: "This session expired. Please try again." };
    }
    if (data?.error?.message) {
      return { success: false, error: data.error.message };
    }
    return { success: false, error: `HTTP ${res.status}` };
  }

  // Kratos returns session on successful login, or updated flow on settings changes
  if (data.session?.identity) {
    return {
      success: true,
      session: {
        identity: data.session.identity,
        authenticator_assurance_level: data.session.authenticator_assurance_level,
      },
    };
  }

  // For settings flows, Kratos returns the updated flow
  if (data.ui) {
    return { success: true, flow: data as LoginFlow | SettingsFlow };
  }

  return { success: false, error: "Unexpected response from flow." };
}

/**
 * Check if a login flow requires a second factor.
 */
export function needsMfa(flow: LoginFlow | undefined): boolean {
  return flow?.requested_aal === "aal2" && !flow.state;
}

/**
 * Get available MFA methods from a login flow's UI nodes.
 */
export function getAvailableMfaMethods(flow: LoginFlow | undefined): string[] {
  if (!flow?.ui?.nodes) return [];
  const methods = new Set<string>();
  for (const node of flow.ui.nodes) {
    if (node.group === "totp") methods.add("totp");
    if (node.group === "lookup_secret") methods.add("lookup_secret");
    if (node.group === "webauthn") methods.add("webauthn");
  }
  return Array.from(methods);
}
