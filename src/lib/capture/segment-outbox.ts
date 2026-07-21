/**
 * Durable transcript outbox for flaky barn WiFi.
 * Keeps failed/in-flight segment POSTs in memory + sessionStorage and flushes with backoff.
 */

export type OutboxSegment = {
  client_id: string;
  offset_ms: number;
  ended_offset_ms?: number | null;
  speaker: "rider" | "trainer" | "system";
  text: string;
  confidence?: number | null;
};

export type SavedSegment = {
  id?: string;
  client_id?: string | null;
  offset_ms: number;
  speaker: "rider" | "trainer" | "system";
  text: string;
};

type PostBatch = (
  segments: OutboxSegment[]
) => Promise<{ ok: boolean; segments?: SavedSegment[] }>;

type OutboxOptions = {
  captureSessionId: string;
  post: PostBatch;
  onQueueChange?: (pending: number) => void;
  onSaved?: (segments: SavedSegment[]) => void;
  maxBatch?: number;
};

function storageKey(captureSessionId: string) {
  return `ve-segment-outbox:${captureSessionId}`;
}

function loadStored(captureSessionId: string): OutboxSegment[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(captureSessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxSegment[];
    return Array.isArray(parsed) ? parsed.filter((s) => s?.client_id && s?.text) : [];
  } catch {
    return [];
  }
}

function saveStored(captureSessionId: string, items: OutboxSegment[]) {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (items.length === 0) {
      sessionStorage.removeItem(storageKey(captureSessionId));
    } else {
      sessionStorage.setItem(storageKey(captureSessionId), JSON.stringify(items));
    }
  } catch {
    /* quota / private mode */
  }
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSegmentOutbox(opts: OutboxOptions) {
  const maxBatch = opts.maxBatch ?? 20;
  let queue: OutboxSegment[] = loadStored(opts.captureSessionId);
  let flushing = false;
  let timer: number | null = null;
  let attempt = 0;
  let destroyed = false;

  const notify = () => opts.onQueueChange?.(queue.length);

  const persist = () => {
    saveStored(opts.captureSessionId, queue);
    notify();
  };

  // Deduplicate by client_id when hydrating
  {
    const seen = new Set<string>();
    queue = queue.filter((s) => {
      if (seen.has(s.client_id)) return false;
      seen.add(s.client_id);
      return true;
    });
    persist();
  }

  function scheduleFlush(delayMs?: number) {
    if (destroyed || timer != null) return;
    const delay =
      delayMs ??
      Math.min(15000, 500 * Math.pow(2, Math.min(attempt, 5)));
    timer = window.setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  }

  async function flush(options?: { timeoutMs?: number }): Promise<{
    pending: number;
    ok: boolean;
  }> {
    if (destroyed) return { pending: queue.length, ok: queue.length === 0 };
    if (flushing) {
      // Wait briefly for in-flight flush
      const start = Date.now();
      const timeout = options?.timeoutMs ?? 8000;
      while (flushing && Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return { pending: queue.length, ok: queue.length === 0 };
    }
    if (queue.length === 0) return { pending: 0, ok: true };

    flushing = true;
    const deadline = Date.now() + (options?.timeoutMs ?? 12000);
    let ok = true;

    try {
      while (queue.length > 0 && Date.now() < deadline) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          ok = false;
          break;
        }
        const batch = queue.slice(0, maxBatch);
        const result = await opts.post(batch);
        if (!result.ok) {
          ok = false;
          attempt += 1;
          break;
        }
        const savedIds = new Set(
          (result.segments || [])
            .map((s) => s.client_id)
            .filter((id): id is string => !!id)
        );
        // Drop posted items (all in batch) — server idempotency handles dupes
        const posted = new Set(batch.map((s) => s.client_id));
        queue = queue.filter((s) => !posted.has(s.client_id));
        persist();
        if (result.segments?.length) opts.onSaved?.(result.segments);
        // If server didn't echo client_ids, still cleared by posted set
        void savedIds;
        attempt = 0;
      }
    } catch {
      ok = false;
      attempt += 1;
    } finally {
      flushing = false;
    }

    if (queue.length > 0) {
      ok = false;
      scheduleFlush();
    }
    return { pending: queue.length, ok: ok && queue.length === 0 };
  }

  function enqueue(segment: OutboxSegment) {
    if (destroyed) return;
    if (queue.some((s) => s.client_id === segment.client_id)) return;
    queue.push(segment);
    persist();
    // Immediate flush when online; otherwise wait for online event
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      scheduleFlush(0);
    }
  }

  function pendingCount() {
    return queue.length;
  }

  function destroy() {
    destroyed = true;
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  return {
    enqueue,
    flush,
    pendingCount,
    destroy,
    /** Force an immediate flush attempt (e.g. on online / reconnected). */
    kick: () => {
      attempt = 0;
      scheduleFlush(0);
    },
  };
}

export type SegmentOutbox = ReturnType<typeof createSegmentOutbox>;
