"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = {
  error: string | null;
};

function safeRedirectPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "/train";
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    (value.startsWith("/invite") ||
      value.startsWith("/shared") ||
      value.startsWith("/train") ||
      value === "/")
  ) {
    return value === "/" ? "/train" : value.split("?")[0] || "/train";
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return { error: "Sign-in succeeded but no session was created. Please try again." };
  }

  redirect(safeRedirectPath(formData.get("redirectTo")));
}
