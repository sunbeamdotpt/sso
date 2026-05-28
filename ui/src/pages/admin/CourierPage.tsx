import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, TextInput, Select, Badge, Callout, Spinner, Table } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

const monoSm = css({ fontFamily: "mono", fontSize: "11px" });

const sectionEyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "text.muted",
  marginBottom: "4px",
});

type CourierMessage = {
  id: string;
  status: string;
  type: string;
  template_type?: string;
  recipient: string;
  send_count?: number;
  sent_at?: string;
  subject?: string;
  body?: string;
  channel?: { id?: string };
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
  { value: "abandoned", label: "Abandoned" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "All channels" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

function statusVariant(status: string): "approved" | "new" | "critical" | "draft" {
  if (status === "sent") return "approved";
  if (status === "queued") return "new";
  if (status === "failed") return "critical";
  return "draft";
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
  } catch { return iso; }
}

const COLUMNS = [
  { key: "status", label: "Status", width: "90px" },
  { key: "template", label: "Template", width: "220px" },
  { key: "recipient", label: "Recipient", width: "200px" },
  { key: "sent", label: "Sent", width: "120px" },
];

export function CourierPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["courier-messages", statusFilter, channelFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);
      return api.get<CourierMessage[]>(`/admin/courier/messages?${params.toString()}`);
    },
  });

  const { data: detail } = useQuery({
    queryKey: ["courier-message", selectedId],
    queryFn: () => api.get<CourierMessage>(`/admin/courier/messages/${selectedId}`),
    enabled: !!selectedId,
  });

  const retryMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        (data ?? [])
          .filter((m) => m.status === "failed")
          .map((m) => api.patch(`/admin/courier/messages/${m.id}/send`, {}))
      ),
    onSuccess: () => refetch(),
  });

  const filtered = (data ?? []).filter((m) => {
    if (!search) return true;
    return m.recipient.includes(search) || (m.template_type ?? m.type ?? "").includes(search);
  });

  const rows = filtered.map((m) => ({
    id: m.id,
    status: <Badge variant={statusVariant(m.status)}>{m.status.toUpperCase()}</Badge>,
    template: (
      <span
        className={css({ fontFamily: "mono", fontSize: "11px", color: "sunbeam.orange", cursor: "pointer" })}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedId(m.id)}
        onKeyDown={(e) => e.key === "Enter" && setSelectedId(m.id)}
      >
        {m.template_type ?? m.type ?? "—"}
      </span>
    ),
    recipient: <span className={css({ fontSize: "12px", fontWeight: 600, color: "text.primary" })}>{m.recipient}</span>,
    sent: <span className={css({ fontSize: "11px", color: "text.muted" })}>{formatDate(m.sent_at)}</span>,
  }));

  const selectedMsg = detail ?? (selectedId ? (data ?? []).find((m) => m.id === selectedId) : null);

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ marginBottom: "14px" })}>
        <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", fontFamily: "heading", marginBottom: "4px" })}>
          Courier · message log
        </h1>
        <div className={css({ fontSize: "12px", color: "text.muted" })}>
          Outbound emails / SMS dispatched by Kratos and Hydra.
        </div>
      </div>

      {/* Toolbar */}
      <div className={css({ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" })}>
        <div className={css({ flex: 1 })}>
          <TextInput value={search} onChange={setSearch} placeholder="search by recipient or template…" />
        </div>
        <div className={css({ width: "160px" })}>
          <Select options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} placeholder="Status" />
        </div>
        <div className={css({ width: "160px" })}>
          <Select options={CHANNEL_OPTIONS} value={channelFilter} onChange={setChannelFilter} placeholder="Channel" />
        </div>
        <Button onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}>
          ↻ Retry failed
        </Button>
      </div>

      {error && (
        <Callout variant="warning">
          {error instanceof Error ? error.message : "Failed to load messages"}
        </Callout>
      )}

      {/* Two-column layout */}
      <div className={css({ display: "grid", gridTemplateColumns: "2fr 1.4fr", gap: "16px" })}>
        {/* Message table */}
        <div>
          {isLoading ? (
            <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
              <Spinner size="md" />
            </div>
          ) : (
            <div className={panel}>
              <Table columns={COLUMNS} rows={rows} rowKey="id" />
            </div>
          )}

          <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" })}>
            <span className={css({ fontSize: "11px", color: "text.muted" })}>Page {page}</span>
            <div className={css({ display: "flex", gap: "6px" })}>
              <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</Button>
              <Button disabled={(data?.length ?? 0) < perPage} onClick={() => setPage((p) => p + 1)}>Next ›</Button>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className={panel}>
          {selectedMsg ? (
            <>
              <div className={sectionEyebrow}>Selected message</div>
              <div className={css({ fontSize: "16px", fontWeight: 600, color: "text.primary", marginTop: "4px" })}>
                {selectedMsg.template_type ?? selectedMsg.type ?? "—"}
              </div>
              <div className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted", marginBottom: "12px" })}>
                id: {selectedMsg.id?.slice(0, 9)}… · channel: {selectedMsg.channel?.id ?? "email"}
              </div>
              <div className={css({ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", marginBottom: "14px" })}>
                {(
                  [
                    ["to", selectedMsg.recipient],
                    ["from", "no-reply@sunbeam.pt"],
                    ["subject", selectedMsg.subject ?? "—"],
                    ["attempts", String(selectedMsg.send_count ?? 0) + " / 5"],
                    ["sent_at", selectedMsg.sent_at ?? "—"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className={css({ display: "flex", justifyContent: "space-between" })}>
                    <span className={css({ color: "text.muted" })}>{k}</span>
                    <span className={monoSm}>{v}</span>
                  </div>
                ))}
              </div>
              {selectedMsg.body && (
                <>
                  <div className={sectionEyebrow}>Body preview</div>
                  <div
                    className={css({
                      padding: "12px",
                      bg: "bg.page",
                      border: "1px dashed",
                      borderColor: "border.subtle",
                      fontSize: "11px",
                      lineHeight: "1.5",
                      marginTop: "6px",
                      marginBottom: "12px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    })}
                  >
                    {selectedMsg.body}
                  </div>
                </>
              )}
              {!selectedMsg.body && (
                <div className={css({ fontSize: "11px", color: "text.muted", marginBottom: "12px" })}>
                  Body not available in list view. Click to fetch detail.
                </div>
              )}
              <div className={css({ display: "flex", gap: "6px" })}>
                <Button>Re-send</Button>
                <Button>Edit template</Button>
              </div>
            </>
          ) : (
            <div className={css({ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" })}>
              <div className={css({ fontSize: "12px", color: "text.muted", textAlign: "center" })}>
                Click a message row to view details.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
