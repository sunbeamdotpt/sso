import { useCallback, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, Callout, Spinner, TextInput } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { submitFlow } from "../api/flows.ts";
import { getFlowError } from "../api/types.ts";
import {
  clearRedirectHistory,
  detectRedirectLoop,
} from "../utils/redirect-guard.ts";
import type { SettingsFlow } from "../api/types.ts";

export function SettingsPage() {
  const search = useSearch({ from: "/recovery/reset" }) as {
    flow?: string;
  };
  const flowId = search.flow;

  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  const settingsQuery = useRestQuery<SettingsFlow>(
    api,
    flowId
      ? `/self-service/settings/flows?id=${flowId}`
      : "/self-service/settings/flows",
    { queryKey: flowId ? ["settings-flow", flowId] : ["settings-flow"], enabled: !!flowId },
  );

  // A successfully loaded flow means we are no longer in the redirect loop.
  useEffect(() => {
    if (flowId && typeof window !== "undefined") {
      clearRedirectHistory();
    }
  }, [flowId]);

  // Without a flow ID we cannot render a settings form. Send the user to the
  // login page so they can start a recovery flow if needed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!flowId) {
      const target = "/login";
      if (detectRedirectLoop(target)) {
        setRedirectError(
          "We could not load your settings session. Please try again.",
        );
        return;
      }
      globalThis.location.href = target;
    }
  }, [flowId]);

  const currentFlow = settingsQuery.data ?? null;
  const flowError = currentFlow ? getFlowError(currentFlow.ui) : undefined;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentFlow?.ui?.action) return;

      setFormError(null);

      const result = await submitFlow(
        currentFlow as SettingsFlow & { ui: NonNullable<SettingsFlow["ui"]> },
        { password },
        "password",
      );

      if (result.success || result.redirect_browser_to) {
        setSuccess(true);
        return;
      }

      if (result.error) {
        if (result.error === "This session expired. Please try again.") {
          settingsQuery.refetch();
        }
        setFormError(result.error);
      } else {
        setFormError("Unexpected response from settings flow.");
      }
    },
    [currentFlow, password, settingsQuery],
  );

  if (redirectError) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <h1 className={title}>Settings</h1>
          <Callout variant="warning">
            {redirectError} Try reloading the page or contact support if the
            problem persists.
          </Callout>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <h1 className={title}>Password updated</h1>
          <p className={subtitle}>
            Your password has been updated. You can now sign in with your new
            password.
          </p>
          <a href="/login" className={primaryLink}>
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (settingsQuery.isLoading || !flowId) {
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

  return (
    <div className={wrapper}>
      <div className={card}>
        <h1 className={title}>Set a new password</h1>
        <p className={subtitle}>
          Choose a new password for your account.
        </p>

        {(formError || flowError) && (
          <Callout variant="warning">{formError ?? flowError}</Callout>
        )}

        <form onSubmit={handleSubmit} className={formStack}>
          <TextInput
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Enter a strong password"
            disabled={settingsQuery.isFetching}
          />
          <Button
            variant="primary"
            type="submit"
            className={primaryButton}
            disabled={settingsQuery.isFetching || !password}
          >
            {settingsQuery.isFetching ? "Updating…" : "Update Password"}
          </Button>
        </form>

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

const primaryButton = css({
  width: "100%",
  justifyContent: "center",
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
