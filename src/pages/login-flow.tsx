import { useState, useCallback } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, TextInput, Toast } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { setUserSession } from "../providers/auth.tsx";
import { submitFlow, needsMfa, getAvailableMfaMethods } from "../api/flows.ts";
import type { LoginFlow } from "../api/types.ts";

type LoginStep = "password" | "mfa" | "submitting";

function getKratosError(flow: LoginFlow): string | undefined {
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

export function LoginFlowPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [step, setStep] = useState<LoginStep>("password");
  const [flow, setFlow] = useState<LoginFlow | null>(null);
  const [selectedMfaMethod, setSelectedMfaMethod] = useState<string>("");
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

  const query = useRestQuery<LoginFlow>(api, "/self-service/login/browser", {
    queryKey: ["login-flow"],
  });

  const currentFlow = flow ?? query.data ?? null;
  const availableMethods = currentFlow ? getAvailableMfaMethods(currentFlow) : [];
  const activeMfaMethod = selectedMfaMethod || availableMethods[0] || "";

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFlow?.ui?.action) return;

    setStep("submitting");
    hideToast();

    const result = await submitFlow(currentFlow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> }, { identifier: email, password }, "password");

    if (result.success && result.session) {
      setUserSession(
        result.session.identity as import("../api/types.ts").Identity,
        result.session.authenticator_assurance_level,
      );
      showToast("Login successful!", "success");
      navigate({ to: "/" });
      return;
    }

    if (result.flow && needsMfa(result.flow as LoginFlow)) {
      setFlow(result.flow as LoginFlow);
      const methods = getAvailableMfaMethods(result.flow as LoginFlow);
      setSelectedMfaMethod(methods[0] || "");
      setMfaCode("");
      setStep("mfa");
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setFlow(null);
        query.refetch();
      } else if (result.flow) {
        setFlow(result.flow as LoginFlow);
      }
      showToast(result.error, "error");
    } else {
      showToast("Unexpected response from login flow.", "error");
    }
    setStep("password");
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFlow?.ui?.action || !activeMfaMethod) return;

    setStep("submitting");
    hideToast();

    const body: Record<string, unknown> = { code: mfaCode };
    if (activeMfaMethod === "lookup_secret") {
      // Kratos expects "code" for lookup_secret as well
    }

    const result = await submitFlow(currentFlow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> }, body, activeMfaMethod);

    if (result.success && result.session) {
      setUserSession(
        result.session.identity as import("../api/types.ts").Identity,
        result.session.authenticator_assurance_level,
      );
      showToast("Login successful!", "success");
      navigate({ to: "/" });
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setFlow(null);
        query.refetch();
        setStep("password");
      } else {
        if (result.flow) {
          setFlow(result.flow as LoginFlow);
        }
        showToast(result.error, "error");
        setStep("mfa");
      }
    } else {
      showToast("Unexpected response from login flow.", "error");
      setStep("mfa");
    }
  };

  const handleBackToPassword = () => {
    setStep("password");
    setMfaCode("");
    hideToast();
  };

  const isSubmitting = step === "submitting";

  return (
    <div className={wrapper}>
      <Toast message={toast.message} variant={toast.variant} visible={toast.visible} onDismiss={hideToast} />

      <div className={card}>
        <h1 className={title}>Sunbeam SSO</h1>
        <p className={subtitle}>Sign in to your account</p>

        {query.isLoading && <p className={statusText}>Loading…</p>}
        {query.error && !currentFlow && (
          <p className={errorText}>{query.error.message}</p>
        )}

        {currentFlow && step === "password" && (
          <form onSubmit={handlePasswordSubmit} className={formStack}>
            <TextInput
              type="email"
              label="E-Mail"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              disabled={isSubmitting}
            />
            <TextInput
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              disabled={isSubmitting}
            />
            <Button variant="primary" type="submit" disabled={isSubmitting || !email || !password}>
              {isSubmitting ? "Signing in…" : "Sign in with password"}
            </Button>
          </form>
        )}

        {currentFlow && step === "mfa" && (
          <form onSubmit={handleMfaSubmit} className={formStack}>
            {availableMethods.length > 1 && (
              <div className={methodPicker}>
                {availableMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={method === activeMfaMethod ? methodButtonSelected : methodButton}
                    onClick={() => {
                      setSelectedMfaMethod(method);
                      setMfaCode("");
                    }}
                  >
                    {method === "totp" ? "Authenticator app" : "Backup code"}
                  </button>
                ))}
              </div>
            )}
            <TextInput
              type="text"
              label={activeMfaMethod === "totp" ? "6-digit code" : "Backup code"}
              placeholder={activeMfaMethod === "totp" ? "000000" : "backup-code"}
              value={mfaCode}
              onChange={setMfaCode}
              disabled={isSubmitting}
            />
            <Button variant="primary" type="submit" disabled={isSubmitting || !mfaCode}>
              {isSubmitting ? "Verifying…" : "Verify"}
            </Button>
            <Button variant="ghost" type="button" disabled={isSubmitting} onClick={handleBackToPassword}>
              ← Back to password
            </Button>
          </form>
        )}

        <div className={footer}>
          <Link to="/registration" className={link}>Create account</Link>
          <span style={{ color: "text.muted" }}>·</span>
          <Link to="/recovery" className={link}>Forgot password?</Link>
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

const methodPicker = css({
  display: "flex",
  gap: "8px",
});

const methodButton = css({
  flex: 1,
  padding: "8px 12px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
  color: "text.primary",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { borderColor: "border.default" },
});

const methodButtonSelected = css({
  flex: 1,
  padding: "8px 12px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "accent",
  backgroundColor: "bg.accent.subtle",
  color: "text.primary",
  fontSize: "sm",
  cursor: "pointer",
});
