export type TextSegment = {
  text: string;
  turnId?: string;
  speakerLabel?: string | null;
  createdAt?: string;
};

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Collapses cumulative prefix chains (e.g. "E", "E aí", "E aí eu") into the longest segment.
 */
export function collapsePrefixDuplicateSegments<T extends TextSegment>(
  segments: T[]
): T[] {
  if (segments.length <= 1) return segments;

  const result: T[] = [];
  for (const segment of segments) {
    const norm = normalizeText(segment.text);
    if (!norm) continue;

    if (result.length === 0) {
      result.push(segment);
      continue;
    }

    const last = result[result.length - 1];
    const lastNorm = normalizeText(last.text);

    if (norm === lastNorm) continue;

    if (norm.startsWith(lastNorm) || lastNorm.startsWith(norm)) {
      if (norm.length >= lastNorm.length) {
        result[result.length - 1] = segment;
      }
      continue;
    }

    result.push(segment);
  }

  return result;
}

const FINAL_DEDUPE_WINDOW_MS = 5000;

/**
 * Merges a new final segment, replacing the last one when it is a prefix extension of the same turn.
 */
export function mergeFinalSegment<T extends TextSegment>(
  prev: T[],
  segment: T
): T[] {
  const norm = normalizeText(segment.text);
  if (!norm) return prev;
  if (prev.length === 0) return [segment];

  const last = prev[prev.length - 1];
  const lastNorm = normalizeText(last.text);

  if (last.turnId && segment.turnId && last.turnId === segment.turnId) {
    return [...prev.slice(0, -1), segment];
  }

  if (lastNorm === norm) return prev;

  const sameSpeaker =
    (last.speakerLabel ?? null) === (segment.speakerLabel ?? null);
  const withinWindow =
    last.createdAt &&
    segment.createdAt &&
    Math.abs(
      new Date(segment.createdAt).getTime() - new Date(last.createdAt).getTime()
    ) <= FINAL_DEDUPE_WINDOW_MS;

  if (
    withinWindow &&
    sameSpeaker &&
    (norm.startsWith(lastNorm) || lastNorm.startsWith(norm))
  ) {
    const longer = norm.length >= lastNorm.length ? segment : last;
    return [...prev.slice(0, -1), longer];
  }

  return [...prev, segment];
}
