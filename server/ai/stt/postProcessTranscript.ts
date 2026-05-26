import type { TranscribeResult } from "./types";

export type PostProcessedTranscriptResult = TranscribeResult & {
  processedTranscript: string;
  uncertainSegmentIds: string[];
  processingLog: string[];
  warnings: string[];
};

function normalizeSpacing(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function wrapUncertainty(text: string, confidence: number | null): string {
  const normalized = normalizeSpacing(text);
  if (!normalized) {
    return "[INAUDIVEL]";
  }

  if (confidence === null) {
    return normalized;
  }

  if (confidence < 0.5) {
    return `[BAIXA_CONFIANCA: "${normalized}"]`;
  }

  if (confidence < 0.75) {
    return `[INCERTO: "${normalized}"]`;
  }

  return normalized;
}

export function postProcessTranscript(
  transcriptResult: TranscribeResult
): PostProcessedTranscriptResult {
  const processingLog: string[] = [];
  const uncertainSegmentIds: string[] = [];
  const warnings = [...transcriptResult.warnings];

  const processedLines = transcriptResult.segments.map((segment) => {
    const transformed = wrapUncertainty(segment.text, segment.confidence);
    if (transformed !== segment.text) {
      processingLog.push(`Segmento ${segment.id} normalizado/conservado.`);
    }
    if (
      transformed.startsWith("[INCERTO:") ||
      transformed.startsWith("[BAIXA_CONFIANCA:")
    ) {
      uncertainSegmentIds.push(segment.id);
    }
    if (transformed.startsWith("[BAIXA_CONFIANCA:")) {
      warnings.push(`Segmento ${segment.id} com baixa confiança (<0.50).`);
    }
    return transformed;
  });

  const processedTranscript = processedLines.filter(Boolean).join("\n\n").trim();
  if (!processedTranscript && transcriptResult.transcript.trim().length > 0) {
    processingLog.push("Transcript vazio após marcações; preservando transcript original.");
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
