import { useState, useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { LoginForm, TwoFactorForm, Toast } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { setUserSession } from "../providers/auth.tsx";
import { submitFlow, needsMfa, getAvailableMfaMethods } from "../api/flows.ts";
import { storeRememberMePreference } from "../utils/remember-me.ts";
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

function getOAuthProviders(flow: LoginFlow | null): Array<{ name: string; icon: string; onClick: () => void }> {
  if (!flow?.ui) return [];
  return flow.ui.nodes
    .filter((n) => n.group === "oidc" && n.attributes.name === "provider")
    .map((n) => ({
      name: n.meta?.label?.text ?? String(n.attributes.value),
      icon: String(n.attributes.value),
      onClick: () => {
        submitFlow(flow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> }, { provider: n.attributes.value }, "oidc");
      },
    }));
}

export function LoginFlowPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" }) as { flow?: string };
  const flowId = search.flow;
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

  const query = useRestQuery<LoginFlow>(api, flowId ? `/self-service/login/flows?id=${flowId}` : "/self-service/login/browser", {
    queryKey: flowId ? ["login-flow", flowId] : ["login-flow"],
  });

  const currentFlow = flow ?? query.data ?? null;
  const availableMethods = currentFlow ? getAvailableMfaMethods(currentFlow) : [];
  const activeMfaMethod = selectedMfaMethod || availableMethods[0] || "";
  const error = currentFlow ? getKratosError(currentFlow) : undefined;
  const oauthProviders = getOAuthProviders(currentFlow);

  const handleLoginSubmit = async (_username: string, password: string, _remember: boolean) => {
    if (!currentFlow?.ui?.action) return;

    setStep("submitting");
    hideToast();

    const result = await submitFlow(
      currentFlow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> },
      { identifier: _username, password, remember: _remember },
      "password",
    );

    if (result.success && result.session) {
      storeRememberMePreference(_remember);
      await setUserSession(
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

  const handleMfaSubmit = async (code: string) => {
    if (!currentFlow?.ui?.action || !activeMfaMethod) return;

    setStep("submitting");
    hideToast();

    const body: Record<string, unknown> = { code };
    const result = await submitFlow(
      currentFlow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> },
      body,
      activeMfaMethod,
    );

    if (result.success && result.session) {
      await setUserSession(
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

  const handleScratchCode = () => {
    setSelectedMfaMethod("lookup_secret");
  };

  const handleBackToPassword = () => {
    setStep("password");
    setSelectedMfaMethod("");
    hideToast();
  };

  const isSubmitting = step === "submitting";

  return (
    <div className={wrapper}>
      <Toast message={toast.message} variant={toast.variant} visible={toast.visible} onDismiss={hideToast} />

      {query.isLoading && <p className={statusText}>Loading…</p>}
      {query.error && !currentFlow && <p className={errorText}>{query.error.message}</p>}

      {currentFlow && step === "password" && (
        <LoginForm
          onSubmit={handleLoginSubmit}
          oauthProviders={oauthProviders.length > 0 ? oauthProviders : undefined}
          error={error}
          loading={isSubmitting}
        />
      )}

      {currentFlow && step === "mfa" && (
        <div className={mfaWrapper}>
          {availableMethods.length > 1 && (
            <div className={methodPicker}>
              {availableMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={method === activeMfaMethod ? methodButtonSelected : methodButton}
                  onClick={() => setSelectedMfaMethod(method)}
                >
                  {method === "totp" ? "Authenticator app" : "Backup code"}
                </button>
              ))}
            </div>
          )}
          <TwoFactorForm
            onSubmit={handleMfaSubmit}
            onScratchCode={activeMfaMethod === "totp" ? handleScratchCode : handleBackToPassword}
            error={error}
            loading={isSubmitting}
          />
          <button type="button" className={backLink} onClick={handleBackToPassword}>
            ← Back to sign in
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
