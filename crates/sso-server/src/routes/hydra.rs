use std::sync::Arc;
use axum::{
    extract::{Extension, Query},
    response::{IntoResponse, Response},
};
use serde_json::Value;

use crate::AppState;

pub async fn get_consent(
    Extension(state): Extension<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let challenge = match params.get("consent_challenge") {
        Some(c) => c,
        None => return (axum::http::StatusCode::BAD_REQUEST, "Missing consent_challenge").into_response(),
    };

    let url = format!("{}/oauth2/auth/requests/consent?consent_challenge={}", state.config.hydra_admin_url, challenge);
    proxy_json(&state, url).await
}

pub async fn accept_consent(
    Extension(state): Extension<Arc<AppState>>,
    axum::extract::Json(body): axum::extract::Json<Value>,
) -> Response {
    let challenge = body.get("challenge").and_then(|v| v.as_str()).unwrap_or("");
    let url = format!("{}/oauth2/auth/requests/consent/accept?consent_challenge={}", state.config.hydra_admin_url, challenge);
    post_json(&state, url, body).await
}

pub async fn reject_consent(
    Extension(state): Extension<Arc<AppState>>,
    axum::extract::Json(body): axum::extract::Json<Value>,
) -> Response {
    let challenge = body.get("challenge").and_then(|v| v.as_str()).unwrap_or("");
    let url = format!("{}/oauth2/auth/requests/consent/reject?consent_challenge={}", state.config.hydra_admin_url, challenge);
    post_json(&state, url, body).await
}

pub async fn get_logout(
    Extension(state): Extension<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Response {
    let challenge = match params.get("logout_challenge") {
        Some(c) => c,
        None => return (axum::http::StatusCode::BAD_REQUEST, "Missing logout_challenge").into_response(),
    };

    let url = format!("{}/oauth2/auth/requests/logout?logout_challenge={}", state.config.hydra_admin_url, challenge);
    proxy_json(&state, url).await
}

pub async fn accept_logout(
    Extension(state): Extension<Arc<AppState>>,
    axum::extract::Json(body): axum::extract::Json<Value>,
) -> Response {
    let challenge = body.get("challenge").and_then(|v| v.as_str()).unwrap_or("");
    let url = format!("{}/oauth2/auth/requests/logout/accept?logout_challenge={}", state.config.hydra_admin_url, challenge);
    post_json(&state, url, body).await
}

pub async fn accept_login(
    Extension(state): Extension<Arc<AppState>>,
    axum::extract::Json(body): axum::extract::Json<Value>,
) -> Response {
    let challenge = body.get("challenge").and_then(|v| v.as_str()).unwrap_or("");
    let url = format!("{}/oauth2/auth/requests/login/accept?login_challenge={}", state.config.hydra_admin_url, challenge);
    post_json(&state, url, body).await
}

async fn proxy_json(state: &AppState, url: String) -> Response {
    let resp = match state.http.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return (axum::http::StatusCode::BAD_GATEWAY, "Hydra unavailable").into_response(),
    };
    let status = resp.status();
    let body = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => return (axum::http::StatusCode::BAD_GATEWAY, "Hydra body error").into_response(),
    };
    (status, body).into_response()
}

async fn post_json(state: &AppState, url: String, body: Value) -> Response {
    let resp = match state.http.post(&url).json(&body).send().await {
        Ok(r) => r,
        Err(_) => return (axum::http::StatusCode::BAD_GATEWAY, "Hydra unavailable").into_response(),
    };
    let status = resp.status();
    let body = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => return (axum::http::StatusCode::BAD_GATEWAY, "Hydra body error").into_response(),
    };
    (status, body).into_response()
}
