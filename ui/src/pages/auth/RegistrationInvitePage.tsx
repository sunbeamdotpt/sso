import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Badge, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

export function RegistrationInvitePage() {
  const [searchParams] = useSearchParams();
  const flowId = searchParams.get("flow") ?? "";
  const invite = searchParams.get("invite") ?? "";
  const [email, setEmail] = useState("joana@studiocorp.pt");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: flow, isLoading, error } = useQuery({
    queryKey: ["flow", "registration-invite", flowId],
    queryFn: () => api.get<{ ui: { action: string; messages?: { text: string }[] } }>(`/flow/registration?id=${flowId}`),
    enabled: !!flowId,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flow) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post(flow.ui.action, {
        method: "saml",
        "traits.email": email,
        invite_token: invite,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Submission failed");
    } finally {
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

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
      <div className={css({ textAlign: "center" })}>
        <Badge variant="open">ORG INVITE</Badge>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginTop: "10px" })}>
          Join Studio Corp
        </h2>
        <p className={css({ fontSize: "13px", color: "text.muted", marginTop: "6px" })}>
          Invited by <strong>Carlos Mendes</strong>
        </p>
      </div>

      {(error || formError) && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : formError}
        </Callout>
      )}

      {flow?.ui?.messages?.map((msg, i) => (
        <Callout key={i} variant="warning">{msg.text}</Callout>
      ))}

      <form onSubmit={handleSubmit} className={css({ display: "flex", flexDirection: "column", gap: "12px" })}>
        <TextInput
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <div
          className={css({
            fontSize: "12px",
            color: "text.muted",
            bg: "bg.card",
            border: "1px solid",
            borderColor: "border.default",
            borderRadius: "md",
            padding: "10px 12px",
            lineHeight: "1.5",
          })}
        >
          This org has SAML enforced — you'll be redirected to your Identity Provider to complete sign-in.
        </div>
        <Button variant="primary" type="submit" disabled={submitting || !email}>
          Continue with Studio SSO
        </Button>
      </form>
    </div>
  );
}
