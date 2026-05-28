import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Select, Badge, Avatar, Callout, Spinner, Table } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

type Session = {
  id: string;
  active: boolean;
  authenticated_at: string;
  expires_at: string;
  identity?: {
    id: string;
    traits?: { email?: string; name?: { first?: string; last?: string } };
  };
  authentication_methods?: Array<{ method: string; aal?: string }>;
  devices?: Array<{ user_agent?: string; ip_address?: string; location?: string }>;
};

const FILTER_OPTIONS = [
  { value: "active", label: "Active only" },
  { value: "all", label: "All" },
  { value: "expired", label: "Expired" },
];

const COLUMNS = [
  { key: "identity", label: "Identity", width: "220px" },
  { key: "device", label: "Device · UA", width: "200px" },
  { key: "location", label: "Location · IP", width: "160px" },
  { key: "aal", label: "AAL", width: "80px" },
  { key: "issued", label: "Issued", width: "140px" },
  { key: "expires", label: "Expires", width: "140px" },
  { key: "action", label: "", width: "80px" },
];

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function AdminSessionsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [identityId, setIdentityId] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-sessions", filter, identityId, page],
    queryFn: () => {
      const params = new URLSearchParams({
        per_page: String(perPage),
        page: String(page),
        expand: "identity,devices",
      });
      if (filter === "active") params.set("active", "true");
      if (identityId) params.set("identity_id", identityId);
      return api.get<Session[]>(`/admin/sessions?${params.toString()}`);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/admin/sessions/${sessionId}`),
    onSuccess: () => refetch(),
  });

  const filtered = (data ?? []).filter((s) => {
    if (!search) return true;
    const email = s.identity?.traits?.email ?? "";
    return email.includes(search) || s.id.includes(search);
  });

  const rows = filtered.map((s) => {
    const email = s.identity?.traits?.email ?? s.identity?.id?.slice(0, 8) ?? "—";
    const first = s.identity?.traits?.name?.first ?? "";
    const last = s.identity?.traits?.name?.last ?? "";
    const name = [first, last].filter(Boolean).join(" ") || "—";
    const initials = name === "—" ? "?" : [first[0], last[0]].filter(Boolean).join("").slice(0, 2).toUpperCase();
    const ua = s.devices?.[0]?.user_agent ?? "Unknown";
    const ip = s.devices?.[0]?.ip_address ?? "—";
    const location = s.devices?.[0]?.location ?? "—";
    const aal = s.authentication_methods?.[0]?.aal?.toUpperCase() ?? "AAL1";
    const expired = new Date(s.expires_at) < new Date();

    return {
      id: s.id,
      identity: (
        <div className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
          <Avatar name={initials} size="sm" />
          <div>
            <div className={css({ fontSize: "12px", fontWeight: 600, color: "text.primary" })}>{email}</div>
            <div className={css({ fontFamily: "mono", fontSize: "10px", color: "text.muted" })}>{s.identity?.id?.slice(0, 8)}…</div>
          </div>
        </div>
      ),
      device: <span className={css({ fontSize: "11px", color: "text.primary" })}>{ua.length > 40 ? ua.slice(0, 40) + "…" : ua}</span>,
      location: <span className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted" })}>{location} · {ip}</span>,
      aal: <Badge variant="new">{aal}</Badge>,
      issued: <span className={css({ fontSize: "11px", color: "text.muted" })}>{formatDate(s.authenticated_at)}</span>,
      expires: (
        <span className={css({ fontSize: "11px", color: expired ? "status.error" : "text.muted" })}>
          {formatDate(s.expires_at)}
        </span>
      ),
      action: (
        <Button
          onClick={() => revokeMutation.mutate(s.id)}
          disabled={revokeMutation.isPending}
        >
          Revoke
        </Button>
      ),
    };
  });

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ marginBottom: "14px" })}>
        <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", fontFamily: "heading", marginBottom: "4px" })}>
          Sessions
        </h1>
        <div className={css({ fontSize: "12px", color: "text.muted" })}>
          Active sessions across the project.
        </div>
      </div>

      {/* Toolbar */}
      <div className={css({ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" })}>
        <div className={css({ flex: 1 })}>
          <TextInput
            value={search}
            onChange={setSearch}
            placeholder="Search by email or session id…"
          />
        </div>
        <div className={css({ width: "180px" })}>
          <Select
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
            placeholder="Filter status"
          />
        </div>
        <div className={css({ width: "200px" })}>
          <TextInput
            value={identityId}
            onChange={setIdentityId}
            placeholder="Filter by identity_id…"
          />
        </div>
      </div>

      {error && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : "Failed to load sessions"}
        </Callout>
      )}

      {revokeMutation.error && (
        <Callout variant="warning">
          {revokeMutation.error instanceof Error ? revokeMutation.error.message : "Revoke failed"}
        </Callout>
      )}

      {isLoading ? (
        <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
          <Spinner size="md" />
        </div>
      ) : (
        <div className={panel}>
          <Table columns={COLUMNS} rows={rows} rowKey="id" />
        </div>
      )}

      {/* Pagination */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" })}>
        <span className={css({ fontSize: "11px", color: "text.muted" })}>
          Page {page} · {filtered.length} sessions
        </span>
        <div className={css({ display: "flex", gap: "6px" })}>
          <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹ Prev
          </Button>
          <Button disabled={(data?.length ?? 0) < perPage} onClick={() => setPage((p) => p + 1)}>
            Next ›
          </Button>
        </div>
      </div>
    </div>
  );
}
