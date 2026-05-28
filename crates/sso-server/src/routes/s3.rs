use std::sync::Arc;
use axum::{
    extract::Extension,
    response::{IntoResponse, Response},
};

use crate::AppState;

pub async fn upload_avatar(
    _state: Extension<Arc<AppState>>,
) -> Response {
    // Placeholder: integrate with actual S3/SeaweedFS
    (axum::http::StatusCode::OK, r#"{"ok":true}"#).into_response()
}

pub async fn get_avatar(
    _state: Extension<Arc<AppState>>,
) -> Response {
    (axum::http::StatusCode::NOT_IMPLEMENTED, "S3 not configured").into_response()
}

pub async fn delete_avatar(
    _state: Extension<Arc<AppState>>,
) -> Response {
    (axum::http::StatusCode::OK, r#"{"ok":true}"#).into_response()
}
