/**
 * Single Zustand store for the annotation workspace (§6.4).
 *
 * Clock propagation (§6.2): the VideoPlayer owns the <video> element and pushes
 * currentMs here once per animation frame. Playhead, tracks and the annotation
 * lane *read* currentMs from the store — nothing else tracks time. Seeking is
 * one-directional: UI sets video time → store updates → everything follows.
 *
 * Annotation CRUD is optimistic; the repository persists behind it.
 */
"use client";

import { create } from "zustand";
import type { Annotation, AnnotationSource, Session, SignalSeries } from "./types";
import {
  defaultAnnotationRepository,
  type AnnotationRepository,
} from "./repository";
import { TrivialSyncProvider } from "./sync/provider";
import { CURRENT_TAXONOMY_VERSION } from "./taxonomy";

export interface VisibleWindow {
  startMs: number;
  endMs: number;
}

export interface AnnotationDraft {
  startMs: number;
  endMs: number;
  targetSignalIds: string[];
}

interface SensorLayout {
  expanded: boolean;
}

interface AnnotationState {
  // --- session context (set once per session) ---
  session: Session | null;
  series: Map<string, SignalSeries>;
  sync: TrivialSyncProvider | null;
  repo: AnnotationRepository;
  authorId: string;

  // --- master clock ---
  currentMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  /** the UI's request to seek the <video>; VideoPlayer consumes + clears it */
  seekRequestMs: number | null;

  // --- viewport ---
  visibleWindow: VisibleWindow;

  // --- annotations ---
  annotations: Annotation[];
  selectionId: string | null;
  draft: AnnotationDraft | null;

  // --- layout ---
  sensorLayout: Record<string, SensorLayout>;
  focusSignalIds: string[] | null;
  perSensorNudgeMs: Record<string, number>;

  // --- actions ---
  initSession: (
    session: Session,
    series: Map<string, SignalSeries>,
    authorId: string,
    repo?: AnnotationRepository
  ) => void;
  setCurrentMs: (ms: number) => void;
  requestSeek: (ms: number) => void;
  consumeSeek: () => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setPlaybackRate: (rate: number) => void;
  setDuration: (ms: number) => void;

  setVisibleWindow: (win: VisibleWindow) => void;
  zoom: (factor: number, anchorMs?: number) => void;
  pan: (deltaMs: number) => void;

  loadAnnotations: () => Promise<void>;
  beginDraft: (startMs: number, targetSignalIds: string[]) => void;
  updateDraft: (patch: Partial<AnnotationDraft>) => void;
  cancelDraft: () => void;
  commitDraft: (labelKey: string) => Promise<void>;
  createAnnotation: (input: NewAnnotationInput) => Promise<Annotation>;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  select: (id: string | null) => void;

  toggleSensor: (sensorId: string) => void;
  setSensorExpanded: (sensorId: string, expanded: boolean) => void;
  setFocus: (signalIds: string[] | null) => void;
  nudgeSensor: (sensorId: string, deltaMs: number) => void;
  setSensorNudge: (sensorId: string, ms: number) => void;
}

export interface NewAnnotationInput {
  startMs: number;
  endMs: number;
  labelKey: string;
  labelVersion?: string;
  targetSignalIds: string[];
  freeText?: string | null;
  confidence?: number | null;
  source?: AnnotationSource;
  modelVersion?: string | null;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `anno-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clampWindow(win: VisibleWindow, durationMs: number): VisibleWindow {
  const minSpan = 200; // never zoom past 200ms
  let span = Math.max(minSpan, win.endMs - win.startMs);
  span = Math.min(span, durationMs || span);
  let start = win.startMs;
  if (start < 0) start = 0;
  if (start + span > durationMs) start = Math.max(0, durationMs - span);
  return { startMs: start, endMs: start + span };
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  session: null,
  series: new Map(),
  sync: null,
  repo: defaultAnnotationRepository,
  authorId: "rider-demo",

  currentMs: 0,
  durationMs: 0,
  isPlaying: false,
  playbackRate: 1,
  seekRequestMs: null,

  visibleWindow: { startMs: 0, endMs: 60_000 },

  annotations: [],
  selectionId: null,
  draft: null,

  sensorLayout: {},
  focusSignalIds: null,
  perSensorNudgeMs: {},

  initSession: (session, series, authorId, repo) => {
    const sync = new TrivialSyncProvider(session);
    const sensorLayout: Record<string, SensorLayout> = {};
    session.sensors.forEach((s, i) => {
      sensorLayout[s.id] = { expanded: i === 0 }; // first sensor open by default
    });
    set({
      session,
      series,
      sync,
      authorId,
      repo: repo ?? get().repo,
      durationMs: session.durationMs,
      currentMs: 0,
      visibleWindow: { startMs: 0, endMs: session.durationMs },
      sensorLayout,
      perSensorNudgeMs: {},
      annotations: [],
      selectionId: null,
      draft: null,
      focusSignalIds: null,
    });
  },

  setCurrentMs: (ms) => set({ currentMs: ms }),
  requestSeek: (ms) => set({ seekRequestMs: Math.max(0, ms) }),
  consumeSeek: () => set({ seekRequestMs: null }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setDuration: (ms) => {
    const { visibleWindow } = get();
    const win =
      visibleWindow.endMs <= visibleWindow.startMs || visibleWindow.endMs > ms
        ? { startMs: 0, endMs: ms }
        : visibleWindow;
    set({ durationMs: ms, visibleWindow: clampWindow(win, ms) });
  },

  setVisibleWindow: (win) =>
    set((s) => ({ visibleWindow: clampWindow(win, s.durationMs) })),

  zoom: (factor, anchorMs) => {
    const { visibleWindow, durationMs, currentMs } = get();
    const span = visibleWindow.endMs - visibleWindow.startMs;
    const anchor = anchorMs ?? currentMs;
    const rel = span > 0 ? (anchor - visibleWindow.startMs) / span : 0.5;
    const newSpan = span * factor;
    const start = anchor - rel * newSpan;
    set({
      visibleWindow: clampWindow(
        { startMs: start, endMs: start + newSpan },
        durationMs
      ),
    });
  },

  pan: (deltaMs) => {
    const { visibleWindow, durationMs } = get();
    set({
      visibleWindow: clampWindow(
        {
          startMs: visibleWindow.startMs + deltaMs,
          endMs: visibleWindow.endMs + deltaMs,
        },
        durationMs
      ),
    });
  },

  loadAnnotations: async () => {
    const { session, repo } = get();
    if (!session) return;
    const annotations = await repo.list(session.id);
    set({ annotations });
  },

  beginDraft: (startMs, targetSignalIds) =>
    set({ draft: { startMs, endMs: startMs, targetSignalIds }, selectionId: null }),

  updateDraft: (patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : {})),

  cancelDraft: () => set({ draft: null }),

  commitDraft: async (labelKey) => {
    const { draft } = get();
    if (!draft) return;
    const start = Math.min(draft.startMs, draft.endMs);
    const end = Math.max(draft.startMs, draft.endMs);
    await get().createAnnotation({
      startMs: start,
      endMs: end,
      labelKey,
      targetSignalIds: draft.targetSignalIds,
    });
    set({ draft: null });
  },

  createAnnotation: async (input) => {
    const { session, repo, authorId } = get();
    if (!session) throw new Error("No session loaded");
    const now = new Date().toISOString();
    const annotation: Annotation = {
      id: newId(),
      sessionId: session.id,
      authorId,
      startMs: Math.round(input.startMs),
      endMs: Math.round(input.endMs),
      labelKey: input.labelKey,
      labelVersion: input.labelVersion ?? CURRENT_TAXONOMY_VERSION,
      freeText: input.freeText ?? null,
      confidence: input.confidence ?? null,
      source: input.source ?? "human",
      modelVersion: input.modelVersion ?? null,
      targetSignalIds: input.targetSignalIds,
      createdAt: now,
      updatedAt: now,
    };
    // optimistic insert
    set((s) => ({
      annotations: [...s.annotations, annotation].sort(
        (a, b) => a.startMs - b.startMs
      ),
      selectionId: annotation.id,
    }));
    try {
      await repo.create(annotation);
    } catch (e) {
      set((s) => ({
        annotations: s.annotations.filter((a) => a.id !== annotation.id),
      }));
      throw e;
    }
    return annotation;
  },

  updateAnnotation: async (id, patch) => {
    const { repo, annotations } = get();
    const prev = annotations.find((a) => a.id === id);
    if (!prev) return;
    const next: Annotation = {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({
      annotations: s.annotations
        .map((a) => (a.id === id ? next : a))
        .sort((a, b) => a.startMs - b.startMs),
    }));
    try {
      await repo.update(next);
    } catch (e) {
      set((s) => ({
        annotations: s.annotations.map((a) => (a.id === id ? prev : a)),
      }));
      throw e;
    }
  },

  deleteAnnotation: async (id) => {
    const { session, repo, annotations } = get();
    if (!session) return;
    const prev = annotations.find((a) => a.id === id);
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectionId: s.selectionId === id ? null : s.selectionId,
    }));
    try {
      await repo.remove(session.id, id);
    } catch (e) {
      if (prev) set((s) => ({ annotations: [...s.annotations, prev] }));
      throw e;
    }
  },

  select: (id) => set({ selectionId: id, draft: null }),

  toggleSensor: (sensorId) =>
    set((s) => ({
      sensorLayout: {
        ...s.sensorLayout,
        [sensorId]: {
          expanded: !(s.sensorLayout[sensorId]?.expanded ?? false),
        },
      },
    })),

  setSensorExpanded: (sensorId, expanded) =>
    set((s) => ({
      sensorLayout: { ...s.sensorLayout, [sensorId]: { expanded } },
    })),

  setFocus: (signalIds) => set({ focusSignalIds: signalIds }),

  nudgeSensor: (sensorId, deltaMs) => {
    const { sync, perSensorNudgeMs } = get();
    const next = (perSensorNudgeMs[sensorId] ?? 0) + deltaMs;
    sync?.setNudge(sensorId, next);
    set({ perSensorNudgeMs: { ...perSensorNudgeMs, [sensorId]: next } });
  },

  setSensorNudge: (sensorId, ms) => {
    const { sync, perSensorNudgeMs } = get();
    sync?.setNudge(sensorId, ms);
    set({ perSensorNudgeMs: { ...perSensorNudgeMs, [sensorId]: ms } });
  },
}));

/** Read a full-resolution series from the store by sensor + signal key. */
export function selectSeries(
  state: AnnotationState,
  sensorId: string,
  signalKey: string
): SignalSeries | undefined {
  return state.series.get(`${sensorId}:${signalKey}`);
}
