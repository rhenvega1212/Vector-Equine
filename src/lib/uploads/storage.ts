import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "avatars" | "post-media" | "event-banners" | "challenge-media" | "submissions" | "ai-training-videos";

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
      upsert: false,
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const fileExt = file.name.split(".").pop();
  const fileName = path || `${crypto.randomUUID()}.${fileExt}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);
        resolve({ url: publicUrl, path: fileName });
      } else {
        let message = "Upload failed";
        try {
          const body = JSON.parse(xhr.responseText);
          message = body.message || body.error || message;
        } catch {}
        reject(new Error(message));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Cache-Control", "3600");
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
export const MAX_VIDEO_SIZE_MB = 100;
export const MAX_FILE_SIZE_MB = 50;
