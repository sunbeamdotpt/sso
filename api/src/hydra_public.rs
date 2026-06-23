// Copyright Sunbeam Studios 2026
// SPDX-License-Identifier: AGPL-3.0-or-later

//! Proxy for Hydra public OAuth2 endpoints (device authorization, token, etc.).

use std::sync::Arc;

use axum::{
    Router as AxumRouter,
    extract::Request,
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::any,
};

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

/// Generic Hydra public proxy handler.
async fn hydra_public_proxy(config: Arc<Config>, request: Request) -> Response {
    let path_and_query = request
        .uri()
        .path_and_query()
        .map(|p| p.as_str())
        .unwrap_or("/");
    let target = config.hydra_public_target(path_and_query);

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

    // Forward Accept header so Hydra can return JSON when the SPA requests it.
    let mut request_headers = forward_request_headers(request.headers());
    if !request_headers.contains_key(header::ACCEPT) {
        request_headers.insert(header::ACCEPT, HeaderValue::from_static("application/json"));
    }

    let mut builder = client.request(method, &target).headers(request_headers);

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
        Err(_) => return (StatusCode::BAD_GATEWAY, "Hydra unavailable").into_response(),
    };

    let status = StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::OK);
    let headers = forward_response_headers(upstream.headers());
    let body_bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_GATEWAY, "Hydra unavailable").into_response(),
    };

    (status, headers, body_bytes).into_response()
}

pub fn hydra_public_routes(config: Arc<Config>) -> AxumRouter {
    let config_device = Arc::clone(&config);
    let config_catch_all = Arc::clone(&config);

    AxumRouter::new()
        .route(
            "/oauth2/device/{*path}",
            any(move |req: Request| hydra_public_proxy(Arc::clone(&config_device), req)),
        )
        .route(
            "/oauth2/{*path}",
            any(move |req: Request| hydra_public_proxy(Arc::clone(&config_catch_all), req)),
        )
}
