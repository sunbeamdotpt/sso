import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

interface LogoutChallenge {
  challenge: string;
  subject: string;
  sid?: string;
  request_url?: string;
  rp_initiated?: boolean;
}

export function PostLogoutPage() {
  const [searchParams] = useSearchParams();
  const challenge = searchParams.get("logout_challenge") ?? searchParams.get("challenge") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: logoutChallenge, isLoading, error } = useQuery({
    queryKey: ["hydra-logout", challenge],
    queryFn: () => api.get<LogoutChallenge>(`/hydra/logout?challenge=${challenge}`),
    enabled: !!challenge,
  });

  async function handleSignOut() {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<{ redirect_to: string }>("/hydra/logout/accept", { challenge });
      if (result?.redirect_to) {
        window.location.href = result.redirect_to;
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign out failed");
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    try {
      await api.post("/hydra/logout/reject", { challenge });
      window.history.back();
    } catch {
      window.history.back();
    }
  }

  if (isLoading) {
    return (
      <div className={css({ display: "flex", justifyContent: "center", padding: "32px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" })}>
      <div>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary" })}>
          Sign out of <span className={css({ color: "sunbeam.orange" })}>Sol Studio</span>?
        </h2>
        <p className={css({ fontSize: "13px", color: "text.muted", marginTop: "8px", lineHeight: "1.5" })}>
          You'll be signed out of Sol Studio and any other Sunbeam apps that share this session.
        </p>
      </div>

      {(error || formError) && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : formError}
        </Callout>
      )}

      <div className={css({ display: "flex", flexDirection: "column", gap: "8px" })}>
        <Button variant="primary" type="button" onClick={handleSignOut} disabled={submitting}>
          {submitting ? <Spinner size="sm" /> : "Sign out"}
        </Button>
        <Button variant="ghost" type="button" onClick={handleCancel} disabled={submitting}>
          No, stay signed in
        </Button>
      </div>
    </div>
  );
}
