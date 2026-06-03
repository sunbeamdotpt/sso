import { useParams } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { ScrollArea } from "@sunbeam/beam-ui";
import { api } from "../api/client.ts";

export function SchemaDetailPage() {
  const { id } = useParams({ from: "/schemas/$id" });
  const query = useRestQuery<Record<string, unknown>>(api, `/schemas/${id}`, {
    queryKey: ["schema", id],
    enabled: Boolean(id),
  });

  return (
    <ScrollArea maxHeight="calc(100vh - 88px)" direction="vertical">
      <div className={container}>
      <h1 className={title}>Schema: {id}</h1>

      {query.isLoading && <p className={status}>Loading…</p>}
      {query.error && <p className={errorText}>Error: {query.error.message}</p>}

      {query.data && (
        <pre className={codeBlock}>
          {JSON.stringify(query.data, null, 2)}
        </pre>
      )}
      </div>
    </ScrollArea>
  );
}

const container = css({
  padding: "24px",
  maxWidth: "900px",
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

const codeBlock = css({
  margin: 0,
  fontSize: "sm",
  fontFamily: "mono",
  background: "bg.card",
  padding: "20px",
  borderRadius: "12px",
  overflow: "auto",
  border: "1px solid",
  borderColor: "border.default",
});
