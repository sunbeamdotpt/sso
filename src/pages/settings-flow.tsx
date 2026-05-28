import { useState, useCallback } from "react";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, TextInput, Toast } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { submitFlow } from "../api/flows.ts";
import { findNodesByGroup, findNodeByName, getFlowError } from "../api/types.ts";
import type { SettingsFlow, UINode } from "../api/types.ts";

type View = "list" | "totp-verify" | "backup-codes";

export function SettingsFlowPage() {
  const [view, setView] = useState<View>("list");
  const [flow, setFlow] = useState<SettingsFlow | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileValues, setProfileValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const query = useRestQuery<SettingsFlow>(api, "/self-service/settings/browser", {
    queryKey: ["settings-flow"],
  });

  const currentFlow = flow ?? query.data ?? null;

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshFlow = useCallback(async () => {
    try {
      const res = await fetch("/api/self-service/settings/browser", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setFlow(data as SettingsFlow);
      }
    } catch {
      // ignore refresh errors
    }
  }, []);

  const handleSubmit = useCallback(
    async (body: Record<string, unknown>, method: string) => {
      if (!currentFlow?.ui) return;
      const result = await submitFlow(currentFlow as { ui: typeof currentFlow.ui }, body, method);
      if (result.success && result.flow) {
        setFlow(result.flow as SettingsFlow);
        showToast("Success", "success");
      } else {
        showToast(result.error ?? "Something went wrong", "error");
        if (result.flow) {
          setFlow(result.flow as SettingsFlow);
        }
      }
    },
    [currentFlow, showToast],
  );

  const ui = currentFlow?.ui;

  const profileNodes = findNodesByGroup(ui, "profile").filter(
    (n) => n.attributes.type !== "hidden" && n.attributes.type !== "submit" && n.attributes.node_type !== "script",
  );

  const passwordNodes = findNodesByGroup(ui, "password");
  const passwordInputNode = findNodeByName(ui, "password");

  const totpNodes = findNodesByGroup(ui, "totp");
  const totpQrNode = findNodeByName(ui, "totp_qr");
  const totpSecretNode = findNodeByName(ui, "totp_secret");
  const totpUnlinkNode = totpNodes.find((n) => n.attributes.name.includes("unlink"));
  const totpInputNode = findNodeByName(ui, "totp_code");
  const isTotpEnrolled = totpNodes.length > 0 && !totpQrNode && !totpSecretNode;

  const lookupNodes = findNodesByGroup(ui, "lookup_secret");
  const lookupCodeNodes = lookupNodes.filter(
    (n) => n.attributes.type === "text" && n.attributes.name.startsWith("lookup_secret"),
  );
  const lookupRegenNode = lookupNodes.find((n) => n.attributes.name.includes("regenerate"));
  const lookupRevealNode = lookupNodes.find((n) => n.attributes.name.includes("reveal"));
  const isLookupGenerated = lookupNodes.length > 0 && lookupCodeNodes.length === 0;

  return (
    <div className={container}>
      <h1 className={title}>Settings</h1>

      {query.isLoading && <p className={status}>Loading…</p>}
      {query.error && <p className={errorText}>Error: {query.error.message}</p>}

      {toast && (
        <div className={toastWrapper}>
          <Toast
            message={toast.message}
            variant={toast.type}
            visible={true}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}

      {currentFlow && (
        <div className={sections}>
          {/* Profile Section */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Profile</h2>
            <div className={sectionBody}>
              {profileNodes.length === 0 ? (
                <p className={status}>No profile fields available.</p>
              ) : (
                <>
                  {profileNodes.map((node) => {
                    const name = node.attributes.name;
                    const label = node.meta?.label?.text ?? name;
                    const value = profileValues[name] ?? String(node.attributes.value ?? "");
                    return (
                      <TextInput
                        key={name}
                        label={label}
                        value={value}
                        onChange={(v) =>
                          setProfileValues((prev) => ({ ...prev, [name]: v }))
                        }
                      />
                    );
                  })}
                  <div className={buttonRow}>
                    <Button
                      onClick={() => {
                        const body: Record<string, unknown> = {};
                        for (const node of profileNodes) {
                          const name = node.attributes.name;
                          body[name] = profileValues[name] ?? node.attributes.value ?? "";
                        }
                        handleSubmit(body, "profile");
                      }}
                    >
                      Save profile
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* TOTP Section */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Authenticator App</h2>
            {view === "totp-verify" && totpQrNode ? (
              <div className={sectionBody}>
                <img
                  className={qrImage}
                  src={String(totpQrNode.attributes.value)}
                  alt="TOTP QR code"
                />
                {totpSecretNode && (
                  <div className={secretBox}>
                    <span className={secretLabel}>Secret:</span>
                    <code className={secretValue}>{String(totpSecretNode.attributes.value)}</code>
                  </div>
                )}
                <TextInput
                  label="Verification code"
                  value={totpCode}
                  onChange={(value) => setTotpCode(value)}
                  placeholder="Enter 6-digit code"
                />
                <div className={buttonRow}>
                  <Button
                    onClick={() =>
                      handleSubmit(
                        { totp_code: totpCode, ...(totpInputNode ? { [totpInputNode.attributes.name]: totpCode } : {}) },
                        "totp",
                      )
                    }
                  >
                    Verify
                  </Button>
                  <Button variant="ghost" onClick={() => setView("list")}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : isTotpEnrolled ? (
              <div className={sectionBody}>
                <p className={successText}>✓ Two-factor authentication is enabled</p>
                {totpUnlinkNode && (
                  <Button
                    variant="primary"
                    onClick={() =>
                      handleSubmit(
                        { [totpUnlinkNode.attributes.name]: totpUnlinkNode.attributes.value },
                        "totp",
                      )
                    }
                  >
                    Remove TOTP
                  </Button>
                )}
              </div>
            ) : (
              <div className={sectionBody}>
                <p className={status}>TOTP is not set up.</p>
                <Button
                  onClick={async () => {
                    await handleSubmit({}, "totp");
                    setView("totp-verify");
                  }}
                >
                  Set up TOTP
                </Button>
              </div>
            )}
          </div>

          {/* Backup Codes Section */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Backup Codes</h2>
            {view === "backup-codes" && lookupCodeNodes.length > 0 ? (
              <div className={sectionBody}>
                <p className={warningText}>
                  These will not be shown again. Save them now.
                </p>
                <ul className={codeList}>
                  {lookupCodeNodes.map((node, i) => (
                    <li key={i} className={codeListItem}>
                      {String(node.attributes.value)}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => {
                    setView("list");
                    refreshFlow();
                  }}
                >
                  I&apos;ve saved them
                </Button>
              </div>
            ) : isLookupGenerated ? (
              <div className={sectionBody}>
                <p className={successText}>✓ Backup codes are generated</p>
                <div className={buttonRow}>
                  {lookupRevealNode && (
                    <Button
                      onClick={() =>
                        handleSubmit(
                          { [lookupRevealNode.attributes.name]: lookupRevealNode.attributes.value },
                          "lookup_secret",
                        ).then(() => setView("backup-codes"))
                      }
                    >
                      View codes
                    </Button>
                  )}
                  {lookupRegenNode && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        handleSubmit(
                          { [lookupRegenNode.attributes.name]: lookupRegenNode.attributes.value },
                          "lookup_secret",
                        ).then(() => setView("backup-codes"))
                      }
                    >
                      Regenerate
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className={sectionBody}>
                <p className={status}>No backup codes generated.</p>
                <Button onClick={() => handleSubmit({}, "lookup_secret").then(() => setView("backup-codes"))}>
                  Generate backup codes
                </Button>
              </div>
            )}
          </div>

          {/* Password Section */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Password</h2>
            <div className={sectionBody}>
              {passwordNodes.length === 0 ? (
                <p className={status}>Password change is not available.</p>
              ) : (
                <>
                  <TextInput
                    label="New password"
                    type="password"
                    value={password}
                    onChange={(v) => setPassword(v)}
                  />
                  <TextInput
                    label="Confirm password"
                    type="password"
                    value={confirmPassword}
                    onChange={(v) => setConfirmPassword(v)}
                  />
                  <div className={buttonRow}>
                    <Button
                      onClick={() => {
                        if (password !== confirmPassword) {
                          showToast("Passwords do not match", "error");
                          return;
                        }
                        const body: Record<string, unknown> = { password };
                        if (passwordInputNode) {
                          body[passwordInputNode.attributes.name] = password;
                        }
                        handleSubmit(body, "password").then(() => {
                          setPassword("");
                          setConfirmPassword("");
                        });
                      }}
                    >
                      Change password
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const container = css({
  padding: "24px",
  maxWidth: "600px",
  margin: "0 auto",
});

const title = css({
  fontSize: "2xl",
  fontWeight: "bold",
  color: "text.primary",
  marginBottom: "24px",
});

const status = css({
  color: "text.secondary",
});

const errorText = css({
  color: "error",
});

const successText = css({
  color: "success",
  fontWeight: "medium",
});

const warningText = css({
  color: "warning",
  fontWeight: "medium",
});

const sections = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const sectionCard = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid",
  borderColor: "border.default",
  background: "bg.surface",
});

const sectionTitle = css({
  fontSize: "lg",
  fontWeight: "semibold",
  color: "text.primary",
});

const sectionBody = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});

const buttonRow = css({
  display: "flex",
  gap: "8px",
  alignItems: "center",
});

const qrImage = css({
  width: "200px",
  height: "200px",
  borderRadius: "8px",
  border: "1px solid",
  borderColor: "border.default",
});

const secretBox = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "12px",
  borderRadius: "8px",
  background: "bg.subtle",
});

const secretLabel = css({
  fontSize: "xs",
  fontWeight: "semibold",
  color: "text.tertiary",
});

const secretValue = css({
  fontSize: "sm",
  fontFamily: "mono",
  color: "text.primary",
  wordBreak: "break-all",
});

const codeList = css({
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
});

const codeListItem = css({
  fontFamily: "mono",
  fontSize: "sm",
  padding: "8px 12px",
  borderRadius: "6px",
  background: "bg.subtle",
  color: "text.primary",
  textAlign: "center",
});

const toastWrapper = css({
  marginBottom: "16px",
});
