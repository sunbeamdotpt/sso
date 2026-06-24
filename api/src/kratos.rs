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
    HOP_BY_HOP.contains(&lower.as_str())
}

/// Remove empty or duplicate `ory_kratos_session` cookie values from a raw
/// Cookie header value. Stale host-only clearing cookies can otherwise shadow
/// a valid domain-scoped session cookie and cause 401s.
fn sanitize_cookie_value(value: &str) -> String {
    let mut session_seen = false;
    let parts: Vec<&str> = value
        .split(';')
        .map(str::trim)
        .filter(|part| {
            if part.is_empty() {
                return false;
            }
            if let Some((name, val)) = part.split_once('=') {
                if name.trim() == "ory_kratos_session" {
                    if val.trim().is_empty() {
                        return false;
                    }
                    if session_seen {
                        return false;
                    }
                    session_seen = true;
                }
            }
            true
        })
        .collect();
    parts.join("; ")
}

/// Sanitize the `Cookie` header in `out` after it has been populated.
fn sanitize_cookie_header(out: &mut reqwest::header::HeaderMap) {
    if let Some(cookie_value) = out.get(reqwest::header::COOKIE).cloned() {
        if let Ok(s) = cookie_value.to_str() {
            let cleaned = sanitize_cookie_value(s);
            if cleaned.is_empty() {
                out.remove(reqwest::header::COOKIE);
            } else if cleaned != s {
                if let Ok(v) = reqwest::header::HeaderValue::from_str(&cleaned) {
                    out.insert(reqwest::header::COOKIE, v);
                }
            }
        }
    }
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
    sanitize_cookie_header(&mut out);
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
                    .filter(|part| !part.starts_with("ory_kratos_session=") && !part.is_empty())
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

/// Build a Set-Cookie header that clears an `ory_kratos_session` cookie.
/// If `domain` is provided the clearing cookie targets that domain; otherwise
/// it targets the host-only cookie for the current host. `secure` mirrors the
/// upstream cookie's `Secure` flag so the clearing cookie can evict a secure
/// cookie that would otherwise be ignored by the browser.
fn clear_session_cookie(domain: Option<&str>, secure: bool) -> (HeaderName, HeaderValue) {
    let secure_attr = if secure { " Secure;" } else { "" };
    let value = if let Some(domain) = domain {
        HeaderValue::from_str(&format!(
            "ory_kratos_session=; Path=/; Domain={domain}; Max-Age=0; HttpOnly;{secure_attr} SameSite=Lax"
        ))
        .unwrap_or_else(|_| {
            HeaderValue::from_static(
                "ory_kratos_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
            )
        })
    } else {
        HeaderValue::from_str(&format!(
            "ory_kratos_session=; Path=/; Max-Age=0; HttpOnly;{secure_attr} SameSite=Lax"
        ))
        .unwrap_or_else(|_| {
            HeaderValue::from_static(
                "ory_kratos_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
            )
        })
    };
    (header::SET_COOKIE, value)
}

/// Extract the `Domain` attribute from the first `ory_kratos_session`
/// `Set-Cookie` header returned by Kratos, if present.
fn session_cookie_domain(headers: &reqwest::header::HeaderMap) -> Option<String> {
    headers
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .find_map(|v| {
            let s = v.to_str().ok()?;
            if !s.trim().starts_with("ory_kratos_session=") {
                return None;
            }
            s.split(';').find_map(|part| {
                let mut kv = part.trim().splitn(2, '=');
                let key = kv.next()?.trim();
                let value = kv.next().map(str::trim).unwrap_or("");
                if key.eq_ignore_ascii_case("domain") && !value.is_empty() {
                    Some(value.to_owned())
                } else {
                    None
                }
            })
        })
}

/// Whether the first `ory_kratos_session` `Set-Cookie` header has the
/// `Secure` attribute.
fn session_cookie_is_secure(headers: &reqwest::header::HeaderMap) -> bool {
    headers
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .find_map(|v| {
            let s = v.to_str().ok()?;
            if !s.trim().starts_with("ory_kratos_session=") {
                return None;
            }
            Some(
                s.split(';')
                    .any(|part| part.trim().eq_ignore_ascii_case("Secure")),
            )
        })
        .unwrap_or(false)
}

/// Forward upstream response headers, but for recovery responses clear stale
/// session cookies before issuing the new one so they cannot shadow it.
fn recovery_response_headers(headers: &reqwest::header::HeaderMap) -> HeaderMap {
    let upstream = forward_response_headers(headers);
    let domain = session_cookie_domain(headers);
    let secure = session_cookie_is_secure(headers);
    let sets_session = domain.is_some()
        || headers
            .get_all(reqwest::header::SET_COOKIE)
            .iter()
            .any(|v| {
                v.to_str()
                    .map(|s| s.trim().starts_with("ory_kratos_session="))
                    .unwrap_or(false)
            });

    let mut out = HeaderMap::new();
    if sets_session {
        // Clear any stale domain-scoped cookie first, then any stale host-only
        // cookie. The fresh session cookie is appended last so it wins.
        if let Some(ref domain) = domain {
            let (name, value) = clear_session_cookie(Some(domain), secure);
            out.append(name, value);
        }
        let (name, value) = clear_session_cookie(None, secure);
        out.append(name, value);
    }
    for (name, value) in upstream.iter() {
        out.append(name.clone(), value.clone());
    }
    out
}

/// Forward headers from upstream response to the client.
///
/// `Set-Cookie` is special-cased: upstream may emit several `Set-Cookie`
/// headers and folding them into a single comma-separated value is invalid for
/// cookies, so we always append them.
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
        if axum_name == header::SET_COOKIE {
            out.append(axum_name, axum_value);
        } else {
            out.insert(axum_name, axum_value);
        }
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
        .map(sanitize_cookie_value)
        .unwrap_or_default();

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

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::{COOKIE, HOST, HeaderMap as ReqwestHeaderMap, SET_COOKIE};

    #[test]
    fn forward_response_headers_preserves_multiple_set_cookies() {
        let mut upstream = ReqwestHeaderMap::new();
        upstream.insert(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static("ory_kratos_session=abc; Path=/"),
        );
        upstream.append(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static("csrf_token=xyz; Path=/"),
        );

        let out = forward_response_headers(&upstream);
        let cookies: Vec<_> = out.get_all(header::SET_COOKIE).iter().collect();
        assert_eq!(cookies.len(), 2);
        assert!(
            cookies
                .iter()
                .any(|v| v.to_str().unwrap().starts_with("ory_kratos_session="))
        );
        assert!(
            cookies
                .iter()
                .any(|v| v.to_str().unwrap().starts_with("csrf_token="))
        );
    }

    #[test]
    fn recovery_response_headers_clears_stale_session_and_keeps_new_one() {
        let mut upstream = ReqwestHeaderMap::new();
        upstream.insert(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static(
                "ory_kratos_session=real; Path=/; Domain=sunbeam.pt; HttpOnly; Secure; SameSite=Lax",
            ),
        );
        upstream.append(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static("csrf_token=csrf; Path=/"),
        );

        let out = recovery_response_headers(&upstream);
        let cookies: Vec<_> = out
            .get_all(header::SET_COOKIE)
            .iter()
            .map(|v| v.to_str().unwrap().to_owned())
            .collect();

        // The fresh session cookie must survive.
        assert!(
            cookies
                .iter()
                .any(|c| c.contains("ory_kratos_session=real"))
        );
        // The CSRF cookie must survive.
        assert!(cookies.iter().any(|c| c.starts_with("csrf_token=")));
        // A clearing cookie for the stale domain-scoped session must be present.
        assert!(cookies.iter().any(|c| {
            c.starts_with("ory_kratos_session=")
                && c.contains("Domain=sunbeam.pt")
                && c.contains("Max-Age=0")
        }));
        // A host-only clearing cookie must also be present for stale host-only shadows.
        assert!(cookies.iter().any(|c| {
            c.starts_with("ory_kratos_session=")
                && !c.contains("Domain=")
                && c.contains("Max-Age=0")
        }));
        // Clearing cookies must mirror the Secure flag so they can evict secure
        // stale cookies instead of being ignored by the browser.
        assert!(cookies.iter().all(|c| {
            !c.starts_with("ory_kratos_session=")
                || !c.contains("Max-Age=0")
                || c.contains("Secure")
        }));
    }

    #[test]
    fn sanitize_cookie_value_drops_empty_session_cookie() {
        let input = "ory_kratos_session=; csrf_token=abc; other=value";
        let out = sanitize_cookie_value(input);
        assert!(!out.contains("ory_kratos_session"));
        assert!(out.contains("csrf_token=abc"));
        assert!(out.contains("other=value"));
    }

    #[test]
    fn sanitize_cookie_value_keeps_valid_session_cookie() {
        let input = "ory_kratos_session=real; csrf_token=abc";
        let out = sanitize_cookie_value(input);
        assert!(out.contains("ory_kratos_session=real"));
        assert!(out.contains("csrf_token=abc"));
    }

    #[test]
    fn sanitize_cookie_value_drops_duplicate_session_cookies() {
        let input = "ory_kratos_session=stale; ory_kratos_session=real; csrf_token=abc";
        let out = sanitize_cookie_value(input);
        // The first non-empty value is kept.
        assert!(out.contains("ory_kratos_session=stale"));
        assert!(!out.contains("ory_kratos_session=real"));
    }

    #[test]
    fn recovery_request_headers_strip_session_cookie_but_keep_others() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_static("ory_kratos_session=stale; csrf_token=abc; other=value"),
        );
        let out = recovery_request_headers(&headers);
        let cookie = out.get(COOKIE).unwrap().to_str().unwrap();
        assert!(!cookie.contains("ory_kratos_session"));
        assert!(cookie.contains("csrf_token=abc"));
        assert!(cookie.contains("other=value"));
    }

    #[test]
    fn forward_request_headers_preserves_host_header() {
        let mut headers = HeaderMap::new();
        headers.insert(header::HOST, HeaderValue::from_static("auth.sunbeam.pt"));
        headers.insert(header::ACCEPT, HeaderValue::from_static("application/json"));
        let out = forward_request_headers(&headers);
        assert_eq!(out.get(HOST).unwrap().to_str().unwrap(), "auth.sunbeam.pt");
        assert_eq!(
            out.get(reqwest::header::ACCEPT).unwrap().to_str().unwrap(),
            "application/json"
        );
    }

    #[test]
    fn session_cookie_domain_parses_domain_attribute() {
        let mut headers = ReqwestHeaderMap::new();
        headers.insert(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static(
                "ory_kratos_session=val; Path=/; Domain=sunbeam.pt; HttpOnly",
            ),
        );
        assert_eq!(
            session_cookie_domain(&headers).as_deref(),
            Some("sunbeam.pt")
        );
    }

    #[test]
    fn session_cookie_domain_returns_none_when_missing() {
        let mut headers = ReqwestHeaderMap::new();
        headers.insert(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static("ory_kratos_session=val; Path=/"),
        );
        assert!(session_cookie_domain(&headers).is_none());
    }

    #[test]
    fn session_cookie_is_secure_detects_secure_flag() {
        let mut headers = ReqwestHeaderMap::new();
        headers.insert(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static(
                "ory_kratos_session=val; Path=/; Domain=sunbeam.pt; Secure; HttpOnly",
            ),
        );
        assert!(session_cookie_is_secure(&headers));
    }

    #[test]
    fn session_cookie_is_secure_false_without_flag() {
        let mut headers = ReqwestHeaderMap::new();
        headers.insert(
            SET_COOKIE,
            reqwest::header::HeaderValue::from_static(
                "ory_kratos_session=val; Path=/; Domain=sunbeam.pt; HttpOnly",
            ),
        );
        assert!(!session_cookie_is_secure(&headers));
    }
}
