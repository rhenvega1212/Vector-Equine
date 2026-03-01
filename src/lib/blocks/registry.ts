import {
  FileText,
  ImageIcon,
  Video,
  File,
  MessageSquare,
  ClipboardCheck,
  HelpCircle,
  CheckSquare,
  Download,
  AlertCircle,
  Minus,
  UserCheck,
} from "lucide-react";
import type { BlockType, BlockRegistryEntry } from "./types";
import { settingsSchemaMap } from "./settings-schemas";

type RegistryMeta = Omit<
  BlockRegistryEntry,
  "EditorComponent" | "RendererComponent" | "SettingsPanel"
>;

const meta: Record<BlockType, RegistryMeta> = {
  rich_text: {
    type: "rich_text",
    label: "Rich Text",
    icon: FileText,
    category: "content",
    defaultSettings: settingsSchemaMap.rich_text.parse({}),
  },
  image: {
    type: "image",
    label: "Image",
    icon: ImageIcon,
    category: "media",
    defaultSettings: settingsSchemaMap.image.parse({}),
  },
  video: {
    type: "video",
    label: "Video",
    icon: Video,
    category: "media",
    defaultSettings: settingsSchemaMap.video.parse({}),
  },
  file: {
    type: "file",
    label: "File",
    icon: File,
    category: "media",
    defaultSettings: settingsSchemaMap.file.parse({}),
  },
  discussion: {
    type: "discussion",
    label: "Discussion",
    icon: MessageSquare,
    category: "interactive",
    defaultSettings: settingsSchemaMap.discussion.parse({}),
  },
  submission: {
    type: "submission",
    label: "Submission",
    icon: ClipboardCheck,
    category: "interactive",
    defaultSettings: settingsSchemaMap.submission.parse({}),
  },
  quiz: {
    type: "quiz",
    label: "Quiz",
    icon: HelpCircle,
    category: "interactive",
    defaultSettings: settingsSchemaMap.quiz.parse({}),
  },
  checklist: {
    type: "checklist",
    label: "Checklist",
    icon: CheckSquare,
    category: "interactive",
    defaultSettings: settingsSchemaMap.checklist.parse({}),
  },
  download: {
    type: "download",
    label: "Download",
    icon: Download,
    category: "media",
    defaultSettings: settingsSchemaMap.download.parse({}),
  },
  callout: {
    type: "callout",
    label: "Callout",
    icon: AlertCircle,
    category: "content",
    defaultSettings: settingsSchemaMap.callout.parse({}),
  },
  divider: {
    type: "divider",
    label: "Divider",
    icon: Minus,
    category: "layout",
    defaultSettings: settingsSchemaMap.divider.parse({}),
  },
  trainer_link: {
    type: "trainer_link",
    label: "Trainer Link",
    icon: UserCheck,
    category: "interactive",
    defaultSettings: settingsSchemaMap.trainer_link.parse({}),
  },
};

export function getBlockMeta(type: BlockType): RegistryMeta {
  return meta[type];
}

export function getAllBlockMeta(): RegistryMeta[] {
  return Object.values(meta);
}

export function getBlocksByCategory(category: RegistryMeta["category"]) {
  return Object.values(meta).filter((m) => m.category === category);
}

export function getDefaultSettings(type: BlockType): Record<string, unknown> {
  return { ...meta[type].defaultSettings };
}
