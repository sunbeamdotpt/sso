// Copyright Sunbeam Studios 2026
// SPDX-License-Identifier: AGPL-3.0-or-later

//! SSO portal server built on sunbeam-g2v.
//!
//! Serves the embedded Vite-built SPA on `/` and implements the small set of
//! server-side endpoints required by Hydra login/consent/logout flows and
//! Kratos session verification.

mod config;
mod hydra;
mod hydra_public;
mod kratos;
mod static_files;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use axum::{
    Router as AxumRouter,
    http::{HeaderValue, Method, header},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::get,
};
use sunbeam_g2v::health::HealthRouter;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

use config::Config;
use hydra::hydra_routes;
use hydra_public::hydra_public_routes;
use kratos::kratos_routes;
use static_files::static_handler;

/// Simple liveness probe.
async fn health_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({ "ok": true }))
}

/// GDPR-compliant access log.
///
/// Logs method, path (query string stripped), response status and latency.
/// Intentionally excludes IP addresses, user agents, cookies, tokens and query
/// parameters so the log cannot be tied back to an individual user.
async fn access_log_layer(
    request: axum::extract::Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let start = Instant::now();

    let response = next.run(request).await;

    info!(
        method = %method,
        path = %path,
        status = response.status().as_u16(),
        duration_ms = start.elapsed().as_millis() as u64,
        "request"
    );
    response
}

/// Security headers applied to every response.
async fn security_headers_layer(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static(
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
        ),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
        ),
    );
    response
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;

    // g2v-style tracing/logging init.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let bind_addr: SocketAddr = config.bind_addr.parse()?;
    let shared_config = Arc::new(config);

    // Server-side API routes live under `/api`. The SPA makes requests like
    // `/api/hydra/login` and `/api/self-service/login/browser`.
    let api_routes = AxumRouter::new()
        .merge(kratos_routes(Arc::clone(&shared_config)))
        .merge(hydra_routes(Arc::clone(&shared_config)))
        .merge(hydra_public_routes(Arc::clone(&shared_config)));

    let app = AxumRouter::new()
        .route("/health", get(health_handler))
        .merge(HealthRouter::new().into_axum_router())
        .nest("/api", api_routes)
        .fallback(static_handler)
        .layer(axum::middleware::from_fn(security_headers_layer))
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers(tower_http::cors::Any),
        )
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(access_log_layer));

    info!("sso portal listening on http://{}", bind_addr);

    let listener = tokio::net::TcpListener::bind(bind_addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
