"use client";

import Image from "next/image";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Background magical glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      
      <div className="relative flex flex-col items-center gap-8">
        <div className="relative w-32 h-32 animate-flip-horizontal">
          <Image
            src="/logo.png"
            alt="Equinti Logo"
            fill
            className="object-contain drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]"
            priority
          />
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold tracking-widest magical-text uppercase">
            Equinti
          </h2>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
          </div>
        </div>
      </div>
      
      {/* Bottom text */}
      <div className="absolute bottom-12 text-muted-foreground text-xs tracking-[0.4em] uppercase font-medium">
        Connect • Learn • Compete
      </div>
    </div>
  );
}
