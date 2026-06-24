// Copyright Sunbeam Studios 2026
// SPDX-License-Identifier: AGPL-3.0-or-later

//! Kratos public API proxy and session helpers.

use std::sync::Arc;

use axum::{
    Router as AxumRouter,
    extract::{Path, Query, Request},
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{any, get},
};
use serde::Deserialize;
use serde_json::Value;

use crate::config::{Config, http_client};

/// Hop-by-hop headers that should not be forwarded to/from upstream.
const HOP_BY_HOP: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
];

fn is_hop_by_hop(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    HOP_BY_HOP.contains(&lower.as_str()) || lower == "host"
}

/// Forward headers from the incoming request to upstream.
fn forward_request_headers(headers: &HeaderMap) -> reqwest::header::HeaderMap {
    let mut out = reqwest::header::HeaderMap::new();
    for (name, value) in headers {
        if is_hop_by_hop(name.as_str()) {
            continue;
        }
        let reqwest_name = match reqwest::header::HeaderName::from_bytes(name.as_str().as_bytes()) {
            Ok(n) => n,
            Err(_) => continue,
        };
        let reqwest_value = match reqwest::header::HeaderValue::from_bytes(value.as_bytes()) {
            Ok(v) => v,
            Err(_) => continue,
        };
        out.insert(reqwest_name, reqwest_value);
    }
    out
}

/// Recovery flows are used by unauthenticated users. Any existing
/// `ory_kratos_session` cookie belongs to a previous session and can confuse
/// Kratos (it may reject the request because the stale cookie is invalid or
/// belongs to a different subdomain). Strip it from the upstream request so
/// Kratos always starts the recovery flow with a clean cookie jar.
fn recovery_request_headers(headers: &HeaderMap) -> reqwest::header::HeaderMap {
    let mut out = forward_request_headers(headers);
    if let Ok(cookie_name) = reqwest::header::HeaderName::from_bytes(b"Cookie") {
        if let Some(cookie_value) = out.get(&cookie_name) {
            if let Ok(s) = cookie_value.to_str() {
                let cleaned: Vec<&str> = s
                    .split(';')
                    .map(str::trim)
                    .filter(|part| {
                        !part.starts_with("ory_kratos_session=") && !part.is_empty()
                    })
                    .collect();
                if cleaned.is_empty() {
                    out.remove(&cookie_name);
                } else {
                    let new_value = reqwest::header::HeaderValue::from_str(&cleaned.join("; "))
                        .unwrap_or_else(|_| cookie_value.clone());
                    out.insert(cookie_name, new_value);
                }
            }
        }
    }
    out
}

/// Build a Set-Cookie header that clears any host-only `ory_kratos_session`
/// cookie. Kratos sets the recovery session cookie with the configured domain
/// (e.g. `sunbeam.pt`), but a stale host-only cookie on `auth.sunbeam.pt` can
/// shadow it and cause 401s on the subsequent settings flow.
fn clear_host_session_cookie() -> (HeaderName, HeaderValue) {
    (
        header::SET_COOKIE,
        HeaderValue::from_static(
            "ory_kratos_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
        ),
    )
}

/// Forward upstream response headers, but for recovery responses clear any
/// host-only session cookie when Kratos issues a new session.
fn recovery_response_headers(headers: &reqwest::header::HeaderMap) -> HeaderMap {
    let mut out = forward_response_headers(headers);
    let sets_session = headers.get_all(reqwest::header::SET_COOKIE).iter().any(|v| {
        v.to_str()
            .map(|s| s.trim().starts_with("ory_kratos_session="))
            .unwrap_or(false)
    });
    if sets_session {
        // Append the clearing cookie *before* the new session cookie so the
        // browser removes stale host-only cookies and then stores the new one.
        let (name, value) = clear_host_session_cookie();
        out.append(name, value);
    }
    out
}

/// Forward headers from upstream response to the client.
fn forward_response_headers(headers: &reqwest::header::HeaderMap) -> HeaderMap {
    let mut out = HeaderMap::new();
    for (name, value) in headers {
        if is_hop_by_hop(name.as_str()) {
            continue;
        }
        let axum_name = match HeaderName::from_bytes(name.as_str().as_bytes()) {
            Ok(n) => n,
            Err(_) => continue,
        };
        let axum_value = match HeaderValue::from_bytes(value.as_bytes()) {
            Ok(v) => v,
            Err(_) => continue,
        };
        out.insert(axum_name, axum_value);
    }
    out
}

/// Generic Kratos public proxy handler.
async fn kratos_proxy(config: Arc<Config>, request: Request) -> Response {
    let path_and_query = request
        .uri()
        .path_and_query()
        .map(|p| p.as_str())
        .unwrap_or("/");
    let target = config.kratos_public_target(path_and_query);

    let client = match http_client() {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build HTTP client",
            )
                .into_response();
        }
    };

    let method = match request.method().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        "PATCH" => reqwest::Method::PATCH,
        _ => reqwest::Method::GET,
    };

    let mut builder = client
        .request(method, &target)
        .headers(forward_request_headers(request.headers()));

    // Forward body for mutating methods.
    if *request.method() != axum::http::Method::GET && *request.method() != axum::http::Method::HEAD
    {
        let body_bytes = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
            Ok(b) => b,
            Err(_) => return (StatusCode::BAD_REQUEST, "invalid request body").into_response(),
        };
        builder = builder.body(body_bytes);
    }

    let upstream = match builder.send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    let status = StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::OK);
    let headers = forward_response_headers(upstream.headers());
    let body_bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    (status, headers, body_bytes).into_response()
}

/// Recovery-specific proxy that sanitizes session cookies so a stale or
/// cross-subdomain `ory_kratos_session` cookie cannot break the recovery flow.
async fn recovery_proxy(config: Arc<Config>, request: Request) -> Response {
    let path_and_query = request
        .uri()
        .path_and_query()
        .map(|p| p.as_str())
        .unwrap_or("/");
    let target = config.kratos_public_target(path_and_query);

    let client = match http_client() {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build HTTP client",
            )
                .into_response();
        }
    };

    let method = match request.method().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        "PATCH" => reqwest::Method::PATCH,
        _ => reqwest::Method::GET,
    };

    let mut builder = client
        .request(method, &target)
        .headers(recovery_request_headers(request.headers()));

    if *request.method() != axum::http::Method::GET && *request.method() != axum::http::Method::HEAD
    {
        let body_bytes = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
            Ok(b) => b,
            Err(_) => return (StatusCode::BAD_REQUEST, "invalid request body").into_response(),
        };
        builder = builder.body(body_bytes);
    }

    let upstream = match builder.send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    let status = StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::OK);
    let headers = recovery_response_headers(upstream.headers());
    let body_bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    (status, headers, body_bytes).into_response()
}

/// Rewrite a request URI in-place.
fn rewrite_uri(req: &mut Request, new_path_and_query: &str) {
    if let Ok(uri) = new_path_and_query.parse() {
        *req.uri_mut() = uri;
    }
}

/// Legacy flow proxy: `/api/flow/:type?flow=<id>`.
#[derive(Deserialize)]
struct FlowQuery {
    flow: String,
}

async fn flow_handler(
    config: Arc<Config>,
    Path(flow_type): Path<String>,
    Query(query): Query<FlowQuery>,
    mut request: Request,
) -> Response {
    rewrite_uri(
        &mut request,
        &format!("/self-service/{}/flows?id={}", flow_type, query.flow),
    );
    kratos_proxy(config, request).await
}

/// Legacy flow error proxy: `/api/flow/error?id=<id>`.
#[derive(Deserialize)]
struct ErrorQuery {
    id: String,
}

async fn flow_error_handler(
    config: Arc<Config>,
    Query(query): Query<ErrorQuery>,
    mut request: Request,
) -> Response {
    rewrite_uri(
        &mut request,
        &format!("/self-service/errors?id={}", query.id),
    );
    kratos_proxy(config, request).await
}

/// GET /api/auth/session — verify Kratos session and return identity info.
async fn session_handler(config: Arc<Config>, request: Request) -> Response {
    let cookie_header = request
        .headers()
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let client = match http_client() {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build HTTP client",
            )
                .into_response();
        }
    };

    let mut upstream_req = client
        .get(config.kratos_public_target("/sessions/whoami"))
        .header(header::ACCEPT, "application/json");

    if !cookie_header.is_empty() {
        upstream_req = upstream_req.header(header::COOKIE, cookie_header);
    }

    let upstream = match upstream_req.send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Kratos unavailable").into_response(),
    };

    let status = upstream.status();
    if status == reqwest::StatusCode::FORBIDDEN {
        // AAL step-up required.
        let body: Value = upstream.json().await.unwrap_or(Value::Null);
        let redirect_to = body
            .get("redirect_browser_to")
            .or_else(|| {
                body.get("error")
                    .and_then(|e| e.get("details").and_then(|d| d.get("redirect_browser_to")))
            })
            .and_then(|v| v.as_str());
        return (
            StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({
                "error": "AAL2 required",
                "needsAal2": true,
                "redirectTo": redirect_to,
            })),
        )
            .into_response();
    }

    if !status.is_success() {
        return (
            StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Unauthorized" })),
        )
            .into_response();
    }

    match upstream.json::<Value>().await {
        Ok(session) => (
            StatusCode::OK,
            axum::Json(serde_json::json!({ "session": session })),
        )
            .into_response(),
        Err(_) => (StatusCode::BAD_GATEWAY, "invalid session response").into_response(),
    }
}

pub fn kratos_routes(config: Arc<Config>) -> AxumRouter {
    let config_sessions = Arc::clone(&config);
    let config_flow_error = Arc::clone(&config);
    let config_flow_type = Arc::clone(&config);
    let config_sessions_proxy = Arc::clone(&config);
    let config_recovery = Arc::clone(&config);
    let config_self_service = Arc::clone(&config);
    let config_catch_all = Arc::clone(&config);

    AxumRouter::new()
        .route(
            "/auth/session",
            get(move |req: Request| session_handler(Arc::clone(&config_sessions), req)),
        )
        .route(
            "/flow/error",
            get(move |q: Query<ErrorQuery>, req: Request| {
                flow_error_handler(Arc::clone(&config_flow_error), q, req)
            }),
        )
        .route(
            "/flow/{type}",
            get(move |p: Path<String>, q: Query<FlowQuery>, req: Request| {
                flow_handler(Arc::clone(&config_flow_type), p, q, req)
            }),
        )
        .route(
            "/sessions/whoami",
            any(move |req: Request| kratos_proxy(Arc::clone(&config_sessions_proxy), req)),
        )
        .route(
            "/self-service/recovery/{*path}",
            any(move |req: Request| recovery_proxy(Arc::clone(&config_recovery), req)),
        )
        .route(
            "/self-service/{*path}",
            any(move |req: Request| kratos_proxy(Arc::clone(&config_self_service), req)),
        )
        .route(
            "/{*path}",
            any(move |req: Request| kratos_proxy(Arc::clone(&config_catch_all), req)),
        )
}
