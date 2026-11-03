export const SELECTION_STORAGE_KEY = 'uspa-monthly-selection-v1';
export const MAX_SAVED_LISTINGS = 4;

export function normalizeSelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string' || candidate.length < 1 || candidate.length > 128) continue;
    if (ids.includes(candidate)) continue;
    ids.push(candidate);
    if (ids.length === MAX_SAVED_LISTINGS) break;
  }
  return ids;
}

export function parseSelection(serialized: string | null): string[] {
  if (!serialized) return [];
  try {
    return normalizeSelection(JSON.parse(serialized));
  } catch {
    return [];
  }
}

export function serializeSelection(ids: unknown): string {
  return JSON.stringify(normalizeSelection(ids));
}

export function toggleSelection(current: string[], id: string): { ids: string[]; saved: boolean; limitReached: boolean } {
  if (!id || id.length > 128) return { ids: current, saved: false, limitReached: false };
  if (current.includes(id)) return { ids: current.filter(value => value !== id), saved: false, limitReached: false };
  if (current.length >= MAX_SAVED_LISTINGS) return { ids: current, saved: false, limitReached: true };
  return { ids: [...current, id], saved: true, limitReached: false };
}
