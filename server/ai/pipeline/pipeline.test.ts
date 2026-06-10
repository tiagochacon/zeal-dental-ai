/**
 * Anti-Hallucination Pipeline Tests
 *
 * Tests the two-stage pipeline orchestrator, extraction stage, and interpretation stage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeAI
vi.mock("../invokeAI", () => ({
  invokeAI: vi.fn(),
}));

// Mock RAG retriever
vi.mock("../../rag/retriever", () => ({
  getRAGContext: vi.fn().mockResolvedValue("Contexto de metodologia DISC e neurovendas."),
}));

import { invokeAI } from "../invokeAI";
import { runSOAPPipeline, runNeurovendasPipeline } from "./index";
import { extractClinicalFacts, extractBehavioralFacts } from "./extractionStage";
import { interpretClinicalFacts, interpretBehavioralFacts } from "./interpretationStage";

const mockedInvokeAI = vi.mocked(invokeAI);

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const SAMPLE_TRANSCRIPT = `Dentista: Bom dia, o que traz você aqui hoje?
Paciente: Estou com uma dor forte no dente de trás, do lado direito. Começou há uns 3 dias.
Dentista: Vamos dar uma olhada. Abra a boca, por favor. Estou vendo uma lesão cariosa no dente 46, face oclusal.
Paciente: Será que precisa de canal?
Dentista: Vamos fazer um teste de vitalidade primeiro. O dente respondeu ao teste térmico, então provavelmente é uma cárie profunda mas ainda vital. Vou indicar uma restauração direta em resina composta.
Paciente: Quanto tempo demora?
Dentista: Cerca de 40 minutos. Vou prescrever ibuprofeno 600mg a cada 8 horas se a dor continuar.`;

const MOCK_CLINICAL_EXTRACTION = {
  queixaPrincipal: {
    texto: "Dor forte no dente de trás, lado direito, há 3 dias",
    citacao: { trecho: "Estou com uma dor forte no dente de trás, do lado direito. Começou há uns 3 dias.", falante: "paciente" },
  },
  historiaDoencaAtual: {
    texto: "Dor iniciou há 3 dias no dente posterior direito",
    citacoes: [{ trecho: "Começou há uns 3 dias", falante: "paciente" }],
  },
  historicoMedico: [],
  medicacoes: [{
    nome: "Ibuprofeno",
    detalhes: "600mg a cada 8 horas",
    citacao: { trecho: "ibuprofeno 600mg a cada 8 horas", falante: "dentista" },
  }],
  achadosClinicos: [{
    achado: "Lesão cariosa face oclusal",
    dente: "46",
    citacao: { trecho: "lesão cariosa no dente 46, face oclusal", falante: "dentista" },
  }],
  dentesReferenciados: [{
    numero: "46",
    contexto: "Cárie profunda, vital ao teste térmico",
    citacao: { trecho: "dente 46, face oclusal", falante: "dentista" },
  }],
  diagnosticosMencionados: [{
    diagnostico: "Cárie profunda",
    confirmado: true,
    citacao: { trecho: "cárie profunda mas ainda vital", falante: "dentista" },
  }],
  tratamentosDiscutidos: [{
    procedimento: "Restauração direta em resina composta",
    dente: "46",
    citacao: { trecho: "restauração direta em resina composta", falante: "dentista" },
  }],
  orientacoesDadas: [],
  sinaisAlerta: [],
  metadados: { totalPalavras: 120, palavrasPaciente: 45, palavrasDentista: 75, qualidadeTranscricao: "media" },
};

const MOCK_BEHAVIORAL_EXTRACTION = {
  falasPaciente: [
    { texto: "Estou com uma dor forte no dente de trás", contexto: "queixa inicial", indicadorComportamental: "busca por alívio" },
    { texto: "Será que precisa de canal?", contexto: "preocupação com procedimento", indicadorComportamental: "medo/ansiedade" },
    { texto: "Quanto tempo demora?", contexto: "pergunta sobre duração", indicadorComportamental: "busca por previsibilidade" },
  ],
  perguntasPaciente: [
    { texto: "Será que precisa de canal?", categoria: "procedimento" },
    { texto: "Quanto tempo demora?", categoria: "tempo" },
  ],
  objecoesPaciente: [],
  expressoesEmocionais: [
    { texto: "dor forte", emocao: "desconforto" },
  ],
  indicadoresRapport: {
    validacoesEmocionais: [],
    espelhamentos: [],
    perguntasAbertas: ["o que traz você aqui hoje?"],
    interrupcoes: [],
  },
  dinamicaConversa: {
    turnosPaciente: 3,
    turnosDentista: 4,
    mediaComprimentoTurnoPaciente: 12,
    mediaComprimentoTurnoDentista: 25,
  },
  metadados: { totalPalavras: 120, palavrasPaciente: 45, palavrasDentista: 75 },
};

const MOCK_SOAP_NOTE = {
  urgency: "medium",
  subjective: {
    queixa_principal: "Dor forte no dente de trás, lado direito, há 3 dias",
    historia_doenca_atual: "Dor iniciou há 3 dias no dente posterior direito",
    historico_medico: [],
    medicacoes: [{ nome: "Ibuprofeno", dose: "600mg", frequencia: "a cada 8 horas" }],
  },
  objective: {
    exame_clinico_geral: "Lesão cariosa no dente 46",
    exame_clinico_especifico: ["Teste de vitalidade positivo"],
    dentes_afetados: ["46"],
    classificacoes_dentes: [{ numero: "46", classificacao: "cavity", notas: "Cárie profunda, vital" }],
  },
  assessment: {
    diagnosticos: ["Cárie profunda dente 46"],
    red_flags: [],
  },
  plan: {
    tratamentos: [{ procedimento: "Restauração direta em resina composta", dente: "46", urgencia: "media", prazo: "Imediato" }],
    orientacoes: [],
    lembretes_clinicos: [],
  },
};

const MOCK_NEUROVENDAS_ANALYSIS = {
  perfilPsicografico: {
    discProfile: {
      perfilPrimario: "estabilidade",
      perfilSecundario: null,
      confianca: 40,
      resumo: "Paciente busca segurança e previsibilidade",
      sinaisDetectados: ["Será que precisa de canal?", "Quanto tempo demora?"],
      motivadores: ["alívio da dor"],
      medosOuResistencias: ["medo de canal"],
      comoComunicar: ["Explicar passo a passo"],
      oQueEvitar: ["Termos técnicos sem explicação"],
      fraseRecomendada: "Vou te explicar cada etapa do procedimento.",
      justificativaTecnica: "Paciente demonstra busca por segurança e previsibilidade.",
    },
    nivelCerebralDominante: "reptiliano",
    motivacaoPrimaria: "alivio_dor",
    nivelAnsiedade: 60,
    nivelReceptividade: 70,
    descricaoPerfil: "Paciente com perfil de estabilidade, busca segurança.",
  },
  objecoes: { verdadeiras: [], ocultas: [] },
  sinaisLinguagem: { positivos: [], negativos: ["dor forte"], palavrasChaveEmocionais: ["dor"] },
  gatilhosMentais: [{ nome: "conforto", justificativa: "Paciente busca alívio", exemploFrase: "Vamos resolver essa dor hoje." }],
  scriptPARE: { problema: "Dor no dente 46", amplificacao: "Pode piorar", resolucao: "Restauração resolve", engajamento: "Podemos fazer hoje?" },
  tecnicaObjecao: { tipo: "LAER", passos: ["Ouvir", "Aceitar", "Explorar", "Responder"] },
  rapport: {
    nivel: 65,
    breakdown: { validacaoEmocional: 50, espelhamentoLinguistico: 60, escutaAtiva: 70, equilibrioTurnos: 75, ausenciaInterrupcoes: 100 },
    justificativa: "Boa escuta ativa, sem interrupções",
    melhoria: "Validar mais as emoções do paciente",
    pontosFortesRelacionamento: ["Sem interrupções"],
    acoesParaMelhorar: ["Validar emoções"],
  },
  resumoExecutivo: "Paciente com perfil de estabilidade, motivado por alívio da dor.",
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("Pipeline Orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runSOAPPipeline", () => {
    it("should complete full two-stage pipeline successfully", async () => {
      // Stage 1: Extraction
      mockedInvokeAI.mockResolvedValueOnce({
        success: true,
        taskType: "soap_extraction",
        invocationId: "ext-1",
        model: "gemini-2.5-flash",
        fallbackUsed: false,
        retries: 0,
        latencyMs: 1200,
        confidence: 0.95,
        response: { choices: [{ message: { content: JSON.stringify(MOCK_CLINICAL_EXTRACTION) } }] },
        warnings: [],
        inferredContent: [],
        createdAt: new Date().toISOString(),
      } as any);

      // Stage 2: Interpretation
      mockedInvokeAI.mockResolvedValueOnce({
        success: true,
        taskType: "soap",
        invocationId: "int-1",
        model: "gemini-2.5-flash",
        fallbackUsed: false,
        retries: 0,
        latencyMs: 1500,
        confidence: 0.9,
        response: { choices: [{ message: { content: JSON.stringify(MOCK_SOAP_NOTE) } }] },
        warnings: [],
        inferredContent: [],
        createdAt: new Date().toISOString(),
      } as any);

      const result = await runSOAPPipeline({
        consultationId: 1,
        transcript: SAMPLE_TRANSCRIPT,
      });

      expect(result).not.toBeNull();
      expect(result!.pipelineUsed).toBe(true);
      expect(result!.extractedFacts).not.toBeNull();
      expect(result!.output).toHaveProperty("urgency");
      expect(result!.output).toHaveProperty("subjective");
      expect(result!.timing.extractionMs).toBeGreaterThanOrEqual(0);
      expect(result!.timing.interpretationMs).toBeGreaterThanOrEqual(0);
      expect(result!.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it("should return null when extraction fails", async () => {
      mockedInvokeAI.mockResolvedValueOnce({
        success: false,
        taskType: "soap_extraction",
        error: "LLM timeout",
      } as any);

      const result = await runSOAPPipeline({
        consultationId: 1,
        transcript: SAMPLE_TRANSCRIPT,
      });

      expect(result).toBeNull();
    });

    it("should return null when interpretation fails after successful extraction", async () => {
      // Stage 1: Success
      mockedInvokeAI.mockResolvedValueOnce({
        success: true,
        taskType: "soap_extraction",
        invocationId: "ext-1",
        model: "gemini-2.5-flash",
        fallbackUsed: false,
        retries: 0,
        latencyMs: 1200,
        confidence: 0.95,
        response: { choices: [{ message: { content: JSON.stringify(MOCK_CLINICAL_EXTRACTION) } }] },
        warnings: [],
        inferredContent: [],
        createdAt: new Date().toISOString(),
      } as any);

      // Stage 2: Failure
      mockedInvokeAI.mockResolvedValueOnce({
        success: false,
        taskType: "soap",
        error: "LLM error",
      } as any);

      const result = await runSOAPPipeline({
        consultationId: 1,
        transcript: SAMPLE_TRANSCRIPT,
      });

      expect(result).toBeNull();
    });
  });

  describe("runNeurovendasPipeline", () => {
    it("should complete full two-stage pipeline successfully", async () => {
      // Stage 1: Extraction
      mockedInvokeAI.mockResolvedValueOnce({
        success: true,
        taskType: "neurovendas_extraction",
        invocationId: "ext-2",
        model: "gemini-2.5-flash",
        fallbackUsed: false,
        retries: 0,
        latencyMs: 1000,
        confidence: 0.9,
        response: { choices: [{ message: { content: JSON.stringify(MOCK_BEHAVIORAL_EXTRACTION) } }] },
        warnings: [],
        inferredContent: [],
        createdAt: new Date().toISOString(),
      } as any);

      // Stage 2: Interpretation
      mockedInvokeAI.mockResolvedValueOnce({
        success: true,
        taskType: "neurovendas_consultation",
        invocationId: "int-2",
        model: "gemini-2.5-flash",
        fallbackUsed: false,
        retries: 0,
        latencyMs: 1800,
        confidence: 0.85,
        response: { choices: [{ message: { content: JSON.stringify(MOCK_NEUROVENDAS_ANALYSIS) } }] },
        warnings: [],
        inferredContent: [],
        createdAt: new Date().toISOString(),
      } as any);

      const result = await runNeurovendasPipeline({
        consultationId: 1,
        transcript: SAMPLE_TRANSCRIPT,
        patientId: 42,
      });

      expect(result).not.toBeNull();
      expect(result!.pipelineUsed).toBe(true);
      expect(result!.extractedFacts).not.toBeNull();
      expect(result!.output).toHaveProperty("perfilPsicografico");
      expect(result!.output).toHaveProperty("rapport");
    });

    it("should return null when extraction fails", async () => {
      mockedInvokeAI.mockResolvedValueOnce({
        success: false,
        taskType: "neurovendas_extraction",
        error: "LLM timeout",
      } as any);

      const result = await runNeurovendasPipeline({
        consultationId: 1,
        transcript: SAMPLE_TRANSCRIPT,
      });

      expect(result).toBeNull();
    });
  });
});

describe("Extraction Stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extractClinicalFacts should parse valid JSON response", async () => {
    mockedInvokeAI.mockResolvedValueOnce({
      success: true,
      taskType: "soap_extraction",
      invocationId: "ext-3",
      model: "gemini-2.5-flash",
      fallbackUsed: false,
      retries: 0,
      latencyMs: 1000,
      confidence: 0.95,
      response: { choices: [{ message: { content: JSON.stringify(MOCK_CLINICAL_EXTRACTION) } }] },
      warnings: [],
      inferredContent: [],
      createdAt: new Date().toISOString(),
    } as any);

    const facts = await extractClinicalFacts(SAMPLE_TRANSCRIPT, 1);

    expect(facts).not.toBeNull();
    expect(facts!.queixaPrincipal).not.toBeNull();
    expect(facts!.queixaPrincipal!.citacao.falante).toBe("paciente");
    expect(facts!.achadosClinicos).toHaveLength(1);
    expect(facts!.dentesReferenciados).toHaveLength(1);
    expect(facts!.metadados.qualidadeTranscricao).toBe("media");
  });

  it("extractBehavioralFacts should parse valid JSON response", async () => {
    mockedInvokeAI.mockResolvedValueOnce({
      success: true,
      taskType: "neurovendas_extraction",
      invocationId: "ext-4",
      model: "gemini-2.5-flash",
      fallbackUsed: false,
      retries: 0,
      latencyMs: 900,
      confidence: 0.9,
      response: { choices: [{ message: { content: JSON.stringify(MOCK_BEHAVIORAL_EXTRACTION) } }] },
      warnings: [],
      inferredContent: [],
      createdAt: new Date().toISOString(),
    } as any);

    const facts = await extractBehavioralFacts(SAMPLE_TRANSCRIPT, 1);

    expect(facts).not.toBeNull();
    expect(facts!.falasPaciente).toHaveLength(3);
    expect(facts!.perguntasPaciente).toHaveLength(2);
    expect(facts!.objecoesPaciente).toHaveLength(0);
    expect(facts!.dinamicaConversa.turnosPaciente).toBe(3);
  });

  it("extractClinicalFacts should return null on invalid JSON", async () => {
    mockedInvokeAI.mockResolvedValueOnce({
      success: true,
      taskType: "soap_extraction",
      invocationId: "ext-5",
      model: "gemini-2.5-flash",
      fallbackUsed: false,
      retries: 0,
      latencyMs: 800,
      confidence: 0.5,
      response: { choices: [{ message: { content: "not valid json {{{" } }] },
      warnings: [],
      inferredContent: [],
      createdAt: new Date().toISOString(),
    } as any);

    const facts = await extractClinicalFacts(SAMPLE_TRANSCRIPT, 1);
    expect(facts).toBeNull();
  });
});

describe("Interpretation Stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("interpretClinicalFacts should produce SOAP note from extracted facts", async () => {
    mockedInvokeAI.mockResolvedValueOnce({
      success: true,
      taskType: "soap",
      invocationId: "int-3",
      model: "gemini-2.5-flash",
      fallbackUsed: false,
      retries: 0,
      latencyMs: 1500,
      confidence: 0.9,
      response: { choices: [{ message: { content: JSON.stringify(MOCK_SOAP_NOTE) } }] },
      warnings: [],
      inferredContent: [],
      createdAt: new Date().toISOString(),
    } as any);

    const result = await interpretClinicalFacts({
      consultationId: 1,
      facts: MOCK_CLINICAL_EXTRACTION as any,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("urgency", "medium");
    expect(result).toHaveProperty("subjective");
    expect(result).toHaveProperty("objective");
    expect(result).toHaveProperty("assessment");
    expect(result).toHaveProperty("plan");
  });

  it("interpretBehavioralFacts should produce neurovendas analysis from extracted facts", async () => {
    mockedInvokeAI.mockResolvedValueOnce({
      success: true,
      taskType: "neurovendas_consultation",
      invocationId: "int-4",
      model: "gemini-2.5-flash",
      fallbackUsed: false,
      retries: 0,
      latencyMs: 1800,
      confidence: 0.85,
      response: { choices: [{ message: { content: JSON.stringify(MOCK_NEUROVENDAS_ANALYSIS) } }] },
      warnings: [],
      inferredContent: [],
      createdAt: new Date().toISOString(),
    } as any);

    const result = await interpretBehavioralFacts({
      consultationId: 1,
      facts: MOCK_BEHAVIORAL_EXTRACTION as any,
      transcript: SAMPLE_TRANSCRIPT,
      patientId: 42,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("perfilPsicografico");
    expect(result).toHaveProperty("rapport");
    expect(result).toHaveProperty("resumoExecutivo");
  });

  it("interpretClinicalFacts should return null on LLM failure", async () => {
    mockedInvokeAI.mockResolvedValueOnce({
      success: false,
      taskType: "soap",
      error: "Rate limit exceeded",
    } as any);

    const result = await interpretClinicalFacts({
      consultationId: 1,
      facts: MOCK_CLINICAL_EXTRACTION as any,
      transcript: SAMPLE_TRANSCRIPT,
    });

    expect(result).toBeNull();
  });
});
