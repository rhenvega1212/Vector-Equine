"use client";

import { OutwardShareButton } from "@/components/train/outward-share-button";

export function DebriefShareActions({
  score,
  decodedLine,
  horseName,
  riderFirstName,
}: {
  score: number;
  decodedLine: string;
  horseName: string;
  riderFirstName: string;
}) {
  return (
    <OutwardShareButton
      score={score}
      decodedLine={decodedLine}
      horseName={horseName}
      riderFirstName={riderFirstName}
    />
  );
}
