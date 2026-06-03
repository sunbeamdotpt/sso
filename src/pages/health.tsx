import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { api } from "../api/client.ts";
import { ScrollArea } from "@sunbeam/beam-ui";
import type { HealthStatus, HealthNotReadyStatus } from "../api/types.ts";

export function HealthPage() {
  const alive = useRestQuery<HealthStatus>(api, "/health/alive", {
    queryKey: ["health", "alive"],
    refetchInterval: 10_000,
  });

  const ready = useRestQuery<HealthNotReadyStatus>(api, "/health/ready", {
    queryKey: ["health", "ready"],
    refetchInterval: 10_000,
  });

  return (
    <ScrollArea maxHeight="calc(100vh - 88px)" direction="vertical">
      <div className={container}>
      <h1 className={title}>Health</h1>

      <div className={grid}>
        <div className={card}>
          <h2 className={cardTitle}>Alive</h2>
          {alive.isLoading && <p className={status}>Checking…</p>}
          {alive.error && (
            <p className={errorText}>Error: {alive.error.message}</p>
          )}
          {alive.data && (
            <div className={badgeWrapper}>
              <span
                className={
                  alive.data.status === "ok" ? badgeSuccess : badgeError
                }
              >
                {alive.data.status}
              </span>
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className={cardTitle}>Ready</h2>
          {ready.isLoading && <p className={status}>Checking…</p>}
          {ready.error && (
            <p className={errorText}>Error: {ready.error.message}</p>
          )}
          {ready.data && (
            <>
              <div className={badgeWrapper}>
                <span
                  className={
                    ready.data.status === "ok" ? badgeSuccess : badgeError
                  }
                >
                  {ready.data.status}
                </span>
              </div>
              {ready.data.errors && (
                <pre className={codeBlock}>
                  {JSON.stringify(ready.data.errors, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </ScrollArea>
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

const grid = css({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
});

const card = css({
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid",
  borderColor: "border.default",
  background: "bg.card",
});

const cardTitle = css({
  fontSize: "md",
  fontWeight: "semibold",
  color: "text.primary",
  marginBottom: "12px",
});

const status = css({
  color: "text.secondary",
});

const errorText = css({
  color: "error",
  fontSize: "sm",
});

const badgeWrapper = css({
  display: "flex",
  alignItems: "center",
});

const badge = css({
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 12px",
  borderRadius: "999px",
  fontSize: "sm",
  fontWeight: "semibold",
});

const badgeSuccess = css({
  ...badge,
  backgroundColor: "success",
  color: "white",
});

const badgeError = css({
  ...badge,
  backgroundColor: "error",
  color: "white",
});

const codeBlock = css({
  marginTop: "12px",
  marginBottom: 0,
  fontSize: "xs",
  fontFamily: "mono",
  background: "bg.card",
  padding: "12px",
  borderRadius: "6px",
  overflow: "auto",
});
