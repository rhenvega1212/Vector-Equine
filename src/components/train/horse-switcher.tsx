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
  variant = "default",
}: {
  horses: HorseOption[];
  activeId: string;
  /** Text link for Vector home header; default keeps the pill select. */
  variant?: "default" | "link";
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function switchTo(id: string) {
    // Persist selection; URL remains the immediate switch.
    void fetch("/api/train/active-horse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horseId: id }),
    }).catch(() => {});
    router.push(`${pathname}?horseId=${id}`);
  }

  if (variant === "link") {
    if (horses.length <= 1) return null;
    return (
      <Select value={activeId} onValueChange={switchTo}>
        <SelectTrigger
          className="h-auto w-auto gap-1 border-0 bg-transparent p-0 text-[12.5px] tracking-[0.04em] text-gold shadow-none hover:text-gold-bright focus:ring-0 focus:ring-offset-0 [&>svg]:hidden"
          aria-label="Switch horse"
        >
          <span>
            Switch horse <span aria-hidden>⌄</span>
          </span>
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

  if (horses.length <= 1) {
    const only = horses[0];
    if (!only) return null;
    return (
      <div className="inline-flex w-full items-center gap-3 rounded-full border border-gold/30 bg-[#0B1220] px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold text-sm font-semibold text-gold">
          {only.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 text-sm">
          <span className="font-medium text-cream">{only.name}</span>
          {only.level && <span className="text-cream/50"> · {only.level}</span>}
        </span>
      </div>
    );
  }

  return (
    <Select value={activeId} onValueChange={switchTo}>
      <SelectTrigger className="h-11 w-full max-w-full rounded-full border-gold/30 bg-[#0B1220] text-cream">
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
