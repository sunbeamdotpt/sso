/** Mock Hydra consent + login + logout request payloads. */

export const consentRequest = {
  challenge: "consent-challenge-test",
  client: {
    client_id: "sol-studio-prod",
    client_name: "Sol Studio",
    logo_uri: "https://cdn.sunbeam.pt/sol/icon.png",
  },
  subject: "8e9105a2-58a0-4b1c-9d33-7e6a2ab44f10",
  requested_scope: ["profile", "email", "projects:read", "projects:write", "offline_access"],
  requested_access_token_audience: ["https://api.sunbeam.pt"],
  skip: false,
};

export const consentRequestSkip = { ...consentRequest, skip: true };

export const loginRequest = {
  challenge: "login-challenge-test",
  client: {
    client_id: "mth-cli",
    client_name: "Marathon CLI",
  },
  subject: "",
  skip: false,
  request_url: "http://localhost:5175/oauth2/login?login_challenge=login-challenge-test",
};

export const logoutRequest = {
  challenge: "logout-challenge-test",
  client: {
    client_id: "sol-studio-prod",
    client_name: "Sol Studio",
  },
  subject: "8e9105a2-58a0-4b1c-9d33-7e6a2ab44f10",
  request_url: "http://localhost:5175/oauth2/sessions/logout?logout_challenge=logout-challenge-test",
};

export const acceptResponse = { redirect_to: "https://sol.sunbeam.pt/auth/callback?code=mock" };
