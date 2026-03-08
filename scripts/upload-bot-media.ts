/**
 * One-time script to upload bot media images to Supabase Storage.
 *
 * Usage:
 *   1. Create a folder at scripts/bot-media/ with subdirectories by category:
 *        scripts/bot-media/arena/
 *        scripts/bot-media/trail/
 *        scripts/bot-media/horse-portrait/
 *        scripts/bot-media/barn/
 *        scripts/bot-media/competition/
 *        scripts/bot-media/western/
 *        scripts/bot-media/tack/
 *        scripts/bot-media/sunset/
 *
 *   2. Drop 5-8 royalty-free images (jpg/png/webp) into each folder.
 *
 *   3. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local
 *
 *   4. Run:  npx tsx scripts/upload-bot-media.ts
 *
 *   5. Copy the printed output into src/lib/bots/media-pool.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Make sure they are set in your environment or .env.local file.\n" +
      "You can run: npx dotenv -e .env.local -- npx tsx scripts/upload-bot-media.ts"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "post-media";
const MEDIA_DIR = path.join(__dirname, "bot-media");

const CATEGORY_TAG_MAP: Record<string, string[]> = {
  arena: ["training", "dressage"],
  trail: ["trail-riding", "western"],
  "horse-portrait": ["horse-care"],
  barn: ["horse-care"],
  competition: ["competition", "jumping"],
  western: ["western"],
  tack: ["horse-care"],
  sunset: ["trail-riding"],
};

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

interface UploadedMedia {
  url: string;
  mediaType: "image";
  tags: string[];
  category: string;
}

async function main() {
  if (!fs.existsSync(MEDIA_DIR)) {
    console.error(
      `Media directory not found: ${MEDIA_DIR}\n` +
        "Create it and add category subfolders with images."
    );
    process.exit(1);
  }

  const categories = fs
    .readdirSync(MEDIA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (categories.length === 0) {
    console.error("No category subdirectories found in", MEDIA_DIR);
    process.exit(1);
  }

  const results: UploadedMedia[] = [];

  for (const category of categories) {
    const categoryDir = path.join(MEDIA_DIR, category);
    const files = fs
      .readdirSync(categoryDir)
      .filter((f) => ALLOWED_EXTENSIONS.has(path.extname(f).toLowerCase()));

    console.log(`Uploading ${files.length} files from ${category}/...`);

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      const fileBuffer = fs.readFileSync(filePath);
      const storagePath = `bot-pool/${category}/${file}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          upsert: true,
          contentType: `image/${path.extname(file).slice(1)}`,
          cacheControl: "31536000",
        });

      if (error) {
        console.error(`  Failed: ${storagePath} - ${error.message}`);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

      results.push({
        url: publicUrl,
        mediaType: "image",
        tags: CATEGORY_TAG_MAP[category] || [],
        category,
      });

      console.log(`  Uploaded: ${storagePath}`);
    }
  }

  console.log(`\n--- Uploaded ${results.length} images ---\n`);
  console.log("Paste the following into src/lib/bots/media-pool.ts:\n");
  console.log("export const MEDIA_POOL: MediaItem[] = [");
  for (const item of results) {
    console.log("  {");
    console.log(`    url: "${item.url}",`);
    console.log(`    mediaType: "${item.mediaType}",`);
    console.log(`    tags: ${JSON.stringify(item.tags)},`);
    console.log(`    category: "${item.category}",`);
    console.log("  },");
  }
  console.log("];");
}

main().catch(console.error);
