/** Public site trainers open from cellular or any Wi-Fi. Never localhost / LAN. */
export const DEFAULT_PUBLIC_APP_ORIGIN = "https://vectorequine.com";

export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h === "[::1]"
  );
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    return isLoopbackHost(new URL(origin).hostname);
  } catch {
    return /localhost|127\.0\.0\.1|\[::1\]/i.test(origin);
  }
}

/** RFC1918 / link-local — a trainer on cellular cannot open these. */
export function isPrivateLanHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export function originFromHref(href: string): string | null {
  try {
    const u = new URL(href.includes("://") ? href : `https://${href}`);
    if (!u.hostname) return null;
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** HTTPS host a phone can open from any network. */
export function isPublicJoinOrigin(origin: string): boolean {
  const parsed = originFromHref(origin);
  if (!parsed) return false;
  try {
    const u = new URL(parsed);
    if (u.protocol !== "https:") return false;
    if (isLoopbackHost(u.hostname)) return false;
    if (isPrivateLanHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function pickPublicJoinOrigin(
  ...candidates: (string | null | undefined)[]
): string {
  for (const raw of candidates) {
    if (!raw) continue;
    const origin = originFromHref(raw);
    if (origin && isPublicJoinOrigin(origin)) return origin;
  }
  return DEFAULT_PUBLIC_APP_ORIGIN;
}

export function trainerJoinUrl(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/join/${code.toUpperCase()}`;
}

/**
 * QR value: a public https URL. Localhost and LAN IPs are skipped so the
 * trainer can be on cellular.
 */
export function resolveTrainerJoinUrl(opts: {
  joinCode: string;
  pageOrigin?: string | null;
  serverJoinUrl?: string | null;
  publicOrigin?: string | null;
}): string {
  const origin = pickPublicJoinOrigin(
    opts.pageOrigin,
    opts.serverJoinUrl,
    opts.publicOrigin
  );
  return trainerJoinUrl(origin, opts.joinCode);
}
