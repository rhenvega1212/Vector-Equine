import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Always send app root to login so "opening the app" shows login screen
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Public routes: shared debriefs + connection invites + guest capture join
  const publicPaths = ["/shared", "/invite", "/join", "/login", "/signup"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const nextWithPath = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    });

  let supabaseResponse = nextWithPath();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // No env: still redirect protected paths to login
    const protectedPaths = ["/feed", "/explore", "/profile", "/settings", "/admin", "/trainer", "/train"];
    if (!isPublicPath && protectedPaths.some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = nextWithPath();
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // Stale/invalid refresh cookies break the login loop — clear them.
    if (userError?.code === "refresh_token_not_found" || /Refresh Token Not Found/i.test(userError?.message || "")) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      if (!isPublicPath && pathname !== "/login") {
        url.pathname = "/login";
        url.search = "";
        const res = NextResponse.redirect(url);
        request.cookies.getAll().forEach((c) => {
          if (c.name.includes("auth") || c.name.startsWith("sb-")) {
            res.cookies.set(c.name, "", { maxAge: 0, path: "/" });
          }
        });
        return res;
      }
    }

    const protectedPaths = ["/feed", "/explore", "/profile", "/settings", "/admin", "/trainer", "/train"];
    const isProtectedPath =
      !isPublicPath &&
      protectedPaths.some((path) => pathname.startsWith(path));

    if (isProtectedPath && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Signed-in users leaving auth screens land on /train (not /invite or /shared)
    const authPaths = ["/login", "/signup"];
    const isAuthPath = authPaths.some((path) =>
      pathname.startsWith(path)
    );

    if (isAuthPath && user) {
      const claim = request.nextUrl.searchParams.get("claim");
      const redirectTo = request.nextUrl.searchParams.get("redirectTo");

      // Existing account opening a claim link from signup → finish claim on onboarding
      if (claim && pathname.startsWith("/signup")) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        url.search = `?claim=${encodeURIComponent(claim)}`;
        return NextResponse.redirect(url);
      }

      const safeRedirect =
        redirectTo &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//") &&
        (redirectTo.startsWith("/invite") ||
          redirectTo.startsWith("/shared") ||
          redirectTo.startsWith("/onboarding"))
          ? redirectTo
          : "/train";
      const url = request.nextUrl.clone();
      if (safeRedirect.startsWith("/onboarding")) {
        const [path, qs] = safeRedirect.split("?");
        url.pathname = path || "/onboarding";
        url.search = qs ? `?${qs}` : "";
      } else {
        url.pathname = safeRedirect.split("?")[0] || "/train";
        url.search = "";
      }
      return NextResponse.redirect(url);
    }

    // Hard gate: riders with zero horses stay on /train/setup until they add one.
    if (user && pathname.startsWith("/train")) {
      const { data: setupProfile } = await supabase
        .from("profiles")
        .select("role_rider, role_trainer, vector_setup_completed_at")
        .eq("id", user.id)
        .maybeSingle();

      let horseCount = 0;
      if (setupProfile?.role_rider) {
        const { count } = await supabase
          .from("horse_profiles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        horseCount = count ?? 0;
      }

      const needsSetup =
        !!setupProfile &&
        setupProfile.role_rider === true &&
        horseCount === 0;
      const onSetup = pathname.startsWith("/train/setup");

      if (needsSetup && !onSetup) {
        const url = request.nextUrl.clone();
        url.pathname = "/train/setup";
        url.search = "";
        return NextResponse.redirect(url);
      }

      if (setupProfile && !needsSetup && onSetup) {
        const url = request.nextUrl.clone();
        url.pathname = "/train";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  } catch {
    // On error, redirect root and protected paths to login so user always sees login when opening app
    const protectedPaths = ["/feed", "/explore", "/profile", "/settings", "/admin", "/trainer", "/train"];
    if (
      pathname === "/" ||
      (!isPublicPath && protectedPaths.some((p) => pathname.startsWith(p)))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
