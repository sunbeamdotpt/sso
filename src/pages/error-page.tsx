import { Link, useSearch } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { Button } from "@sunbeam/beam-ui";
import { sanitizeDisplayText } from "../utils/redirect.ts";

export function ErrorPage() {
  const search = useSearch({ from: "/error" });
  const params = search as Record<string, unknown>;
  const error = sanitizeDisplayText(params.error) || "unknown_error";
  const errorDescription = sanitizeDisplayText(params.error_description);
  const errorHint = sanitizeDisplayText(params.error_hint);

  return (
    <div className={wrapper}>
      <div className={card}>
        <h1 className={title}>Something went wrong</h1>
        <p className={code}>{error}</p>

        {errorDescription && <p className={description}>{errorDescription}</p>}

        {errorHint && <p className={hint}>{errorHint}</p>}

        <div className={actions}>
          <Link to="/login">
            <Button variant="primary">Back to sign in</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

const wrapper = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "24px",
  backgroundColor: "bg.page",
});

const card = css({
  width: "100%",
  maxWidth: "400px",
  padding: "32px",
  borderRadius: "md",
  border: "1px solid",
  borderColor: "border.subtle",
  backgroundColor: "bg.card",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  textAlign: "center",
});

const title = css({
  fontSize: "xl",
  fontWeight: "bold",
  color: "text.primary",
});

const code = css({
  fontSize: "sm",
  fontFamily: "mono",
  color: "error",
});

const description = css({
  fontSize: "sm",
  color: "text.secondary",
});

const hint = css({
  fontSize: "xs",
  color: "text.muted",
});

const actions = css({
  marginTop: "8px",
});
