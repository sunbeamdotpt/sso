use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

const CSRF_COOKIE_NAME: &str = "ory-csrf-token";

pub async fn csrf_middleware(req: Request, next: Next) -> Response {
    let method = req.method().as_str();
    let path = req.uri().path();

    // Only protect state-mutating methods on non-API routes
    let is_mutating = matches!(method, "POST" | "PUT" | "PATCH" | "DELETE");
    let is_api = path.starts_with("/api/");

    if !is_mutating || is_api {
        return next.run(req).await;
    }

    let header_token = req
        .headers()
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok());

    let cookie_token = req
        .headers()
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .and_then(|cookies| {
            cookies.split(';').find_map(|c| {
                let c = c.trim();
                c.strip_prefix(&format!("{}=", CSRF_COOKIE_NAME))
                    .map(|s| s.to_string())
            })
        });

    match (header_token, cookie_token) {
        (Some(h), Some(c)) if h == c => next.run(req).await,
        _ => (
            StatusCode::FORBIDDEN,
            Body::from("CSRF token invalid or missing"),
        )
            .into_response(),
    }
}
