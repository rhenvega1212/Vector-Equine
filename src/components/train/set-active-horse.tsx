"use client";

import { useEffect } from "react";

/** When viewing a horse profile, quietly set them as the active home horse. */
export function SetActiveHorse({ horseId }: { horseId: string }) {
  useEffect(() => {
    void fetch("/api/train/active-horse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horseId }),
    }).catch(() => {});
  }, [horseId]);

  return null;
}
