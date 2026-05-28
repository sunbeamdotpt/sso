import { type ReactNode } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Avatar } from "@sunbeam/beam-ui";
import { css } from "styled-system/css";

const items = [
  { label: "Profile", href: "/account/profile" },
  { label: "Security", href: "/account/security" },
  { label: "Sessions", href: "/account/sessions" },
];

export function AccountShell(): ReactNode {
  return (
    <div className={page}>
      <header className={topbar}>
        <div className={brand}>
          <span className={brandMark} />
          <span>Sunbeam</span>
          <span className={brandSub}>Account</span>
        </div>
        <Avatar name="JS" size="sm" />
      </header>
      <div className={body}>
        <aside className={side}>
          <div className={eyebrow}>SETTINGS</div>
          <nav className={navList}>
            {items.map((it) => (
              <NavLink
                key={it.href}
                to={it.href}
                className={({ isActive }) =>
                  isActive ? `${navItem} ${navItemActive}` : navItem
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className={main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const page = css({
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  bg: "bg.page",
});

const topbar = css({
  height: "56px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingInline: "24px",
  bg: "bg.surface",
  borderBottom: "1.5px solid",
  borderColor: "border.default",
});

const brand = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 600,
});

const brandMark = css({
  width: "14px",
  height: "14px",
  bg: "sunbeam.orange",
  display: "inline-block",
  transform: "rotate(45deg)",
});

const brandSub = css({
  fontSize: "12px",
  color: "text.muted",
  marginLeft: "4px",
});

const body = css({
  flex: 1,
  display: "grid",
  gridTemplateColumns: "200px 1fr",
});

const side = css({
  borderRight: "1.5px solid",
  borderColor: "border.subtle",
  paddingBlock: "24px",
  paddingInline: "16px",
});

const eyebrow = css({
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "sunbeam.orange",
  marginBottom: "12px",
  paddingInline: "8px",
});

const navList = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

const navItem = css({
  paddingBlock: "6px",
  paddingInline: "8px",
  fontSize: "14px",
  textDecoration: "none",
  color: "text.secondary",
  borderLeft: "2px solid transparent",
  transition: "all 0.15s",
  _hover: { color: "sunbeam.orange" },
});

const navItemActive = css({
  color: "sunbeam.orange",
  fontWeight: 700,
  borderLeftColor: "sunbeam.orange",
  bg: "rgba(250,82,15,0.08)",
});

const main = css({
  padding: "32px",
  overflow: "auto",
});
