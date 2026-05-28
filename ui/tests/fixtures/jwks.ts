export type JsonWebKey = {
  kid: string;
  use: string;
  alg: string;
  kty: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
};

export type JsonWebKeySet = { keys: JsonWebKey[] };

export const jwksOpenIdIdToken: JsonWebKeySet = {
  keys: [
    {
      kid: "public:1c84-current",
      use: "sig",
      alg: "RS256",
      kty: "RSA",
      n: "abc-mock",
      e: "AQAB",
    },
    {
      kid: "public:9f20-previous",
      use: "sig",
      alg: "RS256",
      kty: "RSA",
      n: "old-mock",
      e: "AQAB",
    },
  ],
};

export const jwksJwtAccessToken: JsonWebKeySet = {
  keys: [
    {
      kid: "public:7c4b-access",
      use: "sig",
      alg: "ES256",
      kty: "EC",
      crv: "P-256",
      x: "x-mock",
      y: "y-mock",
    },
  ],
};

export const jwksKratosSession: JsonWebKeySet = {
  keys: [
    {
      kid: "kratos-session-current",
      use: "sig",
      alg: "HS256",
      kty: "oct",
    },
  ],
};
