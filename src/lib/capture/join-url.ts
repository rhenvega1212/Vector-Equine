/** Live app trainers open — not the waitlist site on vectorequine.com. */
export const DEFAULT_PUBLIC_APP_ORIGIN = "https://vector-equine.vercel.app";

/** Marketing/waitlist host — no /join route, so a QR there is a dead end. */
function isMarketingHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, "").toLowerCase();
  return h === "vectorequine.com";
}

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

/** @deprecated Use isPrivateLanHost — kept so old bundles don't crash on HMR. */
export function isPrivateLanOrigin(origin: string): boolean {
  try {
    return isPrivateLanHost(new URL(origin).hostname);
  } catch {
    return isPrivateLanHost(origin);
  }
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

/** HTTPS host a phone can open that actually serves /join. */
export function isPublicJoinOrigin(origin: string): boolean {
  const parsed = originFromHref(origin);
  if (!parsed) return false;
  try {
    const u = new URL(parsed);
    if (u.protocol !== "https:") return false;
    if (isLoopbackHost(u.hostname)) return false;
    if (isPrivateLanHost(u.hostname)) return false;
    if (isMarketingHost(u.hostname)) return false;
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

/** Phone on the same Wi-Fi can open this — http or https on a private LAN IP. */
export function isLanJoinOrigin(origin: string): boolean {
  const parsed = originFromHref(origin);
  if (!parsed) return false;
  try {
    const u = new URL(parsed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return isPrivateLanHost(u.hostname);
  } catch {
    return false;
  }
}

/**
 * URL encoded in the trainer QR. Always public https — iPhone will not
 * open the microphone on http://192.168… so LAN must never go in the QR.
 */
export function resolveTrainerJoinUrl(opts: {
  joinCode: string;
  pageOrigin?: string | null;
  serverJoinUrl?: string | null;
  publicOrigin?: string | null;
  lanJoinUrl?: string | null;
}): string {
  return trainerJoinUrl(
    pickPublicJoinOrigin(
      opts.pageOrigin,
      opts.serverJoinUrl,
      opts.publicOrigin
    ),
    opts.joinCode
  );
}

/** Cellular / off-Wi-Fi copy of the join link. Always public https. */
export function publicTrainerJoinUrl(opts: {
  joinCode: string;
  pageOrigin?: string | null;
  serverJoinUrl?: string | null;
  publicOrigin?: string | null;
}): string {
  return trainerJoinUrl(
    pickPublicJoinOrigin(
      opts.pageOrigin,
      opts.serverJoinUrl,
      opts.publicOrigin
    ),
    opts.joinCode
  );
}

/**
 * Same-machine join for lab tests. Localhost is a secure context; a LAN
 * IP is not, so iPhone must never be sent there.
 */
export function localTrainerJoinUrl(opts: {
  joinCode: string;
  pageOrigin?: string | null;
}): string | null {
  const origin = opts.pageOrigin;
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (!isLoopbackHost(u.hostname)) return null;
    return trainerJoinUrl(origin.replace(/\/$/, ""), opts.joinCode);
  } catch {
    return null;
  }
}
