import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getImpersonateCookieName } from "@/lib/admin/impersonate";
import type { Profile } from "@/types/database";

export interface CurrentProfileResult {
  user: User | null;
  /** Effective profile — the impersonated target when an admin is impersonating. */
  profile: Profile | null;
  isImpersonating: boolean;
}

/**
 * Single source of truth for "who is the current viewer" in server components.
 * Cached per request so nested layouts don't re-hit auth + profiles.
 */
export const getCurrentProfile = cache(
  async (): Promise<CurrentProfileResult> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { user: null, profile: null, isImpersonating: false };
      }

      const { data: myProfile } = (await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()) as { data: Profile | null };

      let profile = myProfile;
      let isImpersonating = false;

      const cookieStore = await cookies();
      const impersonateId = cookieStore.get(getImpersonateCookieName())?.value;
      if (
        impersonateId &&
        myProfile?.role === "admin" &&
        impersonateId !== user.id
      ) {
        const { data: targetProfile } = (await supabase
          .from("profiles")
          .select("*")
          .eq("id", impersonateId)
          .single()) as { data: Profile | null };
        if (targetProfile?.username) {
          profile = targetProfile;
          isImpersonating = true;
        }
      }

      return { user, profile, isImpersonating };
    } catch (e) {
      console.error("getCurrentProfile failed", e);
      return { user: null, profile: null, isImpersonating: false };
    }
  }
);
