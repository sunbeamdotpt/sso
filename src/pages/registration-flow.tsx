import { useState, useCallback } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, TextInput, Toast } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { setUserSession } from "../providers/auth.tsx";
import type { RegistrationFlow, UINode } from "../api/types.ts";

function getActionPath(action: string): string {
  try {
    const url = new URL(action);
    return url.pathname + url.search;
  } catch {
    return action;
  }
}

function findNode(flow: RegistrationFlow, name: string): UINode | undefined {
  return flow.ui?.nodes.find((n) => n.attributes.name === name);
}

function getKratosError(flow: RegistrationFlow): string | undefined {
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

export function RegistrationFlowPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flow, setFlow] = useState<RegistrationFlow | null>(null);
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

  const query = useRestQuery<RegistrationFlow>(api, "/self-service/registration/browser", {
    queryKey: ["registration-flow"],
  });

  const currentFlow = flow ?? query.data ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFlow?.ui?.action) return;

    setSubmitting(true);
    hideToast();

    try {
      const path = getActionPath(currentFlow.ui.action);
      const body = {
        method: "password",
        traits: { email },
        password,
      };

      // Include CSRF token from the browser flow
      const csrfNode = findNode(currentFlow, "csrf_token");
      const csrfToken = csrfNode?.attributes.value ?? "";

      const res = await fetch(`/api${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, csrf_token: csrfToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.ui) {
          setFlow(data as RegistrationFlow);
          showToast(getKratosError(data as RegistrationFlow) ?? "Please check your input and try again.", "error");
          return;
        }
        const isExpired = data?.error?.id === "self_service_flow_expired" || data?.error?.code === 410;
        if (isExpired) {
          setFlow(null);
          query.refetch();
          showToast("This session expired. Please try again.", "error");
          return;
        }
        if (data?.error?.message) {
          showToast(data.error.message, "error");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      if (data.session?.identity) {
        setUserSession({
          id: data.session.identity.id,
          traits: data.session.identity.traits,
        } as import("../api/types.ts").Identity);
        showToast("Account created!", "success");
        navigate({ to: "/" });
        return;
      }

      showToast("Unexpected response from registration flow.", "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Registration failed. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={wrapper}>
      <Toast message={toast.message} variant={toast.variant} visible={toast.visible} onDismiss={hideToast} />

      <div className={card}>
        <h1 className={title}>Sunbeam SSO</h1>
        <p className={subtitle}>Create your account</p>

        {query.isLoading && <p className={statusText}>Loading…</p>}
        {query.error && !currentFlow && (
          <p className={errorText}>{query.error.message}</p>
        )}

        {currentFlow && (
          <form onSubmit={handleSubmit} className={formStack}>
            <TextInput
              type="email"
              label="E-Mail"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              disabled={submitting}
            />
            <TextInput
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              disabled={submitting}
            />
            <Button variant="primary" type="submit" disabled={submitting || !email || !password}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        )}

        <div className={footer}>
          <span className={css({ color: "text.secondary" })}>Already have an account?</span>
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
