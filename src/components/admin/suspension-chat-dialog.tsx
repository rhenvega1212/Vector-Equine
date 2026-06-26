"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import type { SuspensionMessage } from "@/types/database";

interface SuspensionChatDialogProps {
  userId: string | null;
  userName: string;
  isSuspended: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function SuspensionChatDialog({
  userId,
  userName,
  isSuspended,
  open,
  onOpenChange,
  onChanged,
}: SuspensionChatDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SuspensionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLifting, setIsLifting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !userId) return;
    setIsLoading(true);
    fetch(`/api/admin/users/${userId}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setIsLoading(false));
  }, [open, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !userId || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setDraft("");
      } else {
        toast({
          title: "Could not send",
          description: data.error || "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleUnsuspend() {
    if (!userId || isLifting) return;
    setIsLifting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Suspension lifted",
          description: `${userName} can access the app again.`,
        });
        onChanged();
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: data.error || "Could not lift suspension.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLifting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Suspension chat — {userName}</DialogTitle>
          <DialogDescription>
            Talk through the suspension. The user sees these messages on their
            suspended screen and can reply here.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="max-h-72 min-h-[120px] overflow-y-auto rounded-lg border bg-muted/30 p-3 space-y-3"
        >
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No messages yet.
            </p>
          ) : (
            messages.map((m) => {
              const isAdmin = m.sender_role === "admin";
              return (
                <div
                  key={m.id}
                  className={cn("flex", isAdmin ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                      isAdmin
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border text-foreground"
                    )}
                  >
                    <p className="mb-0.5 text-[11px] font-semibold opacity-70">
                      {isAdmin ? "You (team)" : userName}
                    </p>
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a reply…"
          rows={2}
        />

        <DialogFooter className="gap-2 sm:justify-between">
          {isSuspended ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleUnsuspend}
              disabled={isLifting}
              className="gap-1"
            >
              {isLifting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Lift suspension
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground self-center">
              This account is active.
            </span>
          )}
          <Button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
            className="gap-1"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
