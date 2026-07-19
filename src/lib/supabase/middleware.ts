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

  // Public routes: shared debriefs + connection invites (logged-out accept flow)
  const publicPaths = ["/shared", "/invite", "/login", "/signup"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // No env: still redirect protected paths to login
    const protectedPaths = ["/feed", "/explore", "/challenges", "/profile", "/settings", "/admin", "/trainer", "/train"];
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
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const protectedPaths = ["/feed", "/explore", "/challenges", "/profile", "/settings", "/admin", "/trainer", "/train"];
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
      const redirectTo = request.nextUrl.searchParams.get("redirectTo");
      const safeRedirect =
        redirectTo &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//") &&
        (redirectTo.startsWith("/invite") || redirectTo.startsWith("/shared"))
          ? redirectTo
          : "/train";
      const url = request.nextUrl.clone();
      url.pathname = safeRedirect.split("?")[0] || "/train";
      url.search = "";
      return NextResponse.redirect(url);
    }
  } catch {
    // On error, redirect root and protected paths to login so user always sees login when opening app
    const protectedPaths = ["/feed", "/explore", "/challenges", "/profile", "/settings", "/admin", "/trainer", "/train"];
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
