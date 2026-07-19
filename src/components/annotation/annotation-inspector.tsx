"use client";

/**
 * AnnotationInspector (§6.1): create/edit an annotation's label, signal targets
 * and notes. Two modes:
 *   - draft (a drag is in progress) → choose a label and commit
 *   - selection (an existing clip)  → edit or delete
 *
 * Labels come from the versioned taxonomy (§3.4) — structured enums, not free
 * text. Targets are many-to-many across sensors (§2.4). `source` is always
 * 'human' in v1 but shown, since it's what turns this into the correction tool.
 */
import { useEffect, useMemo, useState } from "react";
import { X, Trash2, Check, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnotationStore } from "@/lib/annotation/store";
import {
  labelsByCategory,
  CATEGORY_LABELS,
  getLabelForVersion,
  type LabelCategory,
} from "@/lib/annotation/taxonomy";
import { formatMs, formatDurationMs, formatPlacement } from "@/lib/annotation/format";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: LabelCategory[] = [
  "aid",
  "execution",
  "timing",
  "gait",
  "fault",
  "note",
];

interface FormState {
  labelKey: string;
  category: LabelCategory;
  startMs: number;
  endMs: number;
  targetSignalIds: string[];
  freeText: string;
  confidence: string;
}

export function AnnotationInspector() {
  const session = useAnnotationStore((s) => s.session);
  const draft = useAnnotationStore((s) => s.draft);
  const selectionId = useAnnotationStore((s) => s.selectionId);
  const annotations = useAnnotationStore((s) => s.annotations);
  const currentMs = useAnnotationStore((s) => s.currentMs);

  const createAnnotation = useAnnotationStore((s) => s.createAnnotation);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const cancelDraft = useAnnotationStore((s) => s.cancelDraft);
  const beginDraft = useAnnotationStore((s) => s.beginDraft);
  const select = useAnnotationStore((s) => s.select);
  const requestSeek = useAnnotationStore((s) => s.requestSeek);

  const selected = annotations.find((a) => a.id === selectionId) ?? null;
  const mode: "draft" | "edit" | "empty" = draft
    ? "draft"
    : selected
      ? "edit"
      : "empty";

  const labelCatalog = useMemo(() => labelsByCategory(), []);
  const [showTargets, setShowTargets] = useState(false);
  const [form, setForm] = useState<FormState>({
    labelKey: "",
    category: "aid",
    startMs: 0,
    endMs: 0,
    targetSignalIds: [],
    freeText: "",
    confidence: "",
  });

  // sync form to the active draft/selection
  useEffect(() => {
    if (draft) {
      setForm((f) => ({
        ...f,
        labelKey: "",
        startMs: Math.min(draft.startMs, draft.endMs),
        endMs: Math.max(draft.startMs, draft.endMs),
        targetSignalIds: draft.targetSignalIds,
        freeText: "",
        confidence: "",
      }));
    } else if (selected) {
      const def = getLabelForVersion(selected.labelVersion, selected.labelKey);
      setForm({
        labelKey: selected.labelKey,
        category: (def?.category ?? "note") as LabelCategory,
        startMs: selected.startMs,
        endMs: selected.endMs,
        targetSignalIds: selected.targetSignalIds,
        freeText: selected.freeText ?? "",
        confidence: selected.confidence != null ? String(selected.confidence) : "",
      });
    }
  }, [draft, selected]);

  if (!session) return null;

  const signalById = new Map(
    session.sensors.flatMap((sensor) =>
      sensor.signals.map((sig) => [sig.id, { sensor, sig }] as const)
    )
  );

  function toggleTarget(id: string) {
    setForm((f) => ({
      ...f,
      targetSignalIds: f.targetSignalIds.includes(id)
        ? f.targetSignalIds.filter((x) => x !== id)
        : [...f.targetSignalIds, id],
    }));
  }

  function addSensorTargets(sensorId: string) {
    const s = session!.sensors.find((x) => x.id === sensorId);
    if (!s) return;
    setForm((f) => ({
      ...f,
      targetSignalIds: Array.from(
        new Set([...f.targetSignalIds, ...s.signals.map((sig) => sig.id)])
      ),
    }));
  }

  async function handleCommit() {
    if (!form.labelKey) return;
    if (mode === "draft") {
      await createAnnotation({
        startMs: form.startMs,
        endMs: form.endMs,
        labelKey: form.labelKey,
        targetSignalIds: form.targetSignalIds,
        freeText: form.freeText || null,
        confidence: form.confidence ? Number(form.confidence) : null,
      });
    } else if (mode === "edit" && selected) {
      await updateAnnotation(selected.id, {
        startMs: form.startMs,
        endMs: form.endMs,
        labelKey: form.labelKey,
        labelVersion: selected.labelVersion,
        targetSignalIds: form.targetSignalIds,
        freeText: form.freeText || null,
        confidence: form.confidence ? Number(form.confidence) : null,
      });
    }
  }

  const isPoint = form.endMs <= form.startMs;

  return (
    <div className="flex h-full flex-col rounded-lg border border-white/10 bg-navy">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h3 className="text-sm font-semibold">
          {mode === "draft"
            ? "New annotation"
            : mode === "edit"
              ? "Edit annotation"
              : "Inspector"}
        </h3>
        {mode !== "empty" && (
          <button
            onClick={() => (mode === "draft" ? cancelDraft() : select(null))}
            className="rounded p-1 text-muted-foreground hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {mode === "empty" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Select an annotation to edit, or drag across a signal track to create
            one.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => beginDraft(currentMs, [])}
          >
            New at playhead ({formatMs(currentMs, true)})
          </Button>
        </div>
      )}

      {mode !== "empty" && (
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          {/* time range */}
          <div className="grid grid-cols-2 gap-2">
            <TimeField
              label="Start"
              valueMs={form.startMs}
              onChange={(ms) => setForm((f) => ({ ...f, startMs: ms }))}
              onSeek={() => requestSeek(form.startMs)}
              onSetToPlayhead={() =>
                setForm((f) => ({ ...f, startMs: Math.round(currentMs) }))
              }
            />
            <TimeField
              label="End"
              valueMs={form.endMs}
              onChange={(ms) => setForm((f) => ({ ...f, endMs: ms }))}
              onSeek={() => requestSeek(form.endMs)}
              onSetToPlayhead={() =>
                setForm((f) => ({ ...f, endMs: Math.round(currentMs) }))
              }
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isPoint
              ? "Point event (start = end)"
              : `Range · ${formatDurationMs(form.endMs - form.startMs)}`}
          </p>

          {/* label picker */}
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Label
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    form.category === cat
                      ? "bg-gold text-navy"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {labelCatalog[form.category].map((l) => (
                <button
                  key={l.key}
                  onClick={() => setForm((f) => ({ ...f, labelKey: l.key }))}
                  title={l.description}
                  className={cn(
                    "rounded border px-2 py-1 text-[11px]",
                    form.labelKey === l.key
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/10 text-foreground hover:bg-white/10"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* targets */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Target signals · {form.targetSignalIds.length}
              </span>
              <button
                onClick={() => setShowTargets((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-gold hover:underline"
              >
                <Layers className="h-3 w-3" />
                {showTargets ? "Done" : "Edit"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.targetSignalIds.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  No targets — annotation is time-only.
                </span>
              )}
              {form.targetSignalIds.map((id) => {
                const entry = signalById.get(id);
                if (!entry) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px]"
                  >
                    {formatPlacement(entry.sensor.placement)}·{entry.sig.key}
                    <button onClick={() => toggleTarget(id)} aria-label="Remove target">
                      <X className="h-3 w-3 text-muted-foreground hover:text-rose-400" />
                    </button>
                  </span>
                );
              })}
            </div>

            {showTargets && (
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded border border-white/10 p-2">
                {session.sensors.map((sensor) => (
                  <div key={sensor.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-medium">
                        {formatPlacement(sensor.placement)}
                      </span>
                      <button
                        onClick={() => addSensorTargets(sensor.id)}
                        className="text-[10px] text-gold hover:underline"
                      >
                        + all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sensor.signals.map((sig) => (
                        <button
                          key={sig.id}
                          onClick={() => toggleTarget(sig.id)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            form.targetSignalIds.includes(sig.id)
                              ? "bg-gold/20 text-gold"
                              : "bg-white/5 text-muted-foreground hover:bg-white/10"
                          )}
                        >
                          {sig.key}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* free text (supplementary note only, §3.4) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Note (optional)
            </label>
            <textarea
              value={form.freeText}
              onChange={(e) => setForm((f) => ({ ...f, freeText: e.target.value }))}
              rows={2}
              placeholder="Supplementary note — not the primary label."
              className="w-full rounded border border-white/10 bg-black/20 px-2 py-1 text-xs outline-none focus:border-gold/50"
            />
          </div>

          {mode === "edit" && selected && (
            <div className="rounded border border-white/5 bg-white/[0.02] p-2 text-[10px] text-muted-foreground">
              source: <span className="text-foreground">{selected.source}</span>
              {selected.modelVersion ? ` · model ${selected.modelVersion}` : ""} ·{" "}
              {selected.labelVersion}
            </div>
          )}
        </div>
      )}

      {mode !== "empty" && (
        <div className="flex items-center gap-2 border-t border-white/10 p-3">
          <Button
            onClick={handleCommit}
            disabled={!form.labelKey}
            className="flex-1 bg-gold text-navy hover:bg-gold/90"
            size="sm"
          >
            <Check className="mr-1 h-4 w-4" />
            {mode === "draft" ? "Create" : "Save"}
          </Button>
          {mode === "edit" && selected && (
            <Button
              variant="outline"
              size="sm"
              className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              onClick={() => deleteAnnotation(selected.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TimeField({
  label,
  valueMs,
  onChange,
  onSeek,
  onSetToPlayhead,
}: {
  label: string;
  valueMs: number;
  onChange: (ms: number) => void;
  onSeek: () => void;
  onSetToPlayhead: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex gap-1">
          <button
            onClick={onSetToPlayhead}
            className="text-[10px] text-gold hover:underline"
            title="Set to playhead"
          >
            ⤓
          </button>
          <button
            onClick={onSeek}
            className="text-[10px] text-gold hover:underline"
            title="Seek here"
          >
            →
          </button>
        </div>
      </div>
      <input
        type="number"
        value={Math.round(valueMs)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-white/10 bg-black/20 px-2 py-1 font-mono text-xs outline-none focus:border-gold/50"
      />
      <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
        {formatMs(valueMs)}
      </div>
    </div>
  );
}
