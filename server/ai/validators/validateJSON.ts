import type { AIValidationResult } from "./types";

export function validateJSON(rawContent: string): AIValidationResult {
  const content = rawContent.trim();
  if (!content) {
    return { passed: false, issues: ["Conteúdo vazio"] };
  }
  try {
    JSON.parse(content);
    return { passed: true, issues: [] };
  } catch {
    return { passed: false, issues: ["JSON inválido"] };
  }
}
