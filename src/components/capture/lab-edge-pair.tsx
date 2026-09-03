"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DeviceRow = {
  id: string;
  label: string;
  device_key: string;
  last_seen_at: string | null;
  created_at: string;
};

export function LabEdgePair() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshSecret, setFreshSecret] = useState<{
    key: string;
    secret: string;
    auth: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/edge/devices/pair");
    const data = await res.json().catch(() => ({}));
    setDevices(data.devices || []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function pair() {
    setBusy(true);
    setError(null);
    setFreshSecret(null);
    try {
      const res = await fetch("/api/edge/devices/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Barn Jetson" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Pair failed — apply edge_devices migration?"
        );
        return;
      }
      setFreshSecret({
        key: data.device?.device_key,
        secret: data.device_secret,
        auth: data.auth_header_example,
      });
      await refresh();
    } catch {
      setError("Pair failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-gold/15 bg-[#131C31] p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
        Jetson edge
      </p>
      <p className="text-sm text-cream/70">
        Pair a device so it can attach to the open lesson and share{" "}
        <code className="text-gold/80">t0</code>. See{" "}
        <code className="text-gold/80">docs/02-architecture/edge-sync.md</code>.
      </p>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => void pair()}
        className="bg-gold text-navy hover:bg-gold-bright"
      >
        {busy ? "Pairing…" : "Pair Jetson"}
      </Button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {freshSecret ? (
        <div className="space-y-1 rounded-lg bg-black/30 p-3 text-xs text-cream/80">
          <p className="text-gold">Save on the device now (secret shown once):</p>
          <p>
            <span className="text-cream/45">EDGE_DEVICE_KEY=</span>
            {freshSecret.key}
          </p>
          <p className="break-all">
            <span className="text-cream/45">EDGE_DEVICE_SECRET=</span>
            {freshSecret.secret}
          </p>
        </div>
      ) : null}
      {devices.length > 0 ? (
        <ul className="space-y-1 text-xs text-cream/50">
          {devices.map((d) => (
            <li key={d.id}>
              {d.label} · <code className="text-cream/70">{d.device_key}</code>
              {d.last_seen_at ? ` · seen ${d.last_seen_at}` : " · never seen"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
