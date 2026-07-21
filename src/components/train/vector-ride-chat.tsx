"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

const SUGGESTIONS = [
  "What should I practice next?",
  "What did my trainer emphasize?",
  "Summarize the main corrections",
];

export function VectorRideChat({
  sessionId,
  trainerName,
}: {
  sessionId: string;
  trainerName: string | null;
}) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/train/sessions/${sessionId}/chat`,
      }),
    [sessionId]
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  async function ask(text: string) {
    if (busy) return;
    await sendMessage({ text });
  }

  return (
    <section className="space-y-3 rounded-xl border border-gold/20 bg-[#131C31] p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Ask Vector
        </p>
        <p className="mt-1 text-sm text-cream/50">
          Questions about this lesson
          {trainerName ? ` with ${trainerName}` : ""}. Vector answers from the
          brief and timeline — or says when it doesn&apos;t know.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void ask(s)}
            className="rounded-full border border-gold/25 px-3 py-1 text-xs text-cream/70 hover:border-gold/50 hover:text-cream disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-gold/10 bg-navy/40 p-3">
        {messages.length === 0 && (
          <p className="text-sm text-cream/40">
            Try a suggestion, or ask something specific from the ride.
          </p>
        )}
        {messages.map((m) => {
          const text = m.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") || "";
          const mine = m.role === "user";
          return (
            <div
              key={m.id}
              className={
                mine
                  ? "ml-6 rounded-lg bg-gold/15 px-3 py-2 text-sm text-cream"
                  : "mr-6 rounded-lg border border-gold/15 px-3 py-2 text-sm text-cream/90"
              }
            >
              <p className="mb-1 text-[10px] uppercase tracking-wider text-cream/40">
                {mine ? "You" : "Vector"}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
            </div>
          );
        })}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-cream/45">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vector is thinking…
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error.message || "Could not reach Vector. Check Claude API key."}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this ride…"
          className="flex-1 rounded-lg border border-gold/20 bg-navy px-3 py-2 text-sm text-cream placeholder:text-cream/35"
          disabled={busy}
        />
        <Button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-gold text-navy font-semibold hover:bg-gold-bright"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </section>
  );
}
