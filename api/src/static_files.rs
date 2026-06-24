// Copyright Sunbeam Studios 2026
// SPDX-License-Identifier: AGPL-3.0-or-later

//! Static asset serving.
//!
//! The compiled Vite output is embedded into the binary at build time so the
//! final container image needs only the single Rust binary. The backend also
//! injects a small public UI config blob into `index.html` at serve time so
//! feature toggles can be controlled by environment variables without a rebuild.

use std::sync::OnceLock;

use axum::{
    extract::Request,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};

use rust_embed::RustEmbed;

use crate::config::Config;

/// Embedded production build of the SPA.
#[derive(RustEmbed)]
#[folder = "../dist"]
struct Dist;

const CONFIG_PLACEHOLDER: &str = "%SUNBEAM_CONFIG%";

static INDEX_HTML: OnceLock<Vec<u8>> = OnceLock::new();

/// Build the injected `index.html` once, replacing the config placeholder with
/// an HTML-escaped JSON blob derived from the runtime configuration.
pub fn init(config: &Config) {
    let raw = Dist::get("index.html").map(|f| f.data.into_owned()).unwrap_or_default();
    let template = String::from_utf8_lossy(&raw);

    if !template.contains(CONFIG_PLACEHOLDER) {
        INDEX_HTML.set(raw).ok();
        return;
    }

    let json = config.ui_config_json();
    let escaped = html_escape(&json);
    let rendered = template.replace(CONFIG_PLACEHOLDER, &escaped);
    INDEX_HTML.set(rendered.into_bytes()).ok();
}

/// HTML-escape a string so it is safe to embed inside a double-quoted attribute.
fn html_escape(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '&' => "&amp;".to_string(),
            '<' => "&lt;".to_string(),
            '>' => "&gt;".to_string(),
            '"' => "&quot;".to_string(),
            c => c.to_string(),
        })
        .collect()
}

/// Serve an embedded static file, falling back to `index.html` for SPA routes.
pub async fn static_handler(request: Request) -> Response {
    let path = request.uri().path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    let (file, mime_path, is_fallback) = match Dist::get(path) {
        Some(file) => (file, path, false),
        None => match INDEX_HTML.get() {
            Some(bytes) => {
                return (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, "text/html")],
                    bytes.clone(),
                )
                    .into_response();
            }
            None => match Dist::get("index.html") {
                Some(file) => (file, "index.html", true),
                None => {
                    return (
                        StatusCode::NOT_FOUND,
                        [(header::CONTENT_TYPE, "text/plain")],
                        "not found",
                    )
                        .into_response();
                }
            }
        },
    };

    let mime = if mime_path == "index.html" {
        mime_guess::mime::TEXT_HTML.to_string()
    } else {
        mime_guess::from_path(mime_path)
            .first_or(mime_guess::mime::APPLICATION_OCTET_STREAM)
            .to_string()
    };

    // If we served the raw embedded index.html (init not called or placeholder
    // missing), just return it as-is. In production init is always called.
    if is_fallback {
        return (
            StatusCode::OK,
            [(header::CONTENT_TYPE, mime)],
            file.data,
        )
            .into_response();
    }

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, mime)],
        file.data,
    )
        .into_response()
}
