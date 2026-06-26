import type { BlockRendererProps } from "@/lib/blocks/types";

export function RichTextBlockRenderer({ block }: BlockRendererProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-gold prose-strong:text-white prose-code:text-gold-bright">
      <div dangerouslySetInnerHTML={{ __html: block.content || "" }} />
    </div>
  );
}
