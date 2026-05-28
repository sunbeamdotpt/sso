import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Badge, Checkbox, Callout, Spinner, Select } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const LOCALE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "pt-PT", label: "Portuguese (PT)" },
  { value: "pt-BR", label: "Portuguese (BR)" },
  { value: "es-ES", label: "Spanish (ES)" },
  { value: "fr-FR", label: "French (FR)" },
  { value: "de-DE", label: "German (DE)" },
];

export function RegistrationSocialConfirmPage() {
  const [searchParams] = useSearchParams();
  const flowId = searchParams.get("flow") ?? "";
  const [displayName, setDisplayName] = useState("Joana Silva");
  const [locale, setLocale] = useState("pt-PT");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: flow, isLoading, error } = useQuery({
    queryKey: ["flow", "registration-social", flowId],
    queryFn: () => api.get<{
      ui: {
        action: string;
        messages?: { text: string }[];
        nodes: { attributes: { name: string; value: string } }[];
      };
    }>(`/flow/registration?id=${flowId}`),
    enabled: !!flowId,
  });

  const prefillEmail =
    flow?.ui?.nodes?.find((n) => n.attributes.name === "traits.email")?.attributes.value ??
    "j.silva@gmail.com";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flow || !agreed) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post(flow.ui.action, {
        method: "oidc",
        "traits.name.first": displayName,
        "traits.locale": locale,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Account creation failed");
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
        <Badge variant="approved">FROM GOOGLE</Badge>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginTop: "10px" })}>
          Confirm your details
        </h2>
        <p className={css({ fontSize: "13px", color: "text.muted", marginTop: "6px" })}>
          We pre-filled what Google shared. Edit anything before continuing.
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
          label="Email (from Google)"
          type="email"
          value={prefillEmail}
          onChange={(_v) => {}}
          disabled
        />
        <TextInput
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
        />
        <div className={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
          <span className={css({ fontSize: "14px", color: "text.primary", fontWeight: "500" })}>Locale</span>
          <Select
            options={LOCALE_OPTIONS}
            value={locale}
            onChange={setLocale}
            placeholder="Select locale…"
          />
        </div>
        <Checkbox
          checked={agreed}
          onChange={(checked) => setAgreed(checked)}
          label="I agree to the Terms and Privacy Policy"
        />
        <Button variant="primary" type="submit" disabled={submitting || !agreed}>
          Create account
        </Button>
      </form>
    </div>
  );
}
