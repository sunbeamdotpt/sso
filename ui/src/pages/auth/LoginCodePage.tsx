import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { css } from "styled-system/css";
import { Button, PinInput, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const RESEND_SECONDS = 42;

export function LoginCodePage() {
  const [searchParams] = useSearchParams();
  const flowId = searchParams.get("flow") ?? "";
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post(`/flow/login?id=${flowId}`, { code, method: "code" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await api.post(`/flow/login?id=${flowId}`, { method: "code", resend: "code" });
      setCountdown(RESEND_SECONDS);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Resend failed");
    }
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
      <div className={css({ textAlign: "center" })}>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary" })}>
          Check your inbox
        </h2>
        <p className={css({ fontSize: "13px", color: "text.muted", marginTop: "6px" })}>
          We sent a 6-digit code to your email
        </p>
      </div>

      {formError && <Callout variant="warning">{formError}</Callout>}

      <form onSubmit={handleVerify} className={css({ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" })}>
        <PinInput
          length={6}
          value={code}
          onChange={setCode}
          label="Verification code"
        />
        <Button variant="primary" type="submit" disabled={submitting || code.length < 6}>
          {submitting ? <Spinner size="sm" /> : "Verify code"}
        </Button>
      </form>

      <div className={css({ display: "flex", justifyContent: "space-between", fontSize: "11px" })}>
        <span className={css({ color: "text.muted" })}>Didn't get it?</span>
        {countdown > 0 ? (
          <span className={css({ color: "sunbeam.orange" })}>
            Resend in 0:{String(countdown).padStart(2, "0")}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className={css({ color: "sunbeam.orange", background: "none", border: "none", cursor: "pointer", padding: 0 })}
          >
            Resend now
          </button>
        )}
      </div>
    </div>
  );
}
