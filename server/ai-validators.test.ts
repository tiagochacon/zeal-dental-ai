import { describe, expect, it } from "vitest";
import { validateByProfile } from "./ai/validators";

describe("AI validators", () => {
  it("rejects invalid JSON in json profile", () => {
    const result = validateByProfile("{invalid", "json");
    expect(result.passed).toBe(false);
  });

  it("requires SOAP fields and evidence signal", () => {
    const invalid = validateByProfile(JSON.stringify({ subjective: {} }), "soap");
    expect(invalid.passed).toBe(false);

    const valid = validateByProfile(
      JSON.stringify({
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        evidence: "Não documentado na consulta",
      }),
      "soap"
    );
    expect(valid.passed).toBe(true);
  });

  it("validates treatment plan core fields", () => {
    const invalid = validateByProfile(JSON.stringify({ steps: [] }), "treatment_plan");
    expect(invalid.passed).toBe(false);
  });
});
