import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { api } from "../api/client.ts";
import type { VerificationFlow } from "../api/types.ts";

export function VerificationFlowPage() {
  const query = useRestQuery<VerificationFlow>(api, "/self-service/verification/api", {
    queryKey: ["verification-flow"],
  });

  return (
    <div className={container}>
      <h1 className={title}>Verification Flow</h1>

      {query.isLoading && <p className={status}>Loading…</p>}
      {query.error && <p className={errorText}>Error: {query.error.message}</p>}

      {query.data && (
        <div className={card}>
          <div className={field}>
            <span className={label}>Flow ID</span>
            <span className={value}>{query.data.id}</span>
          </div>
          <div className={field}>
            <span className={label}>Type</span>
            <span className={value}>{query.data.type}</span>
          </div>
          <div className={field}>
            <span className={label}>State</span>
            <span className={value}>{query.data.state ?? "—"}</span>
          </div>
          <pre className={codeBlock}>
            {JSON.stringify(query.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

const container = css({
  padding: "24px",
  maxWidth: "800px",
  margin: "0 auto",
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
  marginBottom: "16px",
});

const status = css({
  color: "text.secondary",
});

const errorText = css({
  color: "error",
});

const card = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid",
  borderColor: "border.default",
  background: "bg.surface",
});

const field = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

const label = css({
  fontSize: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "text.tertiary",
});

const value = css({
  fontSize: "sm",
  color: "text.primary",
  fontFamily: "mono",
});

const codeBlock = css({
  margin: 0,
  fontSize: "xs",
  fontFamily: "mono",
  background: "bg.subtle",
  padding: "12px",
  borderRadius: "6px",
  overflow: "auto",
});
