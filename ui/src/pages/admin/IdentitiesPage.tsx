import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Badge, Avatar, Callout, Spinner, Table } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

type KratosIdentity = {
  id: string;
  state: string;
  traits: { email?: string; name?: { first?: string; last?: string } };
  verifiable_addresses?: Array<{ value: string; verified: boolean }>;
  created_at: string;
  updated_at: string;
};

function stateVariant(state: string): "approved" | "new" | "draft" {
  if (state === "active") return "approved";
  if (state === "inactive") return "draft";
  return "new";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

const COLUMNS = [
  { key: "identity", label: "Identity", width: "300px" },
  { key: "state", label: "State", width: "100px" },
  { key: "verified", label: "Verified", width: "100px" },
  { key: "last", label: "Last sign-in", width: "140px" },
  { key: "created", label: "Created", width: "140px" },
];

export function IdentitiesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 25;

  const { data, isLoading, error } = useQuery({
    queryKey: ["identities", search, page],
    queryFn: () =>
      api.get<KratosIdentity[]>(
        `/admin/identities?per_page=${perPage}&page=${page}${search ? `&credentials_identifier=${encodeURIComponent(search)}` : ""}`
      ),
  });

  const rows = (data ?? []).map((id) => {
    const email = id.traits?.email ?? id.verifiable_addresses?.[0]?.value ?? "—";
    const first = id.traits?.name?.first ?? "";
    const last = id.traits?.name?.last ?? "";
    const fullName = [first, last].filter(Boolean).join(" ") || "—";
    const isVerified = id.verifiable_addresses?.some((a) => a.verified) ?? false;
    const initials = fullName === "—" ? "?" : [first[0], last[0]].filter(Boolean).join("").slice(0, 2).toUpperCase();

    return {
      id: id.id,
      identity: (
        <div className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
          <Avatar name={initials} size="sm" />
          <div>
            <div className={css({ fontSize: "12px", fontWeight: 600, color: "text.primary" })}>{email}</div>
            <div className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted" })}>
              {fullName} · {id.id.slice(0, 8)}…
            </div>
          </div>
        </div>
      ),
      state: <Badge variant={stateVariant(id.state)}>{id.state.toUpperCase()}</Badge>,
      verified: isVerified ? (
        <span className={css({ fontSize: "11px", color: "sunbeam.orange" })}>✓ email</span>
      ) : (
        <span className={css({ fontSize: "11px", color: "text.muted" })}>unverified</span>
      ),
      last: <span className={css({ fontSize: "11px", color: "text.muted" })}>—</span>,
      created: <span className={css({ fontSize: "11px", color: "text.muted" })}>{formatDate(id.created_at)}</span>,
    };
  });

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" })}>
        <div>
          <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", fontFamily: "heading", marginBottom: "4px" })}>
            Identities
          </h1>
          <div className={css({ fontSize: "12px", color: "text.muted" })}>
            {(data?.length ?? 0).toLocaleString()} records loaded · Schema:{" "}
            <span className={css({ fontFamily: "mono", fontSize: "11px", color: "sunbeam.orange" })}>person@v3</span>
          </div>
        </div>
        <Button variant="primary" onClick={() => navigate("/admin/identities/new")}>
          + Create
        </Button>
      </div>

      {/* Toolbar */}
      <div className={css({ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" })}>
        <div className={css({ flex: 1 })}>
          <TextInput
            value={search}
            onChange={setSearch}
            placeholder="search by email, id, name, traits.{key}…"
          />
        </div>
        <Button>Schema ▾</Button>
        <Button>State ▾</Button>
        <Button>Verified ▾</Button>
        <Button>⚙ Columns</Button>
        <Button>⇣ Export</Button>
      </div>

      {error && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : "Failed to load identities"}
        </Callout>
      )}

      {isLoading ? (
        <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
          <Spinner size="md" />
        </div>
      ) : (
        <div className={panel}>
          <Table columns={COLUMNS} rows={rows} rowKey="id" selectable />
        </div>
      )}

      {/* Pagination */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" })}>
        <span className={css({ fontSize: "11px", color: "text.muted" })}>
          Page {page} · {(data?.length ?? 0)} loaded
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
