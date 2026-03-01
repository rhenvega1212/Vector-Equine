import type { BlockRendererProps } from "@/lib/blocks/types";

export function DividerBlockRenderer(_props: BlockRendererProps) {
  return <hr className="border-slate-700 my-6" />;
}
