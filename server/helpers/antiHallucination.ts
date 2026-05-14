/**
 * Anti-Hallucination Helpers
 *
 * Funções centrais para validar que análises de IA estão baseadas em evidências
 * reais da transcrição, reduzindo alucinações e invenções.
 */

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

// ---------------------------------------------------------------------------
// Blocos de instrução para prompts de IA
// ---------------------------------------------------------------------------

/**
 * Bloco de instrução para prompts de IA que exige evidência obrigatória.
 * Deve ser incluído em todos os prompts de análise (SOAP, neurovendas, DISC, etc).
 */
export const EVIDENCE_REQUIRED_BLOCK = `
EVIDÊNCIA OBRIGATÓRIA:
- Extraia SOMENTE informações que aparecem EXPLICITAMENTE na transcrição.
- NÃO invente preços, procedimentos, promessas de resultado, dores, motivos ou perfis que não foram ditos.
- Campos sem evidência textual devem usar: string vazia "", array vazio [], "Não informado", ou confiança baixa (número <= 30).
- Diagnósticos clínicos devem ser marcados como "Hipótese:" quando não ditos explicitamente pelo profissional.
- Cada conclusão relevante deve ter base textual na transcrição ou ser marcada como baixa confiança.
- Se a transcrição for muito curta (<50 palavras), retorne campos com confiança baixa e valores mínimos.
`.trim();

/**
 * Bloco de instrução específico para análise DISC.
 */
export const DISC_EVIDENCE_BLOCK = `
REGRAS DISC - EVIDÊNCIA OBRIGATÓRIA:
- Se o lead falou menos de 100 palavras, retorne confiança baixa (<=30) e perfil "estabilidade" como fallback seguro.
- NÃO invente traços de personalidade sem evidência no texto.
- Cada dimensão DISC deve ter base em comportamentos OBSERVADOS no texto (palavras usadas, tom, perguntas feitas, objeções levantadas).
- sinaisDetectados deve conter APENAS frases ou comportamentos reais extraídos da transcrição.
- Se não há evidência suficiente para determinar um perfil, use confiança baixa.
`.trim();

// ---------------------------------------------------------------------------
// Marcadores de alucinação do Whisper
// ---------------------------------------------------------------------------

/**
 * Marcadores adicionais de alucinação do Whisper encontrados em testes reais.
 * Usados para filtrar segmentos espúrios da transcrição.
 */
export const EXTENDED_HALLUCINATION_MARKERS: string[] = [
  // Marcadores de contexto inventado
  "diálogo entre dentista e paciente",
  "transcrição de consulta odontológica clínica",
  "consulta odontológica. português brasileiro.",
  "vocabulário esperado",
  "continuação da transcrição",
  "contexto anterior",
  // Marcadores de legendas/subtítulos
  "legendas por",
  "subtítulos por",
  "obrigado por assistir",
  "inscreva-se no canal",
  "não se esqueça de",
  "clique no botão",
  "até o próximo vídeo",
  "amara.org",
  // URLs
  "www.",
  "http",
  // Marcadores de silêncio/ruído
  "silêncio",
  "música de fundo",
  "aplausos",
  "[música]",
  "[aplausos]",
  // Repetição de prompt
  "transcreva o áudio",
  "transcrição do áudio",
];
