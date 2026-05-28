import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Select, Badge, Checkbox, Callout, Spinner, Tabs } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

const monoSm = css({ fontFamily: "mono", fontSize: "11px" });

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

type OAuthClient = {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  policy_uri?: string;
  contacts?: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  scope?: string;
  audience?: string[];
  created_at?: string;
  updated_at?: string;
};

const AUTH_METHOD_OPTIONS = [
  { value: "none", label: "none (PKCE)" },
  { value: "client_secret_basic", label: "client_secret_basic" },
  { value: "client_secret_post", label: "client_secret_post" },
  { value: "private_key_jwt", label: "private_key_jwt" },
];

const ALL_GRANTS = [
  "authorization_code",
  "refresh_token",
  "client_credentials",
  "urn:ietf:params:oauth:grant-type:device_authorization",
  "urn:ietf:params:oauth:grant-type:jwt-bearer",
  "implicit",
];

const TABS = [
  { value: "basics", label: "Basics" },
  { value: "grants", label: "Grants & Tokens" },
  { value: "redirects", label: "Redirect URIs" },
  { value: "jwks", label: "JWKS" },
  { value: "ttls", label: "Token TTLs" },
  { value: "compliance", label: "Compliance" },
  { value: "test", label: "Test sign-in" },
];

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function OAuthClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basics");
  const [draft, setDraft] = useState<Partial<OAuthClient>>({});
  const [newUri, setNewUri] = useState("");

  const { data: client, isLoading, error } = useQuery({
    queryKey: ["oauth-client", id],
    queryFn: () => api.get<OAuthClient>(`/admin/clients/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (client && Object.keys(draft).length === 0) {
      setDraft(client);
    }
  }, [client]);

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/admin/clients/${id}`, draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["oauth-client", id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/clients/${id}`),
    onSuccess: () => navigate("/admin/clients"),
  });

  if (!id) return <Callout variant="warning">No client ID provided.</Callout>;

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
        <Callout variant="warning">{error instanceof Error ? error.message : "Failed to load client"}</Callout>
      </div>
    );
  }

  const grants = draft.grant_types ?? [];
  const redirectUris = draft.redirect_uris ?? [];
  const scopes = (draft.scope ?? "").split(" ").filter(Boolean);

  function addUri() {
    if (!newUri) return;
    setDraft((d) => ({ ...d, redirect_uris: [...(d.redirect_uris ?? []), newUri] }));
    setNewUri("");
  }

  function removeUri(uri: string) {
    setDraft((d) => ({ ...d, redirect_uris: (d.redirect_uris ?? []).filter((u) => u !== uri) }));
  }

  return (
    <div className={css({ padding: "28px" })}>
      {/* Header */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" })}>
        <div>
          <h2 className={css({ fontSize: "20px", fontWeight: 700, color: "text.primary", fontFamily: "heading", margin: 0 })}>
            {client?.client_name ?? client?.client_id ?? id}
          </h2>
          <div className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted", marginTop: "4px" })}>
            {client?.client_id} · created {formatDate(client?.created_at)}
          </div>
        </div>
        <div className={css({ display: "flex", gap: "6px" })}>
          <Button>Test sign-in</Button>
          <Button>Rotate secret</Button>
          <Button onClick={() => deleteMutation.mutate()}>Delete</Button>
          <Button variant="primary" onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {(saveMutation.error || deleteMutation.error) && (
        <Callout variant="warning">
          {((saveMutation.error ?? deleteMutation.error) as Error)?.message ?? "Action failed"}
        </Callout>
      )}

      {/* Tabs */}
      <div className={css({ marginBottom: "16px" })}>
        <Tabs items={TABS} activeValue={activeTab} onChange={setActiveTab} />
      </div>

      {/* Basics tab */}
      {activeTab === "basics" && (
        <div className={css({ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "18px" })}>
          <div className={panel}>
            <div className={sectionEyebrow}>Basics</div>
            <div className={sectionTitle}>Identity</div>
            <div className={css({ display: "flex", flexDirection: "column", gap: "10px" })}>
              <TextInput
                label="client_name"
                value={draft.client_name ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, client_name: v }))}
              />
              <div>
                <TextInput
                  label="client_id"
                  value={draft.client_id ?? ""}
                  onChange={() => {/* immutable */}}
                  disabled
                />
                <div className={css({ fontSize: "10px", color: "text.muted", marginTop: "2px" })}>immutable</div>
              </div>
              <TextInput
                label="client_uri"
                value={draft.client_uri ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, client_uri: v }))}
              />
              <TextInput
                label="logo_uri"
                value={draft.logo_uri ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, logo_uri: v }))}
              />
              <TextInput
                label="policy_uri"
                value={draft.policy_uri ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, policy_uri: v }))}
              />
              <TextInput
                label="contacts"
                value={(draft.contacts ?? []).join(", ")}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    contacts: v.split(",").map((s) => s.trim()).filter(Boolean),
                  }))
                }
                placeholder="security@example.com"
              />
              <div>
                <div className={css({ fontSize: "11px", color: "text.muted", marginBottom: "4px" })}>token_endpoint_auth_method</div>
                <Select
                  options={AUTH_METHOD_OPTIONS}
                  value={draft.token_endpoint_auth_method ?? "none"}
                  onChange={(v) => setDraft((d) => ({ ...d, token_endpoint_auth_method: v }))}
                />
              </div>
            </div>
          </div>

          <div className={panel}>
            <div className={sectionEyebrow}>Grants</div>
            <div className={sectionTitle}>Allowed grant types</div>
            <div className={css({ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" })}>
              {ALL_GRANTS.map((g) => (
                <div key={g} className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                  <Checkbox
                    checked={grants.includes(g)}
                    onChange={(checked) => {
                      setDraft((d) => ({
                        ...d,
                        grant_types: checked
                          ? [...(d.grant_types ?? []), g]
                          : (d.grant_types ?? []).filter((x) => x !== g),
                      }));
                    }}
                  />
                  <span className={monoSm}>{g}</span>
                </div>
              ))}
            </div>

            <div className={sectionEyebrow}>Response types</div>
            <div className={css({ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" })}>
              {(draft.response_types ?? ["code"]).map((r) => (
                <Badge key={r} variant="new">{r}</Badge>
              ))}
            </div>
          </div>

          {/* Redirect URIs spanning both columns */}
          <div className={css({ gridColumn: "1 / -1" })}>
            <div className={panel}>
              <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" })}>
                <div>
                  <div className={sectionEyebrow}>Redirect URIs</div>
                  <div className={sectionTitle}>{redirectUris.length} allowed callbacks</div>
                </div>
                <div className={css({ display: "flex", gap: "8px", alignItems: "center" })}>
                  <div className={css({ width: "320px" })}>
                    <TextInput value={newUri} onChange={setNewUri} placeholder="https://…/callback" />
                  </div>
                  <Button onClick={addUri}>+ Add URI</Button>
                </div>
              </div>
              <div className={css({ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" })}>
                {redirectUris.map((uri) => (
                  <div
                    key={uri}
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      bg: "bg.page",
                      border: "1px dashed",
                      borderColor: "border.subtle",
                    })}
                  >
                    <span className={monoSm}>{uri}</span>
                    <Button onClick={() => removeUri(uri)}>Remove</Button>
                  </div>
                ))}
                {redirectUris.length === 0 && (
                  <div className={css({ fontSize: "12px", color: "text.muted" })}>No redirect URIs configured.</div>
                )}
              </div>
              <TextInput
                label="post_logout_redirect_uris"
                value={(draft.post_logout_redirect_uris ?? []).join(", ")}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    post_logout_redirect_uris: v.split(",").map((s) => s.trim()).filter(Boolean),
                  }))
                }
                placeholder="https://…/, https://staging.…/"
              />
            </div>
          </div>

          {/* Scopes + Token TTLs */}
          <div className={panel}>
            <div className={sectionEyebrow}>Scopes</div>
            <div className={sectionTitle}>Allowed</div>
            <div className={css({ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" })}>
              {scopes.map((s) => (
                <Badge key={s} variant="new">{s}</Badge>
              ))}
            </div>
            {(draft.audience ?? []).length > 0 && (
              <div className={css({ fontSize: "10px", color: "text.muted", marginTop: "8px" })}>
                audience: <span className={monoSm}>{draft.audience?.join(", ")}</span>
              </div>
            )}
          </div>

          <div className={panel}>
            <div className={sectionEyebrow}>Token TTLs</div>
            <div className={css({ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" })}>
              {[
                ["access_token_ttl", "15m"],
                ["id_token_ttl", "1h"],
                ["refresh_token_ttl", "30d (rotating)"],
                ["authorization_code_ttl", "10m"],
              ].map(([k, v]) => (
                <div key={k} className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
                  <span className={monoSm}>{k}</span>
                  <span className={css({ fontWeight: 600, color: "text.primary", fontSize: "12px" })}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(activeTab === "grants" || activeTab === "redirects" || activeTab === "jwks" || activeTab === "ttls" || activeTab === "compliance" || activeTab === "test") && (
        <div className={panel}>
          <div className={css({ fontSize: "12px", color: "text.muted" })}>
            Switch to the Basics tab to configure this client. Advanced sections coming soon.
          </div>
        </div>
      )}
    </div>
  );
}
