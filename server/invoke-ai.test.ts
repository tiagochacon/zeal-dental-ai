import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { invokeAI, validateClinicalOutput } from "./ai/invokeAI";

describe("invokeAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success with primary model response", async () => {
    (invokeLLM as any).mockResolvedValue({
      id: "r1",
      created: Date.now(),
      model: "gemini-2.5-flash",
      choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }],
    });

    const result = await invokeAI("call_insights", {
      messages: [{ role: "user", content: "oi" }],
      response_format: { type: "json_object" },
    }, { callId: 10 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.fallbackUsed).toBe(false);
      expect(result.taskType).toBe("call_insights");
      expect(result.retries).toBe(0);
      expect(result.confidence).toBeGreaterThan(0);
    }
  });

  it("retries once then succeeds on primary", async () => {
    (invokeLLM as any)
      .mockRejectedValueOnce(new Error("temporary fail"))
      .mockResolvedValue({
        id: "r2",
        created: Date.now(),
        model: "gemini-2.5-flash",
        choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }],
      });

    const result = await invokeAI("call_insights", {
      messages: [{ role: "user", content: "oi" }],
      response_format: { type: "json_object" },
    }, { callId: 10, maxRetriesOverride: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.retries).toBe(1);
    }
  });

  it("returns structured failure when primary and fallback fail", async () => {
    (invokeLLM as any).mockRejectedValue(new Error("provider down"));

    const result = await invokeAI("soap", {
      messages: [{ role: "user", content: "dados" }],
    }, {
      primaryModelOverride: "model-a",
      fallbackModelOverride: "model-b",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Todos os modelos falharam");
      expect(result.primaryError).toContain("provider down");
      expect(result.fallbackError).toContain("provider down");
    }
  });
});

describe("validateClinicalOutput", () => {
  it("flags missing evidence in SOAP", () => {
    const validation = validateClinicalOutput("Resumo sem citação", "soap");
    expect(validation.passed).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });

  it("passes valid JSON for call insights profile", () => {
    const validation = validateClinicalOutput(
      JSON.stringify({ dor: "", busca: "", trabalha: "" }),
      "call_insights"
    );
    expect(validation.passed).toBe(true);
  });
});
