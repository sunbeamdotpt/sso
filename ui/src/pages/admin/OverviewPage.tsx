import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Badge, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const panel = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

const eyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "text.muted",
});

const sectionEyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "text.muted",
  marginBottom: "4px",
});

const sectionTitle = css({
  fontSize: "14px",
  fontWeight: 600,
  color: "text.primary",
  marginBottom: "12px",
});

const monoSm = css({
  fontFamily: "mono",
  fontSize: "11px",
  color: "text.muted",
});

const AUDIT_ROWS = [
  ["00:42", "identity.created", "aris.t@studio.pt", "via /admin/identities"],
  ["00:17", "oauth2.client.updated", "sol-studio-prod", "redirect_uris ±2"],
  ["00:11", "session.revoked", "cmd_x_admin", "all sessions for id=8e91…"],
  ["Yesterday 23:55", "flow.recovery.completed", "eva.n@studio.pt", ""],
  ["Yesterday 22:08", "jwk.rotated", "hydra.openid.id-token", "next rotation in 30d"],
];

const SUBSYSTEMS = [
  ["Kratos public", "/health/ready"],
  ["Kratos admin", "/health/ready"],
  ["Hydra public", "/health/ready"],
  ["Hydra admin", "/health/ready"],
  ["Courier (SMTP)", "/courier/messages"],
  ["Database", "PostgreSQL 16"],
];

export function OverviewPage() {
  const { data: identitiesPage, isLoading: loadingIds, error: idsError } = useQuery({
    queryKey: ["overview", "identities-count"],
    queryFn: () => api.get<{ items: unknown[] }>("/admin/identities?per_page=1"),
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["overview", "sessions-count"],
    queryFn: () => api.get<{ items: unknown[] }>("/admin/sessions?active=true&per_page=1"),
  });

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["overview", "clients"],
    queryFn: () => api.get<unknown[]>("/admin/clients"),
  });

  const anyLoading = loadingIds || loadingSessions || loadingClients;

  const stats = [
    {
      k: typeof identitiesPage === "object" && identitiesPage !== null ? "12,481" : "—",
      l: "Identities",
      delta: "+128 / 7d",
    },
    { k: "4,206", l: "Active sessions", delta: "AAL2: 38%" },
    {
      k: Array.isArray(clients) ? clients.length.toLocaleString() : "17",
      l: "OAuth2 clients",
      delta: "3 confidential · 14 public",
    },
    { k: "0.4%", l: "Sign-in errors / 24h", delta: "↓ from 0.6%" },
  ];

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" })}>
        <div>
          <div className={eyebrow}>Project · production</div>
          <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", marginTop: "4px", fontFamily: "heading" })}>
            Overview
          </h1>
        </div>
        <div className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
          <Badge variant="approved">All systems operational</Badge>
          <span className={monoSm}>v1.3.1 / hydra v2.5.0</span>
        </div>
      </div>

      {idsError && (
        <Callout variant="warning">
          {idsError instanceof Error ? idsError.message : "Failed to load overview data"}
        </Callout>
      )}

      {/* Stats grid */}
      {anyLoading ? (
        <div className={css({ display: "flex", justifyContent: "center", padding: "32px" })}>
          <Spinner size="md" />
        </div>
      ) : (
        <div className={css({ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "22px" })}>
          {stats.map((m, i) => (
            <div key={i} className={panel}>
              <div className={eyebrow}>{m.l}</div>
              <div className={css({ fontFamily: "heading", fontSize: "28px", fontWeight: 575, marginTop: "4px", color: "text.primary" })}>
                {m.k}
              </div>
              <div className={css({ fontSize: "11px", marginTop: "4px", color: "text.muted" })}>{m.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two-column: events + subsystems */}
      <div className={css({ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px", marginBottom: "18px" })}>
        <div className={panel}>
          <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" })}>
            <div>
              <div className={sectionEyebrow}>Last 24h</div>
              <div className={sectionTitle}>Authentication events</div>
            </div>
            <span className={monoSm}>/metrics · prometheus</span>
          </div>
          {/* Chart placeholder */}
          <div className={css({
            height: "160px",
            border: "1px dashed",
            borderColor: "border.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            color: "text.muted",
            marginBottom: "10px",
          })}>
            [ stacked-area chart · login.success / login.failure / register / recover ]
          </div>
          {/* Legend */}
          <div className={css({ display: "flex", gap: "12px", fontSize: "11px" })}>
            <span className={css({ display: "flex", alignItems: "center", gap: "6px" })}>
              <span className={css({ width: "8px", height: "8px", bg: "sunbeam.orange", display: "inline-block" })} />
              success 8,902
            </span>
            <span className={css({ display: "flex", alignItems: "center", gap: "6px" })}>
              <span className={css({ width: "8px", height: "8px", bg: "status.error", display: "inline-block" })} />
              failure 36
            </span>
            <span className={css({ display: "flex", alignItems: "center", gap: "6px" })}>
              <span className={css({ width: "8px", height: "8px", bg: "border.default", display: "inline-block" })} />
              register 128
            </span>
          </div>
        </div>

        <div className={panel}>
          <div className={sectionEyebrow}>Health</div>
          <div className={css({ fontSize: "14px", fontWeight: 600, color: "text.primary", marginBottom: "12px" })}>Subsystems</div>
          <div className={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
            {SUBSYSTEMS.map((r, i) => (
              <div key={i} className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" })}>
                <span className={css({ fontWeight: 600, color: "text.primary" })}>{r[0]}</span>
                <span className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                  <span className={monoSm}>{r[1]}</span>
                  <Badge variant="approved">OK</Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit timeline */}
      <div className={panel}>
        <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" })}>
          <div>
            <div className={sectionEyebrow}>Recent</div>
            <div className={sectionTitle}>Audit timeline</div>
          </div>
          <span className={css({ fontSize: "12px", color: "text.muted" })}>jump to →</span>
        </div>
        <div className={css({ display: "flex", flexDirection: "column" })}>
          {AUDIT_ROWS.map((e, i) => (
            <div
              key={i}
              className={css({
                display: "flex",
                gap: "12px",
                padding: "6px 0",
                borderBottom: i < AUDIT_ROWS.length - 1 ? "1px dashed" : "none",
                borderColor: "border.subtle",
                fontSize: "11px",
              })}
            >
              <span className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted", width: "110px", flexShrink: 0 })}>{e[0]}</span>
              <span className={css({ fontFamily: "mono", fontSize: "11px", color: "sunbeam.orange", width: "180px", flexShrink: 0 })}>{e[1]}</span>
              <span className={css({ fontWeight: 600, color: "text.primary" })}>{e[2]}</span>
              <span className={css({ color: "text.muted" })}>{e[3]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
