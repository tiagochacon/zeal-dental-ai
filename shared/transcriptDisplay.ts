/** Remove marcadores legados de incerteza do texto exibido ao clínico. */
export function stripUncertaintyMarkers(text: string): string {
  return text
    .replace(/\[INCERTO:\s*"([^"]*)"\]/gi, "$1")
    .replace(/\[BAIXA_CONFIANCA:\s*"([^"]*)"\]/gi, "$1")
    .replace(/\[INAUDIVEL\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isInternalTranscriptWarning(warning: string): boolean {
  const normalized = warning.toLowerCase();
  return (
    normalized.includes("cobertura da transcrição") ||
    normalized.includes("speakerrole") ||
    normalized.includes("streaming consultation-only")
  );
}
