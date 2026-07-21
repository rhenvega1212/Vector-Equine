"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HEALTH_FLAG_KEYS,
  HEALTH_FLAG_LABELS,
  type HealthFlagKey,
} from "@/lib/validations/vector-setup";

const DISCIPLINES = [
  { value: "dressage", label: "Dressage" },
  { value: "jumping", label: "Show Jumping" },
  { value: "eventing", label: "Eventing" },
  { value: "western", label: "Western" },
  { value: "hunter", label: "Hunter" },
  { value: "endurance", label: "Endurance" },
  { value: "reining", label: "Reining" },
  { value: "trail", label: "Trail Riding" },
  { value: "other", label: "Other" },
];

const RIDER_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

const SEX_OPTIONS = [
  { value: "Mare", label: "Mare" },
  { value: "Gelding", label: "Gelding" },
  { value: "Stallion", label: "Stallion" },
];

const STEPS = ["You", "Horse", "Together", "Health"] as const;

type FormState = {
  discipline: string;
  rider_level: string;
  name: string;
  breed: string;
  age: string;
  sex: string;
  horse_discipline: string;
  training_level: string;
  goals: string;
  injuries_limitations: string;
  months_together: string;
  sessions_per_week: string;
  current_focus: string;
  sticking_points: string;
  health_flags: HealthFlagKey[];
  health_flag_notes: string;
};

const INITIAL: FormState = {
  discipline: "",
  rider_level: "",
  name: "",
  breed: "",
  age: "",
  sex: "",
  horse_discipline: "",
  training_level: "",
  goals: "",
  injuries_limitations: "",
  months_together: "",
  sessions_per_week: "3",
  current_focus: "",
  sticking_points: "",
  health_flags: [],
  health_flag_notes: "",
};

export function VectorSetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFlag(key: HealthFlagKey) {
    setForm((prev) => ({
      ...prev,
      health_flags: prev.health_flags.includes(key)
        ? prev.health_flags.filter((f) => f !== key)
        : [...prev.health_flags, key],
    }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.discipline) return "Select your discipline";
      if (!form.rider_level) return "Select your rider level";
    }
    if (step === 1) {
      if (!form.name.trim()) return "Horse name is required";
      if (!form.horse_discipline) return "Select horse discipline";
      if (!form.training_level.trim()) return "Training level is required";
    }
    if (step === 2) {
      const months = Number(form.months_together);
      if (form.months_together === "" || Number.isNaN(months) || months < 0) {
        return "How long have you been together?";
      }
      const spw = Number(form.sessions_per_week);
      if (!spw || spw < 1 || spw > 14) return "Sessions per week should be 1–14";
      if (!form.current_focus.trim()) return "What are you working on right now?";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ageNum = form.age.trim() === "" ? null : Number(form.age);
      const res = await fetch("/api/train/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discipline: form.discipline,
          rider_level: form.rider_level,
          horse: {
            name: form.name.trim(),
            breed: form.breed.trim() || null,
            age: ageNum != null && !Number.isNaN(ageNum) ? ageNum : null,
            sex: form.sex || null,
            discipline: form.horse_discipline,
            training_level: form.training_level.trim(),
            goals: form.goals.trim() || null,
            injuries_limitations: form.injuries_limitations.trim() || null,
            months_together: Number(form.months_together),
            sessions_per_week: Number(form.sessions_per_week),
            current_focus: form.current_focus.trim(),
            sticking_points: form.sticking_points.trim() || null,
            health_flags: form.health_flags,
            health_flag_notes: form.health_flag_notes.trim() || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : Array.isArray(data.error)
              ? data.error[0]?.message || "Could not save setup"
              : "Could not save setup";
        setError(msg);
        return;
      }
      router.push("/train");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 pb-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
          Vector
        </p>
        <h1 className="font-serif text-3xl text-cream">Set your starting place</h1>
        <p className="text-sm text-cream/55">
          A few questions so Vector can coach alongside your trainer from day one.
        </p>
      </header>

      <ol className="flex gap-2" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1 space-y-1">
            <div
              className={cn(
                "h-1 rounded-full",
                i <= step ? "bg-gold" : "bg-cream/15"
              )}
            />
            <p
              className={cn(
                "text-[10px] uppercase tracking-[0.14em]",
                i === step ? "text-gold" : "text-cream/35"
              )}
            >
              {label}
            </p>
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {step === 0 && (
          <>
            <StepTitle
              title="About you"
              subtitle="Where you are as a rider — not a test, a baseline."
            />
            <Field label="Discipline *">
              <Select
                value={form.discipline || undefined}
                onValueChange={(v) => setField("discipline", v)}
              >
                <SelectTrigger className="bg-[#131C31] border-gold/20 text-cream">
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rider level *">
              <Select
                value={form.rider_level || undefined}
                onValueChange={(v) => setField("rider_level", v)}
              >
                <SelectTrigger className="bg-[#131C31] border-gold/20 text-cream">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {RIDER_LEVELS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <StepTitle
              title="Your horse"
              subtitle="Who you’re bringing into Vector."
            />
            <Field label="Horse name *">
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Name"
                className="bg-[#131C31] border-gold/20 text-cream"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Breed">
                <Input
                  value={form.breed}
                  onChange={(e) => setField("breed", e.target.value)}
                  placeholder="e.g. Warmblood"
                  className="bg-[#131C31] border-gold/20 text-cream"
                />
              </Field>
              <Field label="Age">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={form.age}
                  onChange={(e) => setField("age", e.target.value)}
                  placeholder="Years"
                  className="bg-[#131C31] border-gold/20 text-cream"
                />
              </Field>
            </div>
            <Field label="Sex">
              <Select
                value={form.sex || undefined}
                onValueChange={(v) => setField("sex", v)}
              >
                <SelectTrigger className="bg-[#131C31] border-gold/20 text-cream">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {SEX_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Horse discipline *">
              <Select
                value={form.horse_discipline || undefined}
                onValueChange={(v) => setField("horse_discipline", v)}
              >
                <SelectTrigger className="bg-[#131C31] border-gold/20 text-cream">
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Training level *">
              <Input
                value={form.training_level}
                onChange={(e) => setField("training_level", e.target.value)}
                placeholder="e.g. First level, Novice, 1.10m"
                className="bg-[#131C31] border-gold/20 text-cream"
              />
            </Field>
            <Field label="Goals">
              <Textarea
                value={form.goals}
                onChange={(e) => setField("goals", e.target.value)}
                placeholder="What do you want to work toward?"
                className="min-h-[80px] bg-[#131C31] border-gold/20 text-cream"
              />
            </Field>
            <Field label="Injuries or limitations">
              <Textarea
                value={form.injuries_limitations}
                onChange={(e) => setField("injuries_limitations", e.target.value)}
                placeholder="Anything Vector should keep in mind"
                className="min-h-[70px] bg-[#131C31] border-gold/20 text-cream"
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle
              title="You and your horse"
              subtitle="How you train together right now."
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Months together *">
                <Input
                  type="number"
                  min={0}
                  max={600}
                  value={form.months_together}
                  onChange={(e) => setField("months_together", e.target.value)}
                  placeholder="e.g. 18"
                  className="bg-[#131C31] border-gold/20 text-cream"
                />
              </Field>
              <Field label="Sessions / week *">
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={form.sessions_per_week}
                  onChange={(e) => setField("sessions_per_week", e.target.value)}
                  className="bg-[#131C31] border-gold/20 text-cream"
                />
              </Field>
            </div>
            <Field label="Current focus *">
              <Input
                value={form.current_focus}
                onChange={(e) => setField("current_focus", e.target.value)}
                placeholder="e.g. Canter balance, left lead"
                className="bg-[#131C31] border-gold/20 text-cream"
              />
            </Field>
            <Field label="Sticking points">
              <Textarea
                value={form.sticking_points}
                onChange={(e) => setField("sticking_points", e.target.value)}
                placeholder="Where do things tend to fall apart?"
                className="min-h-[80px] bg-[#131C31] border-gold/20 text-cream"
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle
              title="Light health check-in"
              subtitle="Helps Vector flag patterns — not a diagnosis."
            />
            <div className="space-y-2">
              {HEALTH_FLAG_KEYS.map((key) => {
                const selected = form.health_flags.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFlag(key)}
                    className={cn(
                      "w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      selected
                        ? "border-gold bg-gold/10 text-cream"
                        : "border-gold/15 bg-[#131C31] text-cream/70 hover:border-gold/35"
                    )}
                  >
                    {HEALTH_FLAG_LABELS[key]}
                  </button>
                );
              })}
            </div>
            <Field label="Notes (optional)">
              <Textarea
                value={form.health_flag_notes}
                onChange={(e) => setField("health_flag_notes", e.target.value)}
                placeholder="Anything else worth flagging for care"
                className="min-h-[80px] bg-[#131C31] border-gold/20 text-cream"
              />
            </Field>
          </>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={back}
            disabled={isLoading}
            className="border-gold/25 text-cream hover:bg-cream/5"
          >
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={next}
            className="flex-1 bg-gold text-navy font-semibold hover:bg-gold-bright"
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submit}
            disabled={isLoading}
            className="flex-1 bg-gold text-navy font-semibold hover:bg-gold-bright"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Enter Vector"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="font-serif text-2xl text-cream">{title}</h2>
      <p className="text-sm text-cream/50">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-cream/70">{label}</Label>
      {children}
    </div>
  );
}
