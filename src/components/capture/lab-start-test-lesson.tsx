"use client";

import Link from "next/link";

/**
 * Admin Lab — open Live in test mode (tagged is_test, hidden from product lists).
 */
export function LabStartTestLesson({ horseId }: { horseId?: string | null }) {
  const q = new URLSearchParams({ test: "1" });
  if (horseId) q.set("horseId", horseId);
  const href = `/train/ride/live?${q.toString()}`;

  return (
    <div className="space-y-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-gold">
        Test lesson
      </p>
      <p className="text-sm text-cream/75">
        Same Live room, bookends, and feel sheet — tagged{" "}
        <span className="text-gold">is_test</span> so it stays out of Last rides,
        coach lists, and averages. After Start, open the join code on a second
        phone to exercise claim.
      </p>
      <Link
        href={href}
        className="inline-flex min-h-[44px] items-center justify-center border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"
      >
        Start test lesson
      </Link>
    </div>
  );
}
