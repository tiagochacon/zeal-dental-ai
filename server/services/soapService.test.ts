import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeAI
vi.mock("../ai/invokeAI", () => ({
  invokeAI: vi.fn(),
}));

import { generateSOAPNote } from "./soapService";
import { invokeAI } from "../ai/invokeAI";

const mockInvokeAI = vi.mocked(invokeAI);

describe("soapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const SAMPLE_TRANSCRIPT = `Dentista: Bom dia, qual a sua queixa principal?
Paciente: Estou com dor no dente de trás, lado direito, já faz uma semana.
Dentista: Vou examinar. Vejo uma cárie extensa no dente 46, face oclusal e mesial.
Paciente: Vai precisar de canal?
Dentista: Vamos fazer uma restauração primeiro e acompanhar. Se a dor persistir, avaliamos endodontia.`;

  const VALID_SOAP_RESPONSE = {
    urgency: "medium",
    subjective: {
      queixa_principal: "Dor no dente de trás, lado direito, há uma semana",
      historia_doenca_atual: "Dor há uma semana no dente posterior direito",
      historico_medico: [],
      medicacoes: [],
    },
    objective: {
      exame_clinico_geral: "Cárie extensa no dente 46",
      exame_clinico_especifico: ["Cárie classe II no dente 46 (oclusal e mesial)"],
      dentes_afetados: ["46"],
      classificacoes_dentes: [
        { numero: "46", classificacao: "cavity", notas: "Cárie extensa face oclusal e mesial" },
      ],
    },
    assessment: {
      diagnosticos: ["Hipótese: Cárie classe II no dente 46"],
      red_flags: [],
    },
    plan: {
      tratamentos: [
        { procedimento: "Restauração", dente: "46", urgencia: "media", prazo: "imediato" },
      ],
      orientacoes: [],
      lembretes_clinicos: ["Acompanhar dor; se persistir, avaliar endodontia"],
    },
    patientProfile: {
      discProfile: {
        perfilPrimario: "estabilidade",
        perfilSecundario: null,
        confianca: 40,
        resumo: "Paciente preocupado com dor",
        sinaisDetectados: ["preocupação com canal"],
        motivadores: ["alívio da dor"],
        medosOuResistencias: ["medo de canal"],
        comoComunicar: ["explicar passo a passo"],
        oQueEvitar: ["termos técnicos complexos"],
        fraseRecomendada: "Vamos resolver essa dor com o tratamento mais conservador possível.",
        justificativaTecnica: "Paciente demonstra preocupação com procedimentos invasivos",
      },
      type: "reptilian",
      confidence: 40,
      primaryTraits: ["ansiedade", "busca segurança"],
      detectedKeywords: ["dor", "canal"],
      recommendedApproach: "Abordagem conservadora com foco em segurança",
      triggers: {
        positive: ["sem dor", "conservador"],
        negative: ["canal", "cirurgia"],
      },
    },
  };

  it("should generate a SOAP note from transcript", async () => {
    mockInvokeAI.mockResolvedValue({
      success: true,
      response: {
        choices: [{ message: { content: JSON.stringify(VALID_SOAP_RESPONSE) } }],
      },
    } as any);

    const result = await generateSOAPNote({
      consultationId: 1,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result.success).toBe(true);
    expect(result.soapNote).toBeDefined();
    expect((result.soapNote as any).urgency).toBe("medium");
    expect((result.soapNote as any).subjective.queixa_principal).toContain("Dor");
    expect(mockInvokeAI).toHaveBeenCalledWith(
      "soap",
      expect.objectContaining({
        temperature: 0,
        seed: 42,
      }),
      expect.any(Object)
    );
  });

  it("should throw on LLM failure", async () => {
    mockInvokeAI.mockResolvedValue({
      success: false,
      error: "LLM unavailable",
    } as any);

    await expect(
      generateSOAPNote({ consultationId: 1, transcript: SAMPLE_TRANSCRIPT })
    ).rejects.toThrow("LLM unavailable");
  });

  it("should throw on empty LLM response", async () => {
    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: "" } }] },
    } as any);

    await expect(
      generateSOAPNote({ consultationId: 1, transcript: SAMPLE_TRANSCRIPT })
    ).rejects.toThrow("Resposta vazia da IA");
  });

  it("should throw on invalid JSON response", async () => {
    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: "not json at all" } }] },
    } as any);

    await expect(
      generateSOAPNote({ consultationId: 1, transcript: SAMPLE_TRANSCRIPT })
    ).rejects.toThrow("formato inválido");
  });

  it("should detect hallucination when queixa has no match in transcript", async () => {
    // Use words that have NO 5-char prefix overlap with the transcript
    const hallucinatedResponse = {
      ...VALID_SOAP_RESPONSE,
      subjective: {
        ...VALID_SOAP_RESPONSE.subjective,
        queixa_principal: "Sangramento gengival intenso bilateral crônico maxilar",
      },
    };

    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: JSON.stringify(hallucinatedResponse) } }] },
    } as any);

    const result = await generateSOAPNote({
      consultationId: 1,
      transcript: "Paciente: Olá doutor. Dentista: Como posso ajudar?",
    });

    expect(result.hallucinationWarning).toBe(true);
  });

  it("should not flag hallucination when queixa matches transcript", async () => {
    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: JSON.stringify(VALID_SOAP_RESPONSE) } }] },
    } as any);

    const result = await generateSOAPNote({
      consultationId: 1,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result.hallucinationWarning).toBe(false);
  });
});
