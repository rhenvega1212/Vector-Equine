"use client";

import { useEffect } from "react";

/** Paint navy under the status bar so cream body never shows on /join. */
export function JoinShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#0E1729";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  return (
    <div
      className="dark min-h-[100dvh] bg-navy text-cream"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-4 py-6">
        {children}
      </div>
    </div>
  );
}
