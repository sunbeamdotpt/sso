import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Select, Badge, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const card = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

const monoSm = css({ fontFamily: "mono", fontSize: "11px" });

type OAuthClient = {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  scope?: string;
  redirect_uris?: string[];
  updated_at?: string;
  metadata?: Record<string, unknown>;
};

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "public", label: "Public" },
  { value: "confidential", label: "Confidential" },
];

const GRANT_OPTIONS = [
  { value: "", label: "All grants" },
  { value: "authorization_code", label: "Authorization Code" },
  { value: "client_credentials", label: "Client Credentials" },
  { value: "urn:ietf:device_code", label: "Device Flow" },
];

function clientType(c: OAuthClient) {
  const method = c.token_endpoint_auth_method ?? "none";
  if (method === "none") return "public · PKCE";
  if (method === "client_secret_basic" || method === "client_secret_post") return "confidential";
  return method;
}

function lastUsed(c: OAuthClient) {
  if (!c.updated_at) return "—";
  try {
    const d = new Date(c.updated_at);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `used ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `used ${hours}h ago`;
    return `used ${Math.floor(hours / 24)}d ago`;
  } catch {
    return "—";
  }
}

export function OAuthClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [grantFilter, setGrantFilter] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["oauth-clients"],
    queryFn: () => api.get<OAuthClient[]>("/admin/clients"),
  });

  const filtered = (data ?? []).filter((c) => {
    if (search && !c.client_id.includes(search) && !(c.client_name ?? "").toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (typeFilter === "public" && c.token_endpoint_auth_method !== "none") return false;
    if (typeFilter === "confidential" && c.token_endpoint_auth_method === "none") return false;
    if (grantFilter && !(c.grant_types ?? []).includes(grantFilter)) return false;
    return true;
  });

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" })}>
        <div>
          <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", fontFamily: "heading", marginBottom: "4px" })}>
            OAuth2 / OIDC clients
          </h1>
          <div className={css({ fontSize: "12px", color: "text.muted" })}>
            {(data?.length ?? 0).toLocaleString()} registered
          </div>
        </div>
        <Button variant="primary" onClick={() => navigate("/admin/clients/new")}>
          + Register client
        </Button>
      </div>

      {/* Toolbar */}
      <div className={css({ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" })}>
        <div className={css({ flex: 1 })}>
          <TextInput
            value={search}
            onChange={setSearch}
            placeholder="search by client_id, name…"
          />
        </div>
        <div className={css({ width: "160px" })}>
          <Select options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} placeholder="Type" />
        </div>
        <div className={css({ width: "200px" })}>
          <Select options={GRANT_OPTIONS} value={grantFilter} onChange={setGrantFilter} placeholder="Grant" />
        </div>
      </div>

      {error && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : "Failed to load clients"}
        </Callout>
      )}

      {isLoading ? (
        <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
          <Spinner size="md" />
        </div>
      ) : (
        <div className={css({ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" })}>
          {filtered.map((c) => {
            const isDeprecated = (c.metadata as { deprecated?: boolean })?.deprecated ?? false;
            const grants = (c.grant_types ?? []).join(" · ");
            const scopes = c.scope ?? "—";
            const redirectCount = c.redirect_uris?.length ?? 0;
            const type = clientType(c);

            return (
              <div key={c.client_id} className={card} style={isDeprecated ? { opacity: 0.65 } : undefined}>
                <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" })}>
                  <span className={css({ fontSize: "13px", fontWeight: 600, color: "text.primary" })}>
                    {c.client_name ?? c.client_id}
                  </span>
                  {isDeprecated && <Badge variant="deprecated">DEPRECATED</Badge>}
                </div>

                <div className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted", marginBottom: "8px" })}>
                  {c.client_id}
                </div>

                <div className={css({ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", marginBottom: "10px" })}>
                  <div className={css({ display: "flex", justifyContent: "space-between" })}>
                    <span className={css({ color: "text.muted" })}>type</span>
                    <span className={css({ fontWeight: 600, color: "text.primary" })}>{type}</span>
                  </div>
                  <div className={css({ display: "flex", justifyContent: "space-between" })}>
                    <span className={css({ color: "text.muted" })}>grants</span>
                    <span className={monoSm} style={{ color: "var(--colors-sunbeam-orange, #f97316)", textAlign: "right", maxWidth: "60%" }}>
                      {grants || "—"}
                    </span>
                  </div>
                  <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start" })}>
                    <span className={css({ color: "text.muted" })}>scopes</span>
                    <span className={monoSm} style={{ textAlign: "right", maxWidth: "70%" }}>
                      {scopes.length > 60 ? scopes.slice(0, 60) + "…" : scopes}
                    </span>
                  </div>
                  <div className={css({ display: "flex", justifyContent: "space-between" })}>
                    <span className={css({ color: "text.muted" })}>redirects</span>
                    <span>{redirectCount > 0 ? `${redirectCount} URI${redirectCount > 1 ? "s" : ""}` : "— (server-to-server)"}</span>
                  </div>
                  <div className={css({ display: "flex", justifyContent: "space-between" })}>
                    <span className={css({ color: "text.muted" })}>last used</span>
                    <span className={css({ color: "text.muted" })}>{lastUsed(c)}</span>
                  </div>
                </div>

                <div className={css({ display: "flex", gap: "6px" })}>
                  <Button onClick={() => navigate(`/admin/clients/${c.client_id}`)}>
                    Edit
                  </Button>
                  <Button>Rotate secret</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
