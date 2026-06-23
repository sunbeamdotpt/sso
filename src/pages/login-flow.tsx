import { useCallback, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import {
  Button,
  Callout,
  TextInput,
  Toast,
  TwoFactorForm,
} from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { setUserSession } from "../providers/auth.tsx";
import { getAvailableMfaMethods, needsMfa, submitFlow } from "../api/flows.ts";
import { storeRememberMePreference } from "../utils/remember-me.ts";
import { getSafeReturnUrl } from "../utils/redirect.ts";
import type { LoginFlow } from "../api/types.ts";

type PageMode = { type: "login"; step: "password" | "mfa" | "submitting" };

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

function getMaterialIcon(providerId: string): string {
  switch (providerId.toLowerCase()) {
    case "discord":
      return "chat";
    case "github":
      return "code";
    case "google":
      return "account_circle";
    case "microsoft":
    case "azuread":
      return "account_circle";
    case "apple":
      return "phone_iphone";
    default:
      return "login";
  }
}

function getOAuthProviders(
  flow: LoginFlow | null,
): Array<{ name: string; icon: string; onClick: () => void }> {
  if (!flow?.ui) return [];
  return flow.ui.nodes
    .filter((n) => n.group === "oidc" && n.attributes.name === "provider")
    .map((n) => ({
      name: n.meta?.label?.text ?? String(n.attributes.value),
      icon: getMaterialIcon(String(n.attributes.value)),
      onClick: () => {
        submitFlow(flow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> }, {
          provider: n.attributes.value,
        }, "oidc");
      },
    }));
}

function isRegistrationDisabled(): boolean {
  return import.meta.env.VITE_REGISTRATION_DISABLED === "true";
}

export function LoginFlowPage() {
  const search = useSearch({ from: "/login" }) as { flow?: string };
  const flowId = search.flow;

  const [mode, setMode] = useState<PageMode>({
    type: "login",
    step: "password",
  });
  const [loginFlow, setLoginFlow] = useState<LoginFlow | null>(null);
  const [selectedMfaMethod, setSelectedMfaMethod] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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

  const currentLoginFlow = loginFlow ?? loginQuery.data ?? null;
  const availableMethods = currentLoginFlow
    ? getAvailableMfaMethods(currentLoginFlow)
    : [];
  const activeMfaMethod = selectedMfaMethod || availableMethods[0] || "";
  const loginError = currentLoginFlow
    ? getKratosError(currentLoginFlow)
    : undefined;
  const oauthProviders = getOAuthProviders(currentLoginFlow);

  const isLoginSubmitting = mode.type === "login" && mode.step === "submitting";

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLoginFlow?.ui?.action) return;

    setMode({ type: "login", step: "submitting" });
    hideToast();

    const result = await submitFlow(
      currentLoginFlow as LoginFlow & { ui: NonNullable<LoginFlow["ui"]> },
      { identifier: email, password, remember: rememberMe },
      "password",
    );

    if (result.success && result.session) {
      storeRememberMePreference(rememberMe);
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
          <div className={card}>
            <h1 className={title}>Sign In</h1>
            {loginError && <Callout variant="warning">{loginError}</Callout>}

            <form onSubmit={handleLoginSubmit} className={formStack}>
              <TextInput
                label="Username or Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                disabled={isLoginSubmitting}
              />
              <TextInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Enter password"
                disabled={isLoginSubmitting}
              />
              <label className={checkboxRow}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoginSubmitting}
                />
                <span>Remember me</span>
              </label>
              <Button
                variant="primary"
                type="submit"
                className={narrowButton}
                disabled={isLoginSubmitting || !email || !password}
              >
                {isLoginSubmitting ? "Signing in…" : "SIGN IN"}
              </Button>
            </form>

            {oauthProviders.length > 0 && (
              <>
                <div className={divider}>
                  <span>OR</span>
                </div>
                <div className={oauthStack}>
                  {oauthProviders.map((provider) => (
                    <Button
                      key={provider.name}
                      variant="ghost"
                      type="button"
                      className={narrowButton}
                      onClick={provider.onClick}
                      disabled={isLoginSubmitting}
                    >
                      <span className={oauthIcon}>{provider.icon}</span>
                      Sign in with {provider.name}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <div className={links}>
              {!isRegistrationDisabled() && (
                <span className={footerText}>
                  Don&apos;t have an account?{" "}
                  <a href="/registration" className={textLink}>
                    Sign up
                  </a>
                </span>
              )}
              <a href="/recovery" className={textLink}>
                Forgot your password?
              </a>
            </div>
          </div>
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

const checkboxRow = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "sm",
  color: "text.primary",
  cursor: "pointer",
  "& input": {
    width: "16px",
    height: "16px",
    accentColor: "accent",
    cursor: "pointer",
  },
});

const narrowButton = css({
  width: "70%",
  alignSelf: "center",
  justifyContent: "center",
});

const divider = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  color: "text.muted",
  fontSize: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  width: "70%",
  alignSelf: "center",
  "&::before, &::after": {
    content: '""',
    flex: 1,
    height: "1px",
    backgroundColor: "border.subtle",
  },
});

const oauthStack = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  width: "100%",
  alignItems: "center",
});

const oauthIcon = css({
  fontFamily: "'Material Symbols Outlined', sans-serif",
  fontSize: "18px",
  lineHeight: 1,
  fontVariationSettings: "'wght' 400",
});

const footerText = css({
  fontSize: "13px",
  fontFamily: "body",
  color: "text.secondary",
  textAlign: "center",
});
