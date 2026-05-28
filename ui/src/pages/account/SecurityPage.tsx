import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { css, cx } from "styled-system/css";
import { Button, TextInput, Badge, Dialog, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

interface SettingsFlow {
  id: string;
  ui: {
    action: string;
    nodes: { attributes: { name: string; value?: string }; type: string }[];
  };
}

interface Passkey {
  id: string;
  display_name: string;
  created_at: string;
  used_at?: string;
}

const eyebrow = css({
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "sunbeam.orange",
});

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  padding: "16px",
  bg: "bg.surface",
  borderRadius: "0",
});

const section = css({ marginBottom: "32px" });

const row = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

// ── mock data (replaced when flow/passkeys endpoints are wired) ──────────────
const MOCK_PASSKEYS: Passkey[] = [
  { id: "pk1", display_name: "MacBook Pro · Touch ID", created_at: "Mar 4", used_at: "today" },
  { id: "pk2", display_name: "iPhone 15", created_at: "Jan 12", used_at: "2d ago" },
  { id: "pk3", display_name: "YubiKey 5C", created_at: "2024", used_at: "14d ago" },
];

const CONNECTED_ACCOUNTS = [
  { icon: "G", label: "Google · j.silva@gmail.com", status: "Connected", linked: true, org: false },
  { icon: "", label: "GitHub · @joana", status: "Connected", linked: true, org: false },
  { icon: "M", label: "Microsoft", status: "Link", linked: false, org: false },
  { icon: "S", label: "SAML · Studio Corp", status: "Linked by org", linked: true, org: true },
];

export function SecurityPage() {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  const { data: flow, isLoading: flowLoading } = useQuery({
    queryKey: ["flow", "settings", "security"],
    queryFn: () => api.get<SettingsFlow>("/flow/settings"),
  });

  const csrfToken = flow?.ui.nodes.find((n) => n.attributes.name === "csrf_token")?.attributes.value;

  const changePwMutation = useMutation({
    mutationFn: () => {
      if (!flow) throw new Error("No settings flow");
      return api.post(flow.ui.action, {
        method: "password",
        csrf_token: csrfToken,
        password: newPw,
      });
    },
    onSuccess: () => {
      setChangePasswordOpen(false);
      setCurrentPw("");
      setNewPw("");
      setPwError(null);
    },
    onError: (err) => setPwError(err instanceof Error ? err.message : "Password change failed"),
  });

  const removePasskeyMutation = useMutation({
    mutationFn: (passkeyId: string) => {
      if (!flow) throw new Error("No settings flow");
      return api.post(flow.ui.action, {
        method: "passkey",
        // TODO: verify passkey remove payload shape with Kratos flow
        passkey_remove: passkeyId,
        csrf_token: csrfToken,
      });
    },
  });

  if (flowLoading) {
    return (
      <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={css({ maxWidth: "640px" })}>
      <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginBottom: "4px" })}>
        Security
      </h2>
      <p className={css({ fontSize: "13px", color: "text.muted", marginBottom: "24px" })}>
        Manage how you sign in.
      </p>

      {/* ── Password ── */}
      <div className={section}>
        <div className={css({ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "sunbeam.orange", marginBottom: "8px" })}>
          PASSWORD
        </div>
        <div className={panel}>
          <div className={row}>
            <div>
              <div className={css({ fontSize: "14px", fontWeight: 600, color: "text.primary", letterSpacing: "0.15em" })}>
                ••••••••••
              </div>
              <div className={css({ fontSize: "11px", color: "text.muted", marginTop: "2px" })}>
                Last changed 47 days ago
              </div>
            </div>
            <Button variant="ghost" onClick={() => setChangePasswordOpen(true)}>
              Change
            </Button>
          </div>
        </div>
      </div>

      {/* ── Passkeys ── */}
      <div className={section}>
        <div className={cx(row, css({ marginBottom: "8px" }))}>
          <span className={eyebrow}>PASSKEYS ({MOCK_PASSKEYS.length})</span>
          <Button variant="ghost" onClick={() => { /* TODO: wire add passkey flow */ }}>
            + Add passkey
          </Button>
        </div>
        <div className={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
          {MOCK_PASSKEYS.map((pk) => (
            <div key={pk.id} className={cx(panel, row)}>
              <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                <span className={css({ fontSize: "22px", color: "sunbeam.orange" })}>◆</span>
                <div>
                  <div className={css({ fontSize: "13px", fontWeight: 600, color: "text.primary" })}>
                    {pk.display_name}
                  </div>
                  <div className={css({ fontSize: "11px", color: "text.muted", marginTop: "2px" })}>
                    Added {pk.created_at} · last used {pk.used_at}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => removePasskeyMutation.mutate(pk.id)}
                disabled={removePasskeyMutation.isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-factor ── */}
      <div className={section}>
        <div className={css({ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "sunbeam.orange", marginBottom: "8px" })}>
          TWO-FACTOR
        </div>
        <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" })}>
          <div className={panel}>
            <div className={cx(row, css({ marginBottom: "4px" }))}>
              <span className={css({ fontSize: "13px", fontWeight: 600, color: "text.primary" })}>
                Authenticator (TOTP)
              </span>
              <Badge variant="approved">ENABLED</Badge>
            </div>
            <div className={css({ fontSize: "11px", color: "text.muted" })}>
              1Password · added Feb 9
            </div>
          </div>
          <div className={panel}>
            <div className={cx(row, css({ marginBottom: "4px" }))}>
              <span className={css({ fontSize: "13px", fontWeight: 600, color: "text.primary" })}>
                Backup codes
              </span>
              {/* TODO: verify Badge variant for neutral "remaining count" state */}
              <Badge variant="stable">7 / 10 LEFT</Badge>
            </div>
            <div className={css({ fontSize: "11px", color: "text.muted" })}>
              Regenerate or download
            </div>
          </div>
        </div>
      </div>

      {/* ── Connected accounts ── */}
      <div className={section}>
        <div className={css({ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "sunbeam.orange", marginBottom: "8px" })}>
          CONNECTED ACCOUNTS
        </div>
        <div className={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
          {CONNECTED_ACCOUNTS.map((acct, i) => (
            <div key={i} className={cx(panel, row)}>
              <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                <span
                  className={css({
                    width: "28px",
                    height: "28px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid",
                    borderColor: "border.default",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "text.secondary",
                    flexShrink: 0,
                  })}
                >
                  {acct.icon}
                </span>
                <span className={css({ fontSize: "13px", fontWeight: 500, color: "text.primary" })}>
                  {acct.label}
                </span>
              </div>
              <Button
                variant="ghost"
                disabled={acct.org}
                onClick={() => { /* TODO: wire OIDC/SAML link/unlink via flow */ }}
              >
                {acct.status}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Change password dialog ── */}
      <Dialog
        open={changePasswordOpen}
        onClose={() => { setChangePasswordOpen(false); setPwError(null); }}
        title="Change password"
        actions={
          <>
            <Button variant="ghost" onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => changePwMutation.mutate()}
              disabled={changePwMutation.isPending || !newPw}
            >
              {changePwMutation.isPending ? "Saving…" : "Update password"}
            </Button>
          </>
        }
      >
        <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
          {pwError && <Callout variant="warning">{pwError}</Callout>}
          <TextInput
            label="Current password"
            type="password"
            value={currentPw}
            onChange={(v) => setCurrentPw(v)}
            placeholder="••••••••"
          />
          <TextInput
            label="New password"
            type="password"
            value={newPw}
            onChange={(v) => setNewPw(v)}
            placeholder="••••••••"
          />
        </div>
      </Dialog>
    </div>
  );
}
