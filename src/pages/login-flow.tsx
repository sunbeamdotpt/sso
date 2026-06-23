import { useCallback, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useAuth, useRestQuery } from "@sunbeam/g2v";
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
import { MarkGithubIcon } from "@primer/octicons-react";
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

function getProviderName(node: {
  meta?: { label?: { text?: string } };
  attributes: { value?: unknown };
}): string {
  const label = node.meta?.label?.text ?? "";
  const clean = label.replace(/^sign\s*in\s*with\s*/i, "").trim();
  return clean || String(node.attributes.value);
}

function OAuthIcon({ providerId }: { providerId: string }): React.ReactNode {
  const id = providerId.toLowerCase();
  if (id === "discord") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <title>Discord</title>
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
      </svg>
    );
  }
  if (id === "github") {
    return <MarkGithubIcon size={18} aria-hidden="true" />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function getOAuthProviders(
  flow: LoginFlow | null,
): Array<{ name: string; icon: React.ReactNode; onClick: () => void }> {
  if (!flow?.ui) return [];
  return flow.ui.nodes
    .filter((n) => n.group === "oidc" && n.attributes.name === "provider")
    .map((n) => ({
      name: getProviderName(n),
      icon: <OAuthIcon providerId={String(n.attributes.value)} />,
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

  const { isAuthenticated } = useAuth();

  const loginQuery = useRestQuery<LoginFlow>(
    api,
    flowId
      ? `/self-service/login/flows?id=${flowId}`
      : "/self-service/login/flows",
    { queryKey: flowId ? ["login-flow", flowId] : ["login-flow"], enabled: !!flowId },
  );

  // Browser flows must be started by redirecting to Kratos so it can set the
  // anti-CSRF cookie before the SPA submits the form. Use refresh=true when the
  // user already has a session so Kratos doesn't bounce them away.
  useEffect(() => {
    if (!flowId && typeof window !== "undefined") {
      const url = isAuthenticated
        ? "/api/self-service/login/browser?refresh=true"
        : "/api/self-service/login/browser";
      window.location.href = url;
    }
  }, [flowId, isAuthenticated]);

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
                      variant="primary"
                      type="button"
                      className={oauthButton}
                      onClick={provider.onClick}
                      disabled={isLoginSubmitting}
                    >
                      <span className={oauthIcon}>{provider.icon}</span>
                      {provider.name}
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

const oauthButton = css({
  width: "70%",
  alignSelf: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
});

const oauthIcon = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "20px",
  height: "20px",
  flexShrink: 0,
});

const footerText = css({
  fontSize: "13px",
  fontFamily: "body",
  color: "text.secondary",
  textAlign: "center",
});
