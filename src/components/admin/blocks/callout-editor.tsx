"use client";

import { Lightbulb, AlertTriangle, Info, Star } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { BlockEditorProps, CalloutSettings } from "@/lib/blocks/types";

const CALLOUT_OPTIONS: {
  value: CalloutSettings["calloutType"];
  label: string;
  icon: typeof Lightbulb;
  border: string;
  bg: string;
}[] = [
  { value: "tip", label: "Tip", icon: Lightbulb, border: "border-green-500", bg: "bg-green-500/10" },
  { value: "warning", label: "Warning", icon: AlertTriangle, border: "border-amber-500", bg: "bg-amber-500/10" },
  { value: "info", label: "Info", icon: Info, border: "border-blue-500", bg: "bg-blue-500/10" },
  { value: "key_point", label: "Key Point", icon: Star, border: "border-purple-500", bg: "bg-purple-500/10" },
];

export function CalloutBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const settings = block.settings as CalloutSettings;
  const calloutType = settings.calloutType ?? "info";
  const active = CALLOUT_OPTIONS.find((o) => o.value === calloutType) ?? CALLOUT_OPTIONS[2];
  const Icon = active.icon;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-slate-300">Callout Type</Label>
        <div className="grid grid-cols-4 gap-2">
          {CALLOUT_OPTIONS.map((opt) => {
            const O = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onUpdate({ settings: { ...settings, calloutType: opt.value } })
                }
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors ${
                  calloutType === opt.value
                    ? `${opt.border} ${opt.bg} text-white`
                    : "border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                <O size={18} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300">Content</Label>
        <textarea
          value={block.content ?? ""}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Callout text…"
          rows={3}
          className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      {/* Live preview */}
      <div>
        <Label className="text-slate-300">Preview</Label>
        <div
          className={`mt-1.5 flex items-start gap-3 rounded-lg border-l-4 p-4 ${active.border} ${active.bg}`}
        >
          <Icon size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm text-slate-200 whitespace-pre-wrap">
            {block.content || "Callout text will appear here…"}
          </p>
        </div>
      </div>
    </div>
  );
}
