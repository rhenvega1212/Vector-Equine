import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export const BLOCK_TYPES = [
  "rich_text",
  "image",
  "video",
  "file",
  "discussion",
  "submission",
  "quiz",
  "checklist",
  "download",
  "callout",
  "divider",
  "trainer_link",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export interface BlockData {
  id: string;
  lesson_id: string;
  block_type: BlockType;
  content: string | null;
  file_name: string | null;
  settings: Record<string, any>;
  is_required: boolean;
  is_hidden: boolean;
  estimated_time: number | null;
  sort_order: number;
  created_at: string;
}

export interface BlockEditorProps {
  block: BlockData;
  onUpdate: (updates: Partial<BlockData>) => void;
}

export interface BlockRendererProps {
  block: BlockData;
  currentUserId?: string;
  challengeId: string;
  isCompleted?: boolean;
  onComplete?: () => void;
}

export interface BlockSettingsPanelProps {
  block: BlockData;
  onUpdate: (updates: Partial<BlockData>) => void;
}

export interface BlockRegistryEntry {
  type: BlockType;
  label: string;
  icon: LucideIcon;
  category: "content" | "media" | "interactive" | "layout";
  defaultSettings: Record<string, unknown>;
  EditorComponent: ComponentType<BlockEditorProps>;
  RendererComponent: ComponentType<BlockRendererProps>;
  SettingsPanel?: ComponentType<BlockSettingsPanelProps>;
}

// ---------- Per-block settings types ----------

export interface RichTextSettings {
  /* no extra settings; content stored in block.content as HTML */
}

export interface ImageSettings {
  caption?: string;
  alignment: "full" | "left" | "right";
  allowEnlarge: boolean;
}

export interface VideoSettings {
  title?: string;
  description?: string;
  trackCompletion: boolean;
}

export interface FileSettings {
  label?: string;
  description?: string;
}

export interface DiscussionSettings {
  prompt?: string;
  sortDefault: "newest" | "top";
  minParticipation: number;
}

export interface SubmissionSettings {
  submissionType: "video" | "image" | "text" | "mixed";
  instructions?: string;
  rubric?: string;
  maxFiles: number;
  allowResubmission: boolean;
  aiFeedbackEnabled: boolean;
  trainerOptions: {
    trainerId: string;
    priceAmount: number;
    turnaroundDays: number;
  }[];
}

export interface QuizSettings {
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
  passingPercent: number;
}

export interface ChecklistSettings {
  items: {
    label: string;
    required: boolean;
  }[];
}

export interface DownloadSettings {
  label?: string;
  description?: string;
}

export interface CalloutSettings {
  calloutType: "tip" | "warning" | "info" | "key_point";
}

export interface DividerSettings {
  /* no settings */
}

export interface TrainerLinkSettings {
  trainers: {
    trainerId: string;
    ctaText?: string;
  }[];
}
