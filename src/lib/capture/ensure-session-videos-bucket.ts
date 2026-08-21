import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "session-videos";

/**
 * Lab / capture audio uploads need this bucket. Remote projects sometimes
 * never ran the storage migration — create it on first use.
 */
export async function ensureSessionVideosBucket(
  admin: SupabaseClient
): Promise<boolean> {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (buckets?.some((b) => b.name === BUCKET || b.id === BUCKET)) {
      return true;
    }
  } catch {
    /* create below */
  }

  // Omit fileSizeLimit — some projects reject createBucket with 413 when set.
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
  });
  if (error) {
    if (/already exists|duplicate|exists/i.test(error.message)) return true;
    console.error("ensure session-videos bucket", error);
    return false;
  }
  return true;
}
