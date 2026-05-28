use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let config = kratos_admin_server::config::Config::load()?;
    let bind_addr = config.bind_addr.clone();
    info!("starting sso on {}", bind_addr);

    let app = kratos_admin_server::create_app(config);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    info!("listening on http://{}", bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}
