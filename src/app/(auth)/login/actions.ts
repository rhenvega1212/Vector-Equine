"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = {
  error: string | null;
};

function safeRedirectPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "/train";
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/train";
  }
  if (
    value.startsWith("/invite") ||
    value.startsWith("/shared") ||
    value.startsWith("/train") ||
    value.startsWith("/onboarding") ||
    value === "/"
  ) {
    if (value === "/") return "/train";
    // Keep ?claim= on onboarding redirects
    if (value.startsWith("/onboarding")) return value;
    return value.split("?")[0] || "/train";
  }
  return "/train";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { error: first || "Please check your email and password." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      const msg = error.message || "Could not sign in.";
      if (/fetch|network|failed to fetch/i.test(msg)) {
        return { error: "Can't reach the project. Check the connection and try again." };
      }
      return { error: msg };
    }

    if (!data.session) {
      return { error: "Sign-in succeeded but no session was created. Please try again." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not sign in.";
    if (/URL and API key are required|keys are not loaded/i.test(msg)) {
      return { error: "Can't reach the project. Restart the local server and try again." };
    }
    return { error: msg };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("redirectTo")));
}
