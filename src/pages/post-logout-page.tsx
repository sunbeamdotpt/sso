import { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { Button, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";

interface LogoutChallenge {
  challenge: string;
  subject: string;
  sid?: string;
  request_url?: string;
  rp_initiated?: boolean;
}

export function PostLogoutPage() {
  const search = useSearch({ from: "/oauth/logged-out" });
  const challenge = (search as Record<string, unknown>).logout_challenge as string | undefined;
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [logoutChallenge, setLogoutChallenge] = useState<LogoutChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    setIsLoading(true);
    api
      .get<LogoutChallenge>(`/hydra/logout?challenge=${challenge}`)
      .then((data) => setLogoutChallenge(data))
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : "Failed to load logout request");
      })
      .finally(() => setIsLoading(false));
  }, [challenge]);

  async function handleSignOut() {
    if (!challenge) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<{ redirect_to: string }>("/hydra/logout/accept", { body: { challenge } });
      if (result?.redirect_to) {
        window.location.href = result.redirect_to;
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign out failed");
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!challenge) {
      window.history.back();
      return;
    }
    try {
      await api.post("/hydra/logout/reject", { body: { challenge } });
    } catch {
      // ignore
    }
    window.history.back();
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

  return (
    <div className={wrapper}>
      <div className={card}>
        <h1 className={title}>Sign out of Sunbeam?</h1>
        <p className={subtitle}>
          You&rsquo;ll be signed out of Sunbeam and any other apps that share this session.
        </p>

        {formError && (
          <Callout variant="warning">{formError}</Callout>
        )}

        <div className={actions}>
          <Button variant="primary" type="button" onClick={handleSignOut} disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : "Sign out"}
          </Button>
          <Button variant="ghost" type="button" onClick={handleCancel} disabled={submitting}>
            No, stay signed in
          </Button>
        </div>
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
  maxWidth: "400px",
  padding: "32px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  textAlign: "center",
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
});

const subtitle = css({
  fontSize: "sm",
  color: "text.secondary",
  lineHeight: "1.5",
});

const actions = css({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
});
