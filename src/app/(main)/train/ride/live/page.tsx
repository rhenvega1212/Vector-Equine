"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VECTOR_CONFIG } from "@/lib/vector/config";
import { ArrowLeft, Headset } from "lucide-react";

export default function LiveRidePage() {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [headset, setHeadset] = useState(false);
  const [ending, setEnding] = useState(false);
  const sensors = VECTOR_CONFIG.SENSORS_CONNECTED;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  async function endRide() {
    setEnding(true);
    setRunning(false);
    try {
      const res = await fetch("/api/train/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_date: new Date().toISOString().split("T")[0],
          horse: "Unassigned",
          session_type: "lesson",
          overall_feel: 7,
          session_source: sensors ? "hybrid" : "comms",
          session_title: "Live ride",
          summary: sensors
            ? "Sensor + comms session captured."
            : "Comms session captured — summary and homework ready for your coach.",
          homework: "Bring today's focus notes to your next lesson.",
          duration_minutes: Math.max(1, Math.round(elapsed / 60) || 1),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const id = data?.id || data?.session?.id || data?.data?.id;
        if (id) {
          router.push(`/train/sessions/${id}`);
          return;
        }
      }
      router.push("/train/sessions/new");
    } catch {
      router.push("/train/sessions/new");
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/train/ride/plan" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Plan
          </Link>
        </Button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Live</p>
      </div>

      <div className="rounded-xl border border-gold/25 bg-navy p-6 text-cream">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cream/50">Status</p>
            <p className="font-medium text-gold-bright">
              {running ? "Capturing this session" : "Paused"}
            </p>
          </div>
          <p className="font-serif text-4xl tabular-nums">
            {mm}:{ss}
          </p>
        </div>
        <p className="mt-3 text-sm text-cream/70">
          {sensors
            ? "Sensors connected — aid meters active."
            : "Comms session — trainer link ready. Aid meters unlock when sensors connect."}
        </p>
      </div>

      <div className="rounded-xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm">
        Coaching cue: Soften the inside rein and keep the outside leg quiet.
      </div>

      {sensors ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {["Seat", "L rein", "R rein", "L leg", "R leg", "Weight"].map((aid) => (
            <div key={aid} className="rounded-lg border border-gold/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">{aid}</p>
              <div className="mx-auto mt-2 h-16 w-3 overflow-hidden rounded-full bg-muted">
                <div className="w-full bg-gold" style={{ height: "55%" }} />
              </div>
              <p className="mt-1 text-[10px] text-gold">sweet spot</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gold/30 p-6 text-center text-sm text-muted-foreground">
          Aid sweet-spot meters appear when sensors are connected. Your ride is still being
          captured for Debrief.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="border-gold/30"
          onClick={() => setHeadset((h) => !h)}
        >
          <Headset className="mr-2 h-4 w-4" />
          Headset view {headset ? "on" : "off"}
        </Button>
        <Button variant="outline" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Resume"}
        </Button>
        <Button
          className="bg-gold text-navy font-semibold hover:bg-gold-bright"
          onClick={endRide}
          disabled={ending}
        >
          {ending ? "Saving…" : "End ride"}
        </Button>
      </div>
    </div>
  );
}
