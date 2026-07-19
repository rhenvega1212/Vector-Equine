/**
 * Training-bundle exporter (§7, Phase 4).
 *
 * v1 builds the exporter, not the correction loop — there's no trained model
 * yet. Sequence: label here → export clean dataset → fine-tune offline.
 *
 * Per session we emit:
 *   meta.json          session, rider, discipline, taxonomy version, sync info,
 *                      full signal catalog (raw + derived)
 *   signals.csv        raw + derived, full-res, aligned t_ms (master clock)
 *   annotations.json   time ranges, target signal_ids, label_key+version, source
 *
 * Signal rows are emitted on the *master clock* (raw t + per-sensor offset from
 * the SyncProvider) so an annotation's time range ties directly to the exact
 * aligned sensor slice. `source`/`model_version` ship even though everything is
 * 'human' now — that's what future-proofs the correction loop for free (§7).
 */
import type { Annotation, Session, SignalSeries } from "../types";
import type { SyncProvider } from "../sync/provider";
import { seriesKey } from "../mock/generate";
import { CURRENT_TAXONOMY_VERSION } from "../taxonomy";

export interface ExportSignalRow {
  session_id: string;
  sensor_id: string;
  signal_id: string;
  signal_key: string;
  kind: string;
  /** aligned to master clock (raw t + sensor offset) */
  t_ms: number;
  value: number;
}

export interface ExportMeta {
  session_id: string;
  rider_id: string;
  discipline: string;
  recorded_at: string;
  session_start_epoch_ms: number;
  duration_ms: number;
  taxonomy_version: string;
  sync: {
    session_start_epoch_ms: number;
    sensor_offsets_ms: Record<string, number>;
  };
  signals: Array<{
    id: string;
    sensor_id: string;
    key: string;
    kind: string;
    unit: string;
    derived_from: unknown;
    placement: string;
    entity: string;
    sample_rate_hz: number;
  }>;
}

export interface ExportAnnotation {
  id: string;
  start_ms: number;
  end_ms: number;
  label_key: string;
  label_version: string;
  free_text: string | null;
  confidence: number | null;
  source: string;
  model_version: string | null;
  target_signal_ids: string[];
}

export interface ExportBundle {
  meta: ExportMeta;
  annotations: ExportAnnotation[];
  /** columnar signal rows (raw + derived, aligned) */
  signals: ExportSignalRow[];
}

export function buildExportBundle(
  session: Session,
  series: Map<string, SignalSeries>,
  annotations: Annotation[],
  sync: SyncProvider
): ExportBundle {
  const sensorOffsets: Record<string, number> = {};
  for (const sensor of session.sensors) {
    sensorOffsets[sensor.id] = sync.getSensorOffsetMs(sensor.id);
  }

  const meta: ExportMeta = {
    session_id: session.id,
    rider_id: session.riderId,
    discipline: session.discipline,
    recorded_at: session.recordedAt,
    session_start_epoch_ms: session.sessionStartEpochMs,
    duration_ms: session.durationMs,
    taxonomy_version: CURRENT_TAXONOMY_VERSION,
    sync: {
      session_start_epoch_ms: sync.getSessionTimeBase(session.id)
        .sessionStartEpochMs,
      sensor_offsets_ms: sensorOffsets,
    },
    signals: session.sensors.flatMap((sensor) =>
      sensor.signals.map((sig) => ({
        id: sig.id,
        sensor_id: sensor.id,
        key: sig.key,
        kind: sig.kind,
        unit: sig.unit,
        derived_from: sig.derivedFrom,
        placement: sensor.placement,
        entity: sensor.entity,
        sample_rate_hz: sensor.sampleRateHz,
      }))
    ),
  };

  const signals: ExportSignalRow[] = [];
  for (const sensor of session.sensors) {
    const offset = sync.getSensorOffsetMs(sensor.id);
    for (const sig of sensor.signals) {
      const s = series.get(seriesKey(sensor.id, sig.key));
      if (!s) continue;
      for (let i = 0; i < s.t.length; i++) {
        signals.push({
          session_id: session.id,
          sensor_id: sensor.id,
          signal_id: sig.id,
          signal_key: sig.key,
          kind: sig.kind,
          t_ms: s.t[i] + offset,
          value: s.v[i],
        });
      }
    }
  }

  const exportAnnotations: ExportAnnotation[] = annotations.map((a) => ({
    id: a.id,
    start_ms: a.startMs,
    end_ms: a.endMs,
    label_key: a.labelKey,
    label_version: a.labelVersion,
    free_text: a.freeText,
    confidence: a.confidence,
    source: a.source,
    model_version: a.modelVersion,
    target_signal_ids: a.targetSignalIds,
  }));

  return { meta, annotations: exportAnnotations, signals };
}

/** Serialize the columnar signals to CSV (the "signals.parquet" stand-in). */
export function signalsToCsv(rows: ExportSignalRow[]): string {
  const header = "session_id,sensor_id,signal_id,signal_key,kind,t_ms,value";
  const lines = rows.map(
    (r) =>
      `${r.session_id},${r.sensor_id},${r.signal_id},${r.signal_key},${r.kind},${r.t_ms},${r.value}`
  );
  return [header, ...lines].join("\n");
}

/**
 * Round-trip helper (§8 Phase 4): pull the signal rows that fall inside an
 * annotation's time range for its target signals. This is exactly the training
 * window a model consumes; a test asserts it matches the aligned sensor slice.
 */
export function extractTrainingWindow(
  bundle: ExportBundle,
  annotation: ExportAnnotation
): ExportSignalRow[] {
  const targets = new Set(annotation.target_signal_ids);
  return bundle.signals.filter(
    (r) =>
      targets.has(r.signal_id) &&
      r.t_ms >= annotation.start_ms &&
      r.t_ms <= annotation.end_ms
  );
}
