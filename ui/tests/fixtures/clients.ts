export type OAuth2Client = {
  client_id: string;
  client_name: string;
  client_uri?: string;
  logo_uri?: string;
  policy_uri?: string;
  contacts?: string[];
  grant_types: string[];
  response_types: string[];
  redirect_uris: string[];
  post_logout_redirect_uris?: string[];
  scope: string;
  audience?: string[];
  token_endpoint_auth_method: string;
  access_token_strategy?: string;
  authorization_code_grant_access_token_lifespan?: string;
  authorization_code_grant_id_token_lifespan?: string;
  authorization_code_grant_refresh_token_lifespan?: string;
  created_at: string;
  updated_at: string;
};

const isoNow = new Date().toISOString();

export const clientSol: OAuth2Client = {
  client_id: "sol-studio-prod",
  client_name: "Sol Studio (web)",
  client_uri: "https://sol.sunbeam.pt",
  logo_uri: "https://cdn.sunbeam.pt/sol/icon.png",
  policy_uri: "https://sunbeam.pt/legal/privacy",
  contacts: ["security@studio.pt"],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  redirect_uris: [
    "https://sol.sunbeam.pt/auth/callback",
    "https://staging.sol.sunbeam.pt/auth/callback",
    "http://localhost:5173/auth/callback",
  ],
  post_logout_redirect_uris: ["https://sol.sunbeam.pt/", "https://staging.sol.sunbeam.pt/"],
  scope: "openid profile email projects:read projects:write offline_access",
  audience: ["https://api.sunbeam.pt"],
  token_endpoint_auth_method: "none",
  authorization_code_grant_access_token_lifespan: "15m",
  authorization_code_grant_id_token_lifespan: "1h",
  authorization_code_grant_refresh_token_lifespan: "30d",
  created_at: "2024-03-04T10:00:00Z",
  updated_at: isoNow,
};

export const clientList: OAuth2Client[] = [
  clientSol,
  {
    ...clientSol,
    client_id: "mth-cli",
    client_name: "Marathon CLI",
    grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
    redirect_uris: [],
    token_endpoint_auth_method: "none",
  },
  {
    ...clientSol,
    client_id: "reports-svc",
    client_name: "Internal Reports API",
    grant_types: ["client_credentials"],
    redirect_uris: [],
    token_endpoint_auth_method: "client_secret_basic",
    scope: "reports:read",
  },
];
