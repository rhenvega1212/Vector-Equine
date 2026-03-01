"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const threshold = 80;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 120));
    } else {
      pulling.current = false;
      setPullDistance(0);
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 || isRefreshing ? pullDistance : 0 }}
      >
        <Loader2
          className={`h-6 w-6 text-cyan-400 transition-transform ${
            isRefreshing ? "animate-spin" : ""
          }`}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${(pullDistance / threshold) * 360}deg)`,
            opacity: Math.min(pullDistance / threshold, 1),
          }}
        />
      </div>
      {children}
    </div>
  );
}
