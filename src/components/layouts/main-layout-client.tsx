"use client";

import { useState, useEffect } from "react";
import { MainNav } from "@/components/shared/main-nav";
import { MobileNav } from "@/components/shared/mobile-nav";
import { LoadingScreen } from "@/components/shared/loading-screen";

export function MainLayoutClient({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: any;
}) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Show loading screen for 2 seconds to showcase the flipping logo animation
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav profile={profile} />
      <main 
        className="container mx-auto px-4 py-4 sm:py-6 md:pb-6"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
