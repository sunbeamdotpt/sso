// Copyright Sunbeam Studios 2026
// SPDX-License-Identifier: AGPL-3.0-or-later

//! Static asset serving.
//!
//! The compiled Vite output is embedded into the binary at build time so the
//! final container image needs only the single Rust binary.

use axum::{
    extract::Request,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};

use rust_embed::RustEmbed;

/// Embedded production build of the SPA.
#[derive(RustEmbed)]
#[folder = "../dist"]
struct Dist;

/// Serve an embedded static file, falling back to `index.html` for SPA routes.
pub async fn static_handler(request: Request) -> Response {
    let path = request.uri().path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    let (file, mime_path) = match Dist::get(path) {
        Some(file) => (file, path),
        None => match Dist::get("index.html") {
            Some(file) => (file, "index.html"),
            None => {
                return (
                    StatusCode::NOT_FOUND,
                    [(header::CONTENT_TYPE, "text/plain")],
                    "not found",
                )
                    .into_response();
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
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, mime)],
        file.data,
    )
        .into_response()
}
