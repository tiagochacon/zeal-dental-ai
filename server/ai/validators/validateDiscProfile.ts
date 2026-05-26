import type { AIValidationResult } from "./types";
import { validateJSON } from "./validateJSON";

export function validateDiscProfile(rawContent: string): AIValidationResult {
  const base = validateJSON(rawContent);
  if (!base.passed) return base;

  const issues: string[] = [];
  const hasAnyDimension = /domin|influ|estab|conform/i.test(rawContent);
  if (!hasAnyDimension) {
    issues.push("DISC sem dimensões identificáveis");
  }
  const hasEvidenceSignal = /evid[eê]ncia|transcri|trecho/i.test(rawContent);
  if (!hasEvidenceSignal) {
    issues.push("DISC sem evidência textual explícita");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
