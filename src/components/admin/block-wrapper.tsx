"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Settings,
  Trash2,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBlockMeta } from "@/lib/blocks/registry";
import type { BlockData } from "@/lib/blocks/types";

interface BlockWrapperProps {
  id: string;
  block: BlockData;
  onDelete: () => void;
  onSettingsClick: () => void;
  onUpdate: (updates: Partial<BlockData>) => void;
  children: React.ReactNode;
}

export function BlockWrapper({
  id,
  block,
  onDelete,
  onSettingsClick,
  onUpdate,
  children,
}: BlockWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = getBlockMeta(block.block_type);
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/block rounded-lg border bg-card transition-shadow ${
        isDragging
          ? "z-50 shadow-lg ring-2 ring-cyan-500/30"
          : "hover:shadow-sm"
      }`}
    >
      {/* Top bar */}
      <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Icon className="h-4 w-4 text-cyan-500" />
        <span className="text-xs font-medium">{meta.label}</span>

        {block.is_required && (
          <Badge
            variant="secondary"
            className="ml-1 h-5 px-1.5 text-[10px] font-medium"
          >
            Required
          </Badge>
        )}

        {block.is_hidden && (
          <Badge
            variant="outline"
            className="ml-1 h-5 px-1.5 text-[10px] font-medium text-muted-foreground"
          >
            Hidden
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onUpdate({ is_hidden: !block.is_hidden })}
            title={block.is_hidden ? "Show block" : "Hide block"}
          >
            {block.is_hidden ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onSettingsClick}
            title="Block settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Delete block"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Block editor content */}
      <div className="p-3">{children}</div>

      {/* Bottom bar – estimated time */}
      {block.estimated_time != null && block.estimated_time > 0 && (
        <div className="flex items-center gap-1 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>~{block.estimated_time} min</span>
        </div>
      )}
    </div>
  );
}
