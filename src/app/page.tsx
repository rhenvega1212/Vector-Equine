"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, signUpSchema, type LoginInput, type SignUpInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle } from "lucide-react";

export default function HomePage() {
  return (
    <Suspense fallback={<AuthScreenSkeleton />}>
      <AuthScreen />
    </Suspense>
  );
}

function AuthScreenSkeleton() {
  return (
    <main className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="animate-pulse space-y-8">
          <div className="w-32 h-32 mx-auto bg-white/5 rounded-full" />
          <div className="h-10 bg-white/5 rounded" />
          <div className="h-10 bg-white/5 rounded" />
          <div className="h-12 bg-white/5 rounded-full" />
        </div>
      </div>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <main className="min-h-screen bg-[#020617] relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-radial from-blue-600/10 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-28 h-28 mb-4">
              <Image
                src="/logo.png"
                alt="Equinti"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-cyan-300/60 text-sm tracking-widest uppercase font-trajan">
              Connect. Learn. Compete.
            </p>
          </div>

          {/* Auth Form */}
          <div className="glass rounded-2xl p-6 sm:p-8">
            {mode === "login" ? (
              <LoginForm onSwitch={() => setMode("signup")} />
            ) : (
              <SignupForm onSwitch={() => setMode("login")} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/feed";
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-white/50">Sign in to continue</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:ring-cyan-400/20"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:ring-cyan-400/20"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-[#020617] font-semibold rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          "Sign In"
        )}
      </Button>

      <p className="text-center text-sm text-white/50">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
        >
          Sign up
        </button>
      </p>
    </form>
  );
}

function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/onboarding");
        router.refresh();
      }, 1500);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Account created!</h2>
        <p className="text-white/50 text-sm">Setting up your profile...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">Create account</h1>
        <p className="text-sm text-white/50">Join the Equinti community</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="signup-email" className="text-white/70 text-sm">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:ring-cyan-400/20"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password" className="text-white/70 text-sm">Password</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:ring-cyan-400/20"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
        <p className="text-xs text-white/40">Must be at least 8 characters</p>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-[#020617] font-semibold rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          "Create Account"
        )}
      </Button>

      <p className="text-center text-sm text-white/50">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
