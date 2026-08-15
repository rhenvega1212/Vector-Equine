/**
 * Play Vector bookend / turn audio in the capture room (local mix).
 */
export async function playVectorAudio(
  captureSessionId: string,
  body: {
    kind: "open" | "close";
    riderFirst?: string | null;
    trainerFirst?: string | null;
    offsetMs?: number;
  },
  authHeaders: () => HeadersInit
): Promise<{ text: string; played: boolean }> {
  try {
    const res = await fetch(
      `/api/capture/sessions/${captureSessionId}/vector/speak`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      }
    );

    const headerText = res.headers.get("X-Vector-Text");
    const text = headerText
      ? decodeURIComponent(headerText)
      : body.kind === "close"
        ? "That's it — capture's off."
        : "";

    if (!res.ok) {
      return { text, played: false };
    }

    const ct = res.headers.get("Content-Type") || "";
    if (!ct.includes("audio")) {
      const json = await res.json().catch(() => ({}));
      return { text: (json as { text?: string }).text || text, played: false };
    }

    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      return { text, played: true };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { text: "", played: false };
  }
}
