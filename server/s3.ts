import type { Context } from "hono";

const SEAWEEDFS_S3_URL =
  Deno.env.get("SEAWEEDFS_S3_URL") ??
  "http://seaweedfs-filer.storage.svc.cluster.local:8333";
const ACCESS_KEY = Deno.env.get("SEAWEEDFS_ACCESS_KEY") ?? "";
const SECRET_KEY = Deno.env.get("SEAWEEDFS_SECRET_KEY") ?? "";
const BUCKET = "avatars";
const REGION = "us-east-1";

const KRATOS_ADMIN_URL =
  Deno.env.get("KRATOS_ADMIN_URL") ??
  "http://kratos-admin.ory.svc.cluster.local:80";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const encoder = new TextEncoder();

// --- AWS Signature V4 (minimal, for single-bucket S3 operations) ---

async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  data: string,
): Promise<ArrayBuffer> {
  const keyBuf = key instanceof Uint8Array ? key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function sha256(data: Uint8Array): Promise<string> {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: Uint8Array | null,
): Promise<Record<string, string>> {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const shortDate = dateStamp.slice(0, 8);
  const scope = `${shortDate}/${REGION}/s3/aws4_request`;

  headers["x-amz-date"] = dateStamp;
  headers["x-amz-content-sha256"] = body
    ? await sha256(body)
    : await sha256(new Uint8Array(0));

  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const signedHeaders = signedHeaderKeys.join(";");

  const canonicalHeaders = signedHeaderKeys
    .map((k) => `${k}:${headers[k] ?? headers[Object.keys(headers).find((h) => h.toLowerCase() === k)!]}`)
    .join("\n") + "\n";

  const canonicalRequest = [
    method,
    url.pathname,
    url.search.replace(/^\?/, ""),
    canonicalHeaders,
    signedHeaders,
    headers["x-amz-content-sha256"],
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateStamp,
    scope,
    await sha256(encoder.encode(canonicalRequest)),
  ].join("\n");

  let signingKey: ArrayBuffer = await hmacSha256(
    encoder.encode("AWS4" + SECRET_KEY),
    shortDate,
  );
  signingKey = await hmacSha256(signingKey, REGION);
  signingKey = await hmacSha256(signingKey, "s3");
  signingKey = await hmacSha256(signingKey, "aws4_request");

  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  headers["Authorization"] =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

async function s3Request(
  method: string,
  key: string,
  body: Uint8Array | null = null,
  contentType?: string,
): Promise<Response> {
  const url = new URL(`/${BUCKET}/${key}`, SEAWEEDFS_S3_URL);
  const headers: Record<string, string> = {
    host: url.host,
  };
  if (contentType) headers["content-type"] = contentType;

  await signRequest(method, url, headers, body);

  return fetch(url.toString(), {
    method,
    headers,
    body,
  });
}

/** PUT /api/avatar — upload avatar image. */
export async function uploadAvatar(c: Context): Promise<Response> {
  const identity = c.get("identity");
  if (!identity?.id) return c.text("Unauthorized", 401);

  const contentType = c.req.header("content-type") ?? "";

  let imageBytes: Uint8Array;
  let imageType: string;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return c.json({ error: "No avatar file provided" }, 400);
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return c.json(
        { error: "Invalid file type. Use JPEG, PNG, or WebP." },
        400,
      );
    }
    if (file.size > MAX_SIZE) {
      return c.json({ error: "File too large. Max 2MB." }, 400);
    }
    imageBytes = new Uint8Array(await file.arrayBuffer());
    imageType = file.type;
  } else {
    // Raw body upload
    if (!ALLOWED_TYPES.has(contentType)) {
      return c.json(
        { error: "Invalid content type. Use JPEG, PNG, or WebP." },
        400,
      );
    }
    imageBytes = new Uint8Array(await c.req.arrayBuffer());
    if (imageBytes.length > MAX_SIZE) {
      return c.json({ error: "File too large. Max 2MB." }, 400);
    }
    imageType = contentType;
  }

  const key = identity.id;

  try {
    const resp = await s3Request("PUT", key, imageBytes, imageType);
    if (!resp.ok) {
      const text = await resp.text();
      return c.json({ error: `S3 upload failed: ${text}` }, 502);
    }
  } catch (err) {
    console.error("Avatar upload error:", err);
    return c.json({ error: `Storage unavailable: ${err}` }, 502);
  }

  // Update identity picture trait via Kratos Admin API
  const PUBLIC_URL = Deno.env.get("PUBLIC_URL") ?? "http://localhost:3102";
  const avatarUrl = `${PUBLIC_URL}/api/avatar/${identity.id}`;
  try {
    const getResp = await fetch(
      `${KRATOS_ADMIN_URL}/admin/identities/${identity.id}`,
      { headers: { Accept: "application/json" } },
    );
    if (getResp.ok) {
      const identityData = await getResp.json();
      identityData.traits.picture = avatarUrl;
      const putResp = await fetch(
        `${KRATOS_ADMIN_URL}/admin/identities/${identity.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schema_id: identityData.schema_id,
            state: identityData.state,
            traits: identityData.traits,
          }),
        },
      );
      if (!putResp.ok) {
        const errText = await putResp.text();
        console.error("Kratos trait update failed:", putResp.status, errText);
      }
    }
  } catch (err) {
    console.error("Kratos trait update error:", err);
  }

  return c.json({ url: avatarUrl });
}

/** GET /api/avatar/:id — proxy avatar image from SeaweedFS. */
export async function getAvatar(c: Context): Promise<Response> {
  const id = c.req.param("id");
  if (!id) return c.text("Missing id", 400);

  try {
    const resp = await s3Request("GET", id);
    if (resp.status === 404 || resp.status === 403) {
      return c.body(null, 404);
    }
    if (!resp.ok) {
      return c.text("Storage error", 502);
    }

    const headers = new Headers();
    const ct = resp.headers.get("content-type");
    if (ct) headers.set("Content-Type", ct);
    headers.set("Cache-Control", "public, max-age=300, must-revalidate");

    return new Response(resp.body, { status: 200, headers });
  } catch {
    return c.text("Storage unavailable", 502);
  }
}

/** DELETE /api/avatar — delete current user's avatar. */
export async function deleteAvatar(c: Context): Promise<Response> {
  const identity = c.get("identity");
  if (!identity?.id) return c.text("Unauthorized", 401);

  try {
    await s3Request("DELETE", identity.id);
  } catch {
    return c.text("Storage unavailable", 502);
  }

  // Clear picture trait
  try {
    const getResp = await fetch(
      `${KRATOS_ADMIN_URL}/admin/identities/${identity.id}`,
      { headers: { Accept: "application/json" } },
    );
    if (getResp.ok) {
      const identityData = await getResp.json();
      delete identityData.traits.picture;
      await fetch(`${KRATOS_ADMIN_URL}/admin/identities/${identity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema_id: identityData.schema_id,
          state: identityData.state,
          traits: identityData.traits,
        }),
      });
    }
  } catch {
    // Non-fatal
  }

  return c.json({ ok: true });
}
