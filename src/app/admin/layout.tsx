import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Users,
  Flag,
  Trophy,
  ArrowLeft,
  LayoutDashboard,
  Shield,
} from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: any };

  if (profile?.role !== "admin") {
    redirect("/feed");
  }

  const navItems = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/reports", label: "Reports", icon: Flag },
    { href: "/admin/challenges", label: "Challenges", icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/feed">
              <Button variant="ghost" size="sm" className="gap-1 sm:gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to App</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-base sm:text-lg font-semibold magical-text">Admin Panel</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation - Horizontal Scrolling */}
      <div className="md:hidden border-b bg-background sticky top-[57px] z-40">
        <nav className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 whitespace-nowrap touch-target"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block md:w-64 shrink-0">
            <nav className="space-y-1 sticky top-[80px]">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
