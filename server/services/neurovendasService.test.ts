import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../ai/invokeAI", () => ({
  invokeAI: vi.fn(),
}));

vi.mock("../_core/metodologiaLoader", () => ({
  getMetodologiaContext: vi.fn().mockResolvedValue("Metodologia DISC: dominancia, influencia, estabilidade, conformidade."),
}));

vi.mock("../helpers/antiHallucination", () => ({
  EVIDENCE_REQUIRED_BLOCK: "EVIDENCE_BLOCK",
  DISC_EVIDENCE_BLOCK: "DISC_BLOCK",
  sanitizeUnsupportedClaims: vi.fn((_, claims) => claims),
  enforceLowConfidenceWhenSparse: vi.fn((disc) => disc),
}));

vi.mock("../helpers/validateNeurovendasAnalysis", () => ({
  validateNeurovendasAnalysis: vi.fn().mockReturnValue([]),
}));

import { analyzeNeurovendas } from "./neurovendasService";
import { invokeAI } from "../ai/invokeAI";

const mockInvokeAI = vi.mocked(invokeAI);

describe("neurovendasService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const SAMPLE_TRANSCRIPT = `Dentista: Bom dia, como posso ajudar?
Paciente: Doutor, estou muito preocupado com meu sorriso. Tenho vergonha de sorrir em fotos e isso me incomoda muito socialmente. Quero fazer um clareamento e talvez facetas. Vi no Instagram que fica muito bonito. Quanto custa mais ou menos? Tenho medo que fique artificial. Minha amiga fez e ficou lindo. Quero transformar meu sorriso completamente.`;

  const VALID_ANALYSIS = {
    perfilPsicografico: {
      discProfile: {
        perfilPrimario: "influencia",
        perfilSecundario: "estabilidade",
        confianca: 70,
        resumo: "Paciente focado em transformação estética e validação social",
        sinaisDetectados: ["vergonha de sorrir", "referência social"],
        motivadores: ["autoestima", "validação social"],
        medosOuResistencias: ["resultado artificial"],
        comoComunicar: ["mostrar casos similares"],
        oQueEvitar: ["dados técnicos frios"],
        fraseRecomendada: "Vamos criar um sorriso natural que combine com você.",
        justificativaTecnica: "Paciente usa linguagem emocional e referências sociais",
      },
      nivelCerebralDominante: "limbico",
      motivacaoPrimaria: "estetica",
      nivelAnsiedade: 30,
      nivelReceptividade: 80,
      descricaoPerfil: "Paciente com perfil emocional focado em transformação",
    },
    objecoes: {
      verdadeiras: [
        { texto: "Quanto custa?", categoria: "financeira", tecnicaSugerida: "Entendo sua preocupação com o investimento..." },
      ],
      ocultas: [
        { texto: "Medo de resultado artificial", sinaisDetectados: "Tenho medo que fique artificial", perguntaReveladora: "O que seria um resultado ideal para você?" },
      ],
    },
    sinaisLinguagem: {
      positivos: ["quero transformar", "ficou lindo"],
      negativos: ["vergonha", "medo"],
      palavrasChaveEmocionais: ["vergonha", "bonito", "transformar"],
    },
    gatilhosMentais: [
      { nome: "transformacao", justificativa: "Desejo de mudança completa", exemploFrase: "Imagine como será sorrir com confiança" },
    ],
    scriptPARE: {
      problema: "Vergonha de sorrir em fotos",
      amplificacao: "Isso afeta sua vida social e autoestima",
      resolucao: "Clareamento + facetas para resultado natural",
      engajamento: "Vamos agendar uma avaliação completa?",
    },
    tecnicaObjecao: {
      tipo: "LAER",
      passos: ["Escutar a preocupação", "Validar o medo", "Mostrar casos naturais"],
    },
    rapport: {
      nivel: 65,
      breakdown: {
        validacaoEmocional: 20,
        espelhamentoLinguistico: 15,
        escutaAtiva: 15,
        equilibrioTurnos: 10,
        ausenciaInterrupcoes: 5,
      },
      justificativa: "Boa escuta ativa com validação emocional",
      melhoria: "Espelhar mais a linguagem do paciente",
      pontosFortesRelacionamento: ["escuta ativa"],
      acoesParaMelhorar: ["usar mais espelhamento"],
    },
    resumoExecutivo: "Paciente com perfil influência, motivado por estética e transformação social.",
  };

  it("should analyze neurovendas from transcript", async () => {
    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: JSON.stringify(VALID_ANALYSIS) } }] },
    } as any);

    const result = await analyzeNeurovendas({
      consultationId: 1,
      transcript: SAMPLE_TRANSCRIPT,
      patientId: 42,
    });

    expect(result.success).toBe(true);
    expect(result.fallback).toBeUndefined();
    expect((result.analysis as any).perfilPsicografico.discProfile.perfilPrimario).toBe("influencia");
    expect(mockInvokeAI).toHaveBeenCalledWith(
      "neurovendas_consultation",
      expect.objectContaining({
        messages: expect.any(Array),
        response_format: expect.any(Object),
      }),
      expect.any(Object)
    );
  });

  it("should return fallback on LLM failure", async () => {
    mockInvokeAI.mockResolvedValue({
      success: false,
      error: "LLM unavailable",
    } as any);

    const result = await analyzeNeurovendas({
      consultationId: 1,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
  });

  it("should return fallback on empty response", async () => {
    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: "" } }] },
    } as any);

    const result = await analyzeNeurovendas({
      consultationId: 1,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
  });

  it("should return fallback on invalid JSON", async () => {
    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: "not valid json {{{" } }] },
    } as any);

    const result = await analyzeNeurovendas({
      consultationId: 1,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
  });

  it("should include warning count when validation finds issues", async () => {
    const { validateNeurovendasAnalysis } = await import("../helpers/validateNeurovendasAnalysis");
    vi.mocked(validateNeurovendasAnalysis).mockReturnValueOnce([
      { field: "test", message: "test warning", severity: "low" },
    ] as any);

    mockInvokeAI.mockResolvedValue({
      success: true,
      response: { choices: [{ message: { content: JSON.stringify(VALID_ANALYSIS) } }] },
    } as any);

    const result = await analyzeNeurovendas({
      consultationId: 1,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result.warnings).toBe(1);
  });
});
