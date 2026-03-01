"use client";

import { useState, useRef, useCallback } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BlockWrapper } from "./block-wrapper";
import { BlockInserter } from "./block-inserter";
import type { BlockData, BlockEditorProps, BlockType } from "@/lib/blocks/types";

interface LessonBlockEditorProps {
  lessonId: string;
  onBlockSettingsClick?: (block: BlockData) => void;
}

function PlaceholderEditor({ block }: BlockEditorProps) {
  return (
    <div className="p-4 text-center text-slate-400">
      {block.block_type} editor coming soon...
    </div>
  );
}

const blockEditorMap: Record<string, React.ComponentType<BlockEditorProps>> = {};

function getBlockEditor(blockType: BlockType): React.ComponentType<BlockEditorProps> {
  return blockEditorMap[blockType] ?? PlaceholderEditor;
}

export function LessonBlockEditor({
  lessonId,
  onBlockSettingsClick,
}: LessonBlockEditorProps) {
  const queryClient = useQueryClient();
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const [lessonTitle, setLessonTitle] = useState<string | null>(null);

  const {
    data: lesson,
    isLoading: lessonLoading,
  } = useQuery<{ id: string; title: string }>({
    queryKey: ["admin-lesson", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/lessons/${lessonId}`);
      if (!res.ok) throw new Error("Failed to fetch lesson");
      return res.json();
    },
  });

  const {
    data: blocks = [],
    isLoading: blocksLoading,
  } = useQuery<BlockData[]>({
    queryKey: ["admin-lesson-blocks", lessonId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/content-blocks?lesson_id=${lessonId}`
      );
      if (!res.ok) throw new Error("Failed to fetch blocks");
      return res.json();
    },
  });

  const sortedBlocks = [...blocks].sort((a, b) => a.sort_order - b.sort_order);
  const displayTitle = lessonTitle ?? lesson?.title ?? "";

  // --- Debounced PATCH helper ---

  const debouncedPatch = useCallback(
    (url: string, body: Record<string, unknown>, key: string) => {
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(async () => {
        try {
          await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch {
          /* silent */
        }
      }, 500);
    },
    []
  );

  // --- Lesson title ---

  function handleTitleChange(value: string) {
    setLessonTitle(value);
    debouncedPatch(
      `/api/admin/lessons/${lessonId}`,
      { title: value },
      `lesson-title-${lessonId}`
    );
  }

  // --- Block CRUD ---

  const updateBlockMutation = useMutation({
    mutationFn: async ({
      blockId,
      updates,
    }: {
      blockId: string;
      updates: Partial<BlockData>;
    }) => {
      const res = await fetch(`/api/admin/content-blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update block");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-lesson-blocks", lessonId],
      });
    },
  });

  function handleBlockUpdate(blockId: string, updates: Partial<BlockData>) {
    if (debounceTimers.current[`block-${blockId}`]) {
      clearTimeout(debounceTimers.current[`block-${blockId}`]);
    }
    debounceTimers.current[`block-${blockId}`] = setTimeout(() => {
      updateBlockMutation.mutate({ blockId, updates });
    }, 500);
  }

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const res = await fetch(`/api/admin/content-blocks/${blockId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete block");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-lesson-blocks", lessonId],
      });
    },
  });

  function handleBlockDelete(blockId: string) {
    if (!confirm("Delete this block?")) return;
    deleteBlockMutation.mutate(blockId);
  }

  // --- Reorder ---

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch("/api/admin/content-blocks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, ordered_ids: orderedIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder blocks");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-lesson-blocks", lessonId],
      });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedBlocks.findIndex((b) => b.id === active.id);
    const newIndex = sortedBlocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedBlocks, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map((b) => b.id));
  }

  function handleBlockAdded() {
    queryClient.invalidateQueries({
      queryKey: ["admin-lesson-blocks", lessonId],
    });
  }

  // --- Render ---

  if (lessonLoading || blocksLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-2 p-6">
      {/* Lesson title */}
      <Input
        value={displayTitle}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Lesson title"
        className="border-none bg-transparent text-2xl font-semibold shadow-none focus-visible:ring-0"
      />

      {/* Top inserter */}
      <BlockInserter
        lessonId={lessonId}
        insertAtOrder={0}
        onBlockAdded={handleBlockAdded}
      />

      {/* Block list */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sortedBlocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedBlocks.map((block, index) => {
            const EditorComponent = getBlockEditor(block.block_type);
            return (
              <div key={block.id}>
                <BlockWrapper
                  id={block.id}
                  block={block}
                  onDelete={() => handleBlockDelete(block.id)}
                  onSettingsClick={() => onBlockSettingsClick?.(block)}
                  onUpdate={(updates) => handleBlockUpdate(block.id, updates)}
                >
                  <EditorComponent
                    block={block}
                    onUpdate={(updates) => handleBlockUpdate(block.id, updates)}
                  />
                </BlockWrapper>

                <BlockInserter
                  lessonId={lessonId}
                  insertAtOrder={block.sort_order + 1}
                  onBlockAdded={handleBlockAdded}
                />
              </div>
            );
          })}
        </SortableContext>
      </DndContext>

      {sortedBlocks.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">
            No blocks yet. Use the inserter above to add content.
          </p>
        </div>
      )}
    </div>
  );
}
