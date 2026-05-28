import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Badge, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

function MethodTile({
  icon,
  label,
  sub,
  accent,
  onClick,
}: {
  icon: string;
  label: string;
  sub?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "12px",
        border: "1px solid",
        borderColor: accent ? "sunbeam.orange" : "border.default",
        borderRadius: "md",
        padding: "12px 14px",
        cursor: "pointer",
        bg: "bg.card",
        transition: "border-color 0.15s ease",
        _hover: { borderColor: "sunbeam.orange" },
        _focusVisible: { outline: "2px solid", outlineColor: "sunbeam.orange", outlineOffset: "2px" },
      })}
    >
      <span className={css({ fontSize: "18px", width: "24px", textAlign: "center", flexShrink: 0 })}>
        {icon}
      </span>
      <div className={css({ flex: 1 })}>
        <div className={css({ fontSize: "13px", fontWeight: "500", color: "text.primary" })}>{label}</div>
        {sub && <div className={css({ fontSize: "11px", color: "text.muted", marginTop: "2px" })}>{sub}</div>}
      </div>
    </div>
  );
}

export function LoginMfaPage() {
  const [searchParams] = useSearchParams();
  const flowId = searchParams.get("flow") ?? "";

  const { data: flow, isLoading, error } = useQuery({
    queryKey: ["flow", "login-mfa", flowId],
    queryFn: () => api.get<{ ui: { messages?: { text: string }[] } }>(`/flow/login?id=${flowId}`),
    enabled: !!flowId,
  });

  if (isLoading) {
    return (
      <div className={css({ display: "flex", justifyContent: "center", padding: "32px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
      <div className={css({ textAlign: "center" })}>
        <Badge variant="open">AAL2 REQUIRED</Badge>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginTop: "12px" })}>
          Second factor
        </h2>
        <p className={css({ fontSize: "13px", color: "text.muted", marginTop: "4px" })}>
          Choose how to verify it's you.
        </p>
      </div>

      {error && <Callout variant="warning">{error instanceof Error ? error.message : "Failed to load flow"}</Callout>}

      {flow?.ui?.messages?.map((msg, i) => (
        <Callout key={i} variant="warning">{msg.text}</Callout>
      ))}

      <div className={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
        <MethodTile icon="◆" label="Passkey" sub="MacBook Pro · last used 2d ago" accent />
        <MethodTile icon="#" label="Authenticator app" sub="6-digit TOTP code" />
        <MethodTile icon="🗝" label="Backup code" sub="lookup_secret" />
        <MethodTile icon="✉" label="Email me a code" sub="j…@studio.pt" />
      </div>

      <div className={css({ display: "flex", justifyContent: "space-between", fontSize: "11px" })}>
        <span className={css({ color: "text.muted" })}>Lost your device?</span>
        <Link
          to="/auth/recovery"
          className={css({ color: "sunbeam.orange", textDecoration: "none", _hover: { textDecoration: "underline" } })}
        >
          Recover account
        </Link>
      </div>
    </div>
  );
}
