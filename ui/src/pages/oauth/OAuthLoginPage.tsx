import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

interface LoginChallenge {
  challenge: string;
  client: { client_name: string };
  subject?: string;
  skip?: boolean;
  redirect_to?: string;
}

export function OAuthLoginPage() {
  const [searchParams] = useSearchParams();
  const challenge = searchParams.get("login_challenge") ?? searchParams.get("challenge") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: loginChallenge, isLoading, error } = useQuery({
    queryKey: ["hydra-login", challenge],
    queryFn: async () => {
      const data = await api.get<LoginChallenge>(`/hydra/login?challenge=${challenge}`);
      // If skip=true, the user is already authenticated — accept immediately
      if (data.skip && data.subject) {
        const result = await api.post<{ redirect_to: string }>("/hydra/login/accept", {
          challenge,
          subject: data.subject,
          remember: false,
          remember_for: 0,
        });
        if (result?.redirect_to) {
          window.location.href = result.redirect_to;
        }
      }
      return data;
    },
    enabled: !!challenge,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<{ redirect_to: string }>("/hydra/login/accept", {
        challenge,
        subject: email,
        remember: false,
        remember_for: 0,
        acr: "0",
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
      <div className={css({ display: "flex", justifyContent: "center", padding: "32px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  const clientName = loginChallenge?.client?.client_name ?? "this application";

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
      <div className={css({ textAlign: "center" })}>
        <p className={css({ fontSize: "11px", color: "text.muted" })}>
          requested by <strong>{clientName}</strong>
        </p>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginTop: "8px" })}>
          Sign in to continue
        </h2>
      </div>

      {(error || formError) && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : formError}
        </Callout>
      )}

      <form onSubmit={handleSubmit} className={css({ display: "flex", flexDirection: "column", gap: "12px" })}>
        <TextInput
          label="Email"
          placeholder="you@studio.pt"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <TextInput
          label="Password"
          placeholder="••••••••"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <div className={css({ display: "flex", justifyContent: "flex-end" })}>
          <a
            href="/auth/recovery"
            className={css({ fontSize: "12px", color: "sunbeam.orange", textDecoration: "none", _hover: { textDecoration: "underline" } })}
          >
            Forgot password?
          </a>
        </div>
        <Button variant="primary" type="submit" disabled={submitting || !email || !password}>
          {submitting ? <Spinner size="sm" /> : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
