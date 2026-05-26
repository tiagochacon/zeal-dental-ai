import type { AIValidationResult } from "./types";
import { validateJSON } from "./validateJSON";

export function validateTreatmentPlan(rawContent: string): AIValidationResult {
  const base = validateJSON(rawContent);
  if (!base.passed) return base;

  const parsed = JSON.parse(rawContent) as Record<string, unknown>;
  const issues: string[] = [];

  if (!("steps" in parsed)) {
    issues.push("Plano sem campo obrigatório: steps");
  }
  if (!("medications" in parsed)) {
    issues.push("Plano sem campo obrigatório: medications");
  }

  const hasProcedureSignal =
    /procedimento|tratamento|nenhum procedimento discutido/i.test(rawContent);
  if (!hasProcedureSignal) {
    issues.push("Plano sem indicação de procedimentos ou marcação de ausência");
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
