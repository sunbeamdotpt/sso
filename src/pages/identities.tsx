import { useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useRestQuery, useRestMutation } from "@sunbeam/g2v";
import { Table, Badge, Button, TextInput, Toast } from "@sunbeam/beam-ui";
import { css } from "styled-system/css";
import { api } from "../api/client.ts";
import type { Identity } from "../api/types.ts";

function shortenId(id: string): string {
  return id.slice(0, 8) + "…";
}

function getEmail(identity: Identity): string | undefined {
  const traits = identity.traits as Record<string, string>;
  return traits?.email;
}

function isVerified(identity: Identity): boolean {
  return identity.verifiable_addresses?.some((a) => a.verified) ?? false;
}

export function IdentitiesPage() {
  const query = useRestQuery<Identity[]>(api, "/identities", {
    queryKey: ["identities"],
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
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

  const createIdentity = useRestMutation<Identity, { body: { schema_id: string; traits: { email: string } } }>(
    api,
    "POST",
    "/identities",
    {
      onSuccess: () => {
        setShowCreate(false);
        setNewEmail("");
        showToast("Identity created successfully.", "success");
        query.refetch();
      },
      onError: (err) => {
        showToast(err.message, "error");
      },
    }
  );

  const columns = [
    { key: "email", label: "Email", sortable: true },
    { key: "id_short", label: "ID", width: "160px" },
    { key: "schema", label: "Schema", width: "120px" },
    { key: "verified", label: "Verified", width: "100px" },
    { key: "actions", label: "", width: "80px" },
  ];

  const rows = (query.data ?? []).map((identity) => ({
    id: identity.id,
    id_short: shortenId(identity.id),
    email: getEmail(identity) ?? "—",
    schema: identity.schema_id,
    verified: isVerified(identity) ? "Yes" : "No",
    actions: (
      <Link
        to="/identities/$id"
        params={{ id: identity.id }}
        className={viewLink}
      >
        View
      </Link>
    ),
  }));

  const handleCreate = () => {
    if (!newEmail.trim()) {
      showToast("Email is required.", "error");
      return;
    }
    createIdentity.mutate({
      body: {
        schema_id: "default",
        traits: { email: newEmail.trim() },
      },
    });
  };

  return (
    <div className={container}>
      <Toast message={toast.message} variant={toast.variant} visible={toast.visible} onDismiss={hideToast} />

      <div className={header}>
        <div>
          <h1 className={title}>Identities</h1>
          {query.data && (
            <p className={subtitle}>
              {query.data.length} {query.data.length === 1 ? "identity" : "identities"} registered
            </p>
          )}
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          Create Identity
        </Button>
      </div>

      {showCreate && (
        <div className={createPanel}>
          <h2 className={css({ fontSize: "md", fontWeight: "semibold", color: "text.primary", marginBottom: "12px" })}>
            Create Identity
          </h2>
          <div className={css({ display: "flex", gap: "12px", alignItems: "flex-end" })}>
            <div className={css({ flex: 1 })}>
              <TextInput
                type="email"
                label="Email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={setNewEmail}
              />
            </div>
            <Button variant="primary" onClick={handleCreate} disabled={createIdentity.isPending}>
              {createIdentity.isPending ? "Creating…" : "Create"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {query.isLoading && <p className={status}>Loading…</p>}
      {query.error && (
        <p className={errorText}>
          Error: {query.error.message}
        </p>
      )}

      {query.data && (
        <Table
          columns={columns}
          rows={rows}
          caption="Registered identities"
          className={css({ borderRadius: "md" })}
        />
      )}
    </div>
  );
}

const container = css({
  padding: "24px",
  maxWidth: "1200px",
  margin: "0 auto",
});

const header = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "24px",
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
});

const subtitle = css({
  fontSize: "sm",
  color: "text.secondary",
  marginTop: "4px",
});

const status = css({
  color: "text.secondary",
});

const errorText = css({
  color: "error",
});

const viewLink = css({
  color: "accent",
  textDecoration: "none",
  fontSize: "sm",
  fontWeight: "medium",
  fontFamily: "body",
  _hover: { textDecoration: "underline" },
});

const createPanel = css({
  padding: "20px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.surface",
  marginBottom: "24px",
});
