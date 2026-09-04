"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

type InvitePreview = {
  code: string;
  invite_role: "rider" | "trainer";
  status: string;
  expires_at: string | null;
};

export default function InviteAcceptPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviterName, setInviterName] = useState<string>("A Vector member");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const kill = window.setTimeout(() => ac.abort(), 10000);

    async function load() {
      try {
        const res = await fetch(`/api/connections/invites/${code}`, {
          signal: ac.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(
            data.error || "This invite link is invalid or has already been used."
          );
          return;
        }
        setInvite(data.invite);
        if (data.inviter?.display_name) {
          setInviterName(data.inviter.display_name);
        } else if (data.inviter?.username) {
          setInviterName(`@${data.inviter.username}`);
        }
        setLoading(false);

        // Optional — don't block the invite card on Auth.
        try {
          const supabase = createClient();
          const raced = await Promise.race([
            supabase.auth.getUser(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);
          if (!raced || cancelled) return;
          setUserId(raced.data?.user?.id ?? null);
        } catch {
          if (!cancelled) setUserId(null);
        }
      } catch {
        if (!cancelled) setError("Could not load this invite.");
      } finally {
        window.clearTimeout(kill);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(kill);
    };
  }, [code]);

  async function accept() {
    if (!userId) {
      router.push(`/login?redirectTo=/invite/${code}`);
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/invites/${code}/accept`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not accept invite"
        );
        return;
      }
      router.push(
        invite?.invite_role === "rider"
          ? "/settings?subscribe=rider"
          : "/train"
      );
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <Card className="w-full border-gold/15 shadow-2xl shadow-black/30">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const roleLabel = invite?.invite_role === "trainer" ? "coach" : "rider";

  return (
    <Card className="w-full border-gold/15 shadow-2xl shadow-black/30">
      <CardHeader className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold mb-2">
          Connection invite
        </p>
        <CardTitle className="text-2xl font-serif">Join {inviterName}</CardTitle>
        <CardDescription>
          {invite
            ? `You've been invited to connect as a ${roleLabel} on Vector.`
            : "Invite details"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}
        {invite && !error && (
          <p className="text-sm text-muted-foreground text-center">
            {invite.invite_role === "rider"
              ? "Accepting connects you as a rider. Capturing sessions works best with a rider subscription — browsing and coaching stay free."
              : "Accepting connects your accounts so you can share rides and coaching notes. Coaching is free — no card needed."}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {invite && !error && (
          <Button
            className="w-full bg-gold text-navy font-semibold hover:bg-gold-bright"
            onClick={accept}
            disabled={accepting}
          >
            {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {userId ? "Accept invite" : "Sign in to accept"}
          </Button>
        )}
        {!userId && invite && !error && (
          <Button variant="outline" className="w-full border-gold/30" asChild>
            <Link href={`/signup?redirectTo=/invite/${code}`}>Create an account</Link>
          </Button>
        )}
        <Button variant="ghost" className="w-full" asChild>
          <Link href={userId ? "/train" : "/login"}>Back</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
