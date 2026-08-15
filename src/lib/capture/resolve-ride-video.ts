import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "session-videos";
const SIGNED_TTL_SEC = 60 * 60 * 6; // 6h playback

/**
 * Prefer Jetson / capture video asset; fall back to external video_link_url.
 */
export async function resolveRideVideo(opts: {
  captureSessionId: string | null | undefined;
  videoLinkUrl: string | null | undefined;
  riderId: string;
}): Promise<{
  url: string | null;
  kind: "native" | "external" | null;
  syncOffsetMs: number;
}> {
  const link = opts.videoLinkUrl?.trim() || null;

  if (opts.captureSessionId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data: asset } = await admin
        .from("session_media_assets")
        .select("storage_path, sync_offset_ms")
        .eq("capture_session_id", opts.captureSessionId)
        .eq("kind", "video")
        .order("sync_offset_ms", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (asset?.storage_path) {
        const { data: signed, error } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(asset.storage_path as string, SIGNED_TTL_SEC);
        if (!error && signed?.signedUrl) {
          return {
            url: signed.signedUrl,
            kind: "native",
            syncOffsetMs: (asset.sync_offset_ms as number) || 0,
          };
        }
      }
    } catch (e) {
      console.error("resolveRideVideo", e);
    }
  }

  // Fallback: rider-scoped client (if RLS allows reading assets)
  if (opts.captureSessionId) {
    try {
      const supabase = await createClient();
      const { data: asset } = await supabase
        .from("session_media_assets")
        .select("storage_path, sync_offset_ms")
        .eq("capture_session_id", opts.captureSessionId)
        .eq("kind", "video")
        .order("sync_offset_ms", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (asset?.storage_path) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(asset.storage_path as string, SIGNED_TTL_SEC);
        if (signed?.signedUrl) {
          return {
            url: signed.signedUrl,
            kind: "native",
            syncOffsetMs: (asset.sync_offset_ms as number) || 0,
          };
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (link) {
    return { url: link, kind: "external", syncOffsetMs: 0 };
  }
  return { url: null, kind: null, syncOffsetMs: 0 };
}
