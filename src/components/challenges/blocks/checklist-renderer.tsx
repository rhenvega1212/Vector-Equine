"use client";

import { useState, useEffect } from "react";
import type { BlockRendererProps, ChecklistSettings } from "@/lib/blocks/types";

export function ChecklistBlockRenderer({ block, onComplete }: BlockRendererProps) {
  const settings = block.settings as ChecklistSettings;
  const items = settings.items ?? [];
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));

  useEffect(() => {
    if (!onComplete || items.length === 0) return;
    const allRequiredDone = items.every(
      (item, i) => !item.required || checked[i],
    );
    if (allRequiredDone) onComplete();
  }, [checked, items, onComplete]);

  function toggle(index: number) {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <label
          key={idx}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20"
        >
          <input
            type="checkbox"
            checked={checked[idx] ?? false}
            onChange={() => toggle(idx)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-400 focus:ring-cyan-400/50"
          />
          <span className="text-sm text-slate-200">
            {item.label}
            {item.required && <span className="ml-1 text-red-400">*</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
