use figment::{Figment, providers::{Env, Format, Toml}};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_bind_addr")]
    pub bind_addr: String,

    #[serde(default = "default_kratos_public_url")]
    pub kratos_public_url: String,

    #[serde(default = "default_kratos_admin_url")]
    pub kratos_admin_url: String,

    #[serde(default = "default_hydra_admin_url")]
    pub hydra_admin_url: String,

    #[serde(default = "default_public_url")]
    pub public_url: String,

    #[serde(default)]
    pub admin_identity_ids: Vec<String>,

    #[serde(default = "default_ui_dist")]
    pub ui_dist: String,

    #[serde(default = "default_csrf_secret")]
    pub csrf_secret: String,
}

fn default_bind_addr() -> String { "0.0.0.0:3102".into() }
fn default_kratos_public_url() -> String { "http://kratos-public.ory.svc.cluster.local:80".into() }
fn default_kratos_admin_url() -> String { "http://kratos-admin.ory.svc.cluster.local:80".into() }
fn default_hydra_admin_url() -> String { "http://hydra-admin.ory.svc.cluster.local:4445".into() }
fn default_public_url() -> String { "http://localhost:3102".into() }
fn default_ui_dist() -> String { "./ui/dist".into() }
fn default_csrf_secret() -> String { "dev-secret-change-in-production".into() }

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let figment = Figment::new()
            .merge(Toml::file("dev.toml"))
            .merge(Env::prefixed("KRATOS_ADMIN_"));
        Ok(figment.extract()?)
    }
}
