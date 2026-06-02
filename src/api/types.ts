/**
 * Typed shapes derived from the Kratos OpenAPI spec (openapi.json).
 * These are partial extracts — expand as the UI grows.
 */

export interface Identity {
  id: string;
  schema_id: string;
  schema_url: string;
  state: State;
  state_changed_at?: string;
  traits: Record<string, unknown>;
  recovery_addresses?: RecoveryAddress[];
  verifiable_addresses?: VerifiableAddress[];
  metadata_public?: Record<string, unknown> | null;
  metadata_admin?: Record<string, unknown> | null;
  organization_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryAddress {
  id: string;
  value: string;
  via: string;
  created_at?: string;
  updated_at?: string;
}

export interface VerifiableAddress {
  id: string;
  value: string;
  verified: boolean;
  via: string;
  status: string;
  verified_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateIdentity {
  schema_id: string;
  traits: Record<string, unknown>;
}

export interface UpdateIdentity {
  schema_id?: string;
  traits?: Record<string, unknown>;
  state?: State;
  metadata_public?: Record<string, unknown> | null;
  metadata_admin?: Record<string, unknown> | null;
}

export type State = "active" | "inactive";

export interface Session {
  id: string;
  active: boolean;
  expires_at?: string;
  authenticated_at?: string;
  authenticator_assurance_level?: "aal1" | "aal2";
  authentication_methods?: { method: string; completed_at: string }[];
  identity: Identity;
}

export interface LoginFlow {
  id: string;
  type: string;
  expires_at?: string;
  issued_at?: string;
  request_url?: string;
  ui?: UIFlow;
  state?: string;
  requested_aal?: "aal1" | "aal2";
  refresh?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RegistrationFlow {
  id: string;
  type: string;
  expires_at?: string;
  issued_at?: string;
  request_url?: string;
  ui?: UIFlow;
}

export interface RecoveryFlow {
  id: string;
  type: string;
  expires_at?: string;
  issued_at?: string;
  request_url?: string;
  ui?: UIFlow;
  state?: string;
}

export interface SettingsFlow {
  id: string;
  type: string;
  expires_at?: string;
  issued_at?: string;
  request_url?: string;
  ui?: UIFlow;
  identity?: Identity;
  return_to?: string;
}

export interface VerificationFlow {
  id: string;
  type: string;
  expires_at?: string;
  issued_at?: string;
  request_url?: string;
  ui?: UIFlow;
  state?: string;
}

export interface UIFlow {
  action: string;
  method: string;
  nodes: UINode[];
  messages?: UIText[];
}

export interface UINode {
  type: string;
  group: string;
  attributes: UINodeAttributes;
  messages?: UIText[];
  meta?: { label?: UIText };
}

export interface UINodeAttributes {
  name: string;
  type?: string;
  value?: unknown;
  disabled?: boolean;
  node_type?: string;
}

export interface UIText {
  id: number;
  text: string;
  type: string;
  context?: Record<string, unknown>;
}

export interface GenericError {
  error: GenericErrorPayload;
}

export interface GenericErrorPayload {
  id?: string;
  code?: number;
  status?: string;
  reason?: string;
  message?: string;
  debug?: string;
  details?: Record<string, unknown>;
}

export interface HealthStatus {
  status: string;
}

export interface HealthNotReadyStatus {
  status: string;
  errors?: Record<string, string>;
}

export interface Version {
  version: string;
}

export interface IdentitySchema {
  id: string;
  schema: Record<string, unknown>;
}

export function findNodeByName(flow: UIFlow | undefined, name: string): UINode | undefined {
  return flow?.nodes.find((n) => n.attributes.name === name);
}

export function findNodesByGroup(flow: UIFlow | undefined, group: string): UINode[] {
  return flow?.nodes.filter((n) => n.group === group) ?? [];
}

export function getNodeValue(flow: UIFlow | undefined, name: string): unknown {
  return findNodeByName(flow, name)?.attributes.value;
}

export function getFlowError(flow: UIFlow | undefined): string | undefined {
  if (!flow) return undefined;
  const flowMsg = flow.messages?.find((m) => m.type === "error");
  if (flowMsg) return flowMsg.text;
  for (const node of flow.nodes ?? []) {
    const nodeMsg = node.messages?.find((m) => m.type === "error");
    if (nodeMsg) return nodeMsg.text;
  }
  return undefined;
}
