/**
 * Mock Kratos self-service flow fixtures shaped like the real /flow/{type} responses
 * proxied via the Hono backend. Every flow has an id, action url, method, and a UI
 * with nodes the page renders.
 */

export type Flow = {
  id: string;
  type: "browser" | "api";
  expires_at: string;
  issued_at: string;
  request_url: string;
  return_to?: string;
  ui: {
    action: string;
    method: string;
    nodes: FlowNode[];
    messages?: FlowMessage[];
  };
};

export type FlowNode = {
  type: "input" | "text" | "img" | "script" | "a";
  group: string;
  attributes: Record<string, unknown>;
  messages: FlowMessage[];
  meta: { label?: { id: number; text: string; type: string } };
};

export type FlowMessage = { id: number; text: string; type: string; context?: unknown };

const futureIso = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();
const pastIso = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

export const loginFlow: Flow = {
  id: "login-flow-test-id",
  type: "browser",
  expires_at: futureIso(60),
  issued_at: pastIso(1),
  request_url: "http://localhost:5175/auth/login",
  ui: {
    action: "/api/flow/login",
    method: "POST",
    nodes: [
      {
        type: "input",
        group: "default",
        attributes: { name: "csrf_token", type: "hidden", value: "csrf-token-mock", required: true },
        messages: [],
        meta: {},
      },
      {
        type: "input",
        group: "password",
        attributes: { name: "identifier", type: "email", required: true },
        messages: [],
        meta: { label: { id: 1, text: "Email", type: "info" } },
      },
      {
        type: "input",
        group: "password",
        attributes: { name: "method", type: "submit", value: "password" },
        messages: [],
        meta: { label: { id: 2, text: "Continue", type: "info" } },
      },
    ],
  },
};

export const loginFlowWithError: Flow = {
  ...loginFlow,
  id: "login-flow-error",
  ui: {
    ...loginFlow.ui,
    messages: [{ id: 4000006, text: "The provided credentials are invalid.", type: "error" }],
  },
};

export const registrationFlow: Flow = {
  id: "registration-flow-test-id",
  type: "browser",
  expires_at: futureIso(60),
  issued_at: pastIso(1),
  request_url: "http://localhost:5175/auth/register",
  ui: {
    action: "/api/flow/registration",
    method: "POST",
    nodes: [
      {
        type: "input",
        group: "default",
        attributes: { name: "csrf_token", type: "hidden", value: "csrf-token-mock" },
        messages: [],
        meta: {},
      },
      {
        type: "input",
        group: "password",
        attributes: { name: "traits.email", type: "email", required: true },
        messages: [],
        meta: { label: { id: 1, text: "Email", type: "info" } },
      },
      {
        type: "input",
        group: "password",
        attributes: { name: "traits.name.first", type: "text" },
        messages: [],
        meta: { label: { id: 2, text: "Display name", type: "info" } },
      },
    ],
  },
};

export const recoveryFlow: Flow = {
  id: "recovery-flow-test-id",
  type: "browser",
  expires_at: futureIso(60),
  issued_at: pastIso(1),
  request_url: "http://localhost:5175/auth/recovery",
  ui: {
    action: "/api/flow/recovery",
    method: "POST",
    nodes: [
      {
        type: "input",
        group: "code",
        attributes: { name: "email", type: "email", required: true },
        messages: [],
        meta: { label: { id: 1, text: "Email", type: "info" } },
      },
    ],
  },
};

export const recoveryFlowSent: Flow = {
  ...recoveryFlow,
  id: "recovery-flow-sent",
  ui: {
    ...recoveryFlow.ui,
    messages: [{ id: 1060003, text: "An email containing a recovery code has been sent.", type: "info" }],
  },
};

export const verificationFlow: Flow = {
  id: "verification-flow-test-id",
  type: "browser",
  expires_at: futureIso(60),
  issued_at: pastIso(1),
  request_url: "http://localhost:5175/auth/verify",
  ui: {
    action: "/api/flow/verification",
    method: "POST",
    nodes: [],
    messages: [{ id: 1070001, text: "An email with a verification link has been sent.", type: "info" }],
  },
};

export const settingsFlow: Flow = {
  id: "settings-flow-test-id",
  type: "browser",
  expires_at: futureIso(60),
  issued_at: pastIso(1),
  request_url: "http://localhost:5175/account/profile",
  ui: {
    action: "/api/flow/settings",
    method: "POST",
    nodes: [
      {
        type: "input",
        group: "profile",
        attributes: { name: "traits.email", type: "email", value: "j.silva@studio.pt" },
        messages: [],
        meta: { label: { id: 1, text: "Email", type: "info" } },
      },
      {
        type: "input",
        group: "profile",
        attributes: { name: "traits.name.first", type: "text", value: "Joana" },
        messages: [],
        meta: { label: { id: 2, text: "Display name", type: "info" } },
      },
    ],
  },
};

export const flowExpired = {
  id: "expired-flow-id",
  error: { id: "flow_expired", message: "The flow has expired." },
  created_at: pastIso(120),
  updated_at: pastIso(120),
};

export const flowError500 = {
  id: "error-id-500",
  error: { id: "internal_server_error", code: 500, message: "Something went wrong." },
  created_at: pastIso(1),
  updated_at: pastIso(1),
};

export const flowError404 = {
  id: "error-id-404",
  error: { id: "not_found", code: 404, message: "Resource not found." },
  created_at: pastIso(1),
  updated_at: pastIso(1),
};
