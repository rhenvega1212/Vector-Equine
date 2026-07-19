"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      role_rider: true,
      role_trainer: false,
    },
  });

  const roleRider = watch("role_rider");
  const roleTrainer = watch("role_trainer");

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = (await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle()) as { data: { username: string } | null };

      if (profile && profile.username) {
        router.push("/train");
        return;
      }

      setIsCheckingAuth(false);
    }

    checkAuth();
  }, [router]);

  async function onSubmit(data: OnboardingInput) {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in to continue");
        return;
      }

      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", data.username)
        .maybeSingle();

      if (existingUser) {
        setError("This username is already taken");
        return;
      }

      const coachOnly = data.role_trainer && !data.role_rider;

      const { error: profileError } = await (supabase.from("profiles") as any).upsert({
        id: user.id,
        email: user.email!,
        username: data.username,
        display_name: data.display_name,
        location: data.location || null,
        discipline: coachOnly ? null : data.discipline || null,
        rider_level: coachOnly ? null : data.rider_level || null,
        role_rider: data.role_rider,
        role_trainer: data.role_trainer,
      });

      if (profileError) {
        setError(profileError.message);
        return;
      }

      router.push("/train");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCheckingAuth) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gold/15 shadow-2xl shadow-black/30">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-serif">Complete your profile</CardTitle>
        <CardDescription>Tell us a bit about yourself to get started</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>How will you use Vector? *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue("role_rider", !roleRider, { shouldValidate: true })}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  roleRider
                    ? "border-gold bg-gold/15 text-foreground"
                    : "border-border bg-white/[0.02] text-muted-foreground hover:border-gold/40"
                )}
              >
                <p className="font-serif text-lg text-gold">I ride</p>
                <p className="mt-1 text-xs">Capture sessions and share with a coach</p>
              </button>
              <button
                type="button"
                onClick={() =>
                  setValue("role_trainer", !roleTrainer, { shouldValidate: true })
                }
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  roleTrainer
                    ? "border-gold bg-gold/15 text-foreground"
                    : "border-border bg-white/[0.02] text-muted-foreground hover:border-gold/40"
                )}
              >
                <p className="font-serif text-lg text-gold">I coach</p>
                <p className="mt-1 text-xs">Connect with riders — free coach seat</p>
              </button>
            </div>
            {errors.role_rider && (
              <p className="text-sm text-destructive">{errors.role_rider.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              placeholder="your_username"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Letters, numbers, and underscores only
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name *</Label>
            <Input
              id="display_name"
              placeholder="Your Name"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
              {...register("display_name")}
            />
            {errors.display_name && (
              <p className="text-sm text-destructive">{errors.display_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              placeholder="City, State"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
              {...register("location")}
            />
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location.message}</p>
            )}
          </div>

          {roleRider && (
            <>
              <div className="space-y-2">
                <Label htmlFor="discipline">Discipline (optional)</Label>
                <Select onValueChange={(value) => setValue("discipline", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your discipline" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map((discipline) => (
                      <SelectItem key={discipline.value} value={discipline.value}>
                        {discipline.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rider_level">Rider Level (optional)</Label>
                <Select onValueChange={(value) => setValue("rider_level", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your level" />
                  </SelectTrigger>
                  <SelectContent>
                    {RIDER_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
