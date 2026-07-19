"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { signUpSchema, type SignUpInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle } from "lucide-react";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <Card className="border-gold/15 shadow-2xl shadow-black/30">
          <CardContent className="py-10 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/train";
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  async function onSubmit(data: SignUpInput) {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const username = data.username.trim();

      // Make sure the username is free before creating the auth account.
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (taken) {
        setError("That username is already taken. Try another.");
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            username,
            display_name: data.display_name.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // If email confirmation is still enabled in Supabase, no session is
      // returned yet — fall back to the verify-by-email path.
      if (!signUpData.session || !signUpData.user) {
        setCheckEmail(true);
        return;
      }

      // Confirmation off: we're logged in. Create the profile and go.
      const { error: profileError } = await (supabase.from("profiles") as any).insert({
        id: signUpData.user.id,
        email: signUpData.user.email!,
        username,
        display_name: data.display_name.trim(),
      });

      if (profileError) {
        // A unique-violation here means the username was taken in a race.
        setError(
          profileError.code === "23505"
            ? "That username was just taken. Please pick another."
            : profileError.message
        );
        return;
      }

      // Brief delay so the session cookie is committed before navigating.
      await new Promise((r) => setTimeout(r, 100));
      const target =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/train";
      window.location.assign(`${window.location.origin}${target}`);
      return;
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <Card className="border-gold/15 shadow-2xl shadow-black/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-gold">
            <CheckCircle className="h-12 w-12" />
          </div>
          <CardTitle className="text-3xl font-serif">Check your email!</CardTitle>
          <CardDescription className="space-y-2">
            <p>We&apos;ve sent a confirmation link to your email address.</p>
            <p className="text-xs text-muted-foreground">
              Click it to activate your account, then sign in. If you don&apos;t
              see it, check your spam folder.
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <Link href="/login" className="text-sm text-gold hover:underline">
              Go to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gold/15 shadow-2xl shadow-black/30">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-serif">Create your account</CardTitle>
        <CardDescription>Join the Vector Equine community</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="display_name">Name</Label>
            <Input
              id="display_name"
              placeholder="Your name"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
              {...register("display_name")}
            />
            {errors.display_name && (
              <p className="text-sm text-destructive">{errors.display_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="your_username"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground text-center">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-gold hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-gold hover:underline">
              Privacy Policy
            </Link>
          </p>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
