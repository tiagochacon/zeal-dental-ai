import type { AIValidationResult } from "./types";
import { validateJSON } from "./validateJSON";

export function validateNeurovendas(rawContent: string): AIValidationResult {
  const base = validateJSON(rawContent);
  if (!base.passed) return base;

  const issues: string[] = [];
  const hasEvidenceSignal = /evid[eê]ncia|transcri|trecho|falou|mensagem/i.test(
    rawContent
  );
  if (!hasEvidenceSignal) {
    issues.push("Neurovendas sem evidência textual explícita");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
