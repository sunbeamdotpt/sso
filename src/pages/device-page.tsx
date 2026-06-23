import { useCallback, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useAuth } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, Callout, Spinner, TextInput } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";

interface DeviceVerifyRequest {
  client?: { client_name?: string; logo_uri?: string };
  subject?: string;
  requested_scope?: string[];
  user_code?: string;
  skip?: boolean;
  redirect_to?: string;
}

interface DeviceVerifyResponse {
  redirect_to?: string;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: "Verify your identity",
  email: "See your email address",
  profile: "See your name and avatar",
  offline_access: "Stay signed in for 30 days",
};

const USER_CODE_PATTERN = /^[A-Z0-9]{4,}-[A-Z0-9]{4,}$/i;

function normalizeUserCode(value: string): string {
  // Allow typed codes without hyphen; insert one in the middle if missing.
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, Math.ceil(cleaned.length / 2))}-${
    cleaned.slice(Math.ceil(cleaned.length / 2))
  }`;
}

function isValidUserCode(value: string): boolean {
  return USER_CODE_PATTERN.test(value);
}

export function DevicePage() {
  const search = useSearch({ from: "/device" }) as { user_code?: string };
  const { isAuthenticated } = useAuth();

  const [userCode, setUserCode] = useState(search.user_code ?? "");
  const [normalizedCode, setNormalizedCode] = useState("");
  const [deviceRequest, setDeviceRequest] = useState<
    DeviceVerifyRequest | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [denied, setDenied] = useState(false);

  const redirectToLogin = useCallback((code: string) => {
    const returnTo = encodeURIComponent(
      `/device?user_code=${encodeURIComponent(code)}`,
    );
    globalThis.location.href = `/login?return_to=${returnTo}`;
  }, []);

  const fetchDeviceRequest = useCallback(async (code: string) => {
    setIsLoading(true);
    setFormError(null);
    try {
      const data = await api.get<DeviceVerifyRequest>(
        `/oauth2/device/verify?user_code=${encodeURIComponent(code)}`,
      );
      setDeviceRequest(data);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Failed to load device request";
      if (
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("401")
      ) {
        redirectToLogin(code);
        return;
      }
      // Hydra's device verify endpoint may return HTML rather than JSON.
      // Fall back to a generic approval screen so the user can still proceed.
      setDeviceRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, [redirectToLogin]);

  useEffect(() => {
    const normalized = normalizeUserCode(search.user_code ?? "");
    setNormalizedCode(normalized);
    if (isValidUserCode(normalized)) {
      fetchDeviceRequest(normalized);
    }
  }, [search.user_code, fetchDeviceRequest]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUserCode(userCode);
    if (!isValidUserCode(normalized)) {
      setFormError("Enter a valid device code, e.g. ABCD-EFGH.");
      return;
    }
    globalThis.location.href = `/device?user_code=${
      encodeURIComponent(normalized)
    }`;
  };

  const handleAllow = async () => {
    if (!normalizedCode) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<DeviceVerifyResponse>(
        "/oauth2/device/verify",
        {
          body: { user_code: normalizedCode },
        },
      );
      if (result?.redirect_to) {
        globalThis.location.href = result.redirect_to;
        return;
      }
      setIsComplete(true);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to approve device",
      );
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!normalizedCode) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const result = await api.post<DeviceVerifyResponse>(
        "/oauth2/device/verify",
        {
          body: { user_code: normalizedCode, deny: true },
        },
      );
      if (result?.redirect_to) {
        globalThis.location.href = result.redirect_to;
        return;
      }
      setDenied(true);
      setIsComplete(true);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to deny device",
      );
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated && normalizedCode) {
    redirectToLogin(normalizedCode);
    return null;
  }

  if (!normalizedCode || !isValidUserCode(normalizedCode)) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <h1 className={title}>Connect a device</h1>
          <p className={subtitle}>
            Enter the code shown on your device to sign in and approve access.
          </p>

          {formError && <Callout variant="warning">{formError}</Callout>}

          <form onSubmit={handleManualSubmit} className={formStack}>
            <TextInput
              label="Device code"
              value={userCode}
              onChange={(value) => setUserCode(normalizeUserCode(value))}
              placeholder="ABCD-EFGH"
              disabled={isSubmitting}
            />
            <Button variant="primary" type="submit" disabled={!userCode}>
              Continue
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              padding: "32px",
            })}
          >
            <Spinner size="md" />
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className={wrapper}>
        <div className={card}>
          <h1 className={title}>
            {denied ? "Access denied" : "Device connected"}
          </h1>
          <p className={subtitle}>
            {denied
              ? "You can close this window and return to your device."
              : "You can close this window and return to your device."}
          </p>
        </div>
      </div>
    );
  }

  const clientName = deviceRequest?.client?.client_name ?? "This device";
  const scopes = (deviceRequest?.requested_scope ?? []).map((s) => ({
    name: s,
    description: SCOPE_DESCRIPTIONS[s] ?? s,
  }));

  return (
    <div className={wrapper}>
      <div className={card}>
        <h1 className={title}>Connect {clientName}</h1>
        <p className={subtitle}>
          A device wants to access your Sunbeam account.
        </p>

        {formError && <Callout variant="warning">{formError}</Callout>}

        <div className={codeRow}>
          <span className={codeLabel}>Device code</span>
          <span className={codeValue}>{normalizedCode}</span>
        </div>

        {scopes.length > 0 && (
          <div className={scopeList}>
            <p className={scopeHeader}>This will let {clientName}:</p>
            <div className={scopeItems}>
              {scopes.map((scope) => (
                <div key={scope.name} className={scopeRow}>
                  <div className={scopeInfo}>
                    <div className={scopeName}>{scope.name}</div>
                    <div className={scopeDesc}>{scope.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={actions}>
          <Button
            variant="ghost"
            type="button"
            onClick={handleDeny}
            disabled={isSubmitting}
          >
            Deny
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleAllow}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner size="sm" /> : "Allow"}
          </Button>
        </div>

        <p className={footer}>
          You can revoke access any time from your account settings.
        </p>
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
  maxWidth: "440px",
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

const codeRow = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
  padding: "16px",
  borderRadius: "md",
  border: "1px dashed",
  borderColor: "border.subtle",
  backgroundColor: "bg.page",
});

const codeLabel = css({
  fontSize: "xs",
  fontWeight: "semibold",
  color: "text.muted",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
});

const codeValue = css({
  fontSize: "2xl",
  fontFamily: "mono",
  fontWeight: "bold",
  color: "text.primary",
  letterSpacing: "0.08em",
});

const scopeList = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

const scopeHeader = css({
  fontSize: "xs",
  fontWeight: "semibold",
  color: "text.muted",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
});

const scopeItems = css({
  display: "flex",
  flexDirection: "column",
  borderTop: "1px solid",
  borderColor: "border.subtle",
});

const scopeRow = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 8px",
  borderBottom: "1px solid",
  borderColor: "border.subtle",
});

const scopeInfo = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

const scopeName = css({
  fontSize: "sm",
  fontFamily: "mono",
  color: "text.primary",
});

const scopeDesc = css({
  fontSize: "xs",
  color: "text.muted",
});

const actions = css({
  display: "flex",
  gap: "12px",
  "& > *": { flex: 1 },
});

const footer = css({
  fontSize: "xs",
  color: "text.muted",
  textAlign: "center",
});
