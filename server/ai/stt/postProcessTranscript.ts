import type { TranscribeResult } from "./types";

export type PostProcessedTranscriptResult = TranscribeResult & {
  processedTranscript: string;
  uncertainSegmentIds: string[];
  processingLog: string[];
  warnings: string[];
};

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const UNCERTAIN_CONFIDENCE_THRESHOLD = 0.75;

function normalizeSpacing(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isUncertainSegment(confidence: number | null): boolean {
  if (confidence === null) return false;
  return confidence < UNCERTAIN_CONFIDENCE_THRESHOLD;
}

function isLowConfidenceSegment(confidence: number | null): boolean {
  if (confidence === null) return false;
  return confidence < LOW_CONFIDENCE_THRESHOLD;
}

/** Texto limpo para UI; incerteza fica em segment.confidence e uncertainSegmentIds. */
function displaySegmentText(text: string): string {
  return normalizeSpacing(text);
}

export function postProcessTranscript(
  transcriptResult: TranscribeResult
): PostProcessedTranscriptResult {
  const processingLog: string[] = [];
  const uncertainSegmentIds: string[] = [];
  const warnings = [...transcriptResult.warnings];

  const processedLines = transcriptResult.segments.map((segment) => {
    const displayText = displaySegmentText(segment.text);

    if (isUncertainSegment(segment.confidence)) {
      uncertainSegmentIds.push(segment.id);
      processingLog.push(`Segmento ${segment.id} marcado como incerto (confiança interna).`);
    }

    if (isLowConfidenceSegment(segment.confidence)) {
      warnings.push(`Segmento ${segment.id} com baixa confiança (<0.50).`);
    }

    return displayText;
  });

  const processedTranscript = processedLines.filter(Boolean).join("\n\n").trim();
  if (!processedTranscript && transcriptResult.transcript.trim().length > 0) {
    processingLog.push("Transcript vazio após normalização; preservando transcript original.");
  }

  return {
    ...transcriptResult,
    processedTranscript:
      processedTranscript || normalizeSpacing(transcriptResult.transcript || ""),
    uncertainSegmentIds,
    processingLog,
    warnings,
  };
}
