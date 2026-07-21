"use client";

import dynamic from "next/dynamic";

const VectorRideChat = dynamic(
  () =>
    import("@/components/train/vector-ride-chat").then((m) => m.VectorRideChat),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-cream/40">Loading Ask Vector…</p>
    ),
  }
);

export function VectorRideChatLazy({
  sessionId,
  trainerName,
}: {
  sessionId: string;
  trainerName: string | null;
}) {
  return <VectorRideChat sessionId={sessionId} trainerName={trainerName} />;
}
