import { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { Button, TextInput, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";

interface LoginChallenge {
  challenge: string;
  client: { client_name: string };
  subject?: string;
  skip?: boolean;
  redirect_to?: string;
}

export function OAuthLoginPage() {
  const search = useSearch({ from: "/oauth/login" });
  const challenge = (search as Record<string, unknown>).login_challenge as string | undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loginChallenge, setLoginChallenge] = useState<LoginChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    setIsLoading(true);
    api
      .get<LoginChallenge>(`/hydra/login?challenge=${challenge}`)
      .then((data) => {
        if (data.skip && data.subject) {
          return api
            .post<{ redirect_to: string }>("/hydra/login/accept", {
              body: {
                challenge,
                subject: data.subject,
                remember: false,
                remember_for: 0,
              },
            })
            .then((result) => {
              if (result?.redirect_to) {
                window.location.href = result.redirect_to;
              }
            });
        }
        setLoginChallenge(data);
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : "Failed to load login request");
      })
      .finally(() => setIsLoading(false));
  }, [challenge]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<{ redirect_to: string }>("/hydra/login/accept", {
        body: {
          challenge,
          subject: email,
          remember: false,
          remember_for: 0,
        },
      });
      if (result?.redirect_to) {
        window.location.href = result.redirect_to;
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign in failed");
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

  const clientName = loginChallenge?.client?.client_name ?? "this application";

  return (
    <div className={wrapper}>
      <div className={card}>
        <h1 className={title}>Sign in to continue</h1>
        <p className={subtitle}>
          requested by <strong>{clientName}</strong>
        </p>

        {formError && (
          <Callout variant="warning">{formError}</Callout>
        )}

        <form onSubmit={handleSubmit} className={formStack}>
          <TextInput
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            disabled={submitting}
          />
          <TextInput
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            disabled={submitting}
          />
          <Button variant="primary" type="submit" disabled={submitting || !email || !password}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
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

const formStack = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});
