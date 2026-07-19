import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import { DEMO_SESSIONS } from "@/lib/annotation/demo";

export const metadata = {
  title: "Annotation Engine · Vector Equine",
};

export default function AnnotateIndexPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-gold">
            <Activity className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Internal tool
            </span>
          </div>
          <h1 className="text-2xl font-bold">Annotation Engine</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Play a session video alongside its synchronized sensor data and label
            what is happening — moment by moment, down to the individual signal.
            Annotations become the labeled training data for the discipline model.
          </p>
        </div>

        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Sessions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_SESSIONS.map((s) => (
            <Link
              key={s.id}
              href={`/annotate/${s.id}`}
              className="group flex items-center justify-between rounded-xl border border-white/10 bg-navy p-4 transition-colors hover:border-gold/40"
            >
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                  {s.discipline} · {(s.durationMs ?? 0) / 1000}s ·{" "}
                  {s.sampleRateHz ?? 100}Hz · WIX-IMU rig
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Sessions are mock WIX-IMU rigs conforming to the sensor data contract.
          Real hardware adapts to the same shape behind the sync boundary — the
          engine can’t tell the difference.
        </p>
      </div>
    </div>
  );
}
