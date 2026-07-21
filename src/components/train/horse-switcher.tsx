"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HorseOption = {
  id: string;
  name: string;
  level?: string | null;
};

export function HorseSwitcher({
  horses,
  activeId,
}: {
  horses: HorseOption[];
  activeId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (horses.length <= 1) {
    const only = horses[0];
    if (!only) return null;
    return (
      <div className="inline-flex items-center gap-3 rounded-full border border-gold/30 bg-[#131C31] px-3 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold text-sm font-semibold text-gold">
          {only.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-sm">
          <span className="font-medium text-cream">{only.name}</span>
          {only.level && <span className="text-cream/50"> · {only.level}</span>}
        </span>
      </div>
    );
  }

  return (
    <Select
      value={activeId}
      onValueChange={(id) => {
        router.push(`${pathname}?horseId=${id}`);
      }}
    >
      <SelectTrigger className="w-[220px] h-11 rounded-full border-gold/30 bg-[#131C31] text-cream">
        <SelectValue placeholder="Select horse" />
      </SelectTrigger>
      <SelectContent>
        {horses.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.name}
            {h.level ? ` · ${h.level}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
