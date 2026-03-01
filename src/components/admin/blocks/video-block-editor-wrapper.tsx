"use client";

import { VideoBlockEditor } from "@/components/admin/video-block-editor";
import type { BlockEditorProps } from "@/lib/blocks/types";

export function VideoBlockEditorWrapper({ block, onUpdate }: BlockEditorProps) {
  return (
    <VideoBlockEditor
      blockId={block.id}
      challengeId=""
      initialUrl={block.content || ""}
      onSave={(url: string) => onUpdate({ content: url })}
    />
  );
}
