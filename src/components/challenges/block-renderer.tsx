"use client";

import { useState, useCallback, type ComponentType } from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BlockData, BlockRendererProps, BlockType } from "@/lib/blocks/types";

import { RichTextBlockRenderer } from "./blocks/rich-text-renderer";
import { ImageBlockRenderer } from "./blocks/image-renderer";
import { VideoBlockRenderer } from "./blocks/video-renderer";
import { DownloadBlockRenderer } from "./blocks/download-renderer";
import { CalloutBlockRenderer } from "./blocks/callout-renderer";
import { DividerBlockRenderer } from "./blocks/divider-renderer";
import { ChecklistBlockRenderer } from "./blocks/checklist-renderer";
import { QuizBlockRenderer } from "./blocks/quiz-renderer";
import { DiscussionBlockRenderer } from "./blocks/discussion-renderer";
import { SubmissionBlockRenderer } from "./blocks/submission-renderer";
import { TrainerLinkBlockRenderer } from "./blocks/trainer-link-renderer";

const RENDERER_MAP: Record<BlockType, ComponentType<BlockRendererProps>> = {
  rich_text: RichTextBlockRenderer,
  image: ImageBlockRenderer,
  video: VideoBlockRenderer,
  file: DownloadBlockRenderer,
  download: DownloadBlockRenderer,
  callout: CalloutBlockRenderer,
  divider: DividerBlockRenderer,
  checklist: ChecklistBlockRenderer,
  quiz: QuizBlockRenderer,
  discussion: DiscussionBlockRenderer,
  submission: SubmissionBlockRenderer,
  trainer_link: TrainerLinkBlockRenderer,
};

interface BlockRendererComponentProps {
  blocks: BlockData[];
  currentUserId?: string;
  challengeId: string;
  completedBlockIds: string[];
  onBlockComplete?: (blockId: string) => void;
}

export function BlockRenderer({
  blocks,
  currentUserId,
  challengeId,
  completedBlockIds,
  onBlockComplete,
}: BlockRendererComponentProps) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  const visibleBlocks = blocks
    .filter((b) => !b.is_hidden)
    .sort((a, b) => a.sort_order - b.sort_order);

  const handleComplete = useCallback(
    async (blockId: string) => {
      if (completingIds.has(blockId) || completedBlockIds.includes(blockId)) return;

      setCompletingIds((prev) => new Set(prev).add(blockId));
      try {
        const res = await fetch(`/api/challenges/blocks/${blockId}/complete`, {
          method: "POST",
        });
        if (res.ok) {
          onBlockComplete?.(blockId);
        }
      } finally {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(blockId);
          return next;
        });
      }
    },
    [completingIds, completedBlockIds, onBlockComplete]
  );

  return (
    <div className="space-y-6">
      {visibleBlocks.map((block) => {
        const Renderer = RENDERER_MAP[block.block_type];
        if (!Renderer) return null;

        const isCompleted = completedBlockIds.includes(block.id);

        return (
          <div key={block.id} className="relative">
            {block.is_required && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => !isCompleted && handleComplete(block.id)}
                  disabled={isCompleted || completingIds.has(block.id)}
                  className="flex items-center gap-1.5 text-xs transition-colors disabled:cursor-default"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground hover:text-cyan-400" />
                  )}
                  <span className={isCompleted ? "text-emerald-400" : "text-muted-foreground"}>
                    Required
                  </span>
                </button>
                {block.estimated_time != null && block.estimated_time > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 py-0">
                    <Clock className="h-3 w-3" />
                    {block.estimated_time} min
                  </Badge>
                )}
              </div>
            )}

            {!block.is_required && block.estimated_time != null && block.estimated_time > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs gap-1 py-0">
                  <Clock className="h-3 w-3" />
                  {block.estimated_time} min
                </Badge>
              </div>
            )}

            <Renderer
              block={block}
              currentUserId={currentUserId}
              challengeId={challengeId}
              isCompleted={isCompleted}
              onComplete={() => handleComplete(block.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
