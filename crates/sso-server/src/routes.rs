use std::sync::Arc;
use axum::{
    Router,
    Extension,
    routing::{delete, get, patch, post, put},
};

use crate::{
    AppState,
    proxy::{flow_handler, flow_error_handler, list_sessions_handler, proxy_handler, revoke_all_sessions_handler, revoke_session_handler, session_handler},
};

mod hydra;
mod s3;

pub fn api_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/auth/session", get(session_handler))
        .route("/api/auth/sessions", get(list_sessions_handler))
        .route("/api/auth/sessions", delete(revoke_all_sessions_handler))
        .route("/api/sessions", get(list_sessions_handler))
        .route("/api/sessions", delete(revoke_all_sessions_handler))
        .route("/api/sessions/{id}", delete(revoke_session_handler))
        .route("/api/flow/error", get(flow_error_handler))
        .route("/api/flow/{*type}", get(flow_handler))
        .route("/api/hydra/consent", get(hydra::get_consent))
        .route("/api/hydra/consent/accept", post(hydra::accept_consent))
        .route("/api/hydra/consent/reject", post(hydra::reject_consent))
        .route("/api/hydra/logout", get(hydra::get_logout))
        .route("/api/hydra/logout/accept", post(hydra::accept_logout))
        .route("/api/hydra/login/accept", post(hydra::accept_login))
        .route("/api/avatar", put(s3::upload_avatar))
        .route("/api/avatar/{id}", get(s3::get_avatar))
        .route("/api/avatar", delete(s3::delete_avatar))
        .route("/api/{*path}", get(proxy_handler))
        .route("/api/{*path}", post(proxy_handler))
        .route("/api/{*path}", put(proxy_handler))
        .route("/api/{*path}", patch(proxy_handler))
        .route("/api/{*path}", delete(proxy_handler))
        .layer(Extension(state))
}
