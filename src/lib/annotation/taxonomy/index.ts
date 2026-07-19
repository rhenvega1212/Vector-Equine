/**
 * Taxonomy entry point. Import from here so callers don't hardcode a version.
 * When a v2 ships, resolve by version rather than swapping the import.
 */
export * from "./v1";
import { TAXONOMY_VERSION, LABELS_V1, getLabel, type LabelDef } from "./v1";

const REGISTRY: Record<string, readonly LabelDef[]> = {
  [TAXONOMY_VERSION]: LABELS_V1,
};

export function getLabelForVersion(
  version: string,
  key: string
): LabelDef | undefined {
  if (version === TAXONOMY_VERSION) return getLabel(key);
  const labels = REGISTRY[version];
  return labels?.find((l) => l.key === key);
}

export const CURRENT_TAXONOMY_VERSION = TAXONOMY_VERSION;
