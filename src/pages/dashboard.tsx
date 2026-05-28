import { Link } from "@tanstack/react-router";
import { useRestQuery } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { api } from "../api/client.ts";
import type { Version } from "../api/types.ts";

export function DashboardPage() {
  const version = useRestQuery<Version>(api, "/version", {
    queryKey: ["version"],
  });

  return (
    <div className={container}>
      <h1 className={title}>Sunbeam SSO</h1>
      <p className={subtitle}>Identity & self-service administration</p>

      {version.data && (
        <p className={versionText}>Kratos version: {version.data.version}</p>
      )}

      <nav className={navGrid} aria-label="Dashboard navigation">
        <Link to="/identities" className={card}>
          <span className={cardIcon}>people</span>
          <span className={cardTitle}>Identities</span>
          <span className={cardDesc}>Manage users and traits</span>
        </Link>
        <Link to="/login" className={card}>
          <span className={cardIcon}>login</span>
          <span className={cardTitle}>Login Flows</span>
          <span className={cardDesc}>Configure authentication</span>
        </Link>
        <Link to="/registration" className={card}>
          <span className={cardIcon}>person_add</span>
          <span className={cardTitle}>Registration</span>
          <span className={cardDesc}>Sign-up experiences</span>
        </Link>
        <Link to="/recovery" className={card}>
          <span className={cardIcon}>key</span>
          <span className={cardTitle}>Recovery</span>
          <span className={cardDesc}>Password reset flows</span>
        </Link>
        <Link to="/settings" className={card}>
          <span className={cardIcon}>settings</span>
          <span className={cardTitle}>Settings</span>
          <span className={cardDesc}>Profile & security</span>
        </Link>
        <Link to="/verification" className={card}>
          <span className={cardIcon}>verified</span>
          <span className={cardTitle}>Verification</span>
          <span className={cardDesc}>Email & address verify</span>
        </Link>
        <Link to="/health" className={card}>
          <span className={cardIcon}>monitor_heart</span>
          <span className={cardTitle}>Health</span>
          <span className={cardDesc}>System status</span>
        </Link>
      </nav>
    </div>
  );
}

const container = css({
  padding: "24px",
  maxWidth: "1200px",
  margin: "0 auto",
});

const title = css({
  fontSize: "2xl",
  fontWeight: "bold",
  color: "text.primary",
  marginBottom: "4px",
});

const subtitle = css({
  fontSize: "md",
  color: "text.secondary",
  marginBottom: "16px",
});

const versionText = css({
  fontSize: "sm",
  color: "text.tertiary",
  marginBottom: "24px",
  fontFamily: "mono",
});

const navGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "16px",
});

const card = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid",
  borderColor: "border.default",
  background: "bg.surface",
  textDecoration: "none",
  transition: "box-shadow 0.15s ease",
  _hover: {
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    borderColor: "border.hover",
  },
});

const cardIcon = css({
  fontFamily: "'Material Symbols Outlined'",
  fontSize: "28px",
  color: "accent",
});

const cardTitle = css({
  fontSize: "md",
  fontWeight: "semibold",
  color: "text.primary",
});

const cardDesc = css({
  fontSize: "sm",
  color: "text.secondary",
});
