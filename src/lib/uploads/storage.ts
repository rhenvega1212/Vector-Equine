import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "avatars" | "post-media" | "event-banners" | "challenge-media" | "submissions" | "ai-training-videos" | "session-videos" | "horse-photos";

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadFile(
  bucket: StorageBucket,
  file: File,
  path?: string
): Promise<UploadResult> {
  const supabase = createClient();
  
  const fileExt = file.name.split(".").pop();
  const fileName = path || `${crypto.randomUUID()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });
  
  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);
  
  return {
    url: publicUrl,
    path: data.path,
  };
}

export async function uploadFileWithProgress(
  bucket: StorageBucket,
  file: File,
  path?: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const supabase = createClient();

  const fileExt = file.name.split(".").pop();
  const fileName = path || `${crypto.randomUUID()}.${fileExt}`;

  // For admin buckets, request a signed upload URL from the server to
  // bypass RLS policies. Falls back to direct auth upload otherwise.
  const adminBuckets: StorageBucket[] = ["challenge-media", "submissions"];
  const useSignedUrl = adminBuckets.includes(bucket);

  let uploadUrl: string;

  if (useSignedUrl) {
    const res = await fetch("/api/admin/storage/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path: fileName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to get upload URL (${res.status})`);
    }
    const { signedUrl } = await res.json();
    uploadUrl = signedUrl;
  } else {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;
  }

  async function prepareHeaders(): Promise<{
    method: string;
    headers: Record<string, string>;
  }> {
    const headers: Record<string, string> = {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
    };
    if (useSignedUrl) {
      return { method: "PUT", headers };
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    headers["Authorization"] = `Bearer ${session.access_token}`;
    headers["x-upsert"] = "true";
    return { method: "POST", headers };
  }

  const { method, headers } = await prepareHeaders();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // XHR can fire progress very frequently; forwarding every tick to React
    // setState stalls the main thread and makes uploads feel "stuck" at low %.
    let lastReported = -1;
    let lastReportAt = 0;
    const MIN_STEP = 2;
    const MIN_MS = 200;

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable || !onProgress) return;
      const percent = Math.round((e.loaded / e.total) * 100);
      const now = Date.now();
      const due =
        percent >= 100 ||
        percent - lastReported >= MIN_STEP ||
        (percent > lastReported && now - lastReportAt >= MIN_MS);
      if (due) {
        lastReported = percent;
        lastReportAt = now;
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress && lastReported < 100) {
          onProgress(100);
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(fileName);
        resolve({ url: publicUrl, path: fileName });
      } else {
        let message = "Upload failed";
        try {
          const body = JSON.parse(xhr.responseText);
          message = body.message || body.error || body.statusCode || message;
        } catch {}
        reject(new Error(message));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error — check your connection and try again"))
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open(method, uploadUrl);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(file);
  });
}

export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase.storage.from(bucket).remove([path]);
  
  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

export function getPublicUrl(bucket: StorageBucket, path: string): string {
  const supabase = createClient();
  
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  
  return publicUrl;
}

export function isValidImageType(file: File): boolean {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(file.type);
}

export function isValidVideoType(file: File): boolean {
  const validTypes = ["video/mp4", "video/webm", "video/quicktime"];
  return validTypes.includes(file.type);
}

export function isValidFileSize(file: File, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

export const MAX_IMAGE_SIZE_MB = 10;
/**
 * Challenge / lesson direct uploads (browser → Supabase signed URL).
 * Keep in sync with Supabase Storage global limit (Dashboard → Storage → Settings, and supabase/config.toml for local).
 * Single-request uploads are typically practical up to ~5 GiB; above that use YouTube/Vimeo or resumable uploads.
 */
export const MAX_VIDEO_SIZE_MB = 5120;
export const MAX_FILE_SIZE_MB = 50;
