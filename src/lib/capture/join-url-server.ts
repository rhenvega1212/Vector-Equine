import {
  pickPublicJoinOrigin,
  trainerJoinUrl,
} from "@/lib/capture/join-url";

function vercelProductionOrigin(): string | null {
  const raw =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (!raw) return null;
  const host = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return host ? `https://${host}` : null;
}

/** Origin encoded in the trainer QR — public https only. */
export function joinOriginFromRequest(request: {
  headers: { get(name: string): string | null };
}): string {
  const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = xfHost || request.headers.get("host") || "";
  const originHeader = request.headers.get("origin");

  let fromRequest = originHeader || "";
  if (!fromRequest && host) {
    const proto = xfProto || "https";
    fromRequest = `${proto}://${host}`;
  }

  return pickPublicJoinOrigin(
    fromRequest,
    process.env.NEXT_PUBLIC_JOIN_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    vercelProductionOrigin()
  );
}

export function joinUrlFromRequest(
  request: { headers: { get(name: string): string | null } },
  code: string
): string {
  return trainerJoinUrl(joinOriginFromRequest(request), code);
}
