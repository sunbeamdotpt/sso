import { useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, TextInput, Toast } from "@sunbeam/beam-ui";
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

  const query = useRestQuery<RecoveryFlow>(api, "/self-service/recovery/browser", {
    queryKey: ["recovery-flow"],
  });

  const currentFlow = flow ?? query.data ?? null;

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
      // Transition to code step if the flow has a code field in its UI nodes
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

    if (result.success) {
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

      <div className={card}>
        <h1 className={title}>Sunbeam SSO</h1>
        <p className={subtitle}>Recover your account</p>

        {query.isLoading && <p className={statusText}>Loading…</p>}
        {query.error && !currentFlow && (
          <p className={errorText}>{query.error.message}</p>
        )}

        {currentFlow && step === "email" && (
          <form onSubmit={handleEmailSubmit} className={formStack}>
            <TextInput
              type="email"
              label="E-Mail"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              disabled={isSubmitting}
            />
            <Button variant="primary" type="submit" disabled={isSubmitting || !email}>
              {isSubmitting ? "Sending…" : "Send recovery code"}
            </Button>
          </form>
        )}

        {currentFlow && step === "code" && (
          <form onSubmit={handleCodeSubmit} className={formStack}>
            <TextInput
              type="text"
              label="Recovery code"
              placeholder="000000"
              value={code}
              onChange={setCode}
              disabled={isSubmitting}
            />
            <Button variant="primary" type="submit" disabled={isSubmitting || !code}>
              {isSubmitting ? "Verifying…" : "Verify code"}
            </Button>
            <Button variant="ghost" type="button" disabled={isSubmitting} onClick={handleBackToEmail}>
              ← Use a different email
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className={formStack}>
            <p className={statusText}>
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Link to="/login" className={link}>Sign in</Link>
          </div>
        )}

        <div className={footer}>
          <span style={{ color: "text.muted" }}>Remember your password?</span>
          <Link to="/login" className={link}>Sign in</Link>
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
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
  textAlign: "center",
  marginBottom: "4px",
});

const subtitle = css({
  fontSize: "sm",
  color: "text.secondary",
  textAlign: "center",
  marginBottom: "24px",
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

const formStack = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const footer = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  marginTop: "20px",
  fontSize: "sm",
});

const link = css({
  color: "accent",
  textDecoration: "none",
  _hover: { textDecoration: "underline" },
});
