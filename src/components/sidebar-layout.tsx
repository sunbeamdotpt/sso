import { useRef, useState, useCallback, useEffect } from "react";
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
});

const contentPanel = css({
  height: "100%",
  overflowY: "auto",
  padding: "24px",
  flex: 1,
});

const resizeHandle = css({
  width: "8px",
  cursor: "col-resize",
  backgroundColor: "transparent",
  border: "none",
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s ease",
  _hover: {
    "& > div": {
      backgroundColor: "sunbeam.orange",
    },
  },
  _active: {
    "& > div": {
      backgroundColor: "sunbeam.orange",
    },
  },
});

const resizeBar = css({
  width: "2px",
  height: "32px",
  backgroundColor: "border.default",
  borderRadius: "full",
  transition: "background-color 0.15s ease",
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

const STORAGE_KEY_SIZE = "kratos-admin:sidebar-size";
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;

function readSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIZE);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isNaN(n) ? DEFAULT_WIDTH : Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
  } catch {
    return DEFAULT_WIDTH;
  }
}

function writeSidebarWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY_SIZE, String(Math.round(width)));
  } catch {
    // ignore
  }
}

interface SidebarLayoutProps {
  children: React.ReactNode;
  open: boolean;
}

export function SidebarLayout({
  children,
  open,
}: SidebarLayoutProps) {
  const [width, setWidth] = useState(readSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      writeSidebarWidth(width);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, width]);

  if (!open) {
    return (
      <div className={css({ display: "flex", height: "100%", overflow: "hidden" })}>
        <div className={contentPanel}>{children}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={css({ display: "flex", height: "100%", overflow: "hidden" })}>
      <div style={{ width, flexShrink: 0 }}>
        <Sidebar />
      </div>
      <button
        type="button"
        className={resizeHandle}
        onMouseDown={handleMouseDown}
        aria-label="Resize sidebar"
      >
        <div className={resizeBar} />
      </button>
      <div className={contentPanel}>{children}</div>
    </div>
  );
}
