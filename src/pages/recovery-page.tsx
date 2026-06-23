import { useCallback, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useAuth, useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, Callout, Spinner, TextInput } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { submitFlow } from "../api/flows.ts";
import { getFlowError } from "../api/types.ts";
import type { RecoveryFlow } from "../api/types.ts";

type RecoveryStep = "email" | "code" | "password" | "submitting" | "success";

function hasPasswordNode(flow: RecoveryFlow | null): boolean {
  return flow?.ui?.nodes?.some((n) => n.attributes.name === "password") ?? false;
}

function hasCodeNode(flow: RecoveryFlow | null): boolean {
  return flow?.ui?.nodes?.some((n) => n.attributes.name === "code") ?? false;
}

export function RecoveryPage() {
  const search = useSearch({ from: "/recovery" }) as {
    flow?: string;
    token?: string;
  };
  const flowId = search.flow;

  const [step, setStep] = useState<RecoveryStep>("email");
  const [recoveryFlow, setRecoveryFlow] = useState<RecoveryFlow | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { isAuthenticated, status } = useAuth();

  const recoveryQuery = useRestQuery<RecoveryFlow>(
    api,
    flowId
      ? `/self-service/recovery/flows?id=${flowId}`
      : "/self-service/recovery/flows",
    { queryKey: flowId ? ["recovery-flow", flowId] : ["recovery-flow"], enabled: !!flowId },
  );

  // Browser flows must be started by redirecting to Kratos so it can set the
  // anti-CSRF cookie before the SPA submits the form. Skip the redirect when
  // the user is already authenticated or arrived via a recovery link.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "initializing") return;
    if (!flowId && !search.token && !isAuthenticated) {
      window.location.href = "/api/self-service/recovery/browser";
    }
  }, [flowId, search.token, isAuthenticated, status]);

  const currentFlow = recoveryFlow ?? recoveryQuery.data ?? null;
  const flowError = currentFlow ? getFlowError(currentFlow.ui) : undefined;
  const isSubmitting = step === "submitting";

  // If a recovery link brought the user here with a token, submit it immediately
  // so Kratos advances to the password-reset step.
  useEffect(() => {
    if (!search.token || !currentFlow?.ui?.action) return;

    setStep("submitting");
    setFormError(null);

    submitFlow(
      currentFlow as RecoveryFlow & { ui: NonNullable<RecoveryFlow["ui"]> },
      { token: search.token },
      "link",
    )
      .then((result) => {
        if (result.success && result.flow) {
          const updatedFlow = result.flow as RecoveryFlow;
          setRecoveryFlow(updatedFlow);
          if (hasPasswordNode(updatedFlow)) {
            setStep("password");
          } else {
            setStep("success");
          }
          return;
        }
        if (result.error) {
          setFormError(result.error);
          setStep("email");
        } else {
          setStep("success");
        }
      })
      .catch(() => {
        setFormError("Failed to validate recovery link.");
        setStep("email");
      });
  }, [search.token, currentFlow?.ui?.action]);

  // Determine the initial step from the fetched flow when not using a link.
  // Only run while we are still on the email step so submission handlers can
  // advance the user to code/password/success without being overwritten.
  useEffect(() => {
    if (search.token) return;
    if (!currentFlow) return;
    if (step !== "email") return;

    if (hasPasswordNode(currentFlow)) {
      setStep("password");
    } else if (hasCodeNode(currentFlow)) {
      setStep("code");
    }
  }, [currentFlow, search.token, step]);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentFlow?.ui?.action) return;

      setStep("submitting");
      setFormError(null);

      const result = await submitFlow(
        currentFlow as RecoveryFlow & { ui: NonNullable<RecoveryFlow["ui"]> },
        { email },
        "code",
      );

      if (result.success && result.flow) {
        const updatedFlow = result.flow as RecoveryFlow;
        setRecoveryFlow(updatedFlow);
        if (hasCodeNode(updatedFlow)) {
          setStep("code");
        } else {
          setStep("success");
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
        setFormError(result.error);
      } else {
        setFormError("Unexpected response from recovery flow.");
      }
      setStep("email");
    },
    [currentFlow, email, recoveryQuery],
  );

  const handleCodeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentFlow?.ui?.action) return;

      setStep("submitting");
      setFormError(null);

      const result = await submitFlow(
        currentFlow as RecoveryFlow & { ui: NonNullable<RecoveryFlow["ui"]> },
        { code },
        "code",
      );

      if (result.success && result.flow) {
        const updatedFlow = result.flow as RecoveryFlow;
        setRecoveryFlow(updatedFlow);
        if (hasPasswordNode(updatedFlow)) {
          setStep("password");
        } else {
          setStep("success");
        }
        return;
      }

      if (result.error) {
        if (result.error === "This session expired. Please try again.") {
          setRecoveryFlow(null);
          recoveryQuery.refetch();
          setStep("email");
        } else {
          if (result.flow) {
            setRecoveryFlow(result.flow as RecoveryFlow);
          }
          setFormError(result.error);
          setStep("code");
        }
      } else {
        setFormError("Unexpected response from recovery flow.");
        setStep("code");
      }
    },
    [currentFlow, code, recoveryQuery],
  );

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentFlow?.ui?.action) return;

      setStep("submitting");
      setFormError(null);

      const result = await submitFlow(
        currentFlow as RecoveryFlow & { ui: NonNullable<RecoveryFlow["ui"]> },
        { password },
        "password",
      );

      if (result.success || result.redirect_browser_to) {
        setStep("success");
        return;
      }

      if (result.error) {
        if (result.error === "This session expired. Please try again.") {
          setRecoveryFlow(null);
          recoveryQuery.refetch();
          setStep("email");
        } else {
          if (result.flow) {
            setRecoveryFlow(result.flow as RecoveryFlow);
          }
          setFormError(result.error);
          setStep("password");
        }
      } else {
        setFormError("Unexpected response from recovery flow.");
        setStep("password");
      }
    },
    [currentFlow, password, recoveryQuery],
  );

  if (recoveryQuery.isLoading && !currentFlow) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <div className={css({ display: "flex", justifyContent: "center", padding: "32px" })}>
            <Spinner size="md" />
          </div>
        </div>
      </div>
    );
  }

  if (!flowId && !search.token && status !== "initializing" && !isAuthenticated) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <h1 className={title}>Reset your password</h1>
          <p className={subtitle}>Redirecting…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !flowId && !search.token) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <h1 className={title}>Already signed in</h1>
          <p className={subtitle}>
            You are already signed in. Sign out if you need to recover a different account.
          </p>
          <a href="/" className={primaryLink}>
            Continue
          </a>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className={wrapper}>
        <div className={card}>
          <h1 className={title}>Password reset</h1>
          <p className={subtitle}>
            Your password has been updated. You can now sign in with your new password.
          </p>
          <a href="/login" className={primaryLink}>
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <div className={card}>
        <h1 className={title}>Reset your password</h1>
        <p className={subtitle}>
          {step === "email" && "Enter your email address and we'll send you a recovery code."}
          {step === "code" && "Enter the recovery code sent to your email."}
          {step === "password" && "Choose a new password for your account."}
        </p>

        {(formError || flowError) && (
          <Callout variant="warning">{formError ?? flowError}</Callout>
        )}

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className={formStack}>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting || !email}
            >
              {isSubmitting ? "Sending…" : "Send Recovery Code"}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleCodeSubmit} className={formStack}>
            <TextInput
              label="Recovery code"
              type="text"
              value={code}
              onChange={setCode}
              placeholder="000000"
              disabled={isSubmitting}
            />
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting || !code}
            >
              {isSubmitting ? "Verifying…" : "Verify Code"}
            </Button>
            <button
              type="button"
              className={backLink}
              onClick={() => setStep("email")}
            >
              ← Use a different email
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className={formStack}>
            <TextInput
              label="New password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Enter a strong password"
              disabled={isSubmitting}
            />
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting || !password}
            >
              {isSubmitting ? "Updating…" : "Reset Password"}
            </Button>
          </form>
        )}

        <div className={links}>
          <a href="/login" className={backLink}>
            ← Back to sign in
          </a>
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
  backgroundColor: "bg.card",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
  textAlign: "center",
});

const subtitle = css({
  fontSize: "sm",
  color: "text.secondary",
  textAlign: "center",
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

const primaryLink = css({
  display: "block",
  width: "100%",
  padding: "12px 16px",
  borderRadius: "md",
  border: "none",
  backgroundColor: "accent",
  color: "white",
  fontSize: "16px",
  fontWeight: "button",
  fontFamily: "body",
  textAlign: "center",
  textDecoration: "none",
  cursor: "pointer",
  _hover: { backgroundColor: "sunbeam.flame" },
});
