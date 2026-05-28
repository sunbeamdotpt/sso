import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Avatar, Button, TextInput, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

interface Identity {
  id: string;
  traits: {
    name?: { first?: string; last?: string };
    email?: string;
    phone?: string;
    display_name?: string;
  };
  verifiable_addresses?: { value: string; verified: boolean }[];
}

interface SessionResponse {
  identity: Identity;
}

interface SettingsFlow {
  id: string;
  ui: { action: string; nodes: { attributes: { name: string; value?: string }; type: string }[] };
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => api.get<SessionResponse>("/auth/session"),
  });

  const identity = session?.identity;
  const traits = identity?.traits ?? {};
  const verifiedEmail = identity?.verifiable_addresses?.find((a) => a.verified)?.value ?? traits.email ?? "";

  const fullName = [traits.name?.first, traits.name?.last].filter(Boolean).join(" ");

  const [form, setForm] = useState({
    fullName: "",
    displayName: "",
    email: "",
    phone: "",
  });

  // Sync form once session loaded
  const [synced, setSynced] = useState(false);
  if (identity && !synced) {
    setSynced(true);
    setForm({
      fullName: [traits.name?.first, traits.name?.last].filter(Boolean).join(" "),
      displayName: traits.display_name ?? traits.name?.first ?? "",
      email: verifiedEmail,
      phone: traits.phone ?? "",
    });
  }

  const { data: flow } = useQuery({
    queryKey: ["flow", "settings", "profile"],
    queryFn: () => api.get<SettingsFlow>("/flow/settings"),
    enabled: !!identity,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!flow) throw new Error("No settings flow");
      const [first, ...rest] = form.fullName.trim().split(" ");
      return api.post(flow.ui.action, {
        method: "profile",
        csrf_token: flow.ui.nodes.find((n) => n.attributes.name === "csrf_token")?.attributes.value,
        "traits.name.first": first ?? "",
        "traits.name.last": rest.join(" "),
        "traits.display_name": form.displayName,
        "traits.email": form.email,
        "traits.phone": form.phone || undefined,
      });
    },
    onSuccess: () => {
      setSaved(true);
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      return fetch("/api/avatar", { method: "PUT", body: fd }).then((r) => {
        if (!r.ok) throw new Error("Upload failed");
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "session"] }),
  });

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) avatarUploadMutation.mutate(file);
  }

  if (sessionLoading) {
    return (
      <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={css({ maxWidth: "640px" })}>
      <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginBottom: "4px" })}>
        Profile
      </h2>
      <p className={css({ fontSize: "13px", color: "text.muted", marginBottom: "24px" })}>
        Edit how you appear across Sunbeam apps.
      </p>

      {saveError && (
        <div className={css({ marginBottom: "16px" })}>
          <Callout variant="warning">{saveError}</Callout>
        </div>
      )}
      {saved && (
        <div className={css({ marginBottom: "16px" })}>
          <Callout variant="info">Changes saved.</Callout>
        </div>
      )}

      {/* Avatar row */}
      <div className={css({ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" })}>
        <Avatar name={fullName || "User"} size="lg" />
        <div>
          <label htmlFor="avatar-upload">
            <Button
              variant="ghost"
              onClick={() => document.getElementById("avatar-upload")?.click()}
            >
              Upload
            </Button>
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/png,image/jpeg"
            className={css({ display: "none" })}
            onChange={handleAvatarChange}
          />
          <p className={css({ fontSize: "11px", color: "text.muted", marginTop: "6px" })}>
            PNG / JPG · max 2MB
          </p>
        </div>
      </div>

      {/* Two-column field grid */}
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "24px",
        })}
      >
        <TextInput
          label="Full name"
          value={form.fullName}
          onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
          placeholder="Joana Silva"
        />
        <TextInput
          label="Display name"
          value={form.displayName}
          onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
          placeholder="Joana"
        />
        <div className={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
          <TextInput
            label="Email (verified)"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="you@studio.pt"
          />
          <p className={css({ fontSize: "11px", color: "text.muted", marginTop: "2px" })}>
            ✓ verified · used for recovery
          </p>
        </div>
        <div className={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
          <TextInput
            label="Phone"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            placeholder="+351 …"
          />
          <p className={css({ fontSize: "11px", color: "text.muted", marginTop: "2px" })}>
            optional · used for SMS code
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
