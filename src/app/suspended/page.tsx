import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { SuspensionAppeal } from "@/components/account/suspension-appeal";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile?.is_suspended) {
    redirect("/feed");
  }

  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-navy-deep p-4">
      <div className="w-full max-w-lg flex flex-col items-center">
        <Image
          src="/logo.png"
          alt="Vector Equine"
          width={120}
          height={120}
          priority
          className="mb-8 h-16 w-auto"
        />
        <div className="w-full rounded-xl border border-gold/15 bg-card p-6 shadow-2xl shadow-black/30">
          <h1 className="text-2xl font-serif text-foreground">
            Your account is suspended
          </h1>
          {profile.suspended_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              Suspended on {formatDate(profile.suspended_at)}
            </p>
          )}
          {profile.suspension_reason && (
            <div className="mt-4 rounded-lg border border-border bg-background/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reason
              </p>
              <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                {profile.suspension_reason}
              </p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            If you believe this was a mistake or would like it reviewed, message
            our team below. We&apos;ll get back to you here.
          </p>

          <div className="mt-6">
            <SuspensionAppeal currentUserId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
