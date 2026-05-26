import type { AIValidationResult } from "./types";
import { validateJSON } from "./validateJSON";

export function validateSOAP(rawContent: string): AIValidationResult {
  const base = validateJSON(rawContent);
  if (!base.passed) return base;

  const parsed = JSON.parse(rawContent) as Record<string, unknown>;
  const issues: string[] = [];
  const required = ["subjective", "objective", "assessment", "plan"];
  for (const field of required) {
    if (!(field in parsed)) {
      issues.push(`Campo SOAP obrigatório ausente: ${field}`);
    }
  }

  const hasEvidenceSignal =
    /evid[eê]ncia|não documentado na consulta|na transcri/i.test(rawContent);
  if (!hasEvidenceSignal) {
    issues.push("SOAP sem evidência explícita ou marcação de não documentado");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
