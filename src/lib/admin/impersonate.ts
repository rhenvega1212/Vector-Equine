import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const IMPERSONATE_COOKIE = "impersonate_user_id";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

/**
 * Get the effective user id for this request: the impersonated user if an admin
 * has set the cookie, otherwise the actual authenticated user.
 * Use this in API routes and server logic that should "act as" the current user.
 */
export async function getEffectiveUserId(request: NextRequest): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const impersonateId = request.cookies.get(IMPERSONATE_COOKIE)?.value;
  if (!impersonateId) return user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role?: string } | null };

  if (profile?.role !== "admin") return user.id;
  return impersonateId;
}

export function getImpersonateCookieName() {
  return IMPERSONATE_COOKIE;
}

export function buildImpersonateCookie(value: string) {
  return `${IMPERSONATE_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function buildClearImpersonateCookie() {
  return `${IMPERSONATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
