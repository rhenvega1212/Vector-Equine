"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";

interface HorseProfile {
  id: string;
  name: string;
  barn_name?: string | null;
}

interface TrainSessionsFiltersProps {
  currentRange: string;
  currentHorseId: string;
  currentSessionType: string;
  horseProfiles: HorseProfile[];
}

export function TrainSessionsFilters({
  currentRange,
  currentHorseId,
  currentSessionType,
  horseProfiles,
}: TrainSessionsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    if (key === "horse_id") {
      p.delete("horse");
    }
    router.push(`/train/sessions?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentRange} onValueChange={(v) => update("range", v)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
      <Select value={currentHorseId || "all"} onValueChange={(v) => update("horse_id", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Horse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All horses</SelectItem>
          {horseProfiles.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.barn_name?.trim() ? `${h.name} (“${h.barn_name}”)` : h.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={currentSessionType || "all"} onValueChange={(v) => update("session_type", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Session type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
