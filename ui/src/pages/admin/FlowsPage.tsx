import { useState } from "react";
import { css } from "styled-system/css";
import { Badge, EmptyState, Table, ToggleGroup } from "@sunbeam/beam-ui";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

const monoSm = css({ fontFamily: "mono", fontSize: "11px" });

type FlowRow = {
  id: string;
  flowId: string;
  flowType: string;
  identity: string;
  state: string;
  issued: string;
  expires: string;
  stateVariant: "approved" | "new" | "medium";
};

const MOCK_FLOWS: FlowRow[] = [
  { id: "b8e3f10", flowId: "b8e3…f10", flowType: "login (browser)", identity: "j.silva@studio.pt", state: "ok", stateVariant: "approved", issued: "00:42", expires: "in 58m" },
  { id: "7c4b3f0", flowId: "7c4b…3f0", flowType: "login (api)", identity: "aris.t@studio.pt", state: "ok", stateVariant: "approved", issued: "00:30", expires: "in 60m" },
  { id: "4bbdac9", flowId: "4bbd…ac9", flowType: "registration", identity: "pending@studio.pt", state: "pending", stateVariant: "new", issued: "5m", expires: "in 55m" },
  { id: "21ab9c4", flowId: "21ab…9c4", flowType: "verification", identity: "eva.n@studio.pt", state: "ok", stateVariant: "approved", issued: "14m", expires: "in 6d" },
  { id: "d4e3aff", flowId: "d4e3…aff", flowType: "settings (privileged)", identity: "j.silva@studio.pt", state: "expired", stateVariant: "medium", issued: "−1h", expires: "expired" },
  { id: "01e9aa1", flowId: "01e9…aa1", flowType: "recovery (link)", identity: "rui@studio.pt", state: "ok", stateVariant: "approved", issued: "yesterday", expires: "in 23h" },
  { id: "be18c29", flowId: "be18…c29", flowType: "logout", identity: "j.silva@studio.pt", state: "ok", stateVariant: "approved", issued: "47m", expires: "in 13m" },
];

const TOGGLE_ITEMS = [
  { value: "all", label: "All" },
  { value: "login", label: "Login" },
  { value: "registration", label: "Registration" },
  { value: "recovery", label: "Recovery" },
  { value: "verification", label: "Verification" },
  { value: "settings", label: "Settings" },
  { value: "logout", label: "Logout" },
];

const COLUMNS = [
  { key: "flowId", label: "Flow id", width: "120px" },
  { key: "flowType", label: "Type", width: "180px" },
  { key: "identity", label: "Identity", width: "200px" },
  { key: "state", label: "State", width: "100px" },
  { key: "issued", label: "Issued", width: "100px" },
  { key: "expires", label: "Expires", width: "120px" },
];

export function FlowsPage() {
  const [activeType, setActiveType] = useState("all");

  const filtered = MOCK_FLOWS.filter((f) => {
    if (activeType === "all") return true;
    return f.flowType.toLowerCase().startsWith(activeType);
  });

  const rows = filtered.map((f) => ({
    id: f.id,
    flowId: <span className={css({ fontFamily: "mono", fontSize: "11px", color: "sunbeam.orange" })}>{f.flowId}</span>,
    flowType: <span className={monoSm}>{f.flowType}</span>,
    identity: <span className={css({ fontSize: "11px", fontWeight: 600, color: "text.primary" })}>{f.identity}</span>,
    state: <Badge variant={f.stateVariant}>{f.state.toUpperCase()}</Badge>,
    issued: <span className={css({ fontSize: "11px", color: "text.muted" })}>{f.issued}</span>,
    expires: <span className={css({ fontSize: "11px", color: f.state === "expired" ? "status.error" : "text.muted" })}>{f.expires}</span>,
  }));

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ marginBottom: "14px" })}>
        <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", fontFamily: "heading", marginBottom: "4px" })}>
          Self-service flows
        </h1>
        <div className={css({ fontSize: "12px", color: "text.muted" })}>
          Live login, registration, recovery, verification, settings, and logout flows.
        </div>
      </div>

      {/* Flow type filter */}
      <div className={css({ margin: "12px 0" })}>
        <ToggleGroup
          items={TOGGLE_ITEMS}
          value={activeType}
          onChange={setActiveType}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No flows found"
          description="No flows match the selected type filter."
        />
      ) : (
        <div className={panel}>
          <Table columns={COLUMNS} rows={rows} rowKey="id" />
        </div>
      )}
    </div>
  );
}
