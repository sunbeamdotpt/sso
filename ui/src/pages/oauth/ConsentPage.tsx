import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, Checkbox, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

interface ConsentScope {
  name: string;
  description: string;
}

interface ConsentFlow {
  challenge: string;
  client: { client_name: string; logo_uri?: string };
  subject: string;
  requested_scope: string[];
  requested_access_token_audience: string[];
  context?: Record<string, unknown>;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  profile: "See your name and avatar",
  email: "See your email address",
  openid: "Verify your identity",
  offline_access: "Stay signed in for 30 days",
  "projects:read": "List your Sunbeam projects",
  "projects:write": "Create and modify projects",
};

export function ConsentPage() {
  const [searchParams] = useSearchParams();
  const challenge = searchParams.get("consent_challenge") ?? searchParams.get("challenge") ?? "";
  const [remember, setRemember] = useState(false);
  const [scopeStates, setScopeStates] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: consent, isLoading, error } = useQuery({
    queryKey: ["hydra-consent", challenge],
    queryFn: () => api.get<ConsentFlow>(`/hydra/consent?challenge=${challenge}`),
    enabled: !!challenge,
  });

  // Initialise scope checkboxes to checked when data first arrives
  useEffect(() => {
    if (!consent) return;
    const initial: Record<string, boolean> = {};
    for (const scope of consent.requested_scope ?? []) {
      initial[scope] = true;
    }
    setScopeStates(initial);
  }, [consent]);

  async function handleAllow() {
    setSubmitting(true);
    setFormError(null);
    try {
      const grantedScopes = Object.entries(scopeStates)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const result = await api.post<{ redirect_to: string }>("/hydra/consent/accept", {
        challenge,
        grant_scope: grantedScopes,
        remember,
        remember_for: remember ? 3600 : 0,
        session: {},
      });
      if (result?.redirect_to) {
        window.location.href = result.redirect_to;
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to accept consent");
      setSubmitting(false);
    }
  }

  async function handleDeny() {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<{ redirect_to: string }>("/hydra/consent/reject", {
        challenge,
        error: "access_denied",
        error_description: "User denied consent",
      });
      if (result?.redirect_to) {
        window.location.href = result.redirect_to;
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to reject consent");
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className={css({ display: "flex", justifyContent: "center", padding: "32px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  const clientName = consent?.client?.client_name ?? "This application";
  const subject = consent?.subject ?? "";
  const scopes: ConsentScope[] = (consent?.requested_scope ?? []).map((s) => ({
    name: s,
    description: SCOPE_DESCRIPTIONS[s] ?? s,
  }));

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
      <div className={css({ textAlign: "center" })}>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary" })}>
          Allow <span className={css({ color: "sunbeam.orange" })}>{clientName}</span> to access your account?
        </h2>
        {subject && (
          <p className={css({ fontSize: "12px", color: "text.muted", marginTop: "6px" })}>
            Signing in as <strong>{subject}</strong>
          </p>
        )}
      </div>

      {(error || formError) && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : formError}
        </Callout>
      )}

      {scopes.length > 0 && (
        <div>
          <p className={css({ fontSize: "11px", fontWeight: 600, color: "text.muted", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" })}>
            This will let {clientName}
          </p>
          <div className={css({ display: "flex", flexDirection: "column" })}>
            {scopes.map((scope) => (
              <div
                key={scope.name}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px",
                  borderBottom: "1px dashed",
                  borderColor: "border.default",
                })}
              >
                <Checkbox
                  checked={scopeStates[scope.name] ?? false}
                  onChange={(checked) => setScopeStates((prev) => ({ ...prev, [scope.name]: checked }))}
                />
                <div className={css({ flex: 1 })}>
                  <div className={css({ fontSize: "12px", fontFamily: "mono", color: "text.primary" })}>{scope.name}</div>
                  <div className={css({ fontSize: "11px", color: "text.muted" })}>{scope.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Checkbox
        checked={remember}
        onChange={setRemember}
        label="Remember my decision for this app"
      />

      <div className={css({ display: "flex", gap: "8px" })}>
        <div className={css({ flex: 1 })}>
          <Button variant="ghost" type="button" onClick={handleDeny} disabled={submitting}>
            Deny
          </Button>
        </div>
        <div className={css({ flex: 1 })}>
          <Button variant="primary" type="button" onClick={handleAllow} disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : "Allow"}
          </Button>
        </div>
      </div>

      <p className={css({ fontSize: "11px", color: "text.muted", textAlign: "center" })}>
        You can revoke access any time in Account → Connections.
      </p>
    </div>
  );
}
