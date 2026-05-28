import { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { Button, Checkbox, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";

interface ConsentFlow {
  challenge: string;
  client: { client_name: string; logo_uri?: string };
  subject: string;
  requested_scope: string[];
  requested_access_token_audience: string[];
  skip?: boolean;
  redirect_to?: string;
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
  const search = useSearch({ from: "/consent" });
  const challenge = (search as Record<string, unknown>).consent_challenge as string | undefined;
  const [remember, setRemember] = useState(false);
  const [scopeStates, setScopeStates] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentFlow | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    setIsLoading(true);
    api
      .get<ConsentFlow>(`/hydra/consent?challenge=${challenge}`)
      .then((data) => {
        if (data.skip && data.redirect_to) {
          window.location.href = data.redirect_to;
          return;
        }
        setConsent(data);
        const initial: Record<string, boolean> = {};
        for (const scope of data.requested_scope ?? []) {
          initial[scope] = true;
        }
        setScopeStates(initial);
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : "Failed to load consent request");
      })
      .finally(() => setIsLoading(false));
  }, [challenge]);

  async function handleAllow() {
    if (!challenge) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const grantedScopes = Object.entries(scopeStates)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const result = await api.post<{ redirect_to: string }>("/hydra/consent/accept", {
        body: {
          challenge,
          grant_scope: grantedScopes,
          remember,
          remember_for: remember ? 3600 : 0,
          session: {},
        },
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
    if (!challenge) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<{ redirect_to: string }>("/hydra/consent/reject", {
        body: {
          challenge,
          error: "access_denied",
          error_description: "User denied consent",
        },
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
      <div className={wrapper}>
        <div className={card}>
          <div className={css({ display: "flex", justifyContent: "center", padding: "32px" })}>
            <Spinner size="md" />
          </div>
        </div>
      </div>
    );
  }

  const clientName = consent?.client?.client_name ?? "This application";
  const subject = consent?.subject ?? "";
  const scopes = (consent?.requested_scope ?? []).map((s) => ({
    name: s,
    description: SCOPE_DESCRIPTIONS[s] ?? s,
  }));

  return (
    <div className={wrapper}>
      <div className={card}>
        <h1 className={title}>Authorize {clientName}</h1>
        <p className={subtitle}>
          {subject ? (
            <>Signed in as <strong>{subject}</strong></>
          ) : (
            "This application is requesting access to your account"
          )}
        </p>

        {(formError) && (
          <Callout variant="warning">{formError}</Callout>
        )}

        {scopes.length > 0 && (
          <div className={scopeList}>
            <p className={scopeHeader}>This will let {clientName}:</p>
            <div className={scopeItems}>
              {scopes.map((scope) => (
                <div key={scope.name} className={scopeRow}>
                  <Checkbox
                    checked={scopeStates[scope.name] ?? false}
                    onChange={(checked) =>
                      setScopeStates((prev) => ({ ...prev, [scope.name]: checked }))
                    }
                  />
                  <div className={scopeInfo}>
                    <div className={scopeName}>{scope.name}</div>
                    <div className={scopeDesc}>{scope.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={rememberRow}>
          <Checkbox
            checked={remember}
            onChange={setRemember}
            label="Remember this decision"
          />
        </div>

        <div className={actions}>
          <Button variant="ghost" type="button" onClick={handleDeny} disabled={submitting}>
            Deny
          </Button>
          <Button variant="primary" type="button" onClick={handleAllow} disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : "Allow"}
          </Button>
        </div>

        <p className={footer}>You can revoke access any time in Account → Connections.</p>
      </div>
    </div>
  );
}

const wrapper = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "24px",
  backgroundColor: "bg.page",
});

const card = css({
  width: "100%",
  maxWidth: "440px",
  padding: "32px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
  textAlign: "center",
});

const subtitle = css({
  fontSize: "sm",
  color: "text.secondary",
  textAlign: "center",
});

const scopeList = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

const scopeHeader = css({
  fontSize: "xs",
  fontWeight: "semibold",
  color: "text.muted",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
});

const scopeItems = css({
  display: "flex",
  flexDirection: "column",
  borderTop: "1px solid",
  borderColor: "border.subtle",
});

const scopeRow = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 8px",
  borderBottom: "1px solid",
  borderColor: "border.subtle",
});

const scopeInfo = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

const scopeName = css({
  fontSize: "sm",
  fontFamily: "mono",
  color: "text.primary",
});

const scopeDesc = css({
  fontSize: "xs",
  color: "text.muted",
});

const rememberRow = css({
  paddingTop: "4px",
});

const actions = css({
  display: "flex",
  gap: "12px",
  "& > *": { flex: 1 },
});

const footer = css({
  fontSize: "xs",
  color: "text.muted",
  textAlign: "center",
});
