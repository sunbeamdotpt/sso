import { type ReactNode } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Sidebar, Avatar, TextInput, Breadcrumbs } from "@sunbeam/beam-ui";
import { useState } from "react";
import type { NavSection } from "@sunbeam/beam-ui";
import { css } from "styled-system/css";

const adminNav: NavSection[] = [
  {
    title: "IDENTITIES",
    items: [
      { label: "Overview", href: "/admin" },
      { label: "Identities", href: "/admin/identities" },
      { label: "Sessions", href: "/admin/sessions" },
      { label: "Identity Schemas", href: "/admin/schemas" },
    ],
  },
  {
    title: "OAUTH2 / OIDC",
    items: [
      { label: "OAuth2 Clients", href: "/admin/clients" },
      { label: "JSON Web Keys", href: "/admin/jwks" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Courier Messages", href: "/admin/courier" },
      { label: "Self-Service Flows", href: "/admin/flows" },
    ],
  },
];

const ADMIN_CRUMB_LABELS: Record<string, string> = {
  admin: "Project",
  identities: "Identities",
  sessions: "Sessions",
  schemas: "Identity Schemas",
  clients: "OAuth2 Clients",
  jwks: "JSON Web Keys",
  courier: "Courier",
  flows: "Self-Service Flows",
};

function buildCrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Sunbeam", href: "/admin" }];
  const crumbs: Array<{ label: string; href: string }> = [
    { label: "Sunbeam", href: "/admin" },
  ];
  let acc = "";
  for (const part of parts) {
    acc += "/" + part;
    crumbs.push({
      label: ADMIN_CRUMB_LABELS[part] ?? part,
      href: acc,
    });
  }
  return crumbs;
}

export function AdminShellLayout(): ReactNode {
  const location = useLocation();
  const crumbs = buildCrumbs(location.pathname);
  const [search, setSearch] = useState("");

  return (
    <div className={pageGrid}>
      <header className={topbar}>
        <Link to="/admin" className={brand}>
          <span className={brandMark} />
          <span>Sunbeam</span>
          <span className={brandSub}>Identity Admin</span>
        </Link>
        <div className={crumbWrap}>
          <Breadcrumbs items={crumbs} />
        </div>
        <div className={topbarRight}>
          <div className={css({ width: "240px" })}>
            <TextInput
              value={search}
              onChange={setSearch}
              placeholder="Search identities, clients, flows…"
            />
          </div>
          <Avatar name="Admin" size="sm" />
        </div>
      </header>
      <aside className={sidebarWrap}>
        <Sidebar sections={adminNav} />
      </aside>
      <main className={mainArea}>
        <Outlet />
      </main>
    </div>
  );
}

const pageGrid = css({
  display: "grid",
  gridTemplateColumns: "240px 1fr",
  gridTemplateRows: "56px 1fr",
  gridTemplateAreas: '"top top" "side main"',
  minHeight: "100dvh",
  bg: "bg.page",
});

const topbar = css({
  gridArea: "top",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  paddingInline: "20px",
  borderBottom: "1.5px solid",
  borderColor: "border.default",
  bg: "bg.page",
  position: "sticky",
  top: 0,
  zIndex: 10,
});

const brand = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  textDecoration: "none",
  color: "text.primary",
  fontWeight: 600,
});

const brandMark = css({
  width: "16px",
  height: "16px",
  bg: "sunbeam.orange",
  display: "inline-block",
  transform: "rotate(45deg)",
});

const brandSub = css({
  fontSize: "12px",
  color: "text.muted",
  marginLeft: "4px",
});

const crumbWrap = css({
  marginLeft: "8px",
  flex: 1,
  minWidth: 0,
});

const topbarRight = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
});

const sidebarWrap = css({
  gridArea: "side",
  borderRight: "1.5px solid",
  borderColor: "border.default",
  bg: "bg.page",
  overflowY: "auto",
});

const mainArea = css({
  gridArea: "main",
  overflow: "auto",
  bg: "bg.page",
});
