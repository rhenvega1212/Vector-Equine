import type { BlockRendererProps } from "@/lib/blocks/types";

export function RichTextBlockRenderer({ block }: BlockRendererProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-cyan-400 prose-strong:text-white prose-code:text-cyan-300">
      <div dangerouslySetInnerHTML={{ __html: block.content || "" }} />
    </div>
  );
}
