import { Lightbulb, AlertTriangle, Info, Star } from "lucide-react";
import type { BlockRendererProps, CalloutSettings } from "@/lib/blocks/types";

const CONFIG: Record<
  CalloutSettings["calloutType"],
  { icon: typeof Lightbulb; border: string; bg: string }
> = {
  tip: { icon: Lightbulb, border: "border-green-500", bg: "bg-green-500/10" },
  warning: { icon: AlertTriangle, border: "border-amber-500", bg: "bg-amber-500/10" },
  info: { icon: Info, border: "border-blue-500", bg: "bg-blue-500/10" },
  key_point: { icon: Star, border: "border-purple-500", bg: "bg-purple-500/10" },
};

export function CalloutBlockRenderer({ block }: BlockRendererProps) {
  const calloutType = (block.settings as CalloutSettings).calloutType ?? "info";
  const { icon: Icon, border, bg } = CONFIG[calloutType];

  return (
    <div className={`flex items-start gap-3 rounded-lg border-l-4 p-4 ${border} ${bg}`}>
      <Icon size={20} className="mt-0.5 shrink-0" />
      <p className="text-sm text-slate-200 whitespace-pre-wrap">{block.content}</p>
    </div>
  );
}
