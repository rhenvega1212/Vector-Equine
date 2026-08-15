import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const EDGE_TTL_MS = 4 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.EDGE_INGEST_SECRET ||
    process.env.CAPTURE_JOIN_SECRET ||
    process.env.LIVEKIT_API_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "vector-edge-dev-secret"
  );
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export type EdgeSessionClaims = {
  captureSessionId: string;
  edgeDeviceId: string;
  role: "edge";
  exp: number;
};

export function hashDeviceSecret(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function mintDeviceSecret(): string {
  return `vedge_${randomBytes(24).toString("base64url")}`;
}

export function generateDeviceKey(label = "jetson"): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "jetson";
  return `${slug}-${randomBytes(3).toString("hex")}`;
}

/** Short-lived HMAC so the Jetson can upload/heartbeat without a user cookie. */
export function signEdgeSessionToken(opts: {
  captureSessionId: string;
  edgeDeviceId: string;
}): string {
  const claims: EdgeSessionClaims = {
    captureSessionId: opts.captureSessionId,
    edgeDeviceId: opts.edgeDeviceId,
    role: "edge",
    exp: Date.now() + EDGE_TTL_MS,
  };
  const payload = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", secret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

export function verifyEdgeSessionToken(token: string): EdgeSessionClaims | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const got = fromB64url(sig);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      return null;
    }
    const claims = JSON.parse(
      fromB64url(payload).toString("utf8")
    ) as EdgeSessionClaims;
    if (!claims.exp || claims.exp < Date.now()) return null;
    if (claims.role !== "edge") return null;
    if (!claims.captureSessionId || !claims.edgeDeviceId) return null;
    return claims;
  } catch {
    return null;
  }
}

export type EdgeDeviceAuth = {
  deviceKey: string;
  deviceSecret: string;
};

/** Parse `Authorization: Edge <device_key>:<device_secret>` or Bearer edge token later. */
export function parseEdgeDeviceAuth(
  header: string | null
): EdgeDeviceAuth | null {
  if (!header) return null;
  const edge = header.match(/^Edge\s+(.+)$/i);
  if (edge) {
    const raw = edge[1].trim();
    const idx = raw.indexOf(":");
    if (idx <= 0) return null;
    return {
      deviceKey: raw.slice(0, idx).trim(),
      deviceSecret: raw.slice(idx + 1).trim(),
    };
  }
  return null;
}

export function buildEdgeManifest(opts: {
  captureSessionId: string;
  t0: string;
  layers: { video: boolean; sensors: boolean; transcript: boolean };
  files?: Array<{ kind: string; path: string; sync_offset_ms: number }>;
}) {
  return {
    version: 1,
    capture_session_id: opts.captureSessionId,
    t0: opts.t0,
    clock: "capture_sessions.t0",
    layers: opts.layers,
    files: opts.files || [],
  };
}
