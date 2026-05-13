function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasEvidenceInTranscript(transcript: string, claim: string): boolean {
  const cleanTranscript = normalizeText(transcript);
  const cleanClaim = normalizeText(claim);
  if (!cleanClaim || cleanClaim.length < 4) return true;
  const words = cleanClaim.split(" ").filter((w) => w.length >= 4);
  if (words.length === 0) return true;
  const matched = words.filter((w) => cleanTranscript.includes(w)).length;
  return matched / words.length >= 0.5;
}

export function sanitizeUnsupportedClaims(transcript: string, values: string[]): string[] {
  return values.filter((value) => hasEvidenceInTranscript(transcript, value));
}

export function enforceLowConfidenceWhenSparse<T extends { confianca?: number; resumo?: string }>(
  payload: T,
  transcript: string,
  minLength = 120
): T {
  const length = normalizeText(transcript).split(" ").filter(Boolean).length;
  if (length >= minLength) return payload;
  const next = { ...payload };
  if (typeof next.confianca === "number" && next.confianca > 35) {
    next.confianca = 35;
  }
  if (typeof next.resumo === "string" && !next.resumo.toLowerCase().includes("baixa confiança")) {
    next.resumo = `${next.resumo} Amostra reduzida, análise com baixa confiança.`.trim();
  }
  return next;
}
