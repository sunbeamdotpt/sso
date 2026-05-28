import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Select, Badge, Avatar, Callout, Spinner, Tabs, Table } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

const sectionEyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "text.muted",
  marginBottom: "4px",
});

const sectionTitle = css({
  fontSize: "14px",
  fontWeight: 600,
  color: "text.primary",
  marginBottom: "12px",
});

type KratosIdentity = {
  id: string;
  state: string;
  schema_id: string;
  traits: { email?: string; name?: { first?: string; last?: string }; locale?: string; organization_id?: string };
  verifiable_addresses?: Array<{ value: string; verified: boolean }>;
  credentials?: Record<string, { type: string; updated_at?: string }>;
  created_at: string;
  updated_at: string;
};

type Session = {
  id: string;
  active: boolean;
  authenticated_at: string;
  expires_at: string;
  authentication_methods?: Array<{ method: string; aal: string }>;
  devices?: Array<{ user_agent?: string; ip_address?: string; location?: string }>;
};

type TraitsDraft = {
  email?: string;
  name?: { first?: string; last?: string };
  locale?: string;
  organization_id?: string;
};

const CREDENTIAL_ROWS = [
  { key: "password", label: "password", sub: "argon2id", aal: "AAL1" },
  { key: "passkey", label: "passkey", sub: "WebAuthn", aal: "AAL2" },
  { key: "totp", label: "totp", sub: "TOTP authenticator", aal: "AAL2" },
  { key: "lookup_secret", label: "lookup_secret", sub: "backup codes", aal: "AAL2" },
  { key: "oidc", label: "oidc", sub: "social providers", aal: "AAL1" },
  { key: "code", label: "code", sub: "email/SMS code", aal: "—" },
  { key: "saml", label: "saml", sub: "SAML SSO", aal: "AAL1" },
];

const SESSION_COLUMNS = [
  { key: "device", label: "Device · UA", width: "200px" },
  { key: "location", label: "Location · IP", width: "160px" },
  { key: "aal", label: "AAL", width: "80px" },
  { key: "issued", label: "Issued", width: "120px" },
  { key: "expires", label: "Expires", width: "120px" },
  { key: "action", label: "", width: "80px" },
];

const TABS = [
  { value: "traits", label: "Traits" },
  { value: "credentials", label: "Credentials" },
  { value: "sessions", label: "Sessions" },
  { value: "devices", label: "Devices · WebAuthn" },
  { value: "audit", label: "Audit · Flows" },
  { value: "raw", label: "Raw JSON" },
  { value: "metadata", label: "Metadata" },
];

const LOCALE_OPTIONS = [
  { value: "pt-PT", label: "pt-PT" },
  { value: "en-GB", label: "en-GB" },
  { value: "es-ES", label: "es-ES" },
  { value: "fr-FR", label: "fr-FR" },
];

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function IdentityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("traits");
  const [traits, setTraits] = useState<TraitsDraft | null>(null);

  const { data: identity, isLoading, error } = useQuery({
    queryKey: ["identity", id],
    queryFn: () =>
      api.get<KratosIdentity>(`/admin/identities/${id}?include_credential=password,oidc,totp,lookup_secret,webauthn,code,passkey`),
    enabled: !!id,
  });

  useEffect(() => {
    if (identity && !traits) {
      setTraits(identity.traits);
    }
  }, [identity]);

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["identity-sessions", id],
    queryFn: () => api.get<Session[]>(`/admin/identities/${id}/sessions`),
    enabled: !!id,
  });

  const recoverMutation = useMutation({
    mutationFn: () => api.post(`/admin/recovery/link`, { identity_id: id }),
  });

  const disableMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/identities/${id}`, [{ op: "replace", path: "/state", value: "inactive" }]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identity", id] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/admin/identities/${id}`, { traits }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identity", id] }),
  });

  if (!id) return <Callout variant="warning">No identity ID provided.</Callout>;

  if (isLoading) {
    return (
      <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={css({ padding: "28px" })}>
        <Callout variant="warning">{error instanceof Error ? error.message : "Failed to load identity"}</Callout>
      </div>
    );
  }

  const email = identity?.traits?.email ?? identity?.verifiable_addresses?.[0]?.value ?? "—";
  const firstName = identity?.traits?.name?.first ?? "";
  const lastName = identity?.traits?.name?.last ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "—";
  const initials = [firstName[0], lastName[0]].filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
  const isVerified = identity?.verifiable_addresses?.some((a) => a.verified) ?? false;

  const sessionRows = (sessions ?? []).map((s) => ({
    id: s.id,
    device: (
      <span className={css({ fontSize: "12px", fontWeight: 600, color: "text.primary" })}>
        {s.devices?.[0]?.user_agent ?? "Unknown device"}
      </span>
    ),
    location: (
      <span className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted" })}>
        {s.devices?.[0]?.ip_address ?? "—"}
      </span>
    ),
    aal: (
      <Badge variant="new">{s.authentication_methods?.[0]?.aal?.toUpperCase() ?? "AAL1"}</Badge>
    ),
    issued: <span className={css({ fontSize: "11px", color: "text.muted" })}>{formatDate(s.authenticated_at)}</span>,
    expires: <span className={css({ fontSize: "11px", color: "text.muted" })}>{formatDate(s.expires_at)}</span>,
    action: (
      <Button onClick={() => api.delete(`/admin/identities/${id}/sessions/${s.id}`)}>
        Revoke
      </Button>
    ),
  }));

  return (
    <div className={css({ padding: "28px" })}>
      {/* Identity header */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" })}>
        <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
          <Avatar name={initials} size="lg" />
          <div>
            <h2 className={css({ fontSize: "20px", fontWeight: 700, color: "text.primary", fontFamily: "heading", margin: 0 })}>
              {fullName}
            </h2>
            <div className={css({ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" })}>
              <span className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted" })}>{identity?.id}</span>
              <Badge variant="approved">ACTIVE</Badge>
              <Badge variant="new">{identity?.schema_id ?? "person@v3"}</Badge>
              {isVerified && <Badge variant="verified">verified</Badge>}
            </div>
          </div>
        </div>
        <div className={css({ display: "flex", gap: "6px" })}>
          <Button onClick={() => recoverMutation.mutate()}>Send recovery link</Button>
          <Button>Force AAL2</Button>
          <Button onClick={() => disableMutation.mutate()}>Disable</Button>
          <Button variant="primary" onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {(recoverMutation.error || disableMutation.error || saveMutation.error) && (
        <Callout variant="warning">
          {((recoverMutation.error ?? disableMutation.error ?? saveMutation.error) as Error)?.message ?? "Action failed"}
        </Callout>
      )}

      {/* Tabs */}
      <div className={css({ marginBottom: "16px" })}>
        <Tabs items={TABS} activeValue={activeTab} onChange={setActiveTab} />
      </div>

      {/* Traits tab */}
      {activeTab === "traits" && (
        <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" })}>
          {/* Profile panel */}
          <div className={panel}>
            <div className={sectionEyebrow}>Traits (schema: {identity?.schema_id ?? "person@v3"})</div>
            <div className={sectionTitle}>Profile</div>
            <div className={css({ display: "flex", flexDirection: "column", gap: "10px" })}>
              <div>
                <TextInput
                  label="email"
                  value={traits?.email ?? email}
                  onChange={(v) => setTraits((t) => ({ ...t, email: v }))}
                />
                <div className={css({ fontSize: "10px", color: "text.muted", marginTop: "2px" })}>
                  {isVerified ? "✓ verified · primary" : "unverified"}
                </div>
              </div>
              <TextInput
                label="name.first"
                value={traits?.name?.first ?? ""}
                onChange={(v) => setTraits((t) => ({ ...t, name: { ...t?.name, first: v } }))}
              />
              <TextInput
                label="name.last"
                value={traits?.name?.last ?? ""}
                onChange={(v) => setTraits((t) => ({ ...t, name: { ...t?.name, last: v } }))}
              />
              <Select
                options={LOCALE_OPTIONS}
                value={traits?.locale ?? ""}
                onChange={(v) => setTraits((t) => ({ ...t, locale: v }))}
                placeholder="Select locale"
              />
              <TextInput
                label="organization_id"
                value={traits?.organization_id ?? ""}
                onChange={(v) => setTraits((t) => ({ ...t, organization_id: v }))}
              />
            </div>
          </div>

          {/* Methods panel */}
          <div className={panel}>
            <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" })}>
              <div>
                <div className={sectionEyebrow}>Credentials</div>
                <div className={sectionTitle}>Methods</div>
              </div>
              <Button>+ Add</Button>
            </div>
            <div className={css({ display: "flex", flexDirection: "column" })}>
              {CREDENTIAL_ROWS.map((cr, i) => {
                const isSet = !!identity?.credentials?.[cr.key];
                return (
                  <div
                    key={cr.key}
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom: i < CREDENTIAL_ROWS.length - 1 ? "1px dashed" : "none",
                      borderColor: "border.subtle",
                    })}
                  >
                    <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                      <span className={css({ fontFamily: "mono", fontSize: "11px", color: "sunbeam.orange", width: "110px" })}>{cr.label}</span>
                      <span className={css({ fontSize: "11px", color: "text.muted" })}>{cr.sub}</span>
                    </div>
                    <div className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                      <Badge variant="new">{cr.aal}</Badge>
                      {isSet ? <Badge variant="approved">SET</Badge> : <span className={css({ fontSize: "10px", color: "text.muted" })}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sessions panel */}
          <div className={css({ gridColumn: "1 / -1" })}>
            <div className={panel}>
              <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" })}>
                <div>
                  <div className={sectionEyebrow}>Active sessions ({sessions?.length ?? 0})</div>
                  <div className={sectionTitle}>Where {firstName || "this user"} is signed in</div>
                </div>
                <Button onClick={() => api.delete(`/admin/identities/${id}/sessions`)}>
                  Revoke all
                </Button>
              </div>
              {loadingSessions ? (
                <Spinner size="md" />
              ) : (
                <Table columns={SESSION_COLUMNS} rows={sessionRows} rowKey="id" />
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "raw" && identity && (
        <div className={panel}>
          <div className={sectionEyebrow}>Raw identity JSON</div>
          <pre className={css({
            marginTop: "8px",
            fontSize: "11px",
            fontFamily: "mono",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "text.primary",
            bg: "bg.page",
            padding: "12px",
            border: "1px dashed",
            borderColor: "border.subtle",
            overflowX: "auto",
          })}>
            {JSON.stringify(identity, null, 2)}
          </pre>
        </div>
      )}

      {activeTab === "credentials" && (
        <div className={panel}>
          <div className={sectionEyebrow}>Credentials detail</div>
          <div className={sectionTitle}>Authentication methods</div>
          {identity?.credentials ? (
            <pre className={css({
              fontSize: "11px",
              fontFamily: "mono",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "text.primary",
              bg: "bg.page",
              padding: "12px",
              border: "1px dashed",
              borderColor: "border.subtle",
            })}>
              {JSON.stringify(identity.credentials, null, 2)}
            </pre>
          ) : (
            <span className={css({ fontSize: "12px", color: "text.muted" })}>No credential data available.</span>
          )}
        </div>
      )}

      {(activeTab === "sessions" || activeTab === "devices" || activeTab === "audit" || activeTab === "metadata") && (
        <div className={panel}>
          <div className={sectionEyebrow}>{activeTab}</div>
          <div className={css({ fontSize: "12px", color: "text.muted", marginTop: "8px" })}>
            Select the Traits tab to view and edit identity data. Advanced tab content coming soon.
          </div>
        </div>
      )}
    </div>
  );
}
