"use client";

import type { BlockEditorProps } from "@/lib/blocks/types";

export function DividerBlockEditor(_props: BlockEditorProps) {
  return (
    <div className="py-2">
      <p className="mb-2 text-xs text-slate-500">Divider &mdash; no editable content</p>
      <hr className="border-slate-700" />
    </div>
  );
}
