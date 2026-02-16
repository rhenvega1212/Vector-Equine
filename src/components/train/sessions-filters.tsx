"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";

interface TrainSessionsFiltersProps {
  currentRange: string;
  currentHorse: string;
  currentSessionType: string;
  horseList: string[];
}

export function TrainSessionsFilters({
  currentRange,
  currentHorse,
  currentSessionType,
  horseList,
}: TrainSessionsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
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
      <Select value={currentHorse || "all"} onValueChange={(v) => update("horse", v === "all" ? "" : v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Horse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All horses</SelectItem>
          {horseList.map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
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
