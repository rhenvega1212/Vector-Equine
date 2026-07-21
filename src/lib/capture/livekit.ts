import { AccessToken } from "livekit-server-sdk";

export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
  );
}

export function getLiveKitUrl(): string | null {
  return process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || null;
}

export async function mintLiveKitToken(opts: {
  roomName: string;
  identity: string;
  name: string;
  canPublish: boolean;
}): Promise<string | null> {
  if (!isLiveKitConfigured()) return null;

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: opts.identity,
      name: opts.name,
      ttl: "4h",
    }
  );
  at.addGrant({
    roomJoin: true,
    room: opts.roomName,
    canPublish: opts.canPublish,
    canSubscribe: true,
    canPublishData: true,
  });
  const jwt = await Promise.resolve(at.toJwt());
  return jwt;
}
