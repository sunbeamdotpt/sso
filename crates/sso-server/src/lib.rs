pub mod config;
pub mod auth;
pub mod csrf;
pub mod proxy;
pub mod routes;

use std::sync::Arc;
use axum::Router as AxumRouter;
use axum::middleware::from_fn;
use axum::Extension;
use tower_http::services::{ServeDir, ServeFile};
use sunbeam_g2v::health::HealthRouter;

use crate::config::Config;
use crate::routes::api_routes;

pub struct AppState {
    pub config: Config,
    pub http: reqwest::Client,
}

pub fn create_app(config: Config) -> AxumRouter {
    let state = Arc::new(AppState {
        http: reqwest::Client::new(),
        config,
    });

    let api = api_routes(state.clone());

    let index_path = format!("{}/index.html", state.config.ui_dist);
    let static_routes = AxumRouter::new()
        .fallback_service(
            ServeDir::new(&state.config.ui_dist)
                .append_index_html_on_directories(true)
                .fallback(ServeFile::new(index_path))
        );

    let health = HealthRouter::new().into_axum_router();

    api
        .merge(health)
        .merge(static_routes)
        .layer(from_fn(auth::auth_middleware))
        .layer(from_fn(csrf::csrf_middleware))
        .layer(Extension(state))
}
