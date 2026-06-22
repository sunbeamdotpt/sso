//! SSO server configuration.

use anyhow::{Context, Result};

/// Runtime configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    /// Address to bind the HTTP server.
    pub bind_addr: String,
    /// Kratos public API base URL.
    pub kratos_public_url: String,
    /// Kratos admin API base URL.
    pub kratos_admin_url: String,
    /// Hydra admin API base URL.
    pub hydra_admin_url: String,
}

impl Config {
    /// Load configuration from environment variables.
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            bind_addr: std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:3102".to_string()),
            kratos_public_url: std::env::var("KRATOS_PUBLIC_URL")
                .unwrap_or_else(|_| "http://kratos-public.ory.svc.cluster.local:80".to_string()),
            kratos_admin_url: std::env::var("KRATOS_ADMIN_URL")
                .unwrap_or_else(|_| "http://kratos-admin.ory.svc.cluster.local:80".to_string()),
            hydra_admin_url: std::env::var("HYDRA_ADMIN_URL")
                .unwrap_or_else(|_| "http://hydra-admin.ory.svc.cluster.local:4445".to_string()),
        })
    }

    /// Build a request URL for the Kratos public API, preserving the path and query.
    pub fn kratos_public_target(&self, path_and_query: &str) -> String {
        format!("{}{}", self.kratos_public_url, path_and_query)
    }

    /// Build a request URL for the Kratos admin API.
    pub fn kratos_admin_target(&self, path_and_query: &str) -> String {
        format!("{}{}", self.kratos_admin_url, path_and_query)
    }

    /// Build a request URL for the Hydra admin API.
    pub fn hydra_admin_target(&self, path_and_query: &str) -> String {
        format!("{}{}", self.hydra_admin_url, path_and_query)
    }
}

/// Shared HTTP client for upstream calls.
pub fn http_client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .context("build HTTP client")
}
