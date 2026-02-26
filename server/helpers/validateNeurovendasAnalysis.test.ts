import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateNeurovendasAnalysis,
  VALID_ENUMS,
  REQUIRED_TOP_LEVEL_FIELDS,
  RAPPORT_BREAKDOWN_FIELDS,
  type ValidationWarning,
} from "./validateNeurovendasAnalysis";

// Mock console.warn and console.error to capture warnings
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  warnSpy.mockClear();
  errorSpy.mockClear();
});

// Helper to create a valid analysis object
function createValidAnalysis(): Record<string, unknown> {
  return {
    perfilPsicografico: {
      nivelCerebralDominante: "neocortex",
      motivacaoPrimaria: "estetica",
      nivelAnsiedade: 5,
      nivelReceptividade: 7,
      descricaoPerfil: "Paciente lógico e analítico",
    },
    objecoes: {
      verdadeiras: [
        {
          texto: "Está muito caro",
          categoria: "financeira",
          tecnicaSugerida: "Entendo sua preocupação...",
        },
      ],
      ocultas: [],
    },
    sinaisLinguagem: {
      positivos: ["interessante"],
      negativos: ["não sei"],
      palavrasChaveEmocionais: ["medo"],
    },
    gatilhosMentais: [
      {
        nome: "transformacao",
        justificativa: "Paciente busca mudança",
        exemploFrase: "Quero mudar meu sorriso",
      },
    ],
    scriptPARE: {
      problema: "Dor ao mastigar",
      amplificacao: "Pode piorar com o tempo",
      resolucao: "Tratamento de canal resolve",
      engajamento: "Podemos agendar para semana que vem?",
    },
    tecnicaObjecao: {
      tipo: "LAER",
      passos: ["Ouvir", "Reconhecer", "Explorar", "Responder"],
    },
    rapport: {
      nivel: 75,
      breakdown: {
        validacaoEmocional: 25,
        espelhamentoLinguistico: 20,
        escutaAtiva: 15,
        equilibrioTurnos: 10,
        ausenciaInterrupcoes: 5,
      },
      justificativa: "Boa escuta ativa demonstrada",
      melhoria: "Melhorar espelhamento linguístico",
      pontosFortesRelacionamento: ["Empatia"],
      acoesParaMelhorar: ["Usar mais perguntas abertas"],
    },
    resumoExecutivo: "Paciente com perfil neocortex, receptivo ao tratamento.",
  };
}

describe("validateNeurovendasAnalysis", () => {
  describe("valid analysis", () => {
    it("should return empty warnings for a valid analysis", () => {
      const analysis = createValidAnalysis();
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      expect(warnings).toHaveLength(0);
    });

    it("should not log any warnings for valid analysis", () => {
      const analysis = createValidAnalysis();
      validateNeurovendasAnalysis(analysis, "crc");
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("missing required fields", () => {
    it("should warn when top-level fields are missing", () => {
      const analysis = { perfilPsicografico: createValidAnalysis().perfilPsicografico };
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      
      const missingFieldNames = warnings
        .filter(w => w.issue === "Campo obrigatório ausente")
        .map(w => w.field);
      
      expect(missingFieldNames).toContain("objecoes");
      expect(missingFieldNames).toContain("sinaisLinguagem");
      expect(missingFieldNames).toContain("gatilhosMentais");
      expect(missingFieldNames).toContain("scriptPARE");
      expect(missingFieldNames).toContain("tecnicaObjecao");
      expect(missingFieldNames).toContain("rapport");
    });

    it("should warn for empty object (all fields missing)", () => {
      const warnings = validateNeurovendasAnalysis({}, "crc");
      const missingFields = warnings.filter(w => w.issue === "Campo obrigatório ausente");
      expect(missingFields.length).toBe(REQUIRED_TOP_LEVEL_FIELDS.length);
    });
  });

  describe("enum validation - perfilPsicografico", () => {
    it("should warn for invalid nivelCerebralDominante", () => {
      const analysis = createValidAnalysis();
      (analysis.perfilPsicografico as Record<string, unknown>).nivelCerebralDominante = "invalido";
      
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      const enumWarning = warnings.find(w => w.field === "perfilPsicografico.nivelCerebralDominante");
      
      expect(enumWarning).toBeDefined();
      expect(enumWarning!.value).toBe("invalido");
    });

    it("should accept all valid nivelCerebralDominante values", () => {
      for (const val of VALID_ENUMS.nivelCerebralDominante) {
        const analysis = createValidAnalysis();
        (analysis.perfilPsicografico as Record<string, unknown>).nivelCerebralDominante = val;
        const warnings = validateNeurovendasAnalysis(analysis, "consulta");
        const enumWarning = warnings.find(w => w.field === "perfilPsicografico.nivelCerebralDominante");
        expect(enumWarning).toBeUndefined();
      }
    });

    it("should warn for invalid motivacaoPrimaria", () => {
      const analysis = createValidAnalysis();
      (analysis.perfilPsicografico as Record<string, unknown>).motivacaoPrimaria = "dinheiro";
      
      const warnings = validateNeurovendasAnalysis(analysis, "crc");
      const enumWarning = warnings.find(w => w.field === "perfilPsicografico.motivacaoPrimaria");
      
      expect(enumWarning).toBeDefined();
      expect(enumWarning!.value).toBe("dinheiro");
    });

    it("should accept all valid motivacaoPrimaria values", () => {
      for (const val of VALID_ENUMS.motivacaoPrimaria) {
        const analysis = createValidAnalysis();
        (analysis.perfilPsicografico as Record<string, unknown>).motivacaoPrimaria = val;
        const warnings = validateNeurovendasAnalysis(analysis, "consulta");
        const enumWarning = warnings.find(w => w.field === "perfilPsicografico.motivacaoPrimaria");
        expect(enumWarning).toBeUndefined();
      }
    });
  });

  describe("numeric range validation", () => {
    it("should warn for nivelAnsiedade out of range (0-10)", () => {
      const analysis = createValidAnalysis();
      (analysis.perfilPsicografico as Record<string, unknown>).nivelAnsiedade = 15;
      
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      const rangeWarning = warnings.find(w => w.field === "perfilPsicografico.nivelAnsiedade");
      
      expect(rangeWarning).toBeDefined();
      expect(rangeWarning!.value).toBe(15);
    });

    it("should warn for negative nivelReceptividade", () => {
      const analysis = createValidAnalysis();
      (analysis.perfilPsicografico as Record<string, unknown>).nivelReceptividade = -1;
      
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      const rangeWarning = warnings.find(w => w.field === "perfilPsicografico.nivelReceptividade");
      
      expect(rangeWarning).toBeDefined();
    });

    it("should warn for rapport.nivel out of range (0-100)", () => {
      const analysis = createValidAnalysis();
      (analysis.rapport as Record<string, unknown>).nivel = 150;
      
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      const rangeWarning = warnings.find(w => w.field === "rapport.nivel");
      
      expect(rangeWarning).toBeDefined();
      expect(rangeWarning!.value).toBe(150);
    });

    it("should accept valid numeric ranges", () => {
      const analysis = createValidAnalysis();
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      
      const rangeWarnings = warnings.filter(w => w.issue.includes("range"));
      expect(rangeWarnings).toHaveLength(0);
    });
  });

  describe("enum validation - gatilhosMentais", () => {
    it("should warn for invalid gatilho nome", () => {
      const analysis = createValidAnalysis();
      (analysis.gatilhosMentais as Array<Record<string, unknown>>)[0].nome = "escassez";
      
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      const enumWarning = warnings.find(w => w.field.startsWith("gatilhosMentais"));
      
      expect(enumWarning).toBeDefined();
      expect(enumWarning!.value).toBe("escassez");
    });

    it("should accept all valid gatilho nomes", () => {
      for (const val of VALID_ENUMS.gatilhoMentalNome) {
        const analysis = createValidAnalysis();
        (analysis.gatilhosMentais as Array<Record<string, unknown>>)[0].nome = val;
        const warnings = validateNeurovendasAnalysis(analysis, "consulta");
        const enumWarning = warnings.find(w => w.field.startsWith("gatilhosMentais"));
        expect(enumWarning).toBeUndefined();
      }
    });
  });

  describe("enum validation - objecoes", () => {
    it("should warn for invalid objecao categoria", () => {
      const analysis = createValidAnalysis();
      const objecoes = analysis.objecoes as Record<string, unknown>;
      (objecoes.verdadeiras as Array<Record<string, unknown>>)[0].categoria = "preguica";
      
      const warnings = validateNeurovendasAnalysis(analysis, "crc");
      const enumWarning = warnings.find(w => w.field.startsWith("objecoes.verdadeiras"));
      
      expect(enumWarning).toBeDefined();
      expect(enumWarning!.value).toBe("preguica");
    });

    it("should accept all valid objecao categorias", () => {
      for (const val of VALID_ENUMS.categoriaObjecao) {
        const analysis = createValidAnalysis();
        const objecoes = analysis.objecoes as Record<string, unknown>;
        (objecoes.verdadeiras as Array<Record<string, unknown>>)[0].categoria = val;
        const warnings = validateNeurovendasAnalysis(analysis, "crc");
        const enumWarning = warnings.find(w => w.field.startsWith("objecoes.verdadeiras"));
        expect(enumWarning).toBeUndefined();
      }
    });
  });

  describe("enum validation - tecnicaObjecao", () => {
    it("should warn for invalid tecnica tipo", () => {
      const analysis = createValidAnalysis();
      (analysis.tecnicaObjecao as Record<string, unknown>).tipo = "SPIN";
      
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      const enumWarning = warnings.find(w => w.field === "tecnicaObjecao.tipo");
      
      expect(enumWarning).toBeDefined();
      expect(enumWarning!.value).toBe("SPIN");
    });

    it("should accept LAER and redirecionamento", () => {
      for (const val of VALID_ENUMS.tecnicaObjecaoTipo) {
        const analysis = createValidAnalysis();
        (analysis.tecnicaObjecao as Record<string, unknown>).tipo = val;
        const warnings = validateNeurovendasAnalysis(analysis, "consulta");
        const enumWarning = warnings.find(w => w.field === "tecnicaObjecao.tipo");
        expect(enumWarning).toBeUndefined();
      }
    });
  });

  describe("rapport breakdown validation", () => {
    it("should warn for missing breakdown fields", () => {
      const analysis = createValidAnalysis();
      const rapport = analysis.rapport as Record<string, unknown>;
      rapport.breakdown = { validacaoEmocional: 20 }; // Missing other fields
      
      const warnings = validateNeurovendasAnalysis(analysis, "consulta");
      const breakdownWarnings = warnings.filter(w => w.field.startsWith("rapport.breakdown."));
      
      // Should have warnings for the 4 missing fields
      expect(breakdownWarnings.length).toBe(4);
    });
  });

  describe("non-blocking behavior", () => {
    it("should never throw even with completely invalid input", () => {
      expect(() => validateNeurovendasAnalysis(null as unknown as Record<string, unknown>, "consulta")).not.toThrow();
      expect(() => validateNeurovendasAnalysis(undefined as unknown as Record<string, unknown>, "consulta")).not.toThrow();
      expect(() => validateNeurovendasAnalysis("string" as unknown as Record<string, unknown>, "crc")).not.toThrow();
      expect(() => validateNeurovendasAnalysis(42 as unknown as Record<string, unknown>, "crc")).not.toThrow();
    });

    it("should log console.error for unexpected errors without throwing", () => {
      // Pass something that will cause internal errors but should be caught
      validateNeurovendasAnalysis(null as unknown as Record<string, unknown>, "consulta");
      expect(errorSpy).toHaveBeenCalled();
    });

    it("should log warnings with correct prefix for consulta", () => {
      const analysis = {};
      validateNeurovendasAnalysis(analysis, "consulta");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[Neurovendas Consulta]"));
    });

    it("should log warnings with correct prefix for crc", () => {
      const analysis = {};
      validateNeurovendasAnalysis(analysis, "crc");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[Neurovendas CRC]"));
    });
  });

  describe("VALID_ENUMS constants", () => {
    it("should have correct nivelCerebralDominante values", () => {
      expect(VALID_ENUMS.nivelCerebralDominante).toEqual(["neocortex", "limbico", "reptiliano"]);
    });

    it("should have correct motivacaoPrimaria values", () => {
      expect(VALID_ENUMS.motivacaoPrimaria).toEqual(["alivio_dor", "estetica", "status", "saude"]);
    });

    it("should have correct gatilhoMentalNome values", () => {
      expect(VALID_ENUMS.gatilhoMentalNome).toEqual(["transformacao", "saude_longevidade", "status", "conforto", "exclusividade"]);
    });

    it("should have correct categoriaObjecao values", () => {
      expect(VALID_ENUMS.categoriaObjecao).toEqual(["financeira", "medo", "tempo", "confianca", "outra"]);
    });

    it("should have correct tecnicaObjecaoTipo values", () => {
      expect(VALID_ENUMS.tecnicaObjecaoTipo).toEqual(["LAER", "redirecionamento"]);
    });
  });
});
