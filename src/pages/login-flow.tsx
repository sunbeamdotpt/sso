import { useCallback, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import {
  Button,
  Callout,
  LoginForm,
  TextInput,
  Toast,
  TwoFactorForm,
} from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { setUserSession } from "../providers/auth.tsx";
import { getAvailableMfaMethods, needsMfa, submitFlow } from "../api/flows.ts";
import { storeRememberMePreference } from "../utils/remember-me.ts";
import { getSafeReturnUrl } from "../utils/redirect.ts";
import type { LoginFlow, RecoveryFlow } from "../api/types.ts";

type PageMode =
  | { type: "login"; step: "password" | "mfa" | "submitting" }
  | { type: "recovery"; step: "email" | "code" | "submitting" | "success" };

function getKratosError(
  flow: {
    ui?: {
      messages?: { type: string; text: string }[];
      nodes?: { messages?: { type: string; text: string }[] }[];
    };
  },
): string | undefined {
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

function getOAuthProviders(
  flow: LoginFlow | null,
): Array<{ name: string; icon: string; onClick: () => void }> {
  if (!flow?.ui) return [];
  return flow.ui.nodes
    .filter((n) => n.group === "oidc" && n.attributes.name === "provider")
    .map((n) => ({
      name: n.meta?.label?.text ?? String(n.attributes.value),
      icon: String(n.attributes.value),
      onClick: () => {
        submitFlow(flow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> }, {
          provider: n.attributes.value,
        }, "oidc");
      },
    }));
}

export function LoginFlowPage() {
  const search = useSearch({ from: "/login" }) as { flow?: string };
  const flowId = search.flow;

  const [mode, setMode] = useState<PageMode>({
    type: "login",
    step: "password",
  });
  const [loginFlow, setLoginFlow] = useState<LoginFlow | null>(null);
  const [recoveryFlow, setRecoveryFlow] = useState<RecoveryFlow | null>(null);
  const [selectedMfaMethod, setSelectedMfaMethod] = useState<string>("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [toast, setToast] = useState<
    { message: string; variant: "success" | "error" | "info"; visible: boolean }
  >({
    message: "",
    variant: "info",
    visible: false,
  });

  const showToast = useCallback(
    (message: string, variant: "success" | "error" | "info" = "info") => {
      setToast({ message, variant, visible: true });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const loginQuery = useRestQuery<LoginFlow>(
    api,
    flowId
      ? `/self-service/login/flows?id=${flowId}`
      : "/self-service/login/browser",
    { queryKey: flowId ? ["login-flow", flowId] : ["login-flow"] },
  );

  const recoveryQuery = useRestQuery<RecoveryFlow>(
    api,
    "/self-service/recovery/browser",
    { queryKey: ["recovery-flow"] },
  );

  const currentLoginFlow = loginFlow ?? loginQuery.data ?? null;
  const currentRecoveryFlow = recoveryFlow ?? recoveryQuery.data ?? null;
  const availableMethods = currentLoginFlow
    ? getAvailableMfaMethods(currentLoginFlow)
    : [];
  const activeMfaMethod = selectedMfaMethod || availableMethods[0] || "";
  const loginError = currentLoginFlow
    ? getKratosError(currentLoginFlow)
    : undefined;
  const recoveryError = currentRecoveryFlow
    ? getKratosError(currentRecoveryFlow)
    : undefined;
  const oauthProviders = getOAuthProviders(currentLoginFlow);

  const isLoginSubmitting = mode.type === "login" && mode.step === "submitting";
  const isRecoverySubmitting = mode.type === "recovery" &&
    mode.step === "submitting";

  const handleLoginSubmit = async (
    _username: string,
    password: string,
    _remember: boolean,
  ) => {
    if (!currentLoginFlow?.ui?.action) return;

    setMode({ type: "login", step: "submitting" });
    hideToast();

    const result = await submitFlow(
      currentLoginFlow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> },
      { identifier: _username, password, remember: _remember },
      "password",
    );

    if (result.success && result.session) {
      storeRememberMePreference(_remember);
      setUserSession(
        result.session.identity as import("../api/types.ts").Identity,
        result.session.authenticator_assurance_level,
      );
      const returnTo = getSafeReturnUrl(currentLoginFlow.return_to, "/");
      if (returnTo !== "/") {
        globalThis.location.href = returnTo;
      } else {
        showToast("Login successful!", "success");
        setMode({ type: "login", step: "password" });
      }
      return;
    }

    if (result.flow && needsMfa(result.flow as LoginFlow)) {
      setLoginFlow(result.flow as LoginFlow);
      const methods = getAvailableMfaMethods(result.flow as LoginFlow);
      setSelectedMfaMethod(methods[0] || "");
      setMode({ type: "login", step: "mfa" });
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setLoginFlow(null);
        loginQuery.refetch();
      } else if (result.flow) {
        setLoginFlow(result.flow as LoginFlow);
      }
      showToast(result.error, "error");
    } else {
      showToast("Unexpected response from login flow.", "error");
    }
    setMode({ type: "login", step: "password" });
  };

  const handleMfaSubmit = async (code: string) => {
    if (!currentLoginFlow?.ui?.action || !activeMfaMethod) return;

    setMode({ type: "login", step: "submitting" });
    hideToast();

    const body: Record<string, unknown> = { code };
    const result = await submitFlow(
      currentLoginFlow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> },
      body,
      activeMfaMethod,
    );

    if (result.success && result.session) {
      setUserSession(
        result.session.identity as import("../api/types.ts").Identity,
        result.session.authenticator_assurance_level,
      );
      const returnTo = getSafeReturnUrl(currentLoginFlow.return_to, "/");
      if (returnTo !== "/") {
        globalThis.location.href = returnTo;
      } else {
        showToast("Login successful!", "success");
        setMode({ type: "login", step: "password" });
      }
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setLoginFlow(null);
        loginQuery.refetch();
        setMode({ type: "login", step: "password" });
      } else {
        if (result.flow) {
          setLoginFlow(result.flow as LoginFlow);
        }
        showToast(result.error, "error");
        setMode({ type: "login", step: "mfa" });
      }
    } else {
      showToast("Unexpected response from login flow.", "error");
      setMode({ type: "login", step: "mfa" });
    }
  };

  const handleScratchCode = () => {
    setSelectedMfaMethod("lookup_secret");
  };

  const handleBackToPassword = () => {
    setMode({ type: "login", step: "password" });
    setSelectedMfaMethod("");
    hideToast();
  };

  const handleRecoveryEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecoveryFlow?.ui?.action) return;

    setMode({ type: "recovery", step: "submitting" });
    hideToast();

    const result = await submitFlow(
      currentRecoveryFlow as RecoveryFlow & {
        ui: NonNullable<RecoveryFlow["ui"]>;
      },
      { email: recoveryEmail },
      "code",
    );

    if (result.success && result.flow) {
      const updatedFlow = result.flow as RecoveryFlow;
      setRecoveryFlow(updatedFlow);
      const flowError = getKratosError(updatedFlow);
      if (flowError) {
        showToast(flowError, "error");
        setMode({ type: "recovery", step: "email" });
        return;
      }
      const hasCodeNode = updatedFlow.ui?.nodes?.some(
        (n) => n.attributes.name === "code" || n.group === "code",
      );
      if (hasCodeNode) {
        setMode({ type: "recovery", step: "code" });
      } else {
        showToast("Recovery email sent. Check your inbox.", "success");
        setMode({ type: "recovery", step: "email" });
      }
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setRecoveryFlow(null);
        recoveryQuery.refetch();
      } else if (result.flow) {
        setRecoveryFlow(result.flow as RecoveryFlow);
      }
      showToast(result.error, "error");
    } else {
      showToast("Unexpected response from recovery flow.", "error");
    }
    setMode({ type: "recovery", step: "email" });
  };

  const handleRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecoveryFlow?.ui?.action) return;

    setMode({ type: "recovery", step: "submitting" });
    hideToast();

    const result = await submitFlow(
      currentRecoveryFlow as RecoveryFlow & {
        ui: NonNullable<RecoveryFlow["ui"]>;
      },
      { code: recoveryCode },
      "code",
    );

    if (result.success || result.redirect_browser_to) {
      showToast("Password reset successful!", "success");
      setMode({ type: "recovery", step: "success" });
      return;
    }

    if (result.error) {
      if (result.error === "This session expired. Please try again.") {
        setRecoveryFlow(null);
        recoveryQuery.refetch();
        setMode({ type: "recovery", step: "email" });
      } else {
        if (result.flow) {
          setRecoveryFlow(result.flow as RecoveryFlow);
        }
        showToast(result.error, "error");
        setMode({ type: "recovery", step: "code" });
      }
    } else {
      showToast("Unexpected response from recovery flow.", "error");
      setMode({ type: "recovery", step: "code" });
    }
  };

  const switchToRecovery = () => {
    setMode({ type: "recovery", step: "email" });
    setRecoveryEmail("");
    setRecoveryCode("");
    hideToast();
  };

  const switchToLogin = () => {
    setMode({ type: "login", step: "password" });
    setRecoveryEmail("");
    setRecoveryCode("");
    hideToast();
  };

  return (
    <div className={wrapper}>
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={hideToast}
      />

      {loginQuery.isLoading && mode.type === "login" && !currentLoginFlow && (
        <p className={statusText}>Loading…</p>
      )}
      {loginQuery.error && !currentLoginFlow && mode.type === "login" && (
        <p className={errorText}>{loginQuery.error.message}</p>
      )}

      {mode.type === "login" && currentLoginFlow && mode.step === "password" &&
        (
          <>
            <LoginForm
              onSubmit={handleLoginSubmit}
              oauthProviders={oauthProviders.length > 0
                ? oauthProviders
                : undefined}
              error={loginError}
              loading={isLoginSubmitting}
            />
            <div className={links}>
              <button
                type="button"
                className={textLink}
                onClick={switchToRecovery}
              >
                Forgot password?
              </button>
            </div>
          </>
        )}

      {mode.type === "login" && currentLoginFlow && mode.step === "mfa" && (
        <div className={mfaWrapper}>
          {availableMethods.length > 1 && (
            <div className={methodPicker}>
              {availableMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={method === activeMfaMethod
                    ? methodButtonSelected
                    : methodButton}
                  onClick={() => setSelectedMfaMethod(method)}
                >
                  {method === "totp" ? "Authenticator app" : "Backup code"}
                </button>
              ))}
            </div>
          )}
          <TwoFactorForm
            onSubmit={handleMfaSubmit}
            onScratchCode={activeMfaMethod === "totp"
              ? handleScratchCode
              : handleBackToPassword}
            error={loginError}
            loading={isLoginSubmitting}
          />
          <button
            type="button"
            className={backLink}
            onClick={handleBackToPassword}
          >
            ← Back to sign in
          </button>
        </div>
      )}

      {mode.type === "recovery" && mode.step === "email" && (
        <div className={card}>
          <h2 className={title}>Forgot Password</h2>
          {recoveryError && (
            <Callout variant="warning">{recoveryError}</Callout>
          )}
          <form onSubmit={handleRecoveryEmailSubmit} className={formStack}>
            <p className={subtitle}>
              Enter your email address and we&apos;ll send you a code to reset
              your password.
            </p>
            <TextInput
              label="Email"
              type="email"
              value={recoveryEmail}
              onChange={setRecoveryEmail}
              placeholder="you@example.com"
              disabled={isRecoverySubmitting}
            />
            <Button variant="primary" type="submit" className={fullWidth}>
              {isRecoverySubmitting ? "Loading…" : "Send Reset Code"}
            </Button>
          </form>
          <div className={links}>
            <button type="button" className={textLink} onClick={switchToLogin}>
              Back to sign in
            </button>
          </div>
        </div>
      )}

      {mode.type === "recovery" && mode.step === "code" && (
        <div className={card}>
          <h2 className={title}>Enter Recovery Code</h2>
          <p className={subtitle}>Enter the code sent to your email.</p>
          {recoveryError && <p className={errorText}>{recoveryError}</p>}
          <form onSubmit={handleRecoveryCodeSubmit} className={formStack}>
            <input
              type="text"
              className={codeInput}
              placeholder="000000"
              value={recoveryCode}
              onChange={(e) =>
                setRecoveryCode(e.target.value)}
              disabled={isRecoverySubmitting}
              autoFocus
            />
            <button
              type="submit"
              className={submitButton}
              disabled={isRecoverySubmitting || !recoveryCode}
            >
              {isRecoverySubmitting ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              className={backLink}
              onClick={() => setMode({ type: "recovery", step: "email" })}
            >
              ← Use a different email
            </button>
          </form>
        </div>
      )}

      {mode.type === "recovery" && mode.step === "success" && (
        <div className={card}>
          <h2 className={title}>Success</h2>
          <p className={subtitle}>
            Your password has been reset. You can now sign in with your new
            password.
          </p>
          <button
            type="button"
            className={submitButton}
            onClick={switchToLogin}
          >
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

const card = css({
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

const links = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  marginTop: "8px",
});

const textLink = css({
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

const backLink = css({
  composes: textLink,
});

const fullWidth = css({
  width: "100%",
  justifyContent: "center",
});

const mfaWrapper = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  width: "100%",
  maxWidth: "400px",
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
  backgroundColor: "bg.card",
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
  backgroundColor: "bg.card",
  color: "text.primary",
  fontSize: "sm",
  cursor: "pointer",
});
