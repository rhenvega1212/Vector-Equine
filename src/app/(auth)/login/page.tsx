"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
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
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <Card className="border-gold/15 shadow-2xl shadow-black/30">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-serif">Welcome back</CardTitle>
        <CardDescription>Sign in to your Vector Equine account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full bg-gold text-navy font-semibold hover:bg-gold/90"
      disabled={pending}
    >
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Sign In
    </Button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/train";
  const [state, formAction] = useFormState(loginAction, {
    error: null,
  });

  // Drop stale/invalid refresh tokens so a new sign-in can set a clean session.
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ error }) => {
      if (error) void supabase.auth.signOut({ scope: "local" });
    });
  }, []);

  // If someone landed with credentials in the query string (broken GET submit), strip them.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("password") || url.searchParams.has("email")) {
      url.searchParams.delete("password");
      url.searchParams.delete("email");
      const clean = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ""}`;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  return (
    <Card className="border-gold/15 shadow-2xl shadow-black/30">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-serif">Welcome back</CardTitle>
        <CardDescription>Sign in to your Vector Equine account</CardDescription>
        <p className="mt-1 text-sm italic text-gold">Every rider knows the moment.</p>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <CardContent className="space-y-4">
          {state.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="bg-white/[0.04] border-border focus-visible:ring-gold/60"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <SubmitButton />
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-gold hover:underline">
              Sign up
            </Link>
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-gold transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-gold transition-colors">
              Terms of Service
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
