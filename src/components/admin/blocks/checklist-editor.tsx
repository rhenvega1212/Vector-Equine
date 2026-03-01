"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { BlockEditorProps, ChecklistSettings } from "@/lib/blocks/types";

export function ChecklistBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const settings = block.settings as ChecklistSettings;
  const items = settings.items ?? [];

  function update(next: ChecklistSettings["items"]) {
    onUpdate({ settings: { ...settings, items: next } });
  }

  function setItem(index: number, patch: Partial<ChecklistSettings["items"][number]>) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update(next);
  }

  function removeItem(index: number) {
    update(items.filter((_, i) => i !== index));
  }

  function addItem() {
    update([...items, { label: "", required: false }]);
  }

  return (
    <div className="space-y-3">
      <Label className="text-slate-300">Checklist Items</Label>

      {items.length === 0 && (
        <p className="text-sm text-slate-500">No items yet. Add one below.</p>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2"
          >
            <Input
              value={item.label}
              onChange={(e) => setItem(idx, { label: e.target.value })}
              placeholder={`Item ${idx + 1}`}
              className="flex-1 border-0 bg-transparent text-sm text-white placeholder:text-slate-500 focus-visible:ring-0"
            />

            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-slate-400">Required</Label>
              <Switch
                checked={item.required}
                onCheckedChange={(v) => setItem(idx, { required: !!v })}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-400"
              onClick={() => removeItem(idx)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="border-dashed border-white/20 text-slate-300 hover:border-cyan-400 hover:text-cyan-400"
        onClick={addItem}
      >
        <Plus size={14} className="mr-1" /> Add Item
      </Button>
    </div>
  );
}
