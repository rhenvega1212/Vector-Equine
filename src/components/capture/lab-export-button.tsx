"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LabExportButton({ captureId }: { captureId: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/capture/sessions/${captureId}/export`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capture-${captureId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      className="bg-gold text-navy font-semibold hover:bg-gold-bright"
      onClick={download}
      disabled={busy}
    >
      {busy ? "Exporting…" : "Export JSON"}
    </Button>
  );
}
