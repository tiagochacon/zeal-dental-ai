export const CLINICAL_EVIDENCE_GUARDRAILS = [
  "Baseie cada afirmação apenas na transcrição fornecida.",
  "Se não houver evidência, use 'Não documentado na consulta'.",
  "Não invente diagnóstico, procedimento, medicação, prazo ou orientação.",
  "Trechos marcados como INCERTO ou BAIXA_CONFIANCA não podem virar afirmação definitiva.",
  "Toda conclusão clínica deve ter evidência textual ou ser marcada como inferida.",
] as const;

export function buildClinicalGuardrailsBlock(): string {
  return CLINICAL_EVIDENCE_GUARDRAILS.map((line) => `- ${line}`).join("\n");
}
