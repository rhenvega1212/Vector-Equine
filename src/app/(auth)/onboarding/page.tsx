"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { onboardingSchema, type OnboardingInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <Card className="border-gold/15 shadow-2xl shadow-black/30">
          <CardContent className="py-10">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      }
    >
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimFromQuery = searchParams.get("claim");
  const [claimToken, setClaimToken] = useState<string | null>(claimFromQuery);
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
      role_rider: !claimFromQuery,
      role_trainer: !!claimFromQuery,
    },
  });

  const roleRider = watch("role_rider");
  const roleTrainer = watch("role_trainer");

  useEffect(() => {
    let token = claimFromQuery;
    try {
      if (!token) token = sessionStorage.getItem("vector-claim-token");
      const claimName = sessionStorage.getItem("vector-claim-name");
      if (claimName) setValue("display_name", claimName);
    } catch {
      /* ignore */
    }
    if (token) {
      setClaimToken(token);
      setValue("role_trainer", true, { shouldValidate: true });
      setValue("role_rider", false, { shouldValidate: true });
    }
  }, [claimFromQuery, setValue]);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(
          claimToken
            ? `/login?redirectTo=${encodeURIComponent(`/onboarding?claim=${claimToken}`)}`
            : "/login"
        );
        return;
      }

      const { data: profile } = (await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle()) as {
        data: {
          username: string;
          display_name: string | null;
        } | null;
      };

      // Claim path: profile may already have username from signup — finish claim after roles.
      if (profile?.username && !claimToken) {
        router.push("/train");
        return;
      }

      if (profile?.username) {
        setValue("username", profile.username);
      }
      if (profile?.display_name) {
        setValue("display_name", profile.display_name);
      }
      if (claimToken) {
        setValue("role_trainer", true, { shouldValidate: true });
        setValue("role_rider", false, { shouldValidate: true });
      }

      setIsCheckingAuth(false);
    }

    checkAuth();
  }, [router, claimToken, setValue]);

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
        .neq("id", user.id)
        .maybeSingle();

      if (existingUser) {
        setError("This username is already taken");
        return;
      }

      const asTrainer = data.role_trainer || !!claimToken;
      const coachOnly = asTrainer && !data.role_rider;

      const { error: profileError } = await (supabase.from("profiles") as any).upsert({
        id: user.id,
        email: user.email!,
        username: data.username,
        display_name: data.display_name,
        role_rider: data.role_rider,
        role_trainer: asTrainer,
        // Coach-only skips the horse wizard; riders hit the /train/setup hard gate.
        ...(coachOnly
          ? { vector_setup_completed_at: new Date().toISOString() }
          : {}),
      });

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (claimToken) {
        const claimRes = await fetch(
          `/api/capture/claim/${encodeURIComponent(claimToken)}`,
          { method: "POST" }
        );
        const claimData = await claimRes.json().catch(() => ({}));
        try {
          sessionStorage.removeItem("vector-claim-token");
          sessionStorage.removeItem("vector-claim-name");
        } catch {
          /* ignore */
        }
        if (claimRes.ok && claimData.sessionId) {
          window.location.assign(
            `${window.location.origin}/train/sessions/${claimData.sessionId}`
          );
          return;
        }
        if (!claimRes.ok) {
          setError(
            claimData.error ||
              "Account ready, but we couldn't open that lesson yet. Check Rides."
          );
        }
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
      <Card className="border-gold/15 shadow-2xl shadow-black/30">
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
        <CardTitle className="text-3xl font-serif">
          {claimToken ? "Finish your coach profile" : "Complete your profile"}
        </CardTitle>
        <CardDescription>
          {claimToken
            ? "Then we'll open the lesson you just taught"
            : "Tell us a bit about yourself to get started"}
        </CardDescription>
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
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-gold text-navy font-semibold hover:bg-gold/90"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {claimToken ? "Open the lesson" : "Complete Profile"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
