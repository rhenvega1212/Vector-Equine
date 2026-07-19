"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";
import type { FeatureFlag, FlagStage } from "@/types/database";

const STAGES: { value: FlagStage; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "Nobody sees it" },
  { value: "internal", label: "Internal", hint: "Team / admins only" },
  { value: "closed_beta", label: "Closed beta", hint: "Admins + beta testers" },
  { value: "open_beta", label: "Open beta", hint: "Beta testers + % rollout" },
  { value: "ga", label: "GA", hint: "Everyone" },
];

const STAGE_BADGE: Record<FlagStage, string> = {
  off: "bg-muted text-muted-foreground",
  internal: "bg-gold/15 text-gold",
  closed_beta: "bg-gold/25 text-gold-bright",
  open_beta: "bg-cream/10 text-cream",
  ga: "bg-gold text-navy",
};

function stageLabel(stage: FlagStage) {
  return STAGES.find((s) => s.value === stage)?.label ?? stage;
}

export function FlagControlPanel({
  initialFlags,
}: {
  initialFlags: FeatureFlag[];
}) {
  const [flags, setFlags] = useState(initialFlags);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateLocal(key: string, patch: Partial<FeatureFlag>) {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...patch } : f))
    );
  }

  async function save(key: string, patch: Partial<FeatureFlag>) {
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      const updated = (await res.json()) as FeatureFlag;
      updateLocal(key, updated);
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingKey(null);
    }
  }

  if (flags.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No feature flags registered yet.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {flags.map((flag) => (
        <Card key={flag.key} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm font-semibold">
                  {flag.key}
                </code>
                <Badge className={STAGE_BADGE[flag.stage]}>
                  {stageLabel(flag.stage)}
                </Badge>
                {savedKey === flag.key && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {flag.description}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Stage
              </label>
              <Select
                value={flag.stage}
                onValueChange={(value) =>
                  save(flag.key, { stage: value as FlagStage })
                }
                disabled={savingKey === flag.key}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label} — {s.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Open-beta rollout</span>
                <span className="font-mono">{flag.rollout_percentage}%</span>
              </label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[flag.rollout_percentage]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) =>
                    updateLocal(flag.key, { rollout_percentage: v })
                  }
                  onValueCommit={([v]) =>
                    save(flag.key, { rollout_percentage: v })
                  }
                  disabled={
                    savingKey === flag.key || flag.stage !== "open_beta"
                  }
                  className={flag.stage !== "open_beta" ? "opacity-50" : ""}
                />
                {savingKey === flag.key && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {flag.stage !== "open_beta" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Only applies while stage is Open beta.
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
