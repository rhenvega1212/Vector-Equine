"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, ChevronRight } from "lucide-react";

type ProfileProps = {
  id: string;
  username: string;
  display_name: string;
  role_rider: boolean;
  role_trainer: boolean;
  trainer_business: boolean;
};

type ConnectionRow = {
  id: string;
  rider_id: string;
  trainer_id: string;
  status: string;
  share_scope: "all" | "shared_only";
  rider?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  trainer?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

type InviteRow = {
  id: string;
  invite_role: "rider" | "trainer";
  code: string;
  status: string;
  created_at: string;
};

export function CoachingPanel({ profile }: { profile: ProfileProps }) {
  const { toast } = useToast();
  const both = profile.role_rider && profile.role_trainer;
  const [mode, setMode] = useState<"riding" | "coaching">(
    profile.role_rider ? "riding" : "coaching"
  );
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, inviteRes] = await Promise.all([
        fetch("/api/connections"),
        fetch("/api/connections/invites"),
      ]);
      const connData = await connRes.json();
      const inviteData = await inviteRes.json();
      if (connRes.ok) setConnections(connData.connections || []);
      if (inviteRes.ok) {
        setInvites(
          (inviteData.invites || []).filter((i: InviteRow) => i.status === "open")
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const asRider = connections.filter(
    (c) => c.rider_id === profile.id && c.status !== "removed"
  );
  const asTrainer = connections.filter(
    (c) => c.trainer_id === profile.id && c.status === "active"
  );
  const rosterCount = asTrainer.length;

  const pendingForMode = invites.filter((i) =>
    mode === "riding" ? i.invite_role === "trainer" : i.invite_role === "rider"
  );

  async function invite(inviteRole: "rider" | "trainer") {
    setInviting(true);
    try {
      const res = await fetch("/api/connections/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Invite failed",
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
        toast({
          title: "Invite link copied",
          description: url,
        });
      } catch {
        toast({
          title: "Invite created",
          description: url,
        });
      }
      await load();
    } finally {
      setInviting(false);
    }
  }

  async function updateConnection(
    id: string,
    patch: { status?: string; share_scope?: string }
  ) {
    const res = await fetch("/api/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "Update failed",
        description: typeof data.error === "string" ? data.error : "Try again",
        variant: "destructive",
      });
      return;
    }
    await load();
  }

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-gold/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Coaching
          </p>
          <h2 className="font-serif text-xl mt-1">Connections</h2>
        </div>
        {both && (
          <div className="inline-flex rounded-lg border border-gold/25 p-0.5">
            <button
              type="button"
              onClick={() => setMode("riding")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                mode === "riding"
                  ? "bg-gold text-navy font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Riding
            </button>
            <button
              type="button"
              onClick={() => setMode("coaching")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                mode === "coaching"
                  ? "bg-gold text-navy font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Coaching
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : mode === "riding" && profile.role_rider ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">My coach</h3>
            <Button
              size="sm"
              variant="outline"
              className="border-gold/30"
              disabled={inviting}
              onClick={() => invite("trainer")}
            >
              {inviting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-3.5 w-3.5" />
              )}
              Invite your trainer
            </Button>
          </div>
          {pendingForMode.length > 0 && (
            <PendingInvites invites={pendingForMode} />
          )}
          {asRider.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No coaches connected yet. Invite your trainer to share rides alongside them.
            </p>
          ) : (
            <ul className="space-y-3">
              {asRider.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 rounded-lg border border-gold/15 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {c.trainer?.display_name || "Coach"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{c.trainer?.username || "—"} · {c.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={c.share_scope}
                      onValueChange={(v) =>
                        updateConnection(c.id, {
                          share_scope: v as "all" | "shared_only",
                        })
                      }
                      disabled={c.status === "removed"}
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Sharing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All rides</SelectItem>
                        <SelectItem value="shared_only">Only what I share</SelectItem>
                      </SelectContent>
                    </Select>
                    {c.status !== "removed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => updateConnection(c.id, { status: "removed" })}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : profile.role_trainer ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">Rider roster</h3>
              <p className="text-xs text-muted-foreground">
                {rosterCount === 0
                  ? "No riders yet"
                  : rosterCount === 1
                    ? "1 rider"
                    : `${rosterCount} riders`}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-gold/30"
              disabled={inviting}
              onClick={() => invite("rider")}
            >
              {inviting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-3.5 w-3.5" />
              )}
              Invite a rider
            </Button>
          </div>

          {pendingForMode.length > 0 && (
            <PendingInvites invites={pendingForMode} />
          )}

          {asTrainer.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No riders on your roster yet. Send an invite to grow your coaching circle.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {asTrainer.map((c) => {
                const name = c.rider?.display_name || "Rider";
                const monogram = name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li
                    key={c.id}
                    className="rounded-lg border border-gold/15 p-3 space-y-2"
                  >
                    <Link
                      href={`/profile/coach/${c.rider_id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/25 bg-[#131C31] text-xs font-semibold text-gold">
                        {monogram}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium group-hover:text-gold transition-colors">
                          {name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{c.rider?.username || "—"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-0 text-destructive"
                      onClick={() => updateConnection(c.id, { status: "removed" })}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enable riding or coaching on your profile to manage connections.
        </p>
      )}
    </div>
  );
}

function PendingInvites({ invites }: { invites: InviteRow[] }) {
  return (
    <div className="rounded-lg border border-gold/15 bg-[#131C31]/60 p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/50">
        Pending invites
      </p>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {invites.map((i) => (
          <li key={i.id} className="flex justify-between gap-2">
            <span>
              Inviting a {i.invite_role} · code{" "}
              <span className="font-mono text-cream/70">{i.code}</span>
            </span>
            <span className="shrink-0 text-cream/40">open</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
