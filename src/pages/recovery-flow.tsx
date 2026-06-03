import { useState, useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { TextInput, Button, Callout, Toast } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { submitFlow } from "../api/flows.ts";
import type { RecoveryFlow } from "../api/types.ts";

type RecoveryStep = "email" | "code" | "submitting" | "success";

function getKratosError(flow: RecoveryFlow): string | undefined {
  const ui = flow.ui;
  if (!ui) return undefined;
  const flowMsg = ui.messages?.find((m) => m.type === "error");
  if (flowMsg) return flowMsg.text;
  for (const node of ui.nodes ?? []) {
    const nodeMsg = node.messages?.find((m) => m.type === "error");
    if (nodeMsg) return nodeMsg.text;
  }
  return undefined;
}

export function RecoveryFlowPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/recovery" }) as { flow?: string };
  const flowId = search.flow;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<RecoveryStep>("email");
  const [flow, setFlow] = useState<RecoveryFlow | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" | "info"; visible: boolean }>({
    message: "",
    variant: "info",
    visible: false,
  });

  const showToast = useCallback((message: string, variant: "success" | "error" | "info" = "info") => {
    setToast({ message, variant, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const query = useRestQuery<RecoveryFlow>(api, flowId ? `/self-service/recovery/flows?id=${flowId}` : "/self-service/recovery/browser", {
    queryKey: flowId ? ["recovery-flow", flowId] : ["recovery-flow"],
  });

  const currentFlow = flow ?? query.data ?? null;
  const error = currentFlow ? getKratosError(currentFlow) : undefined;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFlow?.ui?.action) return;

    setStep("submitting");
    hideToast();

    const result = await submitFlow(
      currentFlow as RecoveryFlow & { ui: NonNullable<RecoveryFlow["ui"]> },
      { email },
      "code",
    );

    if (result.success && result.flow) {
      const updatedFlow = result.flow as RecoveryFlow;
      setFlow(updatedFlow);
      const flowError = getKratosError(updatedFlow);
      if (flowError) {
        showToast(flowError, "error");
        setStep("email");
        return;
      }
      const hasCodeNode = updatedFlow.ui?.nodes?.some(
        (n) => n.attributes.name === "code" || n.group === "code",
      );
      if (hasCodeNode) {
        setStep("code");
      } else {
        showToast("Recovery email sent. Check your inbox.", "success");
        setStep("email");
      }
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setFlow(null);
        query.refetch();
      } else if (result.flow) {
        setFlow(result.flow as RecoveryFlow);
      }
      showToast(result.error, "error");
    } else {
      showToast("Unexpected response from recovery flow.", "error");
    }
    setStep("email");
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFlow?.ui?.action) return;

    setStep("submitting");
    hideToast();

    const result = await submitFlow(
      currentFlow as RecoveryFlow & { ui: NonNullable<RecoveryFlow["ui"]> },
      { code },
      "code",
    );

    if (result.success || result.redirect_browser_to) {
      showToast("Password reset successful!", "success");
      setStep("success");
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setFlow(null);
        query.refetch();
        setStep("email");
      } else {
        if (result.flow) {
          setFlow(result.flow as RecoveryFlow);
        }
        showToast(result.error, "error");
        setStep("code");
      }
    } else {
      showToast("Unexpected response from recovery flow.", "error");
      setStep("code");
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setCode("");
    hideToast();
  };

  const isSubmitting = step === "submitting";

  return (
    <div className={wrapper}>
      <Toast message={toast.message} variant={toast.variant} visible={toast.visible} onDismiss={hideToast} />

      {query.isLoading && <p className={statusText}>Loading…</p>}
      {query.error && !currentFlow && <p className={errorText}>{query.error.message}</p>}

      {currentFlow && step === "email" && (
        <div className={emailCard}>
          <h2 className={title}>Forgot Password</h2>
          {error && <Callout variant="warning">{error}</Callout>}
          <form onSubmit={handleEmailSubmit} className={formStack}>
            <p className={subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
            <Button variant="primary" type="submit" className={fullWidth}>
              {isSubmitting && <span>Loading…</span>}
              Send Reset Link
            </Button>
          </form>
          <div className={links}>
            <a className={backLink} href="/login" onClick={(e) => { e.preventDefault(); navigate({ to: "/login" }); }}>
              Back to sign in
            </a>
          </div>
        </div>
      )}

      {currentFlow && step === "code" && (
        <div className={codeCard}>
          <h2 className={title}>Enter Recovery Code</h2>
          <p className={subtitle}>Enter the code sent to your email.</p>
          {error && <p className={errorText}>{error}</p>}
          <form onSubmit={handleCodeSubmit} className={formStack}>
            <input
              type="text"
              className={codeInput}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
            <button type="submit" className={submitButton} disabled={isSubmitting || !code}>
              {isSubmitting ? "Verifying…" : "Verify"}
            </button>
            <button type="button" className={backLink} onClick={handleBackToEmail}>
              ← Use a different email
            </button>
          </form>
        </div>
      )}

      {step === "success" && (
        <div className={successCard}>
          <h2 className={title}>Success</h2>
          <p className={subtitle}>Your password has been reset. You can now sign in with your new password.</p>
          
          <button className={submitButton} onClick={() => navigate({ to: "/login" })}>
            Sign in
          </button>
        </div>
      )}
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
  flexDirection: "column",
  gap: "16px",
});

const statusText = css({
  fontSize: "sm",
  color: "text.secondary",
  textAlign: "center",
});

const errorText = css({
  fontSize: "sm",
  color: "error",
  textAlign: "center",
});

const codeCard = css({
  maxWidth: "400px",
  width: "100%",
  margin: "0 auto",
  backgroundColor: "bg.page",
  border: "2px solid",
  borderColor: "border.default",
  padding: "32px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  shadow: "golden",
});

const successCard = css({
  maxWidth: "400px",
  width: "100%",
  margin: "0 auto",
  backgroundColor: "bg.page",
  border: "2px solid",
  borderColor: "border.default",
  padding: "32px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  shadow: "golden",
});

const title = css({
  fontSize: "24px",
  fontWeight: "heading",
  fontFamily: "heading",
  color: "text.primary",
  textAlign: "center",
  margin: 0,
});

const subtitle = css({
  fontSize: "14px",
  fontFamily: "body",
  color: "text.secondary",
  lineHeight: 1.5,
  textAlign: "center",
  margin: 0,
});

const formStack = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const codeInput = css({
  width: "100%",
  padding: "12px 16px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.default",
  backgroundColor: "bg.card",
  color: "text.primary",
  fontSize: "16px",
  fontFamily: "body",
  outline: "none",
  _focus: {
    borderColor: "accent",
    ring: "2px",
    ringColor: "accent",
  },
});

const submitButton = css({
  width: "100%",
  padding: "12px 16px",
  borderRadius: "md",
  border: "none",
  backgroundColor: "accent",
  color: "white",
  fontSize: "16px",
  fontWeight: "button",
  fontFamily: "body",
  cursor: "pointer",
  _hover: { backgroundColor: "sunbeam.flame" },
  textAlign: "center",
  _disabled: { opacity: 0.5, cursor: "not-allowed" },
});

const backLink = css({
  fontSize: "13px",
  fontFamily: "body",
  color: "sunbeam.orange",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  background: "none",
  border: "none",
  padding: 0,
  textAlign: "center",
  _hover: {
    textDecorationColor: "sunbeam.orange",
  },
});

const emailCard = css({
  maxWidth: "400px",
  width: "100%",
  margin: "0 auto",
  backgroundColor: "bg.page",
  border: "2px solid",
  borderColor: "border.default",
  padding: "32px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  shadow: "golden",
});

const fullWidth = css({
  width: "100%",
  justifyContent: "center",
});

const links = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  marginTop: "8px",
});
