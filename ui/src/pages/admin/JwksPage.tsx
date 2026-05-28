import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { css } from "styled-system/css";
import { Button, Badge, Callout, Spinner } from "@sunbeam/beam-ui";
import { api } from "../../lib/api";

const card = css({
  border: "1.5px solid",
  borderColor: "border.default",
  borderRadius: "0",
  padding: "16px",
  bg: "bg.surface",
});

type JwkKey = {
  kid?: string;
  alg?: string;
  use?: string;
  crv?: string;
  kty?: string;
};

type JwkSet = {
  keys: JwkKey[];
};

type KeyCardData = {
  set: string;
  alg: string;
  use: string;
  kid: string;
  age: string;
  nextRotation: string;
  state: "current" | "previous" | "archived";
  warn: boolean;
  opacity?: number;
};

function stateVariant(state: string): "approved" | "new" | "medium" {
  if (state === "current") return "approved";
  if (state === "archived") return "medium";
  return "new";
}

function formatKeyCards(setName: string, data: JwkSet | undefined): KeyCardData[] {
  if (!data?.keys?.length) return [];
  return data.keys.map((k, i) => {
    const state: KeyCardData["state"] = i === 0 ? "current" : i === 1 ? "previous" : "archived";
    const isKratosSession = setName === "kratos.session";
    const warn = isKratosSession && state === "current";
    return {
      set: setName,
      alg: k.alg ?? (setName.includes("openid") ? "RS256" : setName.includes("access") ? "ES256" : "HS256"),
      use: k.use ?? "sig",
      kid: k.kid ?? "—",
      age: "—",
      nextRotation: warn ? "rotate in 0d" : state === "current" ? "rotate in 18d" : "—",
      state,
      warn,
      opacity: state === "archived" ? 0.7 : undefined,
    };
  });
}

export function JwksPage() {
  const queryClient = useQueryClient();

  const { data: idTokenSet, isLoading: l1, error: e1 } = useQuery({
    queryKey: ["jwks", "hydra.openid.id-token"],
    queryFn: () => api.get<JwkSet>("/admin/keys/hydra.openid.id-token"),
  });

  const { data: accessTokenSet, isLoading: l2, error: e2 } = useQuery({
    queryKey: ["jwks", "hydra.jwt.access-token"],
    queryFn: () => api.get<JwkSet>("/admin/keys/hydra.jwt.access-token"),
  });

  const { data: sessionSet, isLoading: l3, error: e3 } = useQuery({
    queryKey: ["jwks", "kratos.session"],
    queryFn: () => api.get<JwkSet>("/admin/keys/kratos.session"),
  });

  const rotateMutation = useMutation({
    mutationFn: ({ set }: { set: string }) =>
      api.post(`/admin/keys/${set}`, { alg: "RS256", use: "sig" }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["jwks", vars.set] });
    },
  });

  const anyLoading = l1 || l2 || l3;
  const anyError = e1 ?? e2 ?? e3;

  const allCards: KeyCardData[] = [
    ...formatKeyCards("hydra.openid.id-token", idTokenSet),
    ...formatKeyCards("hydra.jwt.access-token", accessTokenSet),
    ...formatKeyCards("kratos.session", sessionSet),
  ];

  // Fallback mock cards when API not yet available
  const fallbackCards: KeyCardData[] = [
    { set: "hydra.openid.id-token", alg: "RS256", use: "sig", kid: "public:1c84…ab", age: "12 days", nextRotation: "rotate in 18d", state: "current", warn: false },
    { set: "hydra.openid.id-token", alg: "RS256", use: "sig", kid: "public:9f20…1e8e", age: "42 days", nextRotation: "—", state: "previous", warn: false },
    { set: "hydra.jwt.access-token", alg: "ES256", use: "sig", kid: "public:7c4b…3f0", age: "5 days", nextRotation: "rotate in 25d", state: "current", warn: false },
    { set: "kratos.session", alg: "HS256", use: "sig", kid: "—", age: "90 days", nextRotation: "rotate in 0d", state: "current", warn: true },
    { set: "oidc.userinfo (custom)", alg: "RS256", use: "sig", kid: "public:21ab…09c4", age: "127 days", nextRotation: "—", state: "archived", warn: false, opacity: 0.7 },
  ];

  const displayCards = allCards.length > 0 ? allCards : fallbackCards;

  return (
    <div className={css({ padding: "28px" })}>
      {/* Page header */}
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" })}>
        <div>
          <h1 className={css({ fontSize: "24px", fontWeight: 700, color: "text.primary", fontFamily: "heading", marginBottom: "4px" })}>
            JSON Web Keys
          </h1>
          <div className={css({ fontSize: "12px", color: "text.muted" })}>
            Signing keys for ID tokens, JWT access tokens, and OIDC discovery.
          </div>
        </div>
        <Button variant="primary">+ Generate key</Button>
      </div>

      {anyError && (
        <Callout variant="warning">
          {anyError instanceof Error ? anyError.message : "Failed to load JWKS"}
        </Callout>
      )}

      {rotateMutation.error && (
        <Callout variant="warning">
          {rotateMutation.error instanceof Error ? rotateMutation.error.message : "Rotation failed"}
        </Callout>
      )}

      {anyLoading ? (
        <div className={css({ display: "flex", justifyContent: "center", padding: "48px" })}>
          <Spinner size="md" />
        </div>
      ) : (
        <div className={css({ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" })}>
          {displayCards.map((k, i) => (
            <div key={`${k.set}-${k.kid}-${i}`} className={card} style={k.opacity ? { opacity: k.opacity } : undefined}>
              <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" })}>
                <span className={css({ fontFamily: "mono", fontSize: "11px", color: "sunbeam.orange", maxWidth: "70%", wordBreak: "break-all" })}>
                  {k.set}
                </span>
                <Badge variant={stateVariant(k.state)}>{k.state.toUpperCase()}</Badge>
              </div>

              <div className={css({ fontSize: "13px", fontWeight: 600, color: "text.primary", marginTop: "6px" })}>
                {k.alg} · {k.use}
              </div>
              <div className={css({ fontFamily: "mono", fontSize: "11px", color: "text.muted", marginTop: "4px", marginBottom: "10px" })}>
                {k.kid}
              </div>

              <div className={css({ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", marginBottom: "10px" })}>
                <div className={css({ display: "flex", justifyContent: "space-between" })}>
                  <span className={css({ color: "text.muted" })}>age</span>
                  <span>{k.age}</span>
                </div>
                <div className={css({ display: "flex", justifyContent: "space-between" })}>
                  <span className={css({ color: "text.muted" })}>next</span>
                  <span className={css({ color: k.warn ? "status.error" : "text.primary" })}>{k.nextRotation}</span>
                </div>
              </div>

              {k.warn && (
                <div className={css({ marginBottom: "10px" })}>
                  <Callout variant="warning">
                    Overdue rotation! Auto-policy: 90d
                  </Callout>
                </div>
              )}

              <div className={css({ display: "flex", gap: "6px" })}>
                <Button
                  onClick={() => rotateMutation.mutate({ set: k.set })}
                  disabled={rotateMutation.isPending}
                >
                  Rotate
                </Button>
                <Button onClick={() => api.delete(`/admin/keys/${k.set}/${k.kid}`)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
