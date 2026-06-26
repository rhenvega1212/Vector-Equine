"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, LogOut, Send } from "lucide-react";
import type { SuspensionMessage } from "@/types/database";

export function SuspensionAppeal({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SuspensionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    try {
      const res = await fetch("/api/account/suspension/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/account/suspension/messages", {
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
    } catch {
      toast({
        title: "Could not send",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/50 p-3 space-y-3"
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
            const mine = m.sender_id === currentUserId && m.sender_role === "user";
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    mine
                      ? "bg-gold text-navy"
                      : "bg-card border border-border text-foreground"
                  )}
                >
                  {m.sender_role === "admin" && (
                    <p className="mb-0.5 text-[11px] font-semibold text-gold">
                      Vector Equine team
                    </p>
                  )}
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
        placeholder="Write a message to our team…"
        rows={3}
        className="bg-background/50"
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="gap-1 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
        <Button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || isSending}
          className="gap-1 bg-gold text-navy font-semibold hover:bg-gold/90"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
}
