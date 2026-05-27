export const LIVE_MIN_USEFUL_TRANSCRIPT_CHARS = 100;

export function hasUsefulLiveTranscript(
  transcriptText: string,
  segmentCount: number
): boolean {
  return (
    transcriptText.trim().length >= LIVE_MIN_USEFUL_TRANSCRIPT_CHARS &&
    segmentCount >= 1
  );
}

/**
 * Batch fallback only when live output is empty/too short or an explicit streaming failure occurred.
 * Low timestamp coverage alone must not replace a useful live transcript.
 */
export function shouldUseBatchFallback(
  transcriptText: string,
  segmentCount: number,
  explicitFailure: boolean
): boolean {
  if (hasUsefulLiveTranscript(transcriptText, segmentCount)) {
    return false;
  }
  return explicitFailure || transcriptText.trim().length === 0;
}
