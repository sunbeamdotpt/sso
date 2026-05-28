import { useSearchParams, useNavigate } from "react-router-dom";
import { css } from "styled-system/css";
import { Button } from "@sunbeam/beam-ui";

export function FlowExpiredPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const flowId = searchParams.get("flow_id") ?? searchParams.get("flow") ?? "";

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" })}>
      <div>
        <div className={css({ fontSize: "48px", lineHeight: "1" })}>⏱</div>
        <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginTop: "8px" })}>
          This flow has expired
        </h2>
        <p className={css({ fontSize: "13px", color: "text.muted", marginTop: "8px", lineHeight: "1.5" })}>
          For your security, sign-in flows expire after 1 hour. Start fresh below — your progress is gone.
        </p>
        {flowId && (
          <div
            className={css({
              marginTop: "12px",
              display: "inline-block",
              padding: "6px 10px",
              bg: "bg.card",
              border: "1px solid",
              borderColor: "border.default",
              borderRadius: "md",
              fontFamily: "mono",
              fontSize: "12px",
              color: "text.muted",
            })}
          >
            flow_id: {flowId}
          </div>
        )}
      </div>

      <Button variant="primary" type="button" onClick={() => navigate("/auth/login")}>
        Start over
      </Button>
    </div>
  );
}
