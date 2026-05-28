import { Link, useLocation } from "@tanstack/react-router";
import { css } from "styled-system/css";

const sidebarNav = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  listStyle: "none",
  padding: 0,
  margin: 0,
});

const navLink = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  paddingBlock: "10px",
  paddingInline: "16px",
  fontSize: "14px",
  fontWeight: "body",
  color: "text.secondary",
  textDecoration: "none",
  borderRadius: "sm",
  transition: "all 0.15s",
  _hover: {
    color: "accent",
    bg: "bg.hover",
  },
});

const navLinkActive = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  paddingBlock: "10px",
  paddingInline: "16px",
  fontSize: "14px",
  fontWeight: "button",
  color: "accent",
  textDecoration: "none",
  borderRadius: "sm",
  bg: "rgba(250, 82, 15, 0.08)",
});

const icon = css({
  fontFamily: "'Material Symbols Outlined'",
  fontSize: "20px",
  color: "inherit",
});

const sidebarHeader = css({
  fontSize: "11px",
  fontWeight: "button",
  color: "text.muted",
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  paddingInline: "16px",
  paddingBlock: "16px",
  marginBottom: "8px",
});

const sidebarPanel = css({
  height: "100%",
  overflowY: "auto",
  paddingBlock: "16px",
  bg: "bg.surface",
  borderRight: "1px solid",
  borderColor: "border.default",
  width: "240px",
  flexShrink: 0,
});

const contentPanel = css({
  height: "100%",
  overflowY: "auto",
  padding: "24px",
  flex: 1,
});

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Identities", href: "/identities", icon: "people" },
  { label: "Login Flow", href: "/login", icon: "login" },
  { label: "Registration", href: "/registration", icon: "person_add" },
  { label: "Recovery", href: "/recovery", icon: "key" },
  { label: "Settings", href: "/settings", icon: "settings" },
  { label: "Verification", href: "/verification", icon: "verified" },
  { label: "Health", href: "/health", icon: "monitor_heart" },
];

function Sidebar() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  return (
    <div className={sidebarPanel}>
      <div className={sidebarHeader}>Kratos Services</div>
      <nav aria-label="Kratos services">
        <ul className={sidebarNav}>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={isActive(item.href) ? navLinkActive : navLink}
                {...(isActive(item.href) ? { "aria-current": "page" as const } : {})}
              >
                <span className={icon}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

interface SidebarLayoutProps {
  children: React.ReactNode;
  open: boolean;
}

export function SidebarLayout({
  children,
  open,
}: SidebarLayoutProps) {
  return (
    <div className={css({ display: "flex", height: "100%", overflow: "hidden" })}>
      {open && <Sidebar />}
      <div className={contentPanel}>{children}</div>
    </div>
  );
}
