/**
 * Annotation persistence boundary.
 *
 * The store does optimistic CRUD (§6.4); persistence sits behind this
 * interface. v1 ships a localStorage-backed repo so the tool runs with zero
 * backend setup, but a Supabase/Postgres repo (matching the §3.2 tables) drops
 * in without touching the store or components.
 */
import type { Annotation } from "./types";

export interface AnnotationRepository {
  list(sessionId: string): Promise<Annotation[]>;
  create(annotation: Annotation): Promise<Annotation>;
  update(annotation: Annotation): Promise<Annotation>;
  remove(sessionId: string, annotationId: string): Promise<void>;
}

const STORAGE_PREFIX = "ve-annotations:";

/** Browser localStorage implementation. */
export class LocalStorageAnnotationRepository implements AnnotationRepository {
  private key(sessionId: string): string {
    return `${STORAGE_PREFIX}${sessionId}`;
  }

  private read(sessionId: string): Annotation[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(this.key(sessionId));
      return raw ? (JSON.parse(raw) as Annotation[]) : [];
    } catch {
      return [];
    }
  }

  private write(sessionId: string, annotations: Annotation[]): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.key(sessionId), JSON.stringify(annotations));
  }

  async list(sessionId: string): Promise<Annotation[]> {
    return this.read(sessionId).sort((a, b) => a.startMs - b.startMs);
  }

  async create(annotation: Annotation): Promise<Annotation> {
    const all = this.read(annotation.sessionId);
    all.push(annotation);
    this.write(annotation.sessionId, all);
    return annotation;
  }

  async update(annotation: Annotation): Promise<Annotation> {
    const all = this.read(annotation.sessionId);
    const idx = all.findIndex((a) => a.id === annotation.id);
    if (idx >= 0) all[idx] = annotation;
    else all.push(annotation);
    this.write(annotation.sessionId, all);
    return annotation;
  }

  async remove(sessionId: string, annotationId: string): Promise<void> {
    const all = this.read(sessionId).filter((a) => a.id !== annotationId);
    this.write(sessionId, all);
  }
}

export const defaultAnnotationRepository: AnnotationRepository =
  new LocalStorageAnnotationRepository();
