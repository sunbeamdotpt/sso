import { useState, useCallback, useRef, useEffect } from "react";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { Button, TextInput, Toast } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";
import { submitFlow } from "../api/flows.ts";
import { findNodesByGroup, findNodeByName } from "../api/types.ts";
import type { SettingsFlow, UIFlow, UINode } from "../api/types.ts";

type View = "list" | "totp-verify" | "backup-codes";

function getOidcNodes(ui: UIFlow | undefined) {
  const nodes = findNodesByGroup(ui, "oidc");
  const linkNodes = nodes.filter((n) => n.attributes.name.startsWith("link"));
  const unlinkNodes = nodes.filter((n) => n.attributes.name.startsWith("unlink"));
  return { linkNodes, unlinkNodes };
}

export function SettingsFlowPage() {
  const [view, setView] = useState<View>("list");
  const [flow, setFlow] = useState<SettingsFlow | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileValues, setProfileValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [passkeyEnrolling, setPasskeyEnrolling] = useState(false);
  const scriptContainerRef = useRef<HTMLDivElement>(null);
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const cancelPasskeyEnrollment = useCallback(() => {
    setPasskeyEnrolling(false);
    pollCountRef.current = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (scriptContainerRef.current) {
      const container = scriptContainerRef.current;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }
  }, []);

  const handleSubmit = useCallback(
    async (body: Record<string, unknown>, method: string) => {
      if (!currentFlow?.ui) return;
      const isLinkOperation = Object.keys(body).some((k) => k.startsWith("link_"));
      const result = await submitFlow(currentFlow as { ui: typeof currentFlow.ui }, body, method);

      // Handle OIDC link redirect (Kratos returns 422 with redirect_browser_to)
      const redirectTo = result.redirect_browser_to ?? (result.flow as SettingsFlow | undefined)?.return_to;
      if (redirectTo && method === "oidc" && isLinkOperation) {
        globalThis.location.href = redirectTo;
        return;
      }

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

  const handleOidcLink = useCallback(
    (node: UINode) => {
      handleSubmit({ [node.attributes.name]: node.attributes.value }, "oidc");
    },
    [handleSubmit],
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

  const webauthnNodes = findNodesByGroup(ui, "webauthn");
  const webauthnAddNode = webauthnNodes.find(
    (n) => n.attributes.name.includes("register") || n.attributes.name === "webauthn_register_trigger",
  );
  const webauthnRemoveNodes = webauthnNodes.filter(
    (n) => n.attributes.name.includes("remove") || n.attributes.name.includes("unlink"),
  );
  const webauthnScriptNode = webauthnNodes.find((n) => n.attributes.node_type === "script");

  const { linkNodes: oidcLinkNodes, unlinkNodes: oidcUnlinkNodes } = getOidcNodes(ui);

  useEffect(() => {
    if (!scriptContainerRef.current || !webauthnScriptNode || !passkeyEnrolling) return;

    const container = scriptContainerRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const script = document.createElement("script");
    const attrs = webauthnScriptNode.attributes as unknown as Record<string, unknown>;

    if (typeof attrs.src === "string") {
      script.src = attrs.src;
      if (attrs.async === true) script.async = true;
      if (typeof attrs.referrerpolicy === "string") script.referrerPolicy = attrs.referrerpolicy;
      if (typeof attrs.crossorigin === "string") script.crossOrigin = attrs.crossorigin;
      if (typeof attrs.integrity === "string") script.integrity = attrs.integrity;
      if (typeof attrs.id === "string") script.id = attrs.id;
      if (typeof attrs.type === "string") script.type = attrs.type;
    } else if (typeof attrs.value === "string") {
      script.textContent = attrs.value;
      if (typeof attrs.type === "string") script.type = attrs.type;
    }

    container.appendChild(script);

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [webauthnScriptNode, passkeyEnrolling]);

  useEffect(() => {
    if (!passkeyEnrolling) return;
    pollCountRef.current = 0;
    intervalRef.current = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= 20) {
        cancelPasskeyEnrollment();
        return;
      }
      refreshFlow();
    }, 3000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [passkeyEnrolling, refreshFlow, cancelPasskeyEnrollment]);

  useEffect(() => {
    if (!webauthnScriptNode && passkeyEnrolling) {
      setPasskeyEnrolling(false);
    }
  }, [webauthnScriptNode, passkeyEnrolling]);

  useEffect(() => {
    if (!passkeyEnrolling) return;
    timeoutRef.current = setTimeout(() => {
      cancelPasskeyEnrollment();
    }, 60000);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [passkeyEnrolling, cancelPasskeyEnrollment]);

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
            visible
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

          {/* Passkeys Section */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Passkeys</h2>
            <div className={sectionBody}>
              {passkeyEnrolling && webauthnScriptNode && ui && (
                <div style={{ display: "none" }}>
                  <form action={ui.action} method="POST">
                    <input
                      type="hidden"
                      name="csrf_token"
                      value={String(findNodeByName(ui, "csrf_token")?.attributes.value ?? "")}
                    />
                    <input type="hidden" name="method" value="webauthn" />
                    {webauthnAddNode && (
                      <input
                        type="hidden"
                        name={webauthnAddNode.attributes.name}
                        value={String(webauthnAddNode.attributes.value ?? "")}
                      />
                    )}
                  </form>
                  <div ref={scriptContainerRef} />
                </div>
              )}

              {passkeyEnrolling && webauthnScriptNode && (
                <div className={buttonRow}>
                  <p className={status}>Follow your browser&apos;s prompt to complete passkey registration.</p>
                  <Button variant="ghost" onClick={cancelPasskeyEnrollment}>
                    Cancel
                  </Button>
                </div>
              )}

              {webauthnRemoveNodes.length > 0 ? (
                <>
                  <p className={successText}>✓ Passkeys are registered</p>
                  {webauthnRemoveNodes.map((node) => (
                    <div
                      key={node.attributes.name}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span>{node.meta?.label?.text ?? "Passkey"}</span>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          handleSubmit(
                            { [node.attributes.name]: node.attributes.value },
                            "webauthn",
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                !passkeyEnrolling && <p className={status}>No passkeys registered.</p>
              )}

              {webauthnAddNode && !passkeyEnrolling && (
                <Button
                  onClick={async () => {
                    if (!currentFlow?.ui) return;
                    const result = await submitFlow(currentFlow as { ui: typeof currentFlow.ui }, {
                      [webauthnAddNode.attributes.name]: webauthnAddNode.attributes.value,
                    }, "webauthn");
                    if (result.success && result.flow) {
                      setFlow(result.flow as SettingsFlow);
                      setPasskeyEnrolling(true);
                    } else {
                      showToast(result.error ?? "Failed to start passkey enrollment", "error");
                      if (result.flow) setFlow(result.flow as SettingsFlow);
                    }
                  }}
                >
                  Add passkey
                </Button>
              )}
            </div>
          </div>

          {/* Connected Accounts Section */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Connected Accounts</h2>
            <div className={sectionBody}>
              {oidcUnlinkNodes.length === 0 && oidcLinkNodes.length === 0 ? (
                <p className={status}>No social providers available.</p>
              ) : (
                <>
                  {oidcUnlinkNodes.length > 0 && (
                    <>
                      <p className={successText}>✓ Connected providers</p>
                      {oidcUnlinkNodes.map((n) => (
                        <div
                          key={n.attributes.name}
                          className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}
                        >
                          <span className={css({ fontSize: "sm", color: "text.primary" })}>
                            {n.meta?.label?.text ?? n.attributes.name.replace("unlink_", "")}
                          </span>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              handleSubmit(
                                { [n.attributes.name]: n.attributes.value },
                                "oidc",
                              )
                            }
                          >
                            Disconnect
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                  {oidcLinkNodes.length > 0 && (
                    <div className={buttonRow}>
                      {oidcLinkNodes.map((n) => (
                        <Button
                          key={n.attributes.name}
                          variant="primary"
                          onClick={() => handleOidcLink(n)}
                        >
                          Connect {n.meta?.label?.text ?? n.attributes.name.replace("link_", "")}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
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
