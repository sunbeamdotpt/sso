import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, Badge, Spinner, Callout } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

interface Session {
  id: string;
  active: boolean;
  authenticated_at: string;
  expires_at: string;
  devices?: { id: string; ip_address?: string; user_agent?: string; location?: string }[];
  tokenized?: string;
}

interface SessionsResponse {
  sessions: Session[];
  current_session_id?: string;
}

function deviceIcon(ua: string | undefined): string {
  if (!ua) return "◻";
  const lower = ua.toLowerCase();
  if (lower.includes("iphone") || lower.includes("android")) return "📱";
  if (lower.includes("ipad") || lower.includes("tablet")) return "⌨";
  return "◻";
}

function deviceLabel(ua: string | undefined): string {
  if (!ua) return "Unknown device";
  if (/iphone/i.test(ua)) return "iPhone · " + (ua.match(/Safari\/[\d.]+/) ?? ["Safari"])[0];
  if (/ipad/i.test(ua)) return "iPad · Safari";
  if (/android/i.test(ua)) return "Android · " + (ua.match(/Chrome\/[\d.]+/) ?? ["Chrome"])[0];
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[1] ?? "Browser";
  const os = /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : /Linux/i.test(ua) ? "Linux" : "Unknown";
  return `${os} · ${browser}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "Active now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function AccountSessionsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.get<SessionsResponse>("/sessions"),
  });

  const sessions = data?.sessions ?? [];
  const currentId = data?.current_session_id;

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => api.delete("/sessions"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  if (isLoading) {
    return (
      <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={css({ maxWidth: "640px" })}>
      <h2 className={css({ fontSize: "24px", fontWeight: 600, fontFamily: "heading", color: "text.primary", marginBottom: "4px" })}>
        Active sessions
      </h2>
      <p className={css({ fontSize: "13px", color: "text.muted", marginBottom: "24px" })}>
        Devices where you're currently signed in.
      </p>

      {error && (
        <div className={css({ marginBottom: "16px" })}>
          <Callout variant="warning">
            {error instanceof Error ? error.message : "Failed to load sessions"}
          </Callout>
        </div>
      )}

      <div className={css({ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" })}>
        {sessions.length === 0 && !error && (
          <p className={css({ fontSize: "13px", color: "text.muted" })}>No active sessions found.</p>
        )}
        {sessions.map((session) => {
          const device = session.devices?.[0];
          const isCurrent = session.id === currentId;
          const ua = device?.user_agent;
          const location = device?.location ?? device?.ip_address ?? "Unknown location";

          return (
            <div
              key={session.id}
              className={css({
                border: "1.5px solid",
                borderColor: isCurrent ? "sunbeam.orange" : "border.default",
                padding: "16px",
                bg: "bg.surface",
                borderRadius: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              })}
            >
              <div className={css({ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 })}>
                {/* Device icon placeholder */}
                <div
                  className={css({
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid",
                    borderColor: "border.subtle",
                    bg: "bg.card",
                    flexShrink: 0,
                    fontSize: "18px",
                  })}
                >
                  {deviceIcon(ua)}
                </div>
                <div className={css({ minWidth: 0 })}>
                  <div className={css({ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" })}>
                    <span className={css({ fontSize: "13px", fontWeight: 600, color: "text.primary" })}>
                      {deviceLabel(ua)}
                    </span>
                    {isCurrent && <Badge variant="featured">THIS DEVICE</Badge>}
                  </div>
                  <div className={css({ fontSize: "11px", color: "text.muted", marginTop: "2px" })}>
                    {location} · {timeAgo(session.authenticated_at)}
                  </div>
                </div>
              </div>
              {!isCurrent && (
                <Button
                  variant="ghost"
                  onClick={() => revokeMutation.mutate(session.id)}
                  disabled={revokeMutation.isPending}
                >
                  Revoke
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className={css({ display: "flex", justifyContent: "flex-end" })}>
        <Button
          variant="ghost"
          onClick={() => revokeAllMutation.mutate()}
          disabled={revokeAllMutation.isPending}
        >
          {revokeAllMutation.isPending ? "Signing out…" : "Sign out everywhere else"}
        </Button>
      </div>
    </div>
  );
}
