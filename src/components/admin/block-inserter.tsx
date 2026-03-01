"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getBlocksByCategory,
  getDefaultSettings,
} from "@/lib/blocks/registry";
import type { BlockType } from "@/lib/blocks/types";

interface BlockInserterProps {
  lessonId: string;
  insertAtOrder: number;
  onBlockAdded: () => void;
}

const categories = [
  { key: "content" as const, label: "Content" },
  { key: "media" as const, label: "Media" },
  { key: "interactive" as const, label: "Interactive" },
  { key: "layout" as const, label: "Layout" },
];

export function BlockInserter({
  lessonId,
  insertAtOrder,
  onBlockAdded,
}: BlockInserterProps) {
  const [open, setOpen] = useState(false);
  const [inserting, setInserting] = useState(false);

  async function handleSelect(blockType: BlockType) {
    if (inserting) return;
    setInserting(true);
    try {
      const res = await fetch("/api/admin/content-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          block_type: blockType,
          sort_order: insertAtOrder,
          settings: getDefaultSettings(blockType),
        }),
      });
      if (!res.ok) throw new Error("Failed to create block");
      setOpen(false);
      onBlockAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setInserting(false);
    }
  }

  return (
    <div className="group relative flex items-center justify-center py-1">
      <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-border opacity-0 transition-opacity group-hover:opacity-100" />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative z-10 h-6 w-6 rounded-full border-dashed border-cyan-500/40 bg-background text-cyan-500 opacity-0 transition-opacity hover:border-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-600 group-hover:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="center"
          className="w-64 p-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-2">
            {categories.map(({ key, label }) => {
              const blocks = getBlocksByCategory(key);
              if (blocks.length === 0) return null;
              return (
                <div key={key}>
                  <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  {blocks.map((block) => {
                    const Icon = block.icon;
                    return (
                      <button
                        key={block.type}
                        disabled={inserting}
                        onClick={() => handleSelect(block.type)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-cyan-500/10 hover:text-cyan-600 disabled:opacity-50"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{block.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
