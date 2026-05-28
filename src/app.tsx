import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Shell, NotificationCenter, Avatar, Button } from "@sunbeam/beam-ui";
import { useAuth } from "@sunbeam/g2v";
import { useTheme } from "@sunbeam/g2v";
import type { Notification } from "@sunbeam/beam-ui";
import type { AuthClaims } from "@sunbeam/g2v/state";
import { css } from "styled-system/css";
import { SidebarLayout } from "./components/sidebar-layout.tsx";
import { api } from "./api/client.ts";
import { clearSession } from "./providers/auth.tsx";

const STORAGE_KEY_OPEN = "kratos-admin:sidebar-open";

function readSidebarOpen(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OPEN);
    return raw !== "false";
  } catch {
    return true;
  }
}

function writeSidebarOpen(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_OPEN, String(open));
  } catch {
    // ignore
  }
}

const brandStyle = css({
  textDecoration: "none",
  fontSize: "20px",
  fontFamily: "heading",
  fontWeight: "heading",
  letterSpacing: "-0.3px",
  color: "text.primary",
});

const waffleBtn = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  borderRadius: "md",
  border: "none",
  backgroundColor: "transparent",
  color: "text.secondary",
  cursor: "pointer",
  transition: "all 0.15s",
  _hover: {
    color: "text.primary",
    bg: "bg.hover",
  },
});

function HeaderActions() {
  const { isAuthenticated, token, claims, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleLogout = async () => {
    await clearSession();
    logout();
    navigate({ to: "/login" });
  };

  if (!isAuthenticated) {
    return (
      <Link to="/login" className={css({ textDecoration: "none" })}>
        <Button variant="dark">Log in</Button>
      </Link>
    );
  }

  const userClaims = claims as AuthClaims | undefined;

  return (
    <>
      <NotificationCenter
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
      />
      <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
        <Avatar name={userClaims?.name ?? userClaims?.email ?? "User"} size="sm" />
        <Button variant="ghost" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </>
  );
}

export function App() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      writeSidebarOpen(next);
      return next;
    });
  }, []);

  // Keep document.documentElement.dataset.theme in sync so beam-ui components
  // (which read from it via MutationObserver) react immediately.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // When beam-ui's ThemeToggle changes the DOM attribute, sync the change
  // back to g2v's canonical store.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ theme: "light" | "dark" }>).detail;
      setTheme(detail.theme);
    };
    document.addEventListener("sunbeam:themechange", handler);
    return () => document.removeEventListener("sunbeam:themechange", handler);
  }, [setTheme]);

  // When not logged in, show only the page content (login/registration/recovery).
  // No sidebar, no app header, no shell chrome.
  if (!isAuthenticated) {
    return (
      <div data-theme={theme} style={{ height: "100%" }}>
        <Outlet />
      </div>
    );
  }

  const brand = (
    <div className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
      <button
        type="button"
        onClick={toggleSidebar}
        className={waffleBtn}
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        aria-pressed={sidebarOpen}
        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
          {sidebarOpen ? "dock_to_left" : "dock_to_left"}
        </span>
      </button>
      <Link to="/" className={brandStyle}>
        Sunbeam SSO
      </Link>
    </div>
  );

  return (
    <div data-theme={theme} style={{ height: "100%" }}>
      <Shell
        footer={null}
        headerActions={<HeaderActions />}
        brand={brand}
        fullWidth
      >
        <SidebarLayout open={sidebarOpen}>
          <Outlet />
        </SidebarLayout>
      </Shell>
    </div>
  );
}
