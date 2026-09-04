import os from "os";
import {
  isPrivateLanHost,
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

function requestPort(request: {
  headers: { get(name: string): string | null };
}): number {
  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = xfHost || request.headers.get("host") || "";
  const m = host.match(/:(\d+)$/);
  if (m) return Number(m[1]);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return proto === "https" ? 443 : 3000;
}

/**
 * IPv4 on this machine a phone on the same Wi-Fi can open.
 * Prefers en0 (Mac Wi-Fi). Skips loopback and public addresses.
 */
export function lanHttpOrigin(
  port: number,
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()
): string | null {
  const preferred = ["en0", "en1", "eth0", "wlan0", "wi-fi"];
  const found: { name: string; address: string }[] = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const a of addrs || []) {
      const v4 = a.family === "IPv4" || (a.family as unknown) === 4;
      if (!v4 || a.internal) continue;
      if (!isPrivateLanHost(a.address)) continue;
      found.push({ name, address: a.address });
    }
  }
  const picked =
    preferred
      .map((n) => found.find((c) => c.name.toLowerCase() === n))
      .find(Boolean) || found[0];
  return picked ? `http://${picked.address}:${port}` : null;
}

export function lanHttpOriginFromRequest(request: {
  headers: { get(name: string): string | null };
}): string | null {
  return lanHttpOrigin(requestPort(request));
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

export function joinLanUrlFromRequest(
  request: { headers: { get(name: string): string | null } },
  code: string
): string | null {
  const origin = lanHttpOriginFromRequest(request);
  return origin ? trainerJoinUrl(origin, code) : null;
}

export function joinUrlsFromRequest(
  request: { headers: { get(name: string): string | null } },
  code: string
): { join_url: string; join_url_lan: string | null } {
  return {
    join_url: joinUrlFromRequest(request, code),
    join_url_lan: joinLanUrlFromRequest(request, code),
  };
}
