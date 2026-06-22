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

    match Dist::get(path).or_else(|| Dist::get("index.html")) {
        Some(file) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, mime.to_string())],
                file.data,
            )
                .into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "text/plain")],
            "not found",
        )
            .into_response(),
    }
}
