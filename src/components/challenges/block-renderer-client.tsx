"use client";

import { useRouter } from "next/navigation";
import { BlockRenderer } from "./block-renderer";
import type { BlockData } from "@/lib/blocks/types";

interface BlockRendererClientProps {
  blocks: BlockData[];
  currentUserId?: string;
  challengeId: string;
  completedBlockIds: string[];
}

export function BlockRendererClient({
  blocks,
  currentUserId,
  challengeId,
  completedBlockIds,
}: BlockRendererClientProps) {
  const router = useRouter();

  return (
    <BlockRenderer
      blocks={blocks}
      currentUserId={currentUserId}
      challengeId={challengeId}
      completedBlockIds={completedBlockIds}
      onBlockComplete={() => {
        router.refresh();
      }}
    />
  );
}
