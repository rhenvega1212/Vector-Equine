"use client";

import { MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { BlockEditorProps, DiscussionSettings } from "@/lib/blocks/types";

export function DiscussionBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const settings = block.settings as DiscussionSettings;
  const prompt = settings.prompt ?? "";
  const sortDefault = settings.sortDefault ?? "newest";
  const minParticipation = settings.minParticipation ?? 1;

  function update(patch: Partial<DiscussionSettings>) {
    onUpdate({
      settings: { ...settings, ...patch },
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-slate-300">Discussion Prompt</Label>
        <textarea
          value={prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="Ask a question or provide a topic for discussion..."
          rows={3}
          className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-300">Default Sort</Label>
          <select
            value={sortDefault}
            onChange={(e) =>
              update({ sortDefault: e.target.value as "newest" | "top" })
            }
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="top">Most Liked</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-300">Min. Posts Required</Label>
          <input
            type="number"
            min={0}
            max={50}
            value={minParticipation}
            onChange={(e) =>
              update({ minParticipation: Math.max(0, Number(e.target.value)) })
            }
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
          />
          <p className="text-xs text-slate-500">
            Set to 0 for no participation requirement
          </p>
        </div>
      </div>

      {/* Preview */}
      <div>
        <Label className="text-slate-300">Preview</Label>
        <div className="mt-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
              <MessageSquare size={16} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {prompt || "Discussion prompt will appear here..."}
              </p>
              {minParticipation > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {minParticipation} post{minParticipation !== 1 ? "s" : ""}{" "}
                  required to complete
                </p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-500">
            Student replies will appear here
          </div>
        </div>
      </div>
    </div>
  );
}
