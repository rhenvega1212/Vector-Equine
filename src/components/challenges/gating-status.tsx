"use client";

import { Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { GatingResult, GatingType } from "@/lib/challenges/gating";

interface GatingStatusProps {
  gatingResult: GatingResult;
  gatingType: GatingType;
}

export function GatingStatus({ gatingResult, gatingType }: GatingStatusProps) {
  if (gatingResult.unmetRequirements.length === 0) {
    return (
      <div className="flex items-center gap-2 text-emerald-400 text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span>All requirements met</span>
      </div>
    );
  }

  if (gatingType === "soft") {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <div className="flex items-center gap-2 text-yellow-400 mb-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            Recommended before proceeding
          </span>
        </div>
        <ul className="space-y-1 pl-6 text-sm text-yellow-300/80">
          {gatingResult.unmetRequirements.map((req) => (
            <li key={req} className="list-disc">
              {req}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-center gap-2 text-red-400 mb-2">
        <Lock className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          Complete requirements to proceed
        </span>
      </div>
      <ul className="space-y-1 pl-6 text-sm text-red-300/80">
        {gatingResult.unmetRequirements.map((req) => (
          <li key={req} className="list-disc">
            {req}
          </li>
        ))}
      </ul>
    </div>
  );
}
