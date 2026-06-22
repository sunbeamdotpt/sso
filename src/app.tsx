import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Button } from "@sunbeam/beam-ui";
import { useAuth, useTheme } from "@sunbeam/g2v";
import { css } from "styled-system/css";
import { clearSession } from "./providers/auth.tsx";

const headerBar = css({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  height: "64px",
  paddingInline: { base: "16px", md: "24px", lg: "32px" },
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderBottom: "1px solid",
  borderColor: "border.subtle",
  bg: "bg.nav",
  shadow: "nav",
  _dark: {
    bg: "rgba(31, 31, 31, 0.85)",
    borderColor: "rgba(255, 161, 16, 0.12)",
    boxShadow: "0 3px 20px rgba(127, 99, 21, 0.15), 0 1px 0 rgba(255, 161, 16, 0.08) inset",
  },
  _light: {
    bg: "rgba(255, 250, 235, 0.85)",
    borderColor: "rgba(127, 99, 21, 0.12)",
    boxShadow: "0 3px 20px rgba(127, 99, 21, 0.12), 0 1px 0 rgba(255, 255, 255, 0.5) inset",
  },
});

function HeaderLogout() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await clearSession();
    logout();
    globalThis.location.href = "/login";
  };

  return (
    <Button variant="ghost" onClick={handleLogout}>
      Log out
    </Button>
  );
}

export function App() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();

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

  // When not logged in, show only the page content (login).
  // No app header, no shell chrome.
  if (!isAuthenticated) {
    return (
      <div data-theme={theme} style={{ height: "100%" }}>
        <Outlet />
      </div>
    );
  }

  return (
    <div data-theme={theme} style={{ height: "100%" }}>
      <header className={headerBar}>
        <HeaderLogout />
      </header>
      <main style={{ paddingTop: "64px", height: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}
