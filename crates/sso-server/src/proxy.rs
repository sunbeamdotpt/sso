use std::sync::Arc;
use axum::{
    body::Body,
    extract::{Extension, Path, Query, Request},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::Value;

use crate::AppState;

fn strip_hop_by_hop(headers: &HeaderMap) -> HeaderMap {
    let hop_by_hop: &[&str] = &[
        "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailers", "transfer-encoding", "upgrade", "host",
    ];
    let mut out = HeaderMap::new();
    for (k, v) in headers.iter() {
        if !hop_by_hop.contains(&k.as_str().to_lowercase().as_str()) {
            out.insert(k.clone(), v.clone());
        }
    }
    out
}

fn pick_upstream(path: &str, state: &AppState) -> String {
    let hydra_paths = ["/admin/clients", "/admin/keys", "/admin/oauth2", "/oauth2/auth/requests"];
    let kratos_public_paths = ["/schemas", "/sessions"];

    if hydra_paths.iter().any(|p| path == *p || path.starts_with(&format!("{}/", p))) {
        state.config.hydra_admin_url.clone()
    } else if kratos_public_paths.iter().any(|p| path == *p || path.starts_with(&format!("{}/", p))) {
        state.config.kratos_public_url.clone()
    } else {
        state.config.kratos_admin_url.clone()
    }
}

pub async fn proxy_handler(
    Extension(state): Extension<Arc<AppState>>,
    req: Request,
) -> Response {
    let path = req.uri().path().replace("/api", "");
    let query = req.uri().query().map(|q| format!("?{}", q)).unwrap_or_default();
    let upstream = pick_upstream(&path, &state);
    let target = format!("{}{}{}", upstream, path, query);

    let method = req.method().clone();
    let headers = strip_hop_by_hop(req.headers());
    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_REQUEST, "Bad body").into_response(),
    };

    let mut builder = state.http.request(method, &target).headers(headers);
    if !body_bytes.is_empty() {
        builder = builder.body(body_bytes.to_vec());
    }

    let resp = match builder.send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Upstream unavailable").into_response(),
    };

    let status = resp.status();
    let resp_headers = strip_hop_by_hop(resp.headers());
    let body = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Upstream body error").into_response(),
    };

    let mut axum_resp = (status, body).into_response();
    *axum_resp.headers_mut() = resp_headers;
    axum_resp
}

pub async fn flow_handler(
    Extension(state): Extension<Arc<AppState>>,
    Path(flow_type): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let flow_id = match params.get("flow") {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Body::from(r#"{"error":"Missing flow query parameter"}"#)).into_response(),
    };

    let target = format!(
        "{}/self-service/{}/flows?id={}",
        state.config.kratos_public_url, flow_type, flow_id
    );

    let resp = match state.http.get(&target).send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    let status = resp.status();
    let body = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos body error").into_response(),
    };

    (status, body).into_response()
}

pub async fn flow_error_handler(
    Extension(state): Extension<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let error_id = match params.get("id") {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Body::from(r#"{"error":"Missing id query parameter"}"#)).into_response(),
    };

    let target = format!(
        "{}/self-service/errors?id={}",
        state.config.kratos_public_url, error_id
    );

    let resp = match state.http.get(&target).send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    let status = resp.status();
    let body = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos body error").into_response(),
    };

    (status, body).into_response()
}

pub async fn session_handler(
    Extension(state): Extension<Arc<AppState>>,
    req: Request,
) -> Response {
    let cookie_header = req
        .headers()
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let whoami_url = format!("{}/sessions/whoami", state.config.kratos_public_url);
    let resp = match state
        .http
        .get(&whoami_url)
        .header("cookie", cookie_header)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    if resp.status() == reqwest::StatusCode::FORBIDDEN {
        let body = resp.json::<Value>().await.ok();
        let redirect_to = body
            .as_ref()
            .and_then(|b| b.get("redirect_browser_to").and_then(|v| v.as_str()))
            .or_else(|| {
                body.as_ref().and_then(|b| {
                    b.pointer("/error/details/redirect_browser_to")
                        .and_then(|v| v.as_str())
                })
            });
        let mut json = serde_json::json!({ "error": "AAL2 required", "needsAal2": true });
        if let Some(url) = redirect_to {
            json["redirectTo"] = url.into();
        }
        return (StatusCode::FORBIDDEN, json.to_string()).into_response();
    }

    if !resp.status().is_success() {
        return (StatusCode::UNAUTHORIZED, r#"{"error":"Unauthorized"}"#).into_response();
    }

    let session: Value = match resp.json().await {
        Ok(j) => j,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Invalid session response").into_response(),
    };

    let identity = session.get("identity").cloned().unwrap_or_default();
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

    let has_2fa = match check_2fa(&state, &identity_id).await {
        Ok(v) => v,
        Err(_) => true, // fail closed
    };

    let is_admin = state.config.admin_identity_ids.contains(&identity_id)
        || state.config.admin_identity_ids.contains(&email);

    let identity = session.get("identity").cloned().unwrap_or_default();
    let result = serde_json::json!({
        "identity": identity,
        "session": session,
        "isAdmin": is_admin,
        "needs2faSetup": !has_2fa,
    });

    (StatusCode::OK, Json(result)).into_response()
}

async fn check_2fa(state: &AppState, identity_id: &str) -> Result<bool, reqwest::Error> {
    let url = format!(
        "{}/admin/identities/{}?include_credential=totp&include_credential=webauthn",
        state.config.kratos_admin_url, identity_id
    );
    let resp = state.http.get(&url).send().await?;
    if !resp.status().is_success() {
        return Ok(true);
    }
    let identity: Value = resp.json().await?;
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

pub async fn list_sessions_handler(
    Extension(state): Extension<Arc<AppState>>,
    req: Request,
) -> Response {
    let cookie_header = req
        .headers()
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // 1. Get current session to find identity id
    let whoami_url = format!("{}/sessions/whoami", state.config.kratos_public_url);
    let whoami_resp = match state
        .http
        .get(&whoami_url)
        .header("cookie", cookie_header)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    if !whoami_resp.status().is_success() {
        return (StatusCode::UNAUTHORIZED, r#"{"error":"Unauthorized"}"#).into_response();
    }

    let whoami: Value = match whoami_resp.json().await {
        Ok(j) => j,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Invalid session response").into_response(),
    };

    let identity_id = whoami
        .get("identity")
        .and_then(|i| i.get("id"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let current_session_id = whoami
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if identity_id.is_empty() {
        return (StatusCode::UNAUTHORIZED, r#"{"error":"Unauthorized"}"#).into_response();
    }

    // 2. List all sessions for this identity
    let sessions_url = format!(
        "{}/admin/identities/{}/sessions",
        state.config.kratos_admin_url, identity_id
    );
    let sessions_resp = match state.http.get(&sessions_url).send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    let sessions: Value = match sessions_resp.json().await {
        Ok(j) => j,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Invalid sessions response").into_response(),
    };

    let result = serde_json::json!({
        "sessions": sessions,
        "current_session_id": current_session_id,
    });

    (StatusCode::OK, Json(result)).into_response()
}

pub async fn revoke_session_handler(
    Extension(state): Extension<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Response {
    let url = format!("{}/admin/sessions/{}", state.config.kratos_admin_url, session_id);
    let resp = match state.http.delete(&url).send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    if resp.status().is_success() || resp.status() == reqwest::StatusCode::NO_CONTENT {
        (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to revoke session"}))).into_response()
    }
}

pub async fn revoke_all_sessions_handler(
    Extension(state): Extension<Arc<AppState>>,
    req: Request,
) -> Response {
    let cookie_header = req
        .headers()
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let whoami_url = format!("{}/sessions/whoami", state.config.kratos_public_url);
    let resp = match state
        .http
        .get(&whoami_url)
        .header("cookie", cookie_header)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    if !resp.status().is_success() {
        return (StatusCode::UNAUTHORIZED, r#"{"error":"Unauthorized"}"#).into_response();
    }

    let session: Value = match resp.json().await {
        Ok(j) => j,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Invalid session response").into_response(),
    };

    let identity_id = session
        .get("identity")
        .and_then(|i| i.get("id"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let url = format!("{}/admin/identities/{}/sessions", state.config.kratos_admin_url, identity_id);
    let delete_resp = match state.http.delete(&url).send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    if delete_resp.status().is_success() || delete_resp.status() == reqwest::StatusCode::NO_CONTENT {
        (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to revoke sessions"}))).into_response()
    }
}
