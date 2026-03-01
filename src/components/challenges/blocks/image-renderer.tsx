"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { BlockRendererProps } from "@/lib/blocks/types";
import type { ImageSettings } from "@/lib/blocks/types";

export function ImageBlockRenderer({ block }: BlockRendererProps) {
  const [enlarged, setEnlarged] = useState(false);

  if (!block.content) return null;

  const settings = block.settings as unknown as Partial<ImageSettings>;
  const caption = settings?.caption;
  const alignment = settings?.alignment ?? "full";
  const allowEnlarge = settings?.allowEnlarge ?? false;

  const alignmentClasses: Record<string, string> = {
    full: "w-full",
    left: "float-left w-1/2 mr-4",
    right: "float-right w-1/2 ml-4",
  };

  const imgElement = (
    <figure className={cn(alignmentClasses[alignment])}>
      <Image
        src={block.content}
        alt={caption || ""}
        width={800}
        height={600}
        className={cn(
          "rounded-lg object-cover w-full h-auto",
          allowEnlarge && "cursor-pointer"
        )}
        onClick={allowEnlarge ? () => setEnlarged(true) : undefined}
      />
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );

  if (!allowEnlarge) return imgElement;

  return (
    <>
      {imgElement}
      <Dialog open={enlarged} onOpenChange={setEnlarged}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          <VisuallyHidden>
            <DialogTitle>{caption || "Image"}</DialogTitle>
          </VisuallyHidden>
          <Image
            src={block.content}
            alt={caption || ""}
            width={1920}
            height={1080}
            className="w-full h-auto max-h-[85vh] object-contain rounded"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
