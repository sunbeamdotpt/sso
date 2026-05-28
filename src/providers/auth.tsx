import { useEffect, useState } from "react";
import { authActions } from "@sunbeam/g2v/state";
import type { Session, Identity } from "../api/types.ts";

function getDisplayName(identity: Identity): string {
  const traits = identity.traits as Record<string, unknown>;
  const email = typeof traits?.email === "string" ? traits.email : "";
  return email || identity.id.slice(0, 8);
}

/**
 * Validate the current Kratos browser session via cookie and hydrate the auth store.
 */
export async function validateSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/sessions/whoami", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const session = (await res.json()) as Session;
    if (session.active) {
      authActions.loginSuccess({
        accessToken: "cookie",
        claims: {
          sub: session.identity.id,
          email: (session.identity.traits as Record<string, string>)?.email,
          name: getDisplayName(session.identity),
          aal: session.authenticator_assurance_level ?? "aal1",
        },
      });
      return true;
    }
  } catch {
    // Session is invalid or expired
  }
  authActions.logout();
  return false;
}

/**
 * Store user session in the auth store after successful login/registration.
 * The actual session is managed by Kratos via HTTP-only cookie.
 */
export function setUserSession(identity: Identity, aal?: string) {
  authActions.loginSuccess({
    accessToken: "cookie",
    claims: {
      sub: identity.id,
      email: (identity.traits as Record<string, string>)?.email,
      name: getDisplayName(identity),
      aal: aal ?? "aal1",
    },
  });
}

/**
 * Clear the current Kratos browser session.
 */
export async function clearSession() {
  try {
    const initRes = await fetch("/api/self-service/logout/browser", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (initRes.ok) {
      const data = (await initRes.json()) as { logout_token?: string };
      if (data.logout_token) {
        await fetch(`/api/self-service/logout?token=${data.logout_token}`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
      }
    }
  } catch {
    // Ignore logout errors
  }
  authActions.logout();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    validateSession().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--colors-text-secondary)",
        }}
      >
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
