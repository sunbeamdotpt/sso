//! Hydra admin API orchestration.

use std::collections::HashSet;
use std::sync::Arc;

use axum::{
    Router as AxumRouter,
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::config::{Config, http_client};

#[derive(Deserialize)]
struct ChallengeQuery {
    challenge: String,
}

#[derive(Deserialize)]
struct AcceptLoginBody {
    challenge: String,
    subject: String,
}

#[derive(Serialize)]
struct AcceptLoginPayload {
    subject: String,
    remember: bool,
    #[serde(rename = "remember_for")]
    remember_for: i64,
}

#[derive(Deserialize)]
struct AcceptConsentBody {
    challenge: String,
    #[serde(default)]
    grant_scope: Vec<String>,
    #[serde(default)]
    remember: bool,
}

#[derive(Serialize)]
struct AcceptConsentPayload {
    #[serde(rename = "grant_scope")]
    grant_scope: Vec<String>,
    remember: bool,
    #[serde(rename = "remember_for")]
    remember_for: i64,
    session: Value,
}

#[derive(Deserialize)]
struct RejectConsentBody {
    challenge: String,
}

#[derive(Serialize)]
struct RejectConsentPayload {
    error: String,
    #[serde(rename = "error_description")]
    error_description: String,
}

#[derive(Deserialize)]
struct AcceptLogoutBody {
    challenge: String,
}

/// Small error type for Hydra admin calls so we don't return a large `Response` as `Err`.
struct AdminError {
    status: StatusCode,
    body: Value,
}

impl From<AdminError> for Response {
    fn from(err: AdminError) -> Self {
        (err.status, axum::Json(err.body)).into_response()
    }
}

async fn hydra_admin_get(config: &Config, path_and_query: &str) -> Result<Value, AdminError> {
    let client = http_client().map_err(|_| AdminError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        body: Value::String("failed to build HTTP client".to_string()),
    })?;

    let resp = client
        .get(config.hydra_admin_target(path_and_query))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| AdminError {
            status: StatusCode::BAD_GATEWAY,
            body: Value::String("Hydra unavailable".to_string()),
        })?;

    let status = resp.status();
    let body = resp.json::<Value>().await.unwrap_or(Value::Null);

    if !status.is_success() {
        return Err(AdminError {
            status: StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            body,
        });
    }

    Ok(body)
}

async fn hydra_admin_put<T: Serialize>(
    config: &Config,
    path_and_query: &str,
    payload: &T,
) -> Result<Value, AdminError> {
    let client = http_client().map_err(|_| AdminError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        body: Value::String("failed to build HTTP client".to_string()),
    })?;

    let resp = client
        .put(config.hydra_admin_target(path_and_query))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(payload)
        .send()
        .await
        .map_err(|_| AdminError {
            status: StatusCode::BAD_GATEWAY,
            body: Value::String("Hydra unavailable".to_string()),
        })?;

    let status = resp.status();
    let body = resp.json::<Value>().await.unwrap_or(Value::Null);

    if !status.is_success() {
        return Err(AdminError {
            status: StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            body,
        });
    }

    Ok(body)
}

/// Fetch identity traits from Kratos admin API and build OIDC claims.
async fn get_identity_claims(config: &Config, subject: &str, granted_scopes: &[String]) -> Value {
    let client = match http_client() {
        Ok(c) => c,
        Err(_) => return Value::Object(serde_json::Map::new()),
    };

    let resp = match client
        .get(config.kratos_admin_target(&format!("/admin/identities/{}", subject)))
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Value::Object(serde_json::Map::new()),
    };

    if !resp.status().is_success() {
        return Value::Object(serde_json::Map::new());
    }

    let identity: Value = match resp.json().await {
        Ok(v) => v,
        Err(_) => return Value::Object(serde_json::Map::new()),
    };

    let traits = identity
        .get("traits")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let verifiable_addresses = identity
        .get("verifiable_addresses")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let scopes: HashSet<String> = granted_scopes.iter().cloned().collect();
    let mut claims = serde_json::Map::new();

    if scopes.contains("email")
        && let Some(email) = traits.get("email").and_then(|v| v.as_str())
    {
        claims.insert("email".to_string(), Value::String(email.to_string()));
        let verified = verifiable_addresses.iter().any(|a| {
            a.get("value").and_then(|v| v.as_str()) == Some(email)
                && a.get("verified").and_then(|v| v.as_bool()).unwrap_or(false)
        });
        claims.insert("email_verified".to_string(), Value::Bool(verified));
    }

    if scopes.contains("profile") {
        for (key, claim_key) in [
            ("given_name", "given_name"),
            ("family_name", "family_name"),
            ("middle_name", "middle_name"),
            ("nickname", "nickname"),
            ("picture", "picture"),
            ("phone_number", "phone_number"),
        ] {
            if let Some(value) = traits.get(key).cloned() {
                claims.insert(claim_key.to_string(), value);
            }
        }

        let given_name = traits.get("given_name").and_then(|v| v.as_str());
        let family_name = traits.get("family_name").and_then(|v| v.as_str());
        let parts: Vec<&str> = [given_name, family_name].into_iter().flatten().collect();
        if !parts.is_empty() {
            claims.insert("name".to_string(), Value::String(parts.join(" ")));
        }

        if let Some(value) = traits.get("given_name").cloned() {
            claims.insert("first_name".to_string(), value);
        }
        if let Some(value) = traits.get("family_name").cloned() {
            claims.insert("last_name".to_string(), value);
        }
    }

    Value::Object(claims)
}

/// GET /api/hydra/login?challenge=<ch>
async fn get_login(config: Arc<Config>, Query(query): Query<ChallengeQuery>) -> Response {
    match hydra_admin_get(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/login?login_challenge={}",
            query.challenge
        ),
    )
    .await
    {
        Ok(data) => (StatusCode::OK, axum::Json(data)).into_response(),
        Err(err) => err.into(),
    }
}

/// POST /api/hydra/login/accept
async fn accept_login(
    config: Arc<Config>,
    axum::Json(body): axum::Json<AcceptLoginBody>,
) -> Response {
    let payload = AcceptLoginPayload {
        subject: body.subject,
        remember: true,
        remember_for: 0,
    };

    match hydra_admin_put(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/login/accept?login_challenge={}",
            body.challenge
        ),
        &payload,
    )
    .await
    {
        Ok(data) => (StatusCode::OK, axum::Json(data)).into_response(),
        Err(err) => err.into(),
    }
}

/// GET /api/hydra/consent?challenge=<ch>
async fn get_consent(config: Arc<Config>, Query(query): Query<ChallengeQuery>) -> Response {
    match hydra_admin_get(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/consent?consent_challenge={}",
            query.challenge
        ),
    )
    .await
    {
        Ok(data) => (StatusCode::OK, axum::Json(data)).into_response(),
        Err(err) => err.into(),
    }
}

/// POST /api/hydra/consent/accept
async fn accept_consent(
    config: Arc<Config>,
    axum::Json(body): axum::Json<AcceptConsentBody>,
) -> Response {
    // Fetch the consent request first to validate requested scopes.
    let consent = match hydra_admin_get(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/consent?consent_challenge={}",
            body.challenge
        ),
    )
    .await
    {
        Ok(data) => data,
        Err(err) => return err.into(),
    };

    let requested_scopes: HashSet<String> = consent
        .get("requested_scope")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let granted_scopes: Vec<String> = body
        .grant_scope
        .into_iter()
        .filter(|s| requested_scopes.contains(s))
        .collect();

    let subject = consent
        .get("subject")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let id_token_claims = get_identity_claims(&config, &subject, &granted_scopes).await;

    let payload = AcceptConsentPayload {
        grant_scope: granted_scopes,
        remember: body.remember,
        remember_for: if body.remember { 3600 } else { 0 },
        session: serde_json::json!({ "id_token": id_token_claims }),
    };

    match hydra_admin_put(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/consent/accept?consent_challenge={}",
            body.challenge
        ),
        &payload,
    )
    .await
    {
        Ok(data) => (StatusCode::OK, axum::Json(data)).into_response(),
        Err(err) => err.into(),
    }
}

/// POST /api/hydra/consent/reject
async fn reject_consent(
    config: Arc<Config>,
    axum::Json(body): axum::Json<RejectConsentBody>,
) -> Response {
    let payload = RejectConsentPayload {
        error: "access_denied".to_string(),
        error_description: "The resource owner denied the request".to_string(),
    };

    match hydra_admin_put(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/consent/reject?consent_challenge={}",
            body.challenge
        ),
        &payload,
    )
    .await
    {
        Ok(data) => (StatusCode::OK, axum::Json(data)).into_response(),
        Err(err) => err.into(),
    }
}

/// GET /api/hydra/logout?challenge=<ch>
async fn get_logout(config: Arc<Config>, Query(query): Query<ChallengeQuery>) -> Response {
    match hydra_admin_get(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/logout?logout_challenge={}",
            query.challenge
        ),
    )
    .await
    {
        Ok(data) => (StatusCode::OK, axum::Json(data)).into_response(),
        Err(err) => err.into(),
    }
}

/// POST /api/hydra/logout/accept
async fn accept_logout(
    config: Arc<Config>,
    axum::Json(body): axum::Json<AcceptLogoutBody>,
) -> Response {
    match hydra_admin_put(
        &config,
        &format!(
            "/admin/oauth2/auth/requests/logout/accept?logout_challenge={}",
            body.challenge
        ),
        &serde_json::json!({}),
    )
    .await
    {
        Ok(data) => (StatusCode::OK, axum::Json(data)).into_response(),
        Err(err) => err.into(),
    }
}

pub fn hydra_routes(config: Arc<Config>) -> AxumRouter {
    let config_login = Arc::clone(&config);
    let config_login_accept = Arc::clone(&config);
    let config_consent = Arc::clone(&config);
    let config_consent_accept = Arc::clone(&config);
    let config_consent_reject = Arc::clone(&config);
    let config_logout = Arc::clone(&config);
    let config_logout_accept = Arc::clone(&config);

    AxumRouter::new()
        .route(
            "/hydra/login",
            get(move |q: Query<ChallengeQuery>| get_login(Arc::clone(&config_login), q)),
        )
        .route(
            "/hydra/login/accept",
            post(move |body: axum::Json<AcceptLoginBody>| {
                accept_login(Arc::clone(&config_login_accept), body)
            }),
        )
        .route(
            "/hydra/consent",
            get(move |q: Query<ChallengeQuery>| get_consent(Arc::clone(&config_consent), q)),
        )
        .route(
            "/hydra/consent/accept",
            post(move |body: axum::Json<AcceptConsentBody>| {
                accept_consent(Arc::clone(&config_consent_accept), body)
            }),
        )
        .route(
            "/hydra/consent/reject",
            post(move |body: axum::Json<RejectConsentBody>| {
                reject_consent(Arc::clone(&config_consent_reject), body)
            }),
        )
        .route(
            "/hydra/logout",
            get(move |q: Query<ChallengeQuery>| get_logout(Arc::clone(&config_logout), q)),
        )
        .route(
            "/hydra/logout/accept",
            post(move |body: axum::Json<AcceptLogoutBody>| {
                accept_logout(Arc::clone(&config_logout_accept), body)
            }),
        )
}
