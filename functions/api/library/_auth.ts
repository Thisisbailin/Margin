const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JwtPayload = {
  sub?: string;
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
  [key: string]: unknown;
};

type JwtHeader = {
  kid?: string;
  alg?: string;
  [key: string]: unknown;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const getBearerToken = (request: Request) => {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/Bearer\s+(.+)/i);
  return match ? match[1] : "";
};

const decodeBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + pad);
};

const decodeJson = <T>(input: string): T => {
  const json = decodeBase64Url(input);
  return JSON.parse(json) as T;
};

const base64UrlToUint8Array = (input: string) => {
  const raw = decodeBase64Url(input);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
};

let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

const fetchJwks = async (jwksUrl: string) => {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < 5 * 60 * 1000) {
    return jwksCache.keys;
  }

  const res = await fetch(jwksUrl, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch JWKS");
  }
  const data = (await res.json()) as { keys?: JsonWebKey[] };
  const keys = data.keys || [];
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error("Invalid JWKS response");
  }

  jwksCache = { keys, fetchedAt: now };
  return keys;
};

const verifyJwt = async (token: string, env: Record<string, string>) => {
  const [headerSegment, payloadSegment, signatureSegment] = token.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new Error("Malformed token");
  }

  const header = decodeJson<JwtHeader>(headerSegment);
  const payload = decodeJson<JwtPayload>(payloadSegment);

  const jwksUrl = env.CLERK_JWKS_URL || "";
  if (!jwksUrl) {
    throw new Error("Missing CLERK_JWKS_URL");
  }

  const keys = await fetchJwks(jwksUrl);
  const jwk = keys.find((key) => key.kid && key.kid === header.kid) || keys[0];
  if (!jwk) {
    throw new Error("Signing key not found");
  }

  const alg = header.alg || "RS256";
  if (alg !== "RS256") {
    throw new Error("Unsupported token algorithm");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const signature = base64UrlToUint8Array(signatureSegment);

  const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp + 5) {
    throw new Error("Token expired");
  }
  if (payload.nbf && now < payload.nbf - 5) {
    throw new Error("Token not active");
  }

  const expectedIssuer = env.CLERK_ISSUER || "";
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw new Error("Token issuer mismatch");
  }

  return payload;
};

const requireUser = async (request: Request, env: Record<string, string>) => {
  const token = getBearerToken(request);
  if (!token) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  try {
    const payload = await verifyJwt(token, env);
    const userId = payload.sub;
    if (!userId) {
      return { error: jsonResponse({ error: "Invalid token payload" }, 401) };
    }
    return { userId, payload };
  } catch (error: any) {
    return { error: jsonResponse({ error: error?.message || "Unauthorized" }, 401) };
  }
};

export { corsHeaders, jsonResponse, requireUser };
