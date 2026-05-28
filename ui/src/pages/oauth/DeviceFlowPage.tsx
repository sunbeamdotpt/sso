import { useState } from "react";
import { css } from "styled-system/css";
import { Button, TextInput, Badge, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

export function DeviceFlowPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/oauth2/device/verify", { user_code: code });
      setSuccess(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Activation failed — check your code and try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
      <div className={css({ textAlign: "center" })}>
        <Badge variant="new">DEVICE FLOW</Badge>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginTop: "12px" })}>
          Activate Marathon CLI
        </h2>
        <p className={css({ fontSize: "13px", color: "text.muted", marginTop: "6px" })}>
          Enter the code shown in your terminal.
        </p>
      </div>

      {formError && <Callout variant="warning">{formError}</Callout>}

      {success ? (
        <Callout variant="tip">Device activated successfully. You can close this window and return to your terminal.</Callout>
      ) : (
        <form onSubmit={handleActivate} className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
          <TextInput
            label="Device code"
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
          />
          <p className={css({ fontSize: "11px", color: "text.muted", textAlign: "center" })}>
            format: XXXX-XXXX
          </p>
          <Button variant="primary" type="submit" disabled={submitting || !code}>
            {submitting ? <Spinner size="sm" /> : "Activate"}
          </Button>
          <p className={css({ fontSize: "11px", color: "text.muted", textAlign: "center" })}>
            Make sure the code matches the one in your terminal. Don't enter codes from emails or chats.
          </p>
        </form>
      )}
    </div>
  );
}
