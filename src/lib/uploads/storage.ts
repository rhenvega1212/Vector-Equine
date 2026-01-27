import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "avatars" | "post-media" | "event-banners" | "challenge-media" | "submissions";

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
