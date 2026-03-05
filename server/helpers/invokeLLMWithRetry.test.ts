import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNeurovendasFallback, countPatientWords } from "./neurovendasFallback";
import { VALID_ENUMS, REQUIRED_TOP_LEVEL_FIELDS, SCRIPT_PARE_FIELDS, RAPPORT_BREAKDOWN_FIELDS, validateNeurovendasAnalysis } from "./validateNeurovendasAnalysis";

describe("Neurovendas Fallback", () => {
  it("should return a valid fallback object with all required fields", () => {
    const fallback = getNeurovendasFallback();
    
    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
      expect(fallback).toHaveProperty(field);
    }
  });

  it("should have valid enum values in fallback", () => {
    const fallback = getNeurovendasFallback();
    const perfil = fallback.perfilPsicografico as any;
    
    expect(VALID_ENUMS.nivelCerebralDominante).toContain(perfil.nivelCerebralDominante);
    expect(VALID_ENUMS.motivacaoPrimaria).toContain(perfil.motivacaoPrimaria);
  });

  it("should have scriptPARE with all required fields", () => {
    const fallback = getNeurovendasFallback();
    const scriptPARE = fallback.scriptPARE as any;
    
    for (const field of SCRIPT_PARE_FIELDS) {
      expect(scriptPARE).toHaveProperty(field);
    }
  });

  it("should have rapport with breakdown fields", () => {
    const fallback = getNeurovendasFallback();
    const rapport = fallback.rapport as any;
    
    expect(rapport).toHaveProperty("nivel");
    expect(rapport).toHaveProperty("breakdown");
    
    for (const field of RAPPORT_BREAKDOWN_FIELDS) {
      expect(rapport.breakdown).toHaveProperty(field);
    }
  });

  it("should have tecnicaObjecao with valid tipo", () => {
    const fallback = getNeurovendasFallback();
    const tecnica = fallback.tecnicaObjecao as any;
    
    expect(VALID_ENUMS.tecnicaObjecaoTipo).toContain(tecnica.tipo);
  });
});

describe("countPatientWords", () => {
  it("should count words from labeled patient lines", () => {
    const transcript = `Dentista: Olá, como vai?
Paciente: Estou bem, obrigado. Vim porque tenho dor no dente.
Dentista: Vamos dar uma olhada.
Paciente: Sim, por favor.`;
    
    const count = countPatientWords(transcript);
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(30);
  });

  it("should estimate 40% for unlabeled transcripts", () => {
    const transcript = "Olá como vai estou bem obrigado vim porque tenho dor no dente vamos dar uma olhada sim por favor";
    const count = countPatientWords(transcript);
    const totalWords = transcript.split(/\s+/).length;
    expect(count).toBe(Math.round(totalWords * 0.4));
  });

  it("should return 0 for empty transcript", () => {
    expect(countPatientWords("")).toBe(0);
  });

  it("should handle CRC/Lead labels for calls", () => {
    const transcript = `CRC: Bom dia, aqui é da clínica.
Lead: Bom dia, recebi uma mensagem.
CRC: Sim, gostaria de agendar uma avaliação.
Lead: Pode ser na próxima semana.`;
    
    // "Lead" is not matched by "paciente" pattern, but falls through to 40% estimate
    const count = countPatientWords(transcript);
    expect(count).toBeGreaterThan(0);
  });
});

describe("validateNeurovendasAnalysis - scriptPARE completude", () => {
  it("should warn when scriptPARE fields are empty", () => {
    const analysis: Record<string, unknown> = {
      perfilPsicografico: {
        nivelCerebralDominante: "limbico",
        motivacaoPrimaria: "saude",
        nivelAnsiedade: 5,
        nivelReceptividade: 7,
        descricaoPerfil: "Paciente com perfil límbico, motivado por saúde.",
      },
      objecoes: { verdadeiras: [], ocultas: [] },
      sinaisLinguagem: { positivos: [], negativos: [], palavrasChaveEmocionais: [] },
      gatilhosMentais: [],
      scriptPARE: {
        problema: "",
        amplificacao: "",
        resolucao: "",
        engajamento: "",
      },
      tecnicaObjecao: { tipo: "LAER", passos: ["passo 1"] },
      rapport: {
        nivel: 50,
        justificativa: "Boa comunicação",
        sugestaoMelhoria: "Melhorar escuta",
        breakdown: {
          validacaoEmocional: 10,
          espelhamentoLinguistico: 10,
          escutaAtiva: 10,
          equilibrioTurnos: 10,
          ausenciaInterrupcoes: 10,
        },
      },
    };

    const warnings = validateNeurovendasAnalysis(analysis, "consulta");
    const scriptWarnings = warnings.filter(w => w.field.startsWith("scriptPARE."));
    expect(scriptWarnings.length).toBe(4); // All 4 fields empty
  });

  it("should not warn when scriptPARE fields are filled", () => {
    const analysis: Record<string, unknown> = {
      perfilPsicografico: {
        nivelCerebralDominante: "limbico",
        motivacaoPrimaria: "saude",
        nivelAnsiedade: 5,
        nivelReceptividade: 7,
        descricaoPerfil: "Paciente com perfil límbico, motivado por saúde e bem-estar.",
      },
      objecoes: { verdadeiras: [], ocultas: [] },
      sinaisLinguagem: { positivos: [], negativos: [], palavrasChaveEmocionais: [] },
      gatilhosMentais: [],
      scriptPARE: {
        problema: "Você mencionou que sente dor ao mastigar.",
        amplificacao: "Sem tratamento, essa dor pode se agravar.",
        resolucao: "Temos um tratamento eficaz para isso.",
        engajamento: "Podemos agendar para esta semana?",
      },
      tecnicaObjecao: { tipo: "LAER", passos: ["Escutar", "Reconhecer", "Explorar", "Responder"] },
      rapport: {
        nivel: 70,
        justificativa: "Boa comunicação bidirecional",
        sugestaoMelhoria: "Mais espelhamento",
        breakdown: {
          validacaoEmocional: 15,
          espelhamentoLinguistico: 12,
          escutaAtiva: 18,
          equilibrioTurnos: 15,
          ausenciaInterrupcoes: 10,
        },
      },
    };

    const warnings = validateNeurovendasAnalysis(analysis, "consulta");
    const scriptWarnings = warnings.filter(w => w.field.startsWith("scriptPARE."));
    expect(scriptWarnings.length).toBe(0);
  });

  it("should warn when tecnicaObjecao.passos is empty array", () => {
    const analysis: Record<string, unknown> = {
      perfilPsicografico: {
        nivelCerebralDominante: "neocortex",
        motivacaoPrimaria: "estetica",
        nivelAnsiedade: 3,
        nivelReceptividade: 8,
        descricaoPerfil: "Paciente racional, motivado por estética dental.",
      },
      objecoes: { verdadeiras: [], ocultas: [] },
      sinaisLinguagem: { positivos: [], negativos: [], palavrasChaveEmocionais: [] },
      gatilhosMentais: [],
      scriptPARE: {
        problema: "Problema identificado",
        amplificacao: "Amplificação do problema",
        resolucao: "Resolução proposta",
        engajamento: "Engajamento final",
      },
      tecnicaObjecao: { tipo: "LAER", passos: [] },
      rapport: {
        nivel: 60,
        justificativa: "Comunicação adequada",
        sugestaoMelhoria: "Mais empatia",
        breakdown: {
          validacaoEmocional: 12,
          espelhamentoLinguistico: 12,
          escutaAtiva: 12,
          equilibrioTurnos: 12,
          ausenciaInterrupcoes: 12,
        },
      },
    };

    const warnings = validateNeurovendasAnalysis(analysis, "crc");
    const passosWarnings = warnings.filter(w => w.field === "tecnicaObjecao.passos");
    expect(passosWarnings.length).toBe(1);
  });

  it("should warn when rapport.breakdown is missing", () => {
    const analysis: Record<string, unknown> = {
      perfilPsicografico: {
        nivelCerebralDominante: "reptiliano",
        motivacaoPrimaria: "alivio_dor",
        nivelAnsiedade: 8,
        nivelReceptividade: 4,
        descricaoPerfil: "Paciente com alto nível de ansiedade, focado em alívio de dor.",
      },
      objecoes: { verdadeiras: [], ocultas: [] },
      sinaisLinguagem: { positivos: [], negativos: [], palavrasChaveEmocionais: [] },
      gatilhosMentais: [],
      scriptPARE: {
        problema: "Problema",
        amplificacao: "Amplificação",
        resolucao: "Resolução",
        engajamento: "Engajamento",
      },
      tecnicaObjecao: { tipo: "LAER", passos: ["passo 1"] },
      rapport: {
        nivel: 30,
        justificativa: "Baixo rapport",
        sugestaoMelhoria: "Melhorar tudo",
      },
    };

    const warnings = validateNeurovendasAnalysis(analysis, "consulta");
    const breakdownWarnings = warnings.filter(w => w.field === "rapport.breakdown");
    expect(breakdownWarnings.length).toBe(1);
  });
});
