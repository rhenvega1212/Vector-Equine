"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createHorseProfileSchema, type CreateHorseProfileInput } from "@/lib/validations/horse-profile";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const FIELDS: { key: keyof CreateHorseProfileInput; label: string; placeholder?: string; type?: string }[] = [
  { key: "name", label: "Horse name *" },
  { key: "barn_name", label: "Barn name / nickname", placeholder: "e.g. Buddy" },
  { key: "breed", label: "Breed", placeholder: "e.g. Warmblood" },
  { key: "age", label: "Age", type: "number", placeholder: "Years" },
  { key: "birthday", label: "Birthday", type: "date" },
  { key: "sex", label: "Sex", placeholder: "Gelding, Mare, Stallion" },
  { key: "height", label: "Height", placeholder: "e.g. 16.2 hh" },
  { key: "color", label: "Color", placeholder: "e.g. Bay" },
  { key: "discipline", label: "Discipline", placeholder: "e.g. Dressage" },
  { key: "training_level", label: "Training level", placeholder: "e.g. First level" },
  { key: "owner", label: "Owner" },
  { key: "rider", label: "Rider" },
  { key: "trainer", label: "Trainer" },
  { key: "purchase_lease_status", label: "Purchase / lease", placeholder: "Owned, Leased" },
  { key: "date_acquired", label: "Date acquired", type: "date" },
  { key: "show_name", label: "Show name" },
];

interface HorseFormProps {
  mode: "create" | "edit";
  horseId?: string;
  defaultValues?: Partial<CreateHorseProfileInput>;
}

export function HorseForm({ mode, horseId, defaultValues }: HorseFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CreateHorseProfileInput>({
    resolver: zodResolver(createHorseProfileSchema),
    defaultValues: {
      name: "",
      barn_name: "",
      breed: "",
      age: undefined,
      birthday: "",
      sex: "",
      height: "",
      color: "",
      discipline: "",
      training_level: "",
      owner: "",
      rider: "",
      trainer: "",
      purchase_lease_status: "",
      date_acquired: "",
      notes: "",
      show_name: "",
      personality_quirks: "",
      injuries_limitations: "",
      goals: "",
      ...defaultValues,
    },
  });

  async function onSubmit(data: CreateHorseProfileInput) {
    setIsLoading(true);
    try {
      const payload = { ...data };
      if (data.age === undefined || data.age === null) (payload as Record<string, unknown>).age = null;
      if (mode === "create") {
        const res = await fetch("/api/train/horses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error?.message || e.error || "Failed to create horse");
        }
        const horse = await res.json();
        toast({ title: "Horse added" });
        router.push(`/train/horses/${horse.id}`);
      } else if (horseId) {
        const res = await fetch(`/api/train/horses/${horseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error?.message || e.error || "Failed to update horse");
        }
        toast({ title: "Horse updated" });
        router.push(`/train/horses/${horseId}`);
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={mode === "edit" && horseId ? `/train/horses/${horseId}` : "/train/horses"}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </Link>

      <Card className="border-cyan-400/20">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Add horse" : "Edit horse"}</CardTitle>
          <p className="text-sm text-muted-foreground">Basic info — only name is required.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map(({ key, label, placeholder, type }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type={type || "text"}
                    placeholder={placeholder}
                    {...register(key, key === "age" ? { setValueAs: (v) => (v === "" || v === undefined ? undefined : Number(v)) } : undefined)}
                  />
                  {errors[key] && (
                    <p className="text-sm text-destructive">{(errors as Record<string, { message?: string }>)[key]?.message}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="General notes about this horse" className="min-h-[80px]" {...register("notes")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="personality_quirks">Personality / quirks (optional)</Label>
              <Textarea id="personality_quirks" placeholder="Temperament, quirks" className="min-h-[60px]" {...register("personality_quirks")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="injuries_limitations">Injuries or limitations (optional)</Label>
              <Textarea id="injuries_limitations" placeholder="Anything to keep in mind" className="min-h-[60px]" {...register("injuries_limitations")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goals">Goals for this horse (optional)</Label>
              <Textarea id="goals" placeholder="What you're working toward" className="min-h-[80px]" {...register("goals")} />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "create" ? "Add horse" : "Save changes"}
              </Button>
              <Link href={mode === "edit" && horseId ? `/train/horses/${horseId}` : "/train/horses"}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
