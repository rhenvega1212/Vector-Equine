"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface SessionDeleteButtonProps {
  sessionId: string;
  sessionDate: string;
}

export function SessionDeleteButton({ sessionId, sessionDate }: SessionDeleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete this session (${format(parseISO(sessionDate), "MMM d, yyyy")})? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/train/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Session deleted" });
      router.push("/train/sessions");
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Could not delete session", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="text-destructive border-destructive/50" onClick={handleDelete} disabled={loading}>
      <Trash2 className="h-4 w-4 mr-2" />
      Delete
    </Button>
  );
}
