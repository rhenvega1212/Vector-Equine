"use client";

import { useCallback, useEffect, useState } from "react";
import { OutwardShareButton } from "@/components/train/outward-share-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link2, Loader2, Copy, Ban } from "lucide-react";

type ShareLinkRow = {
  id: string;
  token: string;
  revoked: boolean;
  expires_at: string | null;
  created_at: string;
};

type SharedOnlyCoach = {
  trainer_id: string;
  display_name: string;
  share_id: string | null;
};

export function DebriefShareActions({
  score,
  decodedLine,
  horseName,
  riderFirstName,
  sessionId,
  isOwner,
}: {
  score: number | null;
  decodedLine: string;
  horseName: string;
  riderFirstName: string;
  sessionId?: string;
  isOwner?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-wrap gap-3">
        {score != null ? (
          <OutwardShareButton
            score={score}
            decodedLine={decodedLine}
            horseName={horseName}
            riderFirstName={riderFirstName}
          />
        ) : null}
        {isOwner && sessionId && <ViewLinkControls sessionId={sessionId} />}
      </div>
      {isOwner && sessionId && <ShareWithCoachControls sessionId={sessionId} />}
    </div>
  );
}

function ViewLinkControls({ sessionId }: { sessionId: string }) {
  const { toast } = useToast();
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/share-links?session_id=${sessionId}`);
      const data = await res.json();
      if (res.ok) setLinks(data.links || []);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = links.filter((l) => !l.revoked);

  async function createLink() {
    setCreating(true);
    try {
      const res = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not create link",
          description: typeof data.error === "string" ? data.error : "Try again",
          variant: "destructive",
        });
        return;
      }
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${data.url}`
          : data.url;
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "View link copied", description: url });
      } catch {
        toast({ title: "View link created", description: url });
      }
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/shared/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({ title: "Link", description: url });
    }
  }

  async function revoke(token: string) {
    setRevoking(token);
    try {
      const res = await fetch(`/api/share-links/${token}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Revoke failed",
          description: typeof data.error === "string" ? data.error : "Try again",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Link revoked" });
      await load();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="border-gold/30"
        disabled={creating}
        onClick={createLink}
      >
        {creating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Link2 className="mr-2 h-4 w-4" />
        )}
        Share a view link
      </Button>
      {!loading && active.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-gold/15 bg-[#131C31] p-2 text-xs">
          {active.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 text-cream/80"
            >
              <span className="truncate font-mono text-[11px]">…{l.token.slice(-8)}</span>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => copyLink(l.token)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive"
                  disabled={revoking === l.token}
                  onClick={() => revoke(l.token)}
                >
                  {revoking === l.token ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Ban className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareWithCoachControls({ sessionId }: { sessionId: string }) {
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<SharedOnlyCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/session-shares?session_id=${sessionId}`);
      const data = await res.json();
      if (res.ok) setCoaches(data.coaches || []);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || coaches.length === 0) return null;

  async function toggle(coach: SharedOnlyCoach) {
    setBusy(coach.trainer_id);
    try {
      if (coach.share_id) {
        const res = await fetch(`/api/session-shares?id=${coach.share_id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          toast({
            title: "Could not unshare",
            description: typeof data.error === "string" ? data.error : "Try again",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Unshared with coach" });
      } else {
        const res = await fetch("/api/session-shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            trainer_id: coach.trainer_id,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast({
            title: "Could not share",
            description: typeof data.error === "string" ? data.error : "Try again",
            variant: "destructive",
          });
          return;
        }
        toast({ title: `Shared with ${coach.display_name}` });
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4 space-y-3 w-full max-w-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
        Share with coach
      </p>
      <p className="text-xs text-cream/50">
        These coaches only see rides you share. Toggle per coach below.
      </p>
      <ul className="space-y-2">
        {coaches.map((c) => (
          <li
            key={c.trainer_id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="text-cream">{c.display_name}</span>
            <Button
              type="button"
              size="sm"
              variant={c.share_id ? "default" : "outline"}
              className={
                c.share_id
                  ? "bg-gold text-navy font-semibold hover:bg-gold-bright h-8"
                  : "border-gold/30 h-8"
              }
              disabled={busy === c.trainer_id}
              onClick={() => toggle(c)}
            >
              {busy === c.trainer_id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : c.share_id ? (
                "Shared"
              ) : (
                "Share"
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
