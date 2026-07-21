import { createHmac, timingSafeEqual } from "crypto";

const GUEST_TTL_MS = 4 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.CAPTURE_JOIN_SECRET ||
    process.env.LIVEKIT_API_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "vector-capture-dev-secret"
  );
}

export type GuestCaptureClaims = {
  captureSessionId: string;
  participantId: string;
  speaker: "trainer";
  exp: number;
};

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

/** Short-lived HMAC token so guests can POST transcript segments without an account. */
export function signGuestCaptureToken(opts: {
  captureSessionId: string;
  participantId: string;
}): string {
  const claims: GuestCaptureClaims = {
    captureSessionId: opts.captureSessionId,
    participantId: opts.participantId,
    speaker: "trainer",
    exp: Date.now() + GUEST_TTL_MS,
  };
  const payload = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", secret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

export function verifyGuestCaptureToken(token: string): GuestCaptureClaims | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const got = fromB64url(sig);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      return null;
    }
    const claims = JSON.parse(fromB64url(payload).toString("utf8")) as GuestCaptureClaims;
    if (!claims.exp || claims.exp < Date.now()) return null;
    if (claims.speaker !== "trainer") return null;
    return claims;
  } catch {
    return null;
  }
}

export function generateJoinCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[bytes[i]! % alphabet.length];
  }
  return code;
}

export function generateParticipantId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
