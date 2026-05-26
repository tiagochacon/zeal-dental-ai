import type { ValidationProfile } from "../taskConfig";
import { validateDiscProfile } from "./validateDiscProfile";
import { validateJSON } from "./validateJSON";
import { validateNeurovendas } from "./validateNeurovendas";
import { validateSOAP } from "./validateSOAP";
import { validateTreatmentPlan } from "./validateTreatmentPlan";
import type { AIValidationResult } from "./types";

export type { AIValidationResult } from "./types";

export function validateByProfile(
  rawContent: string,
  profile: ValidationProfile
): AIValidationResult {
  switch (profile) {
    case "json":
      return validateJSON(rawContent);
    case "soap":
      return validateSOAP(rawContent);
    case "treatment_plan":
      return validateTreatmentPlan(rawContent);
    case "disc_profile":
      return validateDiscProfile(rawContent);
    case "neurovendas":
      return validateNeurovendas(rawContent);
    case "none":
    default:
      return { passed: true, issues: [] };
  }
}
