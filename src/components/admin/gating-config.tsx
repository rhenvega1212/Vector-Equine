"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Unlock,
  AlertTriangle,
  Lock,
} from "lucide-react";
import type { GatingType, GatingRules } from "@/lib/challenges/gating";

interface GatingConfigProps {
  gatingType: GatingType;
  gatingRules: GatingRules;
  onChange: (gatingType: GatingType, gatingRules: GatingRules) => void;
}

const gatingOptions: {
  value: GatingType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "none",
    label: "None",
    description: "Free navigation between lessons",
    icon: Unlock,
  },
  {
    value: "soft",
    label: "Soft",
    description: "Warn but allow proceeding",
    icon: AlertTriangle,
  },
  {
    value: "hard",
    label: "Hard",
    description: "Must complete before proceeding",
    icon: Lock,
  },
];

export function GatingConfig({
  gatingType,
  gatingRules,
  onChange,
}: GatingConfigProps) {
  function setType(type: GatingType) {
    onChange(type, gatingRules);
  }

  function setRule(patch: Partial<GatingRules>) {
    onChange(gatingType, { ...gatingRules, ...patch });
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          Gating Type
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {gatingOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = gatingType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
                  selected
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-border bg-card hover:border-muted-foreground/40"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {gatingType !== "none" && (
        <div className="space-y-4">
          <Label className="text-sm font-semibold block">
            Requirements
          </Label>

          <div className="flex items-center gap-3">
            <Checkbox
              id="requireAllBlocks"
              checked={!!gatingRules.requireAllBlocks}
              onCheckedChange={(checked) =>
                setRule({ requireAllBlocks: !!checked })
              }
            />
            <Label htmlFor="requireAllBlocks" className="cursor-pointer">
              Complete all required blocks
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="requireSubmission"
              checked={!!gatingRules.requireSubmission}
              onCheckedChange={(checked) =>
                setRule({ requireSubmission: !!checked })
              }
            />
            <Label htmlFor="requireSubmission" className="cursor-pointer">
              Submit and receive feedback on submission
            </Label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="minDiscussionPosts"
              checked={
                gatingRules.minDiscussionPosts != null &&
                gatingRules.minDiscussionPosts > 0
              }
              onCheckedChange={(checked) =>
                setRule({
                  minDiscussionPosts: checked ? 1 : 0,
                })
              }
            />
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="minDiscussionPosts"
                className="cursor-pointer"
              >
                Minimum discussion participation
              </Label>
              {gatingRules.minDiscussionPosts != null &&
                gatingRules.minDiscussionPosts > 0 && (
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={gatingRules.minDiscussionPosts}
                    onChange={(e) =>
                      setRule({
                        minDiscussionPosts: Math.max(
                          1,
                          parseInt(e.target.value, 10) || 1
                        ),
                      })
                    }
                    className="w-24 h-8 text-sm"
                  />
                )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="requireManualApproval"
              checked={!!gatingRules.requireManualApproval}
              onCheckedChange={(checked) =>
                setRule({ requireManualApproval: !!checked })
              }
            />
            <Label
              htmlFor="requireManualApproval"
              className="cursor-pointer"
            >
              Manual approval required
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
