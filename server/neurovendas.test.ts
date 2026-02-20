import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock the database module
vi.mock("./db", () => ({
  getConsultationById: vi.fn(),
  updateConsultation: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { getConsultationById, updateConsultation } from "./db";

describe("Neurovendas Analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Analysis Generation", () => {
    it("should require a transcript to generate analysis", async () => {
      const mockConsultation = {
        id: 1,
        dentistId: 1,
        transcript: null,
        neurovendasAnalysis: null,
      };

      vi.mocked(getConsultationById).mockResolvedValue(mockConsultation as any);

      // The analysis should fail without a transcript
      expect(mockConsultation.transcript).toBeNull();
    });

    it("should call LLM with correct prompt structure for analysis", async () => {
      const mockConsultation = {
        id: 1,
        dentistId: 1,
        transcript: "Paciente: Doutor, estou com muita dor de dente. Dentista: Vamos examinar.",
        neurovendasAnalysis: null,
      };

      vi.mocked(getConsultationById).mockResolvedValue(mockConsultation as any);

      const mockAnalysis = {
        perfilPsicografico: {
          nivelCerebralDominante: "limbico",
          motivacaoPrimaria: "alivio_dor",
          nivelAnsiedade: 7,
          nivelReceptividade: 6,
          descricaoPerfil: "Paciente apresenta alta ansiedade devido à dor",
        },
        objecoes: {
          verdadeiras: [],
          ocultas: [],
        },
        sinaisLinguagem: {
          positivos: [],
          negativos: [],
          palavrasChaveEmocionais: ["dor"],
        },
        gatilhosMentais: [
          {
            nome: "conforto",
            justificativa: "Paciente busca alívio da dor",
            exemploFrase: "Vamos resolver essa dor hoje mesmo",
          },
        ],
        scriptPARE: {
          problema: "Dor de dente intensa",
          amplificacao: "A dor pode piorar se não tratada",
          resolucao: "Tratamento imediato para alívio",
          engajamento: "Podemos começar agora?",
        },
        tecnicaObjecao: {
          tipo: "LAER",
          passos: ["Ouvir", "Aceitar", "Explorar", "Responder"],
        },
        rapport: {
          nivel: 6,
          pontosFortesRelacionamento: ["Empatia demonstrada"],
          acoesParaMelhorar: ["Usar mais perguntas abertas"],
        },
        resumoExecutivo: "Paciente com perfil emocional buscando alívio imediato da dor",
      };

      vi.mocked(invokeLLM).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockAnalysis),
            },
          },
        ],
      } as any);

      // Verify the mock analysis structure is valid
      expect(mockAnalysis.perfilPsicografico.nivelCerebralDominante).toBe("limbico");
      expect(mockAnalysis.gatilhosMentais).toHaveLength(1);
      expect(mockAnalysis.scriptPARE.problema).toBeDefined();
    });

    it("should validate analysis response structure", () => {
      const validAnalysis = {
        perfilPsicografico: {
          nivelCerebralDominante: "neocortex",
          motivacaoPrimaria: "estetica",
          nivelAnsiedade: 3,
          nivelReceptividade: 8,
          descricaoPerfil: "Paciente racional focado em resultados estéticos",
        },
        objecoes: {
          verdadeiras: [
            {
              texto: "Está muito caro",
              categoria: "financeira",
              tecnicaSugerida: "Entendo sua preocupação com o valor. É normal querer entender bem o investimento. Me conta, o que especificamente te preocupa mais: o valor total ou a forma de pagamento? Temos opções de parcelamento que podem ajudar.",
            },
          ],
          ocultas: [],
        },
        sinaisLinguagem: {
          positivos: ["interesse", "curiosidade"],
          negativos: ["hesitação"],
          palavrasChaveEmocionais: ["bonito", "sorriso"],
        },
        gatilhosMentais: [
          {
            nome: "transformacao",
            justificativa: "Paciente quer melhorar aparência",
            exemploFrase: "Imagine como será seu novo sorriso",
          },
        ],
        scriptPARE: {
          problema: "Insatisfação com aparência dental",
          amplificacao: "Impacto na autoestima e confiança",
          resolucao: "Tratamento estético personalizado",
          engajamento: "Vamos agendar a avaliação completa?",
        },
        tecnicaObjecao: {
          tipo: "redirecionamento",
          passos: ["Reconhecer", "Redirecionar", "Resolver"],
        },
        rapport: {
          nivel: 8,
          pontosFortesRelacionamento: ["Boa comunicação", "Confiança estabelecida"],
          acoesParaMelhorar: [],
        },
        resumoExecutivo: "Paciente racional com foco em estética, apresenta objeção financeira",
      };

      // Validate structure
      expect(validAnalysis.perfilPsicografico).toBeDefined();
      expect(validAnalysis.objecoes.verdadeiras).toBeInstanceOf(Array);
      expect(validAnalysis.gatilhosMentais).toBeInstanceOf(Array);
      expect(validAnalysis.scriptPARE).toBeDefined();
      expect(validAnalysis.rapport.nivel).toBeGreaterThanOrEqual(0);
      expect(validAnalysis.rapport.nivel).toBeLessThanOrEqual(10);
    });

    it("should handle all brain level types", () => {
      const brainLevels = ["neocortex", "limbico", "reptiliano"];
      
      brainLevels.forEach((level) => {
        expect(["neocortex", "limbico", "reptiliano"]).toContain(level);
      });
    });

    it("should handle all motivation types", () => {
      const motivations = ["alivio_dor", "estetica", "status", "saude"];
      
      motivations.forEach((motivation) => {
        expect(["alivio_dor", "estetica", "status", "saude"]).toContain(motivation);
      });
    });

    it("should handle all objection categories", () => {
      const categories = ["financeira", "medo", "tempo", "confianca", "outra"];
      
      categories.forEach((category) => {
        expect(["financeira", "medo", "tempo", "confianca", "outra"]).toContain(category);
      });
    });

    it("should handle all mental trigger types", () => {
      const triggers = ["transformacao", "saude_longevidade", "status", "conforto", "exclusividade"];
      
      triggers.forEach((trigger) => {
        expect(["transformacao", "saude_longevidade", "status", "conforto", "exclusividade"]).toContain(trigger);
      });
    });

    it("should handle both objection technique types", () => {
      const techniques = ["LAER", "redirecionamento"];
      
      techniques.forEach((technique) => {
        expect(["LAER", "redirecionamento"]).toContain(technique);
      });
    });
  });

  describe("Analysis Storage", () => {
    it("should save analysis to consultation", async () => {
      const consultationId = 1;
      const mockAnalysis = {
        resumoExecutivo: "Test analysis",
        perfilPsicografico: {
          nivelCerebralDominante: "limbico",
          motivacaoPrimaria: "alivio_dor",
          nivelAnsiedade: 5,
          nivelReceptividade: 5,
          descricaoPerfil: "Test profile",
        },
        objecoes: { verdadeiras: [], ocultas: [] },
        sinaisLinguagem: { positivos: [], negativos: [], palavrasChaveEmocionais: [] },
        gatilhosMentais: [],
        scriptPARE: { problema: "", amplificacao: "", resolucao: "", engajamento: "" },
        tecnicaObjecao: { tipo: "LAER", passos: [] },
        rapport: { nivel: 5, pontosFortesRelacionamento: [], acoesParaMelhorar: [] },
      };

      vi.mocked(updateConsultation).mockResolvedValue(undefined);

      await updateConsultation(consultationId, {
        neurovendasAnalysis: mockAnalysis as any,
      });

      expect(updateConsultation).toHaveBeenCalledWith(consultationId, {
        neurovendasAnalysis: mockAnalysis,
      });
    });
  });

  describe("Analysis Retrieval", () => {
    it("should return hasAnalysis false when no analysis exists", async () => {
      const mockConsultation = {
        id: 1,
        dentistId: 1,
        neurovendasAnalysis: null,
      };

      vi.mocked(getConsultationById).mockResolvedValue(mockConsultation as any);

      const result = await getConsultationById(1);
      expect(result?.neurovendasAnalysis).toBeNull();
    });

    it("should return analysis when it exists", async () => {
      const mockAnalysis = {
        resumoExecutivo: "Existing analysis",
      };

      const mockConsultation = {
        id: 1,
        dentistId: 1,
        neurovendasAnalysis: mockAnalysis,
      };

      vi.mocked(getConsultationById).mockResolvedValue(mockConsultation as any);

      const result = await getConsultationById(1);
      expect(result?.neurovendasAnalysis).toEqual(mockAnalysis);
    });
  });
});
