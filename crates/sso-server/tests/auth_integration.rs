use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

use kratos_admin_server::config::Config;
use kratos_admin_server::create_app;
use kratos_admin_server::AppState;

fn test_config(kratos_public_url: String, kratos_admin_url: String) -> Config {
    Config {
        bind_addr: "127.0.0.1:0".to_string(),
        kratos_public_url,
        kratos_admin_url,
        hydra_admin_url: "http://localhost:4445".to_string(),
        public_url: "http://localhost:3000".to_string(),
        admin_identity_ids: vec!["admin-id-123".to_string()],
        ui_dist: "./ui/dist".to_string(),
        csrf_secret: "test-secret".to_string(),
    }
}

#[tokio::test]
async fn health_no_auth() {
    let config = test_config(
        "http://localhost:4433".to_string(),
        "http://localhost:4434".to_string(),
    );
    let app = create_app(config);

    let req = Request::builder().uri("/health/live").body(Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn static_assets_no_auth() {
    let config = test_config(
        "http://localhost:4433".to_string(),
        "http://localhost:4434".to_string(),
    );
    let app = create_app(config);

    let req = Request::builder()
        .uri("/assets/index.js")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    // 404 because dist doesn't exist in test, but it should NOT be 401
    assert_ne!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn api_flow_no_auth() {
    let config = test_config(
        "http://localhost:4433".to_string(),
        "http://localhost:4434".to_string(),
    );
    let app = create_app(config);

    let req = Request::builder()
        .uri("/api/flow/login?flow=test-flow")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    // 502 because Kratos isn't running, but NOT 401
    assert_ne!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn protected_route_without_session_returns_401() {
    let config = test_config(
        "http://localhost:4433".to_string(),
        "http://localhost:4434".to_string(),
    );
    let app = create_app(config);

    let req = Request::builder()
        .uri("/api/auth/session")
        .header("accept", "application/json")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn protected_page_without_session_redirects_to_login() {
    let config = test_config(
        "http://localhost:4433".to_string(),
        "http://localhost:4434".to_string(),
    );
    let app = create_app(config);

    let req = Request::builder()
        .uri("/account/profile")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::FOUND);
    let location = resp.headers().get("location").unwrap().to_str().unwrap();
    assert!(location.contains("/login"));
}

#[tokio::test]
async fn admin_route_without_session_redirects_to_login() {
    let config = test_config(
        "http://localhost:4433".to_string(),
        "http://localhost:4434".to_string(),
    );
    let app = create_app(config);

    let req = Request::builder()
        .uri("/admin")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::FOUND);
    let location = resp.headers().get("location").unwrap().to_str().unwrap();
    assert!(location.contains("/login"));
}
