"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type {
  BlockRendererProps,
  TrainerLinkSettings,
} from "@/lib/blocks/types";

interface TrainerProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

function trainerInitials(name: string | null, id: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return id.slice(0, 2).toUpperCase();
}

export function TrainerLinkBlockRenderer({
  block,
}: BlockRendererProps) {
  const { toast } = useToast();
  const settings = (block.settings ?? {}) as Partial<TrainerLinkSettings>;
  const trainers = settings.trainers ?? [];
  const trainerIds = trainers.map((t) => t.trainerId).filter(Boolean);

  const [selectedTrainer, setSelectedTrainer] = useState<{
    trainerId: string;
    ctaText?: string;
    profile?: TrainerProfile;
  } | null>(null);

  const { data: profiles, isLoading } = useQuery<TrainerProfile[]>({
    queryKey: ["trainer-profiles", trainerIds],
    queryFn: async () => {
      if (trainerIds.length === 0) return [];
      const res = await fetch(
        `/api/profiles?ids=${trainerIds.join(",")}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: trainerIds.length > 0,
  });

  function getProfile(id: string): TrainerProfile | undefined {
    return profiles?.find((p) => p.id === id);
  }

  if (trainers.length === 0) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {trainers.map((trainer) => {
          const profile = getProfile(trainer.trainerId);
          const name = profile?.display_name ?? trainer.trainerId;
          const initials = trainerInitials(
            profile?.display_name ?? null,
            trainer.trainerId
          );

          return (
            <div
              key={trainer.trainerId}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 text-sm font-semibold text-white">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {trainer.ctaText || "Get expert feedback"}
                </p>
              </div>

              <Button
                size="sm"
                onClick={() =>
                  setSelectedTrainer({
                    trainerId: trainer.trainerId,
                    ctaText: trainer.ctaText,
                    profile,
                  })
                }
                className="shrink-0 bg-cyan-500 text-white hover:bg-cyan-600"
              >
                Get Feedback
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!selectedTrainer}
        onOpenChange={(open) => !open && setSelectedTrainer(null)}
      >
        <DialogContent className="border-white/10 bg-[#0f1117] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedTrainer?.profile?.display_name ??
                selectedTrainer?.trainerId ??
                "Trainer"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedTrainer?.ctaText || "Get personalised feedback from this trainer."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                About
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {selectedTrainer?.profile?.bio ??
                  "This trainer provides expert feedback on your submissions. Bio coming soon."}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Pricing
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Pricing details coming soon.
              </p>
            </div>

            <Button
              className="w-full bg-cyan-500 text-white hover:bg-cyan-600"
              onClick={() => {
                toast({ title: "Checkout flow coming soon!" });
                setSelectedTrainer(null);
              }}
            >
              Proceed to Checkout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
