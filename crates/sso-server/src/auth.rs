use std::sync::Arc;
use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde::Deserialize;

use crate::AppState;

#[derive(Debug, Clone, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub email: String,
    pub identity: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub session: SessionInfo,
    pub is_admin: bool,
    pub has_2fa: bool,
}

fn extract_session_cookie(header: &str) -> Option<String> {
    header.split(';').find_map(|c| {
        let c = c.trim();
        if c.starts_with("ory_session_") || c.starts_with("ory_kratos_session") {
            Some(c.to_string())
        } else {
            None
        }
    })
}

pub async fn auth_middleware(
    axum::extract::Extension(state): axum::extract::Extension<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path();

    // Static assets and SPA bootstrap must be served without auth
    if path.starts_with("/assets/")
        || path == "/index.html"
        || path == "/favicon.ico"
        || path == "/health"
        || path == "/health/live"
        || path == "/health/ready"
    {
        return next.run(req).await;
    }

    // Public SPA routes (auth, OAuth, onboarding) — unauthenticated users must reach these
    if path.starts_with("/auth/")
        || path.starts_with("/oauth2/")
        || path == "/onboarding"
        || path.starts_with("/onboarding/")
    {
        return next.run(req).await;
    }

    // API flow endpoints are public (Kratos handles its own auth)
    if path.starts_with("/api/flow/") || path.starts_with("/api/hydra/") {
        return next.run(req).await;
    }

    // All other API and page routes need a session
    let cookie_header = req
        .headers()
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let session_cookie = match extract_session_cookie(cookie_header) {
        Some(c) => c,
        None => {
            if path.starts_with("/api/") || accepts_json(&req) {
                return (StatusCode::UNAUTHORIZED, Body::from(r#"{"error":"Unauthorized"}"#))
                    .into_response();
            }
            let login_url = format!(
                "{}/auth/login?return_to={}",
                state.config.public_url,
                urlencoding::encode(&(state.config.public_url.clone() + path))
            );
            return (StatusCode::FOUND, [("location", login_url)], Body::empty()).into_response();
        }
    };

    // Validate session with Kratos
    let whoami_url = format!("{}/sessions/whoami", state.config.kratos_public_url);
    let resp = match state
        .http
        .get(&whoami_url)
        .header("cookie", &session_cookie)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            return (StatusCode::SERVICE_UNAVAILABLE, Body::from("Kratos unavailable"))
                .into_response();
        }
    };

    if resp.status() == reqwest::StatusCode::FORBIDDEN {
        // AAL2 required
        let body = resp.json::<serde_json::Value>().await.ok();
        let redirect_to = body
            .as_ref()
            .and_then(|b| b.get("redirect_browser_to").and_then(|v| v.as_str().map(String::from)))
            .or_else(|| {
                body.as_ref().and_then(|b| {
                    b.pointer("/error/details/redirect_browser_to")
                        .and_then(|v| v.as_str().map(String::from))
                })
            });

        if path.starts_with("/api/") || accepts_json(&req) {
            let mut json = serde_json::json!({"error": "AAL2 required" });
            if let Some(url) = redirect_to {
                json["redirectTo"] = url.into();
            }
            return (
                StatusCode::FORBIDDEN,
                Body::from(json.to_string()),
            )
                .into_response();
        }

        let target = redirect_to.unwrap_or_else(|| {
            let return_to = format!("{}{}", state.config.public_url, path);
            format!(
                "{}/kratos/self-service/login/browser?aal=aal2&return_to={}",
                state.config.public_url,
                urlencoding::encode(&return_to)
            )
        });
        return (StatusCode::FOUND, [("location", target)], Body::empty()).into_response();
    }

    if !resp.status().is_success() {
        if path.starts_with("/api/") || accepts_json(&req) {
            return (StatusCode::UNAUTHORIZED, Body::from(r#"{"error":"Unauthorized"}"#))
                .into_response();
        }
        let login_url = format!(
            "{}/auth/login?return_to={}",
            state.config.public_url,
            urlencoding::encode(&(state.config.public_url.clone() + path))
        );
        return (StatusCode::FOUND, [("location", login_url)], Body::empty()).into_response();
    }

    let session_json: serde_json::Value = match resp.json().await {
        Ok(j) => j,
        Err(_) => {
            return (StatusCode::BAD_GATEWAY, Body::from("Invalid session response"))
                .into_response();
        }
    };

    let identity = session_json.get("identity").cloned().unwrap_or_default();
    let identity_id = identity
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let email = identity
        .pointer("/traits/email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let session_info = SessionInfo {
        id: identity_id.clone(),
        email: email.clone(),
        identity,
    };

    // Check admin status — strict: if list is empty, nobody is admin
    let is_admin = state.config.admin_identity_ids.contains(&identity_id)
        || state.config.admin_identity_ids.contains(&email);

    // Check 2FA enrollment
    let has_2fa = match check_2fa(&state, &identity_id).await {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_GATEWAY, Body::from("Failed to check 2FA status"))
                .into_response();
        }
    };

    // Enforce 2FA for protected routes
    let skip_mfa = path == "/onboarding"
        || path.starts_with("/onboarding/")
        || path.starts_with("/api/auth/")
        || path.starts_with("/api/flow/")
        || path.starts_with("/api/avatar/")
        || path.starts_with("/api/health/")
        || path == "/health"
        || path.starts_with("/kratos/");

    if !has_2fa && !skip_mfa {
        if path.starts_with("/api/") || accepts_json(&req) {
            return (
                StatusCode::FORBIDDEN,
                Body::from(r#"{"error":"2FA setup required","needs2faSetup":true}"#),
            )
                .into_response();
        }
        return (
            StatusCode::FOUND,
            [("location", "/onboarding".to_string())],
            Body::empty(),
        )
            .into_response();
    }

    // Admin-only routes
    if is_admin_route(path) && !is_admin {
        if path.starts_with("/api/") || accepts_json(&req) {
            return (StatusCode::FORBIDDEN, Body::from(r#"{"error":"Forbidden"}"#))
                .into_response();
        }
        return (
            StatusCode::FOUND,
            [("location", "/settings".to_string())],
            Body::empty(),
        )
            .into_response();
    }

    let auth_ctx = AuthContext {
        session: session_info,
        is_admin,
        has_2fa,
    };

    req.extensions_mut().insert(auth_ctx);
    next.run(req).await
}

async fn check_2fa(state: &AppState, identity_id: &str) -> Result<bool, reqwest::Error> {
    let url = format!(
        "{}/admin/identities/{}?include_credential=totp&include_credential=webauthn",
        state.config.kratos_admin_url, identity_id
    );
    let resp = state.http.get(&url).send().await?;
    if !resp.status().is_success() {
        // Fail closed on admin API errors
        return Ok(true);
    }
    let identity: serde_json::Value = resp.json().await?;
    let creds = identity.get("credentials").cloned().unwrap_or_default();
    let has_totp = creds
        .get("totp")
        .and_then(|c| c.get("identifiers"))
        .and_then(|i| i.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    let has_webauthn = creds
        .get("webauthn")
        .and_then(|c| c.get("identifiers"))
        .and_then(|i| i.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    Ok(has_totp || has_webauthn)
}

fn accepts_json(req: &Request) -> bool {
    req.headers()
        .get("accept")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.contains("application/json"))
        .unwrap_or(false)
}

fn is_admin_route(path: &str) -> bool {
    let prefixes = [
        "/api/identities",
        "/api/admin",
        "/api/courier",
        "/admin",
        "/identities",
        "/courier",
        "/schemas",
    ];
    prefixes.iter().any(|p| {
        path == *p || path.starts_with(&format!("{}/", p)) || path.starts_with(&format!("{}?", p))
    })
}
